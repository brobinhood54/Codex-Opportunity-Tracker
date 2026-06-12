# Open Opportunity Tracker

A Sites-hosted opportunity progress tracker for open pipeline work. It tracks
stage, value, probability, progress, risk, close date, next step, and notes for
each opportunity.

## What It Includes

- D1-backed opportunity records with a generated Drizzle migration.
- A board view grouped by stage and a table view for denser scanning.
- Summary metrics for total pipeline, weighted value, average progress, next
  steps due soon, and high-risk deals.
- Inline create, edit, advance, and archive actions.
- A project-local dashboard preview image at `public/screenshot.jpeg`.

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
npm run db:generate
```

For local D1 preview, apply the generated migration to the dev database before
opening the app.
