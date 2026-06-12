import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  accountProfiles,
  contextSources,
  opportunities,
} from "../../../../db/schema";

type OpportunityInsert = typeof opportunities.$inferInsert;

type StageId =
  | "Discovery"
  | "Qualified"
  | "Solution"
  | "POV"
  | "Proposal"
  | "Negotiation"
  | "Commit";

const STAGE_PROGRESS: Record<StageId, number> = {
  Discovery: 15,
  Qualified: 35,
  Solution: 45,
  POV: 55,
  Proposal: 70,
  Negotiation: 85,
  Commit: 95,
};

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  const combined = `${message}\n${detail}`;

  if (combined.includes("no such table") || combined.includes("no such column")) {
    return "Salesforce import tables are not ready yet. Deploy the latest migration, then retry.";
  }

  return message;
}

function cleanText(value: unknown, fallback = "", maxLength = 240) {
  return String(value ?? fallback)
    .trim()
    .slice(0, maxLength);
}

function parseNumber(value: unknown) {
  const parsed = Number.parseFloat(
    String(value ?? "")
      .replace(/[$,%]/g, "")
      .replace(/,/g, "")
      .trim()
  );
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function normalizeDate(value: unknown) {
  const text = cleanText(value, "", 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!slashDate) return "";

  const year =
    slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3];
  return `${year}-${slashDate[1].padStart(2, "0")}-${slashDate[2].padStart(
    2,
    "0"
  )}`;
}

function normalizeStage(value: unknown): StageId {
  const text = cleanText(value, "Discovery", 80).toLowerCase();
  if (text.includes("pov") || text.includes("proof") || text.includes("pilot")) {
    return "POV";
  }
  if (text.includes("proposal") || text.includes("quote")) return "Proposal";
  if (
    text.includes("negotiation") ||
    text.includes("procurement") ||
    text.includes("legal") ||
    text.includes("contract")
  ) {
    return "Negotiation";
  }
  if (text.includes("commit") || text.includes("closed won")) return "Commit";
  if (text.includes("qual")) return "Qualified";
  if (text.includes("solution") || text.includes("demo")) return "Solution";
  if (text.includes("discover") || text.includes("prospect")) return "Discovery";

  return "Discovery";
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);

  const [headers, ...body] = rows;
  if (!headers?.length) return [];

  return body.map((cells) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), cells[index]?.trim() ?? ""])
    )
  );
}

function getColumn(row: Record<string, string>, ...names: string[]) {
  const entries = Object.entries(row);
  for (const name of names) {
    const direct = row[name];
    if (direct !== undefined) return direct;
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = entries.find(
      ([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized
    );
    if (match) return match[1];
  }
  return "";
}

function normalizeOpportunityName(value: string, accountName: string) {
  const cleaned = cleanText(value, "", 160).replace(/\s*-\s*$/, "").trim();
  return cleaned || `${accountName} opportunity`;
}

async function upsertAccountProfile(values: {
  accountName: string;
  accountWebsite: string;
  industry: string;
  salesforceAccountId: string;
  stage: string;
  progress: number;
}) {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(accountProfiles)
    .where(eq(accountProfiles.accountName, values.accountName))
    .limit(1);

  const profileValues = {
    accountName: values.accountName,
    accountWebsite: values.accountWebsite,
    industry: values.industry || "Unknown",
    salesforceAccountId: values.salesforceAccountId,
    health: values.stage === "Negotiation" ? "At Risk" : "Active",
    score: values.progress,
    updatedAt: new Date().toISOString(),
  };

  if (profile) {
    await db
      .update(accountProfiles)
      .set(profileValues)
      .where(eq(accountProfiles.id, profile.id));
    return;
  }

  await db.insert(accountProfiles).values(profileValues);
}

async function findExistingOpportunity(values: {
  accountName: string;
  opportunityName: string;
  salesforceOpportunityId: string;
}) {
  const db = getDb();

  if (values.salesforceOpportunityId) {
    const [existing] = await db
      .select()
      .from(opportunities)
      .where(
        eq(opportunities.salesforceOpportunityId, values.salesforceOpportunityId)
      )
      .limit(1);
    if (existing) return existing;
  }

  const [fallback] = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.accountName, values.accountName),
        eq(opportunities.opportunityName, values.opportunityName)
      )
    )
    .limit(1);
  return fallback;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const csvText = cleanText(payload.csvText, "", 2_000_000);
    const rows = parseCsv(csvText);

    if (!rows.length) {
      return Response.json(
        { error: "Upload a Salesforce CSV with at least one opportunity row." },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const importedIds: number[] = [];

    for (const row of rows) {
      const accountName = cleanText(getColumn(row, "Account Name"), "", 160);
      const opportunityName = normalizeOpportunityName(
        getColumn(row, "Opportunity Name"),
        accountName
      );

      if (!accountName || !opportunityName) {
        skipped += 1;
        continue;
      }

      const stage = normalizeStage(getColumn(row, "Stage"));
      const progress = STAGE_PROGRESS[stage];
      const salesforceOpportunityId = cleanText(
        getColumn(row, "Opportunity ID", "Opportunity Id", "Id"),
        "",
        80
      );
      const salesforceAccountId = cleanText(
        getColumn(row, "Account ID", "Account Id"),
        "",
        80
      );
      const accountWebsite = cleanText(
        getColumn(row, "Account Website", "Website"),
        "",
        240
      );
      const industry = cleanText(getColumn(row, "Industry"), "", 120);

      const values: OpportunityInsert = {
        accountName,
        opportunityName,
        owner: cleanText(getColumn(row, "Owner", "Opportunity Owner"), "", 80),
        stage,
        amount: parseNumber(getColumn(row, "Amount")),
        probability: parseNumber(getColumn(row, "Probability")),
        progress,
        closeDate: normalizeDate(getColumn(row, "Close Date")),
        nextStep: cleanText(getColumn(row, "Next Step"), "", 180),
        nextStepDate: "",
        riskLevel: "Medium",
        notes: "",
        salesforceOpportunityId,
        salesforceAccountId,
        accountWebsite,
        industry,
        forecastCategory: cleanText(
          getColumn(row, "Forecast Category"),
          "",
          80
        ),
        lastActivityDate: normalizeDate(getColumn(row, "Last Activity Date")),
        sourceSystem: "salesforce_csv",
        status: "open",
        updatedAt: new Date().toISOString(),
      };

      const db = getDb();
      const existing = await findExistingOpportunity({
        accountName,
        opportunityName,
        salesforceOpportunityId,
      });

      const [saved] = existing
        ? await db
            .update(opportunities)
            .set(values)
            .where(eq(opportunities.id, existing.id))
            .returning()
        : await db.insert(opportunities).values(values).returning();

      if (existing) updated += 1;
      else created += 1;

      importedIds.push(saved.id);
      await upsertAccountProfile({
        accountName,
        accountWebsite,
        industry,
        salesforceAccountId,
        stage,
        progress,
      });
      await db.insert(contextSources).values({
        accountName,
        sourceType: "file",
        title: "Salesforce CSV import",
        summary: `Imported ${opportunityName} from Salesforce CSV.`,
        sourceDate: values.lastActivityDate || values.closeDate,
      });
    }

    const openOpportunities = await getDb()
      .select()
      .from(opportunities)
      .where(eq(opportunities.status, "open"))
      .orderBy(desc(opportunities.updatedAt), desc(opportunities.id));

    return Response.json({
      created,
      importedIds,
      opportunities: openOpportunities,
      skipped,
      updated,
    });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
