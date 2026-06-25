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
type AccountProfileRow = typeof accountProfiles.$inferSelect;
type OpportunityRow = typeof opportunities.$inferSelect;

type AccountSummary = AccountProfileRow & {
  latestStage: string;
  lastActivityDate: string;
  nextStep: string;
  openOpportunityCount: number;
  sourceCount: number;
  totalPipeline: number;
  transcriptCount: number;
  weightedPipeline: number;
};

type SpeakerTurn = { speaker: string; text: string; time?: string };

type PersonInsight = {
  name: string;
  title: string;
  company: string;
  side: "customer" | "oasis" | "unknown";
  role: string;
  influence: "High" | "Medium" | "Low";
  mentionCount: number;
  questionCount: number;
};

type DealQuestion = {
  question: string;
  status: "open" | "answered" | "deferred" | "action";
  owner: "Oasis" | "Customer" | "Mutual";
  kind: "customer_question" | "oasis_question" | "oasis_action" | "customer_action";
  askedBy: string;
  answeredBy: string;
  answer: string;
  action: string;
  priority: "High" | "Medium" | "Low";
  time: string;
};

type DealSignal = {
  label: string;
  tone: "risk" | "positive" | "watch" | "action";
  category: "Pain" | "Fit" | "Risk" | "Decision" | "Momentum";
  summary: string;
  evidence: string;
  confidence: "High" | "Medium";
};

const SOURCE_TYPES = ["manual", "gmail", "slack", "transcript", "file"] as const;
const RESEARCH_STATUSES = ["queued", "complete", "stale"] as const;
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

function normalizeResearchStatus(value: unknown) {
  const status = cleanText(value, "queued", 40);
  return RESEARCH_STATUSES.includes(
    status as (typeof RESEARCH_STATUSES)[number]
  )
    ? status
    : "queued";
}

function normalizeResearchSources(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((source) => {
        if (!source || typeof source !== "object") return null;
        const record = source as Record<string, unknown>;
        const title = cleanText(record.title, "", 180);
        const url = cleanText(record.url, "", 600);
        return title || url ? { title, url } : null;
      })
      .filter(Boolean);
  }

  return [];
}

function tryJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function maxDateString(...values: string[]) {
  return values
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] ?? "";
}

