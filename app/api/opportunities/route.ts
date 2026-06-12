import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { opportunities } from "../../../db/schema";

const STAGES = [
  "Qualification",
  "Discovery",
  "POV Planning",
  "POV",
  "Decision / Negotiations",
  "Legal / Procurement",
  "Closed",
] as const;

const RISK_LEVELS = ["Low", "Medium", "High"] as const;

const STAGE_PROGRESS: Record<(typeof STAGES)[number], number> = {
  Qualification: 15,
  Discovery: 30,
  "POV Planning": 45,
  POV: 60,
  "Decision / Negotiations": 75,
  "Legal / Procurement": 88,
  Closed: 100,
};

type OpportunityInsert = typeof opportunities.$inferInsert;

function toRouteErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  const combined = `${message}\n${detail}`;

  if (
    combined.includes("no such table") ||
    combined.includes('from "opportunities"')
  ) {
    return "The opportunities table is unavailable. Generate and deploy the D1 migration so the database can be created.";
  }

  return message;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function positiveId(value: unknown) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function cleanText(value: unknown, fallback = "", maxLength = 240) {
  return String(value ?? fallback)
    .trim()
    .slice(0, maxLength);
}

function normalizeStage(value: unknown) {
  const stage = cleanText(value, "Qualification", 80);
  const normalized = stage.toLowerCase();
  if (
    STAGES.includes(stage as (typeof STAGES)[number])
  ) {
    return stage as (typeof STAGES)[number];
  }
  if (/closed|closed won|closed lost|commit/.test(normalized)) return "Closed";
  if (/legal|procurement|contract|redline|paperwork/.test(normalized)) {
    return "Legal / Procurement";
  }
  if (/decision|negotiat|proposal|quote|pricing/.test(normalized)) {
    return "Decision / Negotiations";
  }
  if (/pov planning|proof planning|pilot planning|planning/.test(normalized)) {
    return "POV Planning";
  }
  if (/pov|proof|pilot/.test(normalized)) return "POV";
  if (/solution|demo|technical validation/.test(normalized)) {
    return "POV Planning";
  }
  if (/discover|prospect/.test(normalized)) return "Discovery";
  if (/qual/.test(normalized)) return "Qualification";
  return STAGES.includes(stage as (typeof STAGES)[number])
    ? (stage as (typeof STAGES)[number])
    : "Qualification";
}

function normalizeRisk(value: unknown) {
  const risk = cleanText(value, "Medium", 20);
  return RISK_LEVELS.includes(risk as (typeof RISK_LEVELS)[number])
    ? (risk as (typeof RISK_LEVELS)[number])
    : "Medium";
}

function normalizeDate(value: unknown) {
  const text = cleanText(value, "", 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.status, "open"))
      .orderBy(desc(opportunities.updatedAt), desc(opportunities.id));

    return Response.json({ opportunities: rows });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const accountName = cleanText(payload.accountName, "", 120);
    const opportunityName = cleanText(payload.opportunityName, "", 140);

    if (!accountName || !opportunityName) {
      return Response.json(
        { error: "Account and opportunity are required." },
        { status: 400 }
      );
    }

    const stage = normalizeStage(payload.stage);
    const [opportunity] = await getDb()
      .insert(opportunities)
      .values({
        accountName,
        opportunityName,
        owner: cleanText(payload.owner, "", 80),
        stage,
        amount: clampNumber(payload.amount, 0, 0, 1000000000),
        probability: clampNumber(payload.probability, 25, 0, 100),
        progress: clampNumber(
          payload.progress,
          STAGE_PROGRESS[stage],
          0,
          100
        ),
        closeDate: normalizeDate(payload.closeDate),
        nextStep: cleanText(payload.nextStep, "", 180),
        nextStepDate: normalizeDate(payload.nextStepDate),
        riskLevel: normalizeRisk(payload.riskLevel),
        notes: cleanText(payload.notes, "", 1000),
        salesforceOpportunityId: cleanText(
          payload.salesforceOpportunityId,
          "",
          80
        ),
        salesforceAccountId: cleanText(payload.salesforceAccountId, "", 80),
        accountWebsite: cleanText(payload.accountWebsite, "", 240),
        industry: cleanText(payload.industry, "", 120),
        forecastCategory: cleanText(payload.forecastCategory, "", 80),
        lastActivityDate: normalizeDate(payload.lastActivityDate),
        sourceSystem: cleanText(payload.sourceSystem, "manual", 40),
        status: "open",
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return Response.json({ opportunity }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = positiveId(payload.id);

    if (!id) {
      return Response.json({ error: "id is required." }, { status: 400 });
    }

    const updates: Partial<OpportunityInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if ("accountName" in payload) {
      updates.accountName = cleanText(payload.accountName, "", 120);
    }
    if ("opportunityName" in payload) {
      updates.opportunityName = cleanText(payload.opportunityName, "", 140);
    }
    if ("owner" in payload) {
      updates.owner = cleanText(payload.owner, "", 80);
    }
    if ("stage" in payload) {
      updates.stage = normalizeStage(payload.stage);
    }
    if ("amount" in payload) {
      updates.amount = clampNumber(payload.amount, 0, 0, 1000000000);
    }
    if ("probability" in payload) {
      updates.probability = clampNumber(payload.probability, 0, 0, 100);
    }
    if ("progress" in payload) {
      updates.progress = clampNumber(payload.progress, 0, 0, 100);
    }
    if ("closeDate" in payload) {
      updates.closeDate = normalizeDate(payload.closeDate);
    }
    if ("nextStep" in payload) {
      updates.nextStep = cleanText(payload.nextStep, "", 180);
    }
    if ("nextStepDate" in payload) {
      updates.nextStepDate = normalizeDate(payload.nextStepDate);
    }
    if ("riskLevel" in payload) {
      updates.riskLevel = normalizeRisk(payload.riskLevel);
    }
    if ("notes" in payload) {
      updates.notes = cleanText(payload.notes, "", 1000);
    }
    if ("salesforceOpportunityId" in payload) {
      updates.salesforceOpportunityId = cleanText(
        payload.salesforceOpportunityId,
        "",
        80
      );
    }
    if ("salesforceAccountId" in payload) {
      updates.salesforceAccountId = cleanText(payload.salesforceAccountId, "", 80);
    }
    if ("accountWebsite" in payload) {
      updates.accountWebsite = cleanText(payload.accountWebsite, "", 240);
    }
    if ("industry" in payload) {
      updates.industry = cleanText(payload.industry, "", 120);
    }
    if ("forecastCategory" in payload) {
      updates.forecastCategory = cleanText(payload.forecastCategory, "", 80);
    }
    if ("lastActivityDate" in payload) {
      updates.lastActivityDate = normalizeDate(payload.lastActivityDate);
    }

    const [opportunity] = await getDb()
      .update(opportunities)
      .set(updates)
      .where(eq(opportunities.id, id))
      .returning();

    if (!opportunity) {
      return Response.json({ error: "Opportunity not found." }, { status: 404 });
    }

    return Response.json({ opportunity });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const id = positiveId(new URL(request.url).searchParams.get("id"));

    if (!id) {
      return Response.json({ error: "id is required." }, { status: 400 });
    }

    const [opportunity] = await getDb()
      .update(opportunities)
      .set({ status: "archived", updatedAt: new Date().toISOString() })
      .where(eq(opportunities.id, id))
      .returning();

    if (!opportunity) {
      return Response.json({ error: "Opportunity not found." }, { status: 404 });
    }

    return Response.json({ id });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 }
    );
  }
}
