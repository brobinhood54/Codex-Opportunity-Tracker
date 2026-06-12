import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const opportunities = sqliteTable(
  "opportunities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountName: text("account_name").notNull(),
    opportunityName: text("opportunity_name").notNull(),
    owner: text("owner").notNull().default(""),
    stage: text("stage").notNull().default("Qualification"),
    amount: integer("amount").notNull().default(0),
    probability: integer("probability").notNull().default(20),
    progress: integer("progress").notNull().default(15),
    closeDate: text("close_date").notNull().default(""),
    nextStep: text("next_step").notNull().default(""),
    nextStepDate: text("next_step_date").notNull().default(""),
    riskLevel: text("risk_level").notNull().default("Medium"),
    notes: text("notes").notNull().default(""),
    salesforceOpportunityId: text("salesforce_opportunity_id")
      .notNull()
      .default(""),
    salesforceAccountId: text("salesforce_account_id").notNull().default(""),
    accountWebsite: text("account_website").notNull().default(""),
    industry: text("industry").notNull().default(""),
    forecastCategory: text("forecast_category").notNull().default(""),
    lastActivityDate: text("last_activity_date").notNull().default(""),
    sourceSystem: text("source_system").notNull().default("manual"),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    statusIdx: index("opportunities_status_idx").on(table.status),
    stageIdx: index("opportunities_stage_idx").on(table.stage),
    closeDateIdx: index("opportunities_close_date_idx").on(table.closeDate),
    salesforceOpportunityIdx: index(
      "opportunities_salesforce_opportunity_idx"
    ).on(table.salesforceOpportunityId),
    salesforceAccountIdx: index("opportunities_salesforce_account_idx").on(
      table.salesforceAccountId
    ),
  })
);

export const accountProfiles = sqliteTable(
  "account_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountName: text("account_name").notNull().unique(),
    industry: text("industry").notNull().default("Unknown"),
    segment: text("segment").notNull().default("Prospect"),
    health: text("health").notNull().default("At Risk"),
    score: integer("score").notNull().default(35),
    notes: text("notes").notNull().default(""),
    salesforceAccountId: text("salesforce_account_id").notNull().default(""),
    accountWebsite: text("account_website").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    accountNameIdx: index("account_profiles_account_name_idx").on(
      table.accountName
    ),
  })
);

export const contextSources = sqliteTable(
  "context_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountName: text("account_name").notNull(),
    sourceType: text("source_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    sourceDate: text("source_date").notNull().default(""),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    accountIdx: index("context_sources_account_idx").on(table.accountName),
    sourceTypeIdx: index("context_sources_source_type_idx").on(
      table.sourceType
    ),
  })
);

export const callTranscripts = sqliteTable(
  "call_transcripts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountName: text("account_name").notNull(),
    title: text("title").notNull(),
    callDate: text("call_date").notNull().default(""),
    attendeesJson: text("attendees_json").notNull().default("[]"),
    transcript: text("transcript").notNull(),
    summary: text("summary").notNull().default(""),
    questionsJson: text("questions_json").notNull().default("[]"),
    signalsJson: text("signals_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    accountIdx: index("call_transcripts_account_idx").on(table.accountName),
    callDateIdx: index("call_transcripts_call_date_idx").on(table.callDate),
  })
);

export const researchBriefs = sqliteTable(
  "research_briefs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountName: text("account_name").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("queued"),
    summary: text("summary").notNull().default(""),
    sourcesJson: text("sources_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    accountIdx: index("research_briefs_account_idx").on(table.accountName),
    statusIdx: index("research_briefs_status_idx").on(table.status),
  })
);