function profileFromAccountName(accountName: string): AccountProfileRow {
  const timestamp = new Date().toISOString();
  return {
    id: 0,
    accountName,
    industry: "Unknown",
    segment: "Prospect",
    health: "Prospect",
    score: 0,
    notes: "",
    salesforceAccountId: "",
    accountWebsite: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function profileFromOpportunity(opportunity: OpportunityRow): AccountProfileRow {
  return {
    id: 0,
    accountName: opportunity.accountName,
    industry: opportunity.industry || "Unknown",
    segment: "Prospect",
    health: opportunity.riskLevel === "High" ? "At Risk" : "Active",
    score: opportunity.progress,
    notes: "",
    salesforceAccountId: opportunity.salesforceAccountId,
    accountWebsite: opportunity.accountWebsite,
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
  };
}

function initAccountSummary(profile: AccountProfileRow): AccountSummary {
  return {
    ...profile,
    latestStage: "",
    lastActivityDate: "",
    nextStep: "",
    openOpportunityCount: 0,
    sourceCount: 0,
    totalPipeline: 0,
    transcriptCount: 0,
    weightedPipeline: 0,
  };
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

function cleanPersonName(value: string) {
  return value
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferSide(
  text: string,
  sectionIndex = -1,
  allowCustomerFallback = false
): PersonInsight["side"] {
  const normalized = text.toLowerCase();
  if (/\boasis\b|brendan|adam fisher|sales engineer|account executive/.test(normalized)) {
    return "oasis";
  }
  if (sectionIndex > 0 || allowCustomerFallback) return "customer";
  return "unknown";
}

function inferRole(title: string, speakerText: string) {
  const text = `${title} ${speakerText}`.toLowerCase();
  if (/procurement|legal|contract|vendor assessment|sourcing/.test(text)) {
    return "Procurement / Legal";
  }
  if (/\bciso\b|\bcio\b|\bcto\b|chief|vp|vice president|executive|budget|sign/.test(text)) {
    return "Executive / Economic Buyer";
  }
  if (/director|head of|owner|sponsor|champion|priority|we need|we want/.test(text)) {
    return "Champion / Sponsor";
  }
  if (/security|identity|iam|iga|engineer|architect|technical|it |cyber|devops|cloud/.test(text)) {
    return "Technical Evaluator";
  }
  if (/user|admin|operator|analyst/.test(text)) {
    return "User / Operator";
  }
  return "Unclassified";
}

function inferInfluence(role: string, questionCount: number): PersonInsight["influence"] {
  if (/Executive|Economic|Champion|Sponsor/.test(role)) return "High";
  if (questionCount >= 2 || /Technical|Procurement/.test(role)) return "Medium";
  return "Low";
}

function parseParticipantPeople(text: string) {
  const participantsBlock =
    text.match(/(?:^|\n)\s*participants\s*\n([\s\S]*?)(?:\n\s*transcript\b|$)/i)
      ?.[1] ?? "";
  const people: PersonInsight[] = [];
  let sectionIndex = -1;
  let sectionLabel = "";

  for (const rawLine of participantsBlock.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const dashParts = line.split(/\s+[–-]\s+/).map((item) => item.trim());
    if (dashParts.length >= 2) {
      const [rawName, ...rest] = dashParts;
      const name = cleanPersonName(rawName);
      if (!/^[A-Z][A-Za-z .'-]{1,60}$/.test(name)) continue;

      const company = rest.length > 1 ? rest[rest.length - 1] : sectionLabel;
      const title = (rest.length > 1 ? rest.slice(0, -1) : rest).join(" - ").slice(0, 160);
      people.push({
        name,
        title,
        company,
        side: inferSide(`${company} ${title} ${name}`, sectionIndex, true),
        role: inferRole(title, ""),
        influence: "Low",
        mentionCount: 0,
        questionCount: 0,
      });
      continue;
    }

    if (!line.includes(",")) {
      sectionIndex += 1;
      sectionLabel = line;
      continue;
    }

    const [rawName, ...rest] = line.split(",").map((item) => item.trim());
    const name = cleanPersonName(rawName);
    if (!/^[A-Z][A-Za-z .'-]{1,60}$/.test(name)) continue;

    const title = rest.join(", ").slice(0, 160);
    people.push({
      name,
      title,
      company: sectionLabel,
      side: inferSide(`${sectionLabel} ${title} ${name}`, sectionIndex, true),
      role: inferRole(title, ""),
      influence: "Low",
      mentionCount: 0,
      questionCount: 0,
    });
  }

  return people;
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

function mergePeople(people: PersonInsight[]) {
  const merged: PersonInsight[] = [];

  for (const person of people) {
    const existing = merged.find((candidate) =>
      speakerMatchesPerson(candidate.name, person.name)
    );

    if (!existing) {
      merged.push(person);
      continue;
    }

    if (person.name.length > existing.name.length) existing.name = person.name;
    if (!existing.title && person.title) existing.title = person.title;
    if (!existing.company && person.company) existing.company = person.company;
    if (existing.side === "unknown" && person.side !== "unknown") {
      existing.side = person.side;
    }
    existing.mentionCount += person.mentionCount;
    existing.questionCount += person.questionCount;
    existing.role =
      existing.role === "Unclassified" ? person.role : existing.role;
  }

  return merged.map((person) => {
    const role = inferRole(person.title, "");
    const finalRole = person.role === "Unclassified" ? role : person.role;
    return {
      ...person,
      role: finalRole,
      influence: inferInfluence(finalRole, person.questionCount),
    };
  });
}

function detectAttendees(text: string, turns = extractSpeakerTurns(text)) {
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

  const participantPeople = parseParticipantPeople(text);
  const participantNames = participantPeople.map((person) => person.name);
  const allNames = dedupePeople([
    ...fromLine.map(cleanPersonName),
    ...participantNames,
    ...speakerNames.map(cleanPersonName),
    ...timestampSpeakers.map(cleanPersonName),
  ]).slice(0, 24);

  const people = allNames.map((name) => {
    const participant = participantPeople.find((person) =>
      speakerMatchesPerson(person.name, name)
    );
    const speakerTurns = turns.filter((turn) => speakerMatchesPerson(turn.speaker, name));
    const speakerText = speakerTurns.map((turn) => turn.text).join(" ");
    const questionCount = speakerTurns.flatMap((turn) =>
      questionFragments(turn.text, false)
    ).length;
    const role = inferRole(participant?.title ?? "", speakerText);

    return {
      name,
      title: participant?.title ?? "",
      company: participant?.company ?? "",
      side:
        participant?.side ??
        inferSide(`${participant?.company ?? ""} ${participant?.title ?? ""} ${name}`),
      role,
      influence: inferInfluence(role, questionCount),
      mentionCount: speakerTurns.length,
      questionCount,
    };
  });

  return mergePeople(people).sort((a, b) => {
    const sideDelta =
      Number(a.side === "customer") - Number(b.side === "customer");
    if (sideDelta) return -sideDelta;
    return b.mentionCount + b.questionCount - (a.mentionCount + a.questionCount);
  });
}

function isNoisyQuestion(question: string) {
  const normalized = question
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  const attendanceOrSetupChatter =
    /\b(join|joining|attend|attending|dial|camera|audio|hear|recorded|recording|teams|zoom|screen|share|slides)\b/.test(
      normalized
    ) &&
    /\b(today|call|meeting|audio|camera|teams|zoom|joining|attend|attending|hear|see|screen|slides)\b/.test(
      normalized
    );
  const tagQuestion =
    /\b(right|correct|ok|okay|cool|fair|make sense|sound good|yeah|yep)\?$/.test(
      normalized
    );
  const noShowQuestion =
    /\b(won't|will not|isn't|is not|can't|cannot)\s+(be\s+)?(join|joining|attend|attending|make)\b/.test(
      normalized
    );
  const lowValuePrompt =
    (/\b(any questions|questions so far|anything else|does that make sense|is that helpful|are we good|ready to rock|can you hear|see my screen|everyone here|who else is joining)\b/.test(
      normalized
    ) ||
      /\bwhat else\b/.test(normalized)) &&
    !isDealRelevantQuestion(normalized);
  const weakPronounOnly =
    /^(is|are|does|do|did|was|were|would|could|can)\s+(it|this|that|these|those|things|stuff)\b/.test(
      normalized
    ) && !isDealRelevantQuestion(normalized);

  return (
    attendanceOrSetupChatter ||
    tagQuestion ||
    noShowQuestion ||
    lowValuePrompt ||
    weakPronounOnly ||
    [
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
      "can you hear",
      "does that make sense",
      "is that right",
      "sound good",
      "any questions",
      "cool?",
      "right?",
      "is everyone",
      "who's on",
    ].some((phrase) => normalized.includes(phrase))
  );
}

function isDealRelevantQuestion(question: string) {
  const normalized = question.toLowerCase();
  const dealProcess =
    /success criteria|criteria|scorecard|evaluation|decision criteria|poc|proof|pilot|timeline|close|decision|approval|procurement|legal|contract|budget|pricing|commercial|renewal|security review|vendor assessment|risk|compliance|requirements?|next step|follow up|scope|success metric|business case|roi|value|priority|blocker|blocked/.test(
      normalized
    );
  const technicalFit =
    /integrat|api|sso|scim|okta|azure|service now|servicenow|cyberark|hashicorp|vault|deployment|install|sandbox|production|architecture|data|access|permission|owner|secrets?|credential|rotation|remediation|resolve|dismiss|flagged|mcp|\bai\b|genai|agentic|model/.test(
      normalized
    );
  const buyingCommittee =
    /stakeholder|champion|executive|economic buyer|ciso|cio|cto|security team|identity team|procurement team/.test(
      normalized
    );

  return dealProcess || technicalFit || buyingCommittee;
}

function isHighSignalCustomerQuestion(question: string) {
  const normalized = question.toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const startsAsRealAsk =
    /^(can|could|would|do|does|did|is|are|will|should|how|what|when|who|where|why)\b/.test(
      normalized
    );
  const customerAsk =
    startsAsRealAsk ||
    /\b(i|we)\b.{0,90}\b(want|need|have to|would like|are trying|trying to|don't know|do not know|need to know|have a question)\b/.test(
      normalized
    );
  const hasSubstance =
    /success criteria|criteria|scorecard|evaluation|poc|proof|pilot|vendor assessment|decision|approval|procurement|legal|contract|budget|pricing|timeline|security|compliance|risk|requirements?|integrat|api|sso|scim|okta|azure|service now|servicenow|cyberark|hashicorp|vault|deployment|sandbox|production|architecture|data|access|permission|owner|secrets?|credential|rotation|remediation|resolve|dismiss|flagged|business case|roi|value|scope|next demo|next call|next step|mcp|\bai\b|genai|agentic|model/.test(
      normalized
    );

  return (
    wordCount >= 6 &&
    wordCount <= 70 &&
    customerAsk &&
    hasSubstance &&
    isDealRelevantQuestion(normalized)
  );
}

function priorityForText(text: string): DealQuestion["priority"] {
  const normalized = text.toLowerCase();
  if (/success criteria|decision|approval|procurement|legal|contract|budget|pricing|security review|timeline|close|blocked|risk/.test(normalized)) {
    return "High";
  }
  if (/poc|pilot|integrat|deployment|requirements?|follow up|next step|sandbox|production/.test(normalized)) {
    return "Medium";
  }
  return "Low";
}

function extractSpeakerTurns(text: string) {
  const turns: SpeakerTurn[] = [];
  let currentSpeaker = "";
  let currentTime = "";
  let currentText: string[] = [];

  function pushTurn() {
    if (currentSpeaker && currentText.length) {
      turns.push({
        speaker: currentSpeaker,
        text: currentText.join(" ").replace(/\s+/g, " ").trim(),
        time: currentTime,
      });
    }
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const timestampSpeaker = line.match(
      /^(\d{1,2}:\d{2}(?::\d{2})?)\s*\|\s*([A-Z][A-Za-z .'-]{1,48})\s*$/
    );
    const colonSpeaker = line.match(/^([A-Z][A-Za-z .'-]{1,48}):\s*(.+)$/);

    if (timestampSpeaker) {
      pushTurn();
      currentTime = timestampSpeaker[1].trim();
      currentSpeaker = timestampSpeaker[2].trim();
      currentText = [];
      continue;
    }

    if (colonSpeaker) {
      pushTurn();
      currentTime = "";
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

function questionFragments(text: string, dealRelevantOnly = true) {
  return text
    .split(/(?<=\?)\s+/)
    .map((question) => question.replace(/\s+/g, " ").trim())
    .filter(
      (question) =>
        question.endsWith("?") &&
        question.length >= 18 &&
        !isNoisyQuestion(question) &&
        !/^(attendees|participants|speakers)\s*:/i.test(question) &&
        (!dealRelevantOnly || isDealRelevantQuestion(question))
    );
}

function ownerForQuestion(side: PersonInsight["side"]): DealQuestion["owner"] {
  if (side === "customer") return "Oasis";
  if (side === "oasis") return "Customer";
  return "Mutual";
}

function sideForSpeaker(attendees: PersonInsight[], speaker: string) {
  return attendees.find((attendee) =>
    speakerMatchesPerson(attendee.name, speaker)
  )?.side ?? "unknown";
}

function answerSentenceForQuestion(text: string, question: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 28 && !sentence.endsWith("?"));
  const needsConcreteFollowUp =
    /success criteria|scorecard|evaluation|approval|procurement|legal|contract|budget|pricing|security review|timeline|close/.test(
      question.toLowerCase()
    );
  const deferred = sentences.find(isDeferredAnswer);

  if (needsConcreteFollowUp && deferred) return deferred.slice(0, 340);

  const questionTokens = importantQuestionTokens(question);
  const scored = sentences
    .map((sentence, index) => ({
      sentence,
      score: answerRelevanceScore(sentence, question, questionTokens),
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return (scored[0]?.sentence ?? "").slice(0, 340);
}

function isDeferredAnswer(text: string) {
  return /follow up|get back|circle back|take away|take offline|check on|not sure|don't know|do not know|need to verify|need to check|need to confirm|will confirm|confirm with|next call|next meeting|next check-in|working session/i.test(
    text
  );
}

function importantQuestionTokens(text: string) {
  const stopWords = new Set([
    "about",
    "after",
    "also",
    "anything",
    "areas",
    "before",
    "being",
    "besides",
    "could",
    "does",
    "have",
    "into",
    "just",
    "know",
    "like",
    "more",
    "some",
    "something",
    "that",
    "their",
    "there",
    "these",
    "thing",
    "things",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
    "you",
    "your",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/s$/, ""))
    .filter((token) => token.length >= 4 && !stopWords.has(token));
}

function answerRelevanceScore(
  sentence: string,
  question: string,
  questionTokens: string[]
) {
  const normalizedSentence = sentence.toLowerCase();
  const normalizedQuestion = question.toLowerCase();
  const domainTerms = [
    "azure",
    "cyberark",
    "hashicorp",
    "okta",
    "sandbox",
    "scorecard",
    "servicenow",
    "service now",
    "success criteria",
    "vault",
  ];
  let score = 0;

  for (const term of domainTerms) {
    if (normalizedQuestion.includes(term) && normalizedSentence.includes(term)) {
      score += 8;
    }
  }

  for (const token of questionTokens) {
    if (normalizedSentence.includes(token)) score += 1;
  }

  return score;
}

function answerForQuestion(
  turns: SpeakerTurn[],
  startIndex: number,
  attendees: PersonInsight[],
  askerSide: PersonInsight["side"],
  question: string
): Pick<DealQuestion, "answer" | "answeredBy" | "status"> {
  const expectedOwner = ownerForQuestion(askerSide);

  for (const turn of turns.slice(startIndex + 1, startIndex + 5)) {
    const responseSide = sideForSpeaker(attendees, turn.speaker);
    if (askerSide !== "unknown" && responseSide === askerSide) continue;
    if (expectedOwner === "Oasis" && responseSide === "customer") continue;
    if (expectedOwner === "Customer" && responseSide === "oasis") continue;

    const answer = answerSentenceForQuestion(turn.text, question);
    if (!answer) continue;

    return {
      answer,
      answeredBy: turn.speaker,
      status: isDeferredAnswer(answer) ? "deferred" : "answered",
    };
  }

  return { answer: "", answeredBy: "", status: "open" };
}

function detectQuestions(
  text: string,
  attendees: PersonInsight[],
  turns = extractSpeakerTurns(text)
) {
  const questions: DealQuestion[] = [];

  for (const [index, turn] of turns.entries()) {
    const person = attendees.find((attendee) =>
      speakerMatchesPerson(attendee.name, turn.speaker)
    );
    const side = person?.side ?? "unknown";

    for (const question of questionFragments(turn.text)) {
      if (side !== "customer") continue;
      if (!isHighSignalCustomerQuestion(question)) continue;

      const owner = ownerForQuestion(side);
      const answer = answerForQuestion(turns, index, attendees, side, question);
      questions.push({
        question,
        status: answer.status,
        owner,
        kind: side === "oasis" ? "oasis_question" : "customer_question",
        askedBy: turn.speaker,
        answeredBy: answer.answeredBy,
        answer: answer.answer,
        action:
          answer.status === "answered"
            ? "Answered on call"
            : answer.status === "deferred"
              ? `${owner} follow-up owed`
              : owner === "Oasis"
            ? "Oasis response needed"
            : owner === "Customer"
              ? "Customer response needed"
              : "Mutual follow-up needed",
        priority: priorityForText(question),
        time: turn.time ?? "",
      });
    }
  }

  const unique = new Map<string, DealQuestion>();
  for (const item of questions) {
    const key = `${item.kind}:${item.question.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 120)}`;
    if (!unique.has(key)) unique.set(key, item);
  }

  return Array.from(unique.values())
    .sort((a, b) => {
      const priorityScore = { High: 3, Medium: 2, Low: 1 };
      return priorityScore[b.priority] - priorityScore[a.priority];
    })
    .slice(0, 14);
}

function shortEvidence(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 360);
}

function signalFromSentence(sentence: string): DealSignal | null {
  const normalized = sentence.toLowerCase();

  if (/success criteria|scorecard|criteria|evaluation criteria|requirements/.test(normalized)) {
    return {
      label: /not|undefined|missing|still|no /.test(normalized)
        ? "Success criteria gap"
        : "Success criteria signal",
      tone: /not|undefined|missing|still|no /.test(normalized) ? "risk" : "action",
      category: "Decision",
      summary: /not|undefined|missing|still|no /.test(normalized)
        ? "Evaluation criteria may not be locked, which can stall or distort the POC."
        : "The customer is discussing evaluation criteria; this should be converted into a written scorecard.",
      evidence: shortEvidence(sentence),
      confidence: "High",
    };
  }

  if (/procurement|legal|contract|vendor assessment|security review|approval/.test(normalized)) {
    return {
      label: "Buying process risk",
      tone: "risk",
      category: "Risk",
      summary: "A non-technical approval path may affect timeline, ownership, or close sequence.",
      evidence: shortEvidence(sentence),
      confidence: "High",
    };
  }

  if (/manual|gap|pain|problem|struggle|unable|can't|cannot|visibility|sprawl|orphaned|exposed|risk/.test(normalized)) {
    return {
      label: "Customer pain confirmed",
      tone: "positive",
      category: "Pain",
      summary: "The call contains a concrete pain signal that can anchor the POC value story.",
      evidence: shortEvidence(sentence),
      confidence: "Medium",
    };
  }

  if (/integrat|okta|azure|cyberark|vault|servicenow|api|sso|scim|sandbox|production|deploy|install/.test(normalized)) {
    return {
      label: "Technical fit area",
      tone: "watch",
      category: "Fit",
      summary: "The customer is discussing integration or deployment details that should map to POC scope.",
      evidence: shortEvidence(sentence),
      confidence: "Medium",
    };
  }

  if (/priority|important|executive|directive|sponsor|champion|we need|we want|urgent|timeline|next step/.test(normalized)) {
    return {
      label: "Momentum / urgency",
      tone: "positive",
      category: "Momentum",
      summary: "The account shows urgency or sponsorship that can be used to drive the next close step.",
      evidence: shortEvidence(sentence),
      confidence: "Medium",
    };
  }

  if (/competitor|alternative|vendor|head-to-head|astrix|clutch|sailpoint|silverfort/.test(normalized)) {
    return {
      label: "Competitive pressure",
      tone: "risk",
      category: "Risk",
      summary: "A competitor or alternative path is in the deal and should be handled explicitly.",
      evidence: shortEvidence(sentence),
      confidence: "High",
    };
  }

  return null;
}

function detectSignals(text: string, turns = extractSpeakerTurns(text)) {
  const signals: DealSignal[] = [];

  for (const turn of turns) {
    const sentences = turn.text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.replace(/\s+/g, " ").trim())
      .filter((sentence) => sentence.length >= 35);

    for (const sentence of sentences) {
      const signal = signalFromSentence(sentence);
      if (signal) signals.push(signal);
    }
  }

  if (!signals.length) {
    const fallbackSentences = text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.replace(/\s+/g, " ").trim())
      .filter((sentence) => sentence.length >= 35);
    for (const sentence of fallbackSentences) {
      const signal = signalFromSentence(sentence);
      if (signal) signals.push(signal);
    }
  }

  const unique = new Map<string, DealSignal>();
  for (const signal of signals) {
    const key = `${signal.label}:${signal.evidence.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 90)}`;
    if (!unique.has(key)) unique.set(key, signal);
  }

  return Array.from(unique.values()).slice(0, 8);
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
  const turns = extractSpeakerTurns(payload.transcript);
  const attendees = detectAttendees(payload.transcript, turns);
  const questions = detectQuestions(payload.transcript, attendees, turns);
  const signals = detectSignals(payload.transcript, turns);
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
    transcripts: transcripts.map((transcript) => {
      const parsed = parseTranscript({
        title: transcript.title,
        fileName: transcript.title,
        callDate: transcript.callDate,
        transcript: transcript.transcript,
      });
      const attendees = tryJsonArray(transcript.attendeesJson);
      const questions = tryJsonArray(transcript.questionsJson);
      const firstQuestion = questions[0];
      const signals = tryJsonArray(transcript.signalsJson);
      const firstSignal = signals[0];

      return {
        ...transcript,
        attendees:
          attendees.length && typeof attendees[0] === "object"
            ? attendees
            : parsed.attendees,
        questions:
          questions.length &&
          firstQuestion &&
          typeof firstQuestion === "object" &&
          "owner" in firstQuestion
            ? questions
            : parsed.questions,
        signals:
          signals.length &&
          firstSignal &&
          typeof firstSignal === "object" &&
          "summary" in firstSignal
            ? signals
            : parsed.signals,
      };
    }),
    researchBriefs: briefs.map((brief) => ({
      ...brief,
      sources: tryJsonArray(brief.sourcesJson),
    })),
  };
}

async function readAccountSummaries() {
  const db = getDb();
  const [profiles, openOpportunities, sources, transcripts] = await Promise.all([
    db
      .select()
      .from(accountProfiles)
      .orderBy(desc(accountProfiles.updatedAt), desc(accountProfiles.id)),
    db
      .select()
      .from(opportunities)
      .where(eq(opportunities.status, "open"))
      .orderBy(desc(opportunities.updatedAt), desc(opportunities.id)),
    db
      .select()
      .from(contextSources)
      .where(eq(contextSources.status, "active"))
      .orderBy(desc(contextSources.createdAt), desc(contextSources.id)),
    db
      .select()
      .from(callTranscripts)
      .orderBy(desc(callTranscripts.callDate), desc(callTranscripts.id)),
  ]);

  const byName = new Map<string, AccountSummary>();

  for (const profile of profiles) {
    byName.set(profile.accountName, initAccountSummary(profile));
  }

  for (const opportunity of openOpportunities) {
    const summary =
      byName.get(opportunity.accountName) ??
      initAccountSummary(profileFromOpportunity(opportunity));

    summary.openOpportunityCount += 1;
    summary.totalPipeline += opportunity.amount;
    summary.weightedPipeline += Math.round(
      opportunity.amount * (opportunity.probability / 100)
    );
    summary.lastActivityDate = maxDateString(
      summary.lastActivityDate,
      opportunity.lastActivityDate,
      opportunity.updatedAt
    );

    if (!summary.latestStage) {
      summary.latestStage = opportunity.stage;
    }
    if (!summary.nextStep && opportunity.nextStep) {
      summary.nextStep = opportunity.nextStep;
    }
    if (!summary.accountWebsite && opportunity.accountWebsite) {
      summary.accountWebsite = opportunity.accountWebsite;
    }
    if ((!summary.industry || summary.industry === "Unknown") && opportunity.industry) {
      summary.industry = opportunity.industry;
    }
    if (!summary.salesforceAccountId && opportunity.salesforceAccountId) {
      summary.salesforceAccountId = opportunity.salesforceAccountId;
    }

    byName.set(opportunity.accountName, summary);
  }

  for (const source of sources) {
    const summary =
      byName.get(source.accountName) ??
      initAccountSummary(profileFromAccountName(source.accountName));
    summary.sourceCount += 1;
    summary.lastActivityDate = maxDateString(
      summary.lastActivityDate,
      source.sourceDate,
      source.createdAt
    );
    byName.set(source.accountName, summary);
  }

  for (const transcript of transcripts) {
    const summary =
      byName.get(transcript.accountName) ??
      initAccountSummary(profileFromAccountName(transcript.accountName));
    summary.transcriptCount += 1;
    summary.lastActivityDate = maxDateString(
      summary.lastActivityDate,
      transcript.callDate,
      transcript.createdAt
    );
    byName.set(transcript.accountName, summary);
  }

  return Array.from(byName.values()).sort((a, b) => {
    const activeDelta =
      Number(b.openOpportunityCount > 0) - Number(a.openOpportunityCount > 0);
    if (activeDelta) return activeDelta;

    const pipelineDelta = b.totalPipeline - a.totalPipeline;
    if (pipelineDelta) return pipelineDelta;

    return a.accountName.localeCompare(b.accountName);
  });
}

export async function GET(request: Request) {
  try {
    const accountName = cleanAccountName(
      new URL(request.url).searchParams.get("accountName")
    );

    if (!accountName) {
      return Response.json({ accounts: await readAccountSummaries() });
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
        summary: cleanText(payload.summary, "", 6000),
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

    if (action === "reprocess") {
      const db = getDb();
      const transcripts = await db
        .select()
        .from(callTranscripts)
        .where(eq(callTranscripts.accountName, accountName));

      for (const transcript of transcripts) {
        const parsed = parseTranscript({
          title: transcript.title,
          fileName: transcript.title,
          callDate: transcript.callDate,
          transcript: transcript.transcript,
        });

        await db
          .update(callTranscripts)
          .set({
            attendeesJson: JSON.stringify(parsed.attendees),
            questionsJson: JSON.stringify(parsed.questions),
            signalsJson: JSON.stringify(parsed.signals),
            summary: parsed.summary,
          })
          .where(eq(callTranscripts.id, transcript.id));
      }

      return Response.json({
        account: await readAccount(accountName),
        reprocessed: transcripts.length,
      });
    }

    if (action === "research") {
      await getDb().insert(researchBriefs).values({
        accountName,
        title: cleanText(payload.title, "Deep account research", 180),
        status: normalizeResearchStatus(payload.status),
        summary: cleanText(payload.summary, "", 12000),
        sourcesJson: JSON.stringify(normalizeResearchSources(payload.sources)),
        updatedAt: new Date().toISOString(),
      });
      return Response.json({ account: await readAccount(accountName) });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
