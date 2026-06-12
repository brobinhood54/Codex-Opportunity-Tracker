import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  accountProfiles,
  callTranscripts,
  contextSources,
  opportunities,
  researchBriefs,
} from "../../../db/schema";

type ContextSourceInsert = typeof contextSources.$inferInsert;

const SOURCE_TYPES = ["manual", "gmail", "slack", "transcript", "file"] as const;
const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  const combined = `${message}\n${detail}`;

  if (combined.includes("no such table")) {
    return "Account context tables are unavailable. Generate and deploy the latest D1 migration.";
  }

  return message;
}

function cleanText(value: unknown, fallback = "", maxLength = 2000) {
  return String(value ?? fallback)
    .trim()
    .slice(0, maxLength);
}

function cleanAccountName(value: unknown) {
  return cleanText(value, "", 160);
}

function normalizeDate(value: unknown) {
  const text = cleanText(value, "", 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashDate) {
    const year =
      slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3];
    return `${year}-${slashDate[1].padStart(2, "0")}-${slashDate[2].padStart(
      2,
      "0"
    )}`;
  }

  const namedDate = text.match(
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\b/
  );
  if (namedDate) {
    const month = MONTHS[namedDate[1].toLowerCase()];
    if (month) {
      return `${namedDate[3]}-${month}-${namedDate[2].padStart(2, "0")}`;
    }
  }

  return "";
}

function normalizeSourceType(value: unknown) {
  const sourceType = cleanText(value, "manual", 40);
  return SOURCE_TYPES.includes(sourceType as (typeof SOURCE_TYPES)[number])
    ? sourceType
    : "manual";
}

function tryJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stripExtension(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^call[-_\s]*transcript[-_\s]*/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function firstSentences(text: string, limit = 2) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, limit);
  return sentences.join(" ").slice(0, 520);
}

function detectDate(text: string) {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const slash = text.match(/\b(\d{1,2}\/\d{1,2}\/(?:20)?\d{2})\b/);
  if (slash) return normalizeDate(slash[1]);

  const named = text.match(
    /\b(?:recorded on\s+)?([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+20\d{2})\b/i
  );
  if (named) return normalizeDate(named[1]);

  return "";
}

function dedupePeople(names: string[]) {
  const unique = Array.from(
    new Set(names.map((name) => name.trim()).filter(Boolean))
  );
  return unique.filter((name) => {
    const normalized = name.toLowerCase();
    return !unique.some((other) => {
      const otherNormalized = other.toLowerCase();
      return (
        otherNormalized !== normalized &&
        otherNormalized.startsWith(`${normalized} `)
      );
    });
  });
}

function detectCustomerNames(text: string) {
  const participantsBlock =
    text.match(/(?:^|\n)\s*participants\s*\n([\s\S]*?)(?:\n\s*transcript\b|$)/i)
      ?.[1] ?? "";
  const names: string[] = [];
  let sectionIndex = -1;

  for (const rawLine of participantsBlock.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!line.includes(",")) {
      sectionIndex += 1;
      continue;
    }

    if (sectionIndex > 0) {
      names.push(line.split(",")[0].trim());
    }
  }

  return dedupePeople(names);
}

function speakerMatchesPerson(speaker: string, person: string) {
  const normalizedSpeaker = speaker.toLowerCase();
  const normalizedPerson = person.toLowerCase();
  return (
    normalizedPerson === normalizedSpeaker ||
    normalizedPerson.startsWith(`${normalizedSpeaker} `) ||
    normalizedSpeaker.startsWith(`${normalizedPerson} `)
  );
}

