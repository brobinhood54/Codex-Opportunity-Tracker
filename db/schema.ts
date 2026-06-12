import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const opportunities = sqliteTable(
  "opportunities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountName: text("account_name").notNull(),
    opportunityName: text("opportunity_name").notNull(),
    owner: text("owner").notNull().default(""),
    stage: text("stage").notNull().default("Discovery"),
    amount: integer("amount").notNull().default(0),
    probability: integer("probability").notNull().default(20),
    progress: integer("progress").notNull().default(15),
    closeDate: text("close_date").notNull().default(""),
    nextStep: text("next_step").notNull().default(""),
    nextStepDate: text("next_step_date").notNull().default(""),
    riskLevel: text("risk_level").notNull().default("Medium"),
    notes: text("notes").notNull().default(""),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    statusIdx: index("opportunities_status_idx").on(table.status),
    stageIdx: index("opportunities_stage_idx").on(table.stage),
    closeDateIdx: index("opportunities_close_date_idx").on(table.closeDate),
  })
);