function detectAttendees(text: string) {
  const ignoredNames = new Set(["attendees", "participants", "speakers"]);
  const attendeesLine = text.match(
    /(?:attendees|participants|speakers)\s*:\s*(.+)/i
  );
  const fromLine =
    attendeesLine?.[1]
      ?.split(/,|;|\band\b/i)
      .map((item) => item.trim())
      .filter(Boolean) ?? [];

  const speakerNames = Array.from(
    new Set(
      text
        .split("\n")
        .map((line) => line.match(/^\s*([A-Z][A-Za-z .'-]{1,48}):/))
        .map((match) => match?.[1]?.trim())
        .filter(
          (name): name is string =>
            Boolean(name) && !ignoredNames.has(name.toLowerCase())
        )
    )
  );

  const timestampSpeakers = text
    .split("\n")
    .map((line) =>
      line.match(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*\|\s*([A-Z][A-Za-z .'-]{1,48})\s*$/)
    )
    .map((match) => match?.[1]?.trim())
    .filter((name): name is string => Boolean(name));

  const participantsBlock =
    text.match(/(?:^|\n)\s*participants\s*\n([\s\S]*?)(?:\n\s*transcript\b|$)/i)
      ?.[1] ?? "";
  const participantNames = participantsBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(","))
    .map((line) => line.split(",")[0].trim())
    .filter((name) => /^[A-Z][A-Za-z .'-]{1,60}$/.test(name));

  return dedupePeople([
    ...fromLine,
    ...participantNames,
    ...speakerNames,
    ...timestampSpeakers,
  ]).slice(0, 16);
}

function isNoisyQuestion(question: string) {
  const normalized = question.toLowerCase();
  return [
    "are we ready to rock",
    "background here real quick",
    "call recorded",
    "camera",
    "customer?",
    "flight back",
    "happy monday",
    "made it back",
    "put it on",
    "seventeenth",
    "teams meeting",
    "the news or not",
    "time of day",
    "the option to use teams",
    "what's going on",
    "way back",
  ].some((phrase) => normalized.includes(phrase));
}

function extractSpeakerTurns(text: string) {
  const turns: { speaker: string; text: string }[] = [];
  let currentSpeaker = "";
  let currentText: string[] = [];

  function pushTurn() {
    if (currentSpeaker && currentText.length) {
      turns.push({
        speaker: currentSpeaker,
        text: currentText.join(" ").replace(/\s+/g, " ").trim(),
      });
    }
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const timestampSpeaker = line.match(
      /^\d{1,2}:\d{2}(?::\d{2})?\s*\|\s*([A-Z][A-Za-z .'-]{1,48})\s*$/
    );
    const colonSpeaker = line.match(/^([A-Z][A-Za-z .'-]{1,48}):\s*(.+)$/);

    if (timestampSpeaker) {
      pushTurn();
      currentSpeaker = timestampSpeaker[1].trim();
      currentText = [];
      continue;
    }

    if (colonSpeaker) {
      pushTurn();
      currentSpeaker = colonSpeaker[1].trim();
      currentText = [colonSpeaker[2].trim()];
      continue;
    }

    if (currentSpeaker) {
      currentText.push(line);
    }
  }

  pushTurn();
  return turns;
}

function questionFragments(text: string) {
  return text
    .split(/(?<=\?)\s+/)
    .map((question) => question.replace(/\s+/g, " ").trim())
    .filter(
      (question) =>
        question.endsWith("?") &&
        question.length >= 18 &&
        !isNoisyQuestion(question) &&
        !/^(attendees|participants|speakers)\s*:/i.test(question)
    );
}

function detectQuestions(text: string) {
  const customerNames = detectCustomerNames(text);
  const turns = extractSpeakerTurns(text);
  const customerQuestions = customerNames.length
    ? turns
        .filter((turn) =>
          customerNames.some((person) =>
            speakerMatchesPerson(turn.speaker, person)
          )
        )
        .flatMap((turn) => questionFragments(turn.text))
    : [];

  const questions = customerQuestions.length
    ? customerQuestions
    : text
        .split(/\n+/)
        .flatMap((line) =>
          questionFragments(
            line
              .replace(
                /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*\|\s*([A-Z][A-Za-z .'-]{1,48})\s*/,
                ""
              )
              .replace(/^\s*([A-Z][A-Za-z .'-]{1,48}):\s*/, "")
          )
        );

  return Array.from(new Set(questions))
    .slice(0, 12)
    .map((question) => ({
      question,
      status: "open",
    }));
}

function detectSignals(text: string) {
  const normalized = text.toLowerCase();
  const checks = [
    {
      label: "Budget pressure",
      keywords: ["budget", "pricing", "discount", "procurement"],
      tone: "risk",
    },
    {
      label: "Security review",
      keywords: ["security", "compliance", "risk", "legal"],
      tone: "risk",
    },
    {
      label: "Champion activity",
      keywords: ["champion", "sponsor", "executive", "vp", "ciso"],
      tone: "positive",
    },
    {
      label: "Competitor mention",
      keywords: ["competitor", "alternative", "vendor", "evaluation"],
      tone: "watch",
    },
    {
      label: "Next step",
      keywords: ["next step", "follow up", "schedule", "send", "share"],
      tone: "action",
    },
  ];

  return checks
    .filter((check) =>
      check.keywords.some((keyword) => normalized.includes(keyword))
    )
    .map((check) => ({
      label: check.label,
      tone: check.tone,
    }));
}

function parseTranscript(payload: {
  title: string;
  fileName: string;
  callDate: string;
  transcript: string;
}) {
  const title =
    cleanText(payload.title, "", 180) ||
    stripExtension(payload.fileName) ||
    "Call transcript";
  const callDate =
    normalizeDate(payload.callDate) ||
    detectDate(`${payload.title} ${payload.fileName} ${payload.transcript}`);
  const attendees = detectAttendees(payload.transcript);
  const questions = detectQuestions(payload.transcript);
  const signals = detectSignals(payload.transcript);
  const summary =
    firstSentences(payload.transcript) ||
    "Transcript imported. Add notes or reprocess after more context is available.";

  return { title, callDate, attendees, questions, signals, summary };
}

async function ensureProfile(accountName: string) {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(accountProfiles)
    .where(eq(accountProfiles.accountName, accountName))
    .limit(1);

  if (profile) return profile;

  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.accountName, accountName))
    .limit(1);

  const [created] = await db
    .insert(accountProfiles)
    .values({
      accountName,
      industry: opportunity?.industry || "Unknown",
      accountWebsite: opportunity?.accountWebsite ?? "",
      salesforceAccountId: opportunity?.salesforceAccountId ?? "",
      health: opportunity?.riskLevel === "High" ? "At Risk" : "Active",
      score: opportunity?.progress ?? 35,
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return created;
}

async function readAccount(accountName: string) {
  const db = getDb();
  const profile = await ensureProfile(accountName);
  const [openOpportunities, sources, transcripts, briefs] = await Promise.all([
    db
      .select()
      .from(opportunities)
      .where(eq(opportunities.accountName, accountName))
      .orderBy(desc(opportunities.updatedAt), desc(opportunities.id)),
    db
      .select()
      .from(contextSources)
      .where(eq(contextSources.accountName, accountName))
      .orderBy(desc(contextSources.createdAt), desc(contextSources.id)),
    db
      .select()
      .from(callTranscripts)
      .where(eq(callTranscripts.accountName, accountName))
      .orderBy(desc(callTranscripts.callDate), desc(callTranscripts.id)),
    db
      .select()
      .from(researchBriefs)
      .where(eq(researchBriefs.accountName, accountName))
      .orderBy(desc(researchBriefs.updatedAt), desc(researchBriefs.id)),
  ]);

  return {
    profile,
    opportunities: openOpportunities,
    sources,
    transcripts: transcripts.map((transcript) => ({
      ...transcript,
      attendees: tryJsonArray(transcript.attendeesJson),
      questions: tryJsonArray(transcript.questionsJson),
      signals: tryJsonArray(transcript.signalsJson),
    })),
    researchBriefs: briefs.map((brief) => ({
      ...brief,
      sources: tryJsonArray(brief.sourcesJson),
    })),
  };
}

export async function GET(request: Request) {
  try {
    const accountName = cleanAccountName(
      new URL(request.url).searchParams.get("accountName")
    );

    if (!accountName) {
      return Response.json(
        { error: "accountName is required." },
        { status: 400 }
      );
    }

    return Response.json({ account: await readAccount(accountName) });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = cleanText(payload.action, "", 40);
    const accountName = cleanAccountName(payload.accountName);

    if (!accountName) {
      return Response.json(
        { error: "accountName is required." },
        { status: 400 }
      );
    }

    await ensureProfile(accountName);

    if (action === "source") {
      const source: ContextSourceInsert = {
        accountName,
        sourceType: normalizeSourceType(payload.sourceType),
        title: cleanText(payload.title, "Manual context", 180),
        summary: cleanText(payload.summary, "", 1200),
        sourceDate: normalizeDate(payload.sourceDate),
      };
      await getDb().insert(contextSources).values(source);
      return Response.json({ account: await readAccount(accountName) });
    }

    if (action === "transcript") {
      const transcriptText = cleanText(payload.transcript, "", 120000);
      if (!transcriptText) {
        return Response.json(
          { error: "Transcript text is required." },
          { status: 400 }
        );
      }

      const parsed = parseTranscript({
        title: cleanText(payload.title, "", 180),
        fileName: cleanText(payload.fileName, "", 220),
        callDate: cleanText(payload.callDate, "", 40),
        transcript: transcriptText,
      });

      const db = getDb();
      const [duplicate] = await db
        .select()
        .from(callTranscripts)
        .where(
          and(
            eq(callTranscripts.accountName, accountName),
            eq(callTranscripts.title, parsed.title),
            eq(callTranscripts.callDate, parsed.callDate)
          )
        )
        .limit(1);

      if (duplicate) {
        return Response.json({
          account: await readAccount(accountName),
          skipped: true,
        });
      }

      await db.insert(callTranscripts).values({
        accountName,
        title: parsed.title,
        callDate: parsed.callDate,
        attendeesJson: JSON.stringify(parsed.attendees),
        transcript: transcriptText,
        summary: parsed.summary,
        questionsJson: JSON.stringify(parsed.questions),
        signalsJson: JSON.stringify(parsed.signals),
      });
      await db.insert(contextSources).values({
        accountName,
        sourceType: "transcript",
        title: parsed.title,
        summary: parsed.summary,
        sourceDate: parsed.callDate,
      });

      return Response.json({ account: await readAccount(accountName) });
    }

    if (action === "research") {
      await getDb().insert(researchBriefs).values({
        accountName,
        title: cleanText(payload.title, "Deep account research", 180),
        status: "queued",
        summary: cleanText(payload.summary, "", 1200),
        updatedAt: new Date().toISOString(),
      });
      return Response.json({ account: await readAccount(accountName) });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
