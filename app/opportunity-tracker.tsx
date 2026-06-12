"use client";

import {
  CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Stage =
  | "Discovery"
  | "Qualified"
  | "Solution"
  | "Proposal"
  | "Negotiation"
  | "Commit";

type RiskLevel = "Low" | "Medium" | "High";

type Opportunity = {
  id: number;
  accountName: string;
  opportunityName: string;
  owner: string;
  stage: Stage;
  amount: number;
  probability: number;
  progress: number;
  closeDate: string;
  nextStep: string;
  nextStepDate: string;
  riskLevel: RiskLevel;
  notes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Draft = Omit<
  Opportunity,
  "id" | "status" | "createdAt" | "updatedAt" | "amount"
> & {
  amount: string;
};

const STAGES: { id: Stage; progress: number; accent: string }[] = [
  { id: "Discovery", progress: 15, accent: "#263241" },
  { id: "Qualified", progress: 35, accent: "#177e81" },
  { id: "Solution", progress: 55, accent: "#d66655" },
  { id: "Proposal", progress: 70, accent: "#c99b36" },
  { id: "Negotiation", progress: 85, accent: "#4f6f9f" },
  { id: "Commit", progress: 95, accent: "#41825b" },
];

const EMPTY_DRAFT: Draft = {
  accountName: "",
  opportunityName: "",
  owner: "",
  stage: "Discovery",
  amount: "",
  probability: 25,
  progress: 15,
  closeDate: "",
  nextStep: "",
  nextStepDate: "",
  riskLevel: "Medium",
  notes: "",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCurrency(value: number) {
  return currency.format(value || 0);
}

function formatCompact(value: number) {
  return compactCurrency.format(value || 0);
}

function toDraft(opportunity: Opportunity): Draft {
  return {
    accountName: opportunity.accountName,
    opportunityName: opportunity.opportunityName,
    owner: opportunity.owner,
    stage: opportunity.stage,
    amount: String(opportunity.amount || ""),
    probability: opportunity.probability,
    progress: opportunity.progress,
    closeDate: opportunity.closeDate,
    nextStep: opportunity.nextStep,
    nextStepDate: opportunity.nextStepDate,
    riskLevel: opportunity.riskLevel,
    notes: opportunity.notes,
  };
}

function dateLabel(date: string) {
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function isSoon(date: string) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T12:00:00`);
  const difference = target.getTime() - today.getTime();
  return difference <= 1000 * 60 * 60 * 24 * 7;
}

function stagePosition(stage: Stage) {
  return STAGES.findIndex((item) => item.id === stage);
}

function nextStage(stage: Stage) {
  const index = stagePosition(stage);
  return STAGES[Math.min(index + 1, STAGES.length - 1)].id;
}

export default function OpportunityTracker() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [mode, setMode] = useState<"board" | "table">("board");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"All" | Stage>("All");
  const [riskFilter, setRiskFilter] = useState<"All" | RiskLevel>("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedIdRef = useRef<number | null>(null);

  const selected = useMemo(
    () => opportunities.find((item) => item.id === selectedId) ?? null,
    [opportunities, selectedId]
  );

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadOpportunities = useCallback(async () => {
    try {
      const response = await fetch("/api/opportunities", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        opportunities?: Opportunity[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load opportunities.");
      }

      const rows = payload.opportunities ?? [];
      const currentSelectedId = selectedIdRef.current;
      const nextSelectedId = rows.some((row) => row.id === currentSelectedId)
        ? currentSelectedId
        : rows[0]?.id ?? null;
      const nextSelected = rows.find((row) => row.id === nextSelectedId);
      setOpportunities(rows);
      setSelectedId(nextSelectedId);
      selectedIdRef.current = nextSelectedId;
      setDraft(nextSelected ? toDraft(nextSelected) : EMPTY_DRAFT);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load opportunities."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The tracker needs to load durable opportunity records when the app opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOpportunities();
  }, [loadOpportunities]);

  function refreshOpportunities() {
    setLoading(true);
    setError("");
    void loadOpportunities();
  }

  const filteredOpportunities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return opportunities
      .filter((item) => {
        const matchesQuery =
          !normalizedQuery ||
          `${item.accountName} ${item.opportunityName} ${item.owner} ${item.nextStep}`
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesStage =
          stageFilter === "All" || item.stage === stageFilter;
        const matchesRisk = riskFilter === "All" || item.riskLevel === riskFilter;
        return matchesQuery && matchesStage && matchesRisk;
      })
      .sort((a, b) => {
        const stageDelta = stagePosition(b.stage) - stagePosition(a.stage);
        if (stageDelta) return stageDelta;
        return b.amount * b.probability - a.amount * a.probability;
      });
  }, [opportunities, query, riskFilter, stageFilter]);

  const metrics = useMemo(() => {
    const value = opportunities.reduce((sum, item) => sum + item.amount, 0);
    const weighted = opportunities.reduce(
      (sum, item) => sum + item.amount * (item.probability / 100),
      0
    );
    const averageProgress = opportunities.length
      ? Math.round(
          opportunities.reduce((sum, item) => sum + item.progress, 0) /
            opportunities.length
        )
      : 0;
    const dueSoon = opportunities.filter((item) =>
      isSoon(item.nextStepDate)
    ).length;
    const highRisk = opportunities.filter(
      (item) => item.riskLevel === "High"
    ).length;

    return { value, weighted, averageProgress, dueSoon, highRisk };
  }, [opportunities]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startNew() {
    setSelectedId(null);
    selectedIdRef.current = null;
    setDraft(EMPTY_DRAFT);
  }

  function selectOpportunity(id: number) {
    const opportunity = opportunities.find((item) => item.id === id);
    setSelectedId(id);
    selectedIdRef.current = id;
    if (opportunity) {
      setDraft(toDraft(opportunity));
    }
  }

  async function saveOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      ...draft,
      id: selected?.id,
      amount: Number(draft.amount || 0),
    };

    try {
      const response = await fetch("/api/opportunities", {
        method: selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        opportunity?: Opportunity;
        error?: string;
      };

      if (!response.ok || !result.opportunity) {
        throw new Error(result.error ?? "Unable to save opportunity.");
      }

      const saved = result.opportunity;
      setOpportunities((current) => {
        if (selected) {
          return current.map((item) =>
            item.id === saved.id ? saved : item
          );
        }
        return [saved, ...current];
      });
      setSelectedId(saved.id);
      selectedIdRef.current = saved.id;
      setDraft(toDraft(saved));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save opportunity."
      );
    } finally {
      setSaving(false);
    }
  }

  async function patchSelected(updates: Partial<Draft>) {
    if (!selected) return;
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, ...updates }),
      });
      const result = (await response.json()) as {
        opportunity?: Opportunity;
        error?: string;
      };

      if (!response.ok || !result.opportunity) {
        throw new Error(result.error ?? "Unable to update opportunity.");
      }

      const saved = result.opportunity;
      setOpportunities((current) =>
        current.map((item) =>
          item.id === saved.id ? saved : item
        )
      );
      setDraft(toDraft(saved));
    } catch (patchError) {
      setError(
        patchError instanceof Error
          ? patchError.message
          : "Unable to update opportunity."
      );
    } finally {
      setSaving(false);
    }
  }

  async function advanceSelected() {
    if (!selected) return;
    const stage = nextStage(selected.stage);
    const stageConfig = STAGES.find((item) => item.id === stage);
    await patchSelected({
      stage,
      progress: Math.max(selected.progress, stageConfig?.progress ?? 0),
      probability: Math.max(selected.probability, stageConfig?.progress ?? 0),
    });
  }

  async function archiveSelected() {
    if (!selected) return;
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/opportunities?id=${selected.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to archive opportunity.");
      }

      setOpportunities((current) =>
        current.filter((item) => item.id !== selected.id)
      );
      setSelectedId(null);
      selectedIdRef.current = null;
      setDraft(EMPTY_DRAFT);
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Unable to archive opportunity."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Pipeline command center</p>
          <h1>Open opportunities</h1>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button" onClick={refreshOpportunities}>
            Refresh
          </button>
          <button className="primary-button" onClick={startNew}>
            New
          </button>
        </div>
      </header>

      <section className="overview-band">
        <div className="overview-copy">
          <div className="metric-grid" aria-label="Pipeline summary">
            <Metric label="Open" value={String(opportunities.length)} />
            <Metric label="Pipeline" value={formatCompact(metrics.value)} />
            <Metric label="Weighted" value={formatCompact(metrics.weighted)} />
            <Metric label="Progress" value={`${metrics.averageProgress}%`} />
            <Metric label="Next steps" value={String(metrics.dueSoon)} tone="watch" />
            <Metric label="High risk" value={String(metrics.highRisk)} tone="risk" />
          </div>
          <div className="stage-strip" aria-label="Stage distribution">
            {STAGES.map((stage) => {
              const count = opportunities.filter(
                (item) => item.stage === stage.id
              ).length;
              return (
                <button
                  className={
                    stageFilter === stage.id
                      ? "stage-chip stage-chip-active"
                      : "stage-chip"
                  }
                  key={stage.id}
                  onClick={() =>
                    setStageFilter(stageFilter === stage.id ? "All" : stage.id)
                  }
                  style={{ "--accent": stage.accent } as CSSProperties}
                >
                  <span>{stage.id}</span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="pipeline-visual"
          src="/opportunity-pipeline.png"
          alt="Opportunity pipeline planning board"
        />
      </section>

      <section className="toolbar" aria-label="Opportunity filters">
        <label className="search-field">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Account, deal, owner, next step"
          />
        </label>
        <label className="select-field">
          <span>Stage</span>
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value as "All" | Stage)}
          >
            <option value="All">All stages</option>
            {STAGES.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.id}
              </option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <span>Risk</span>
          <select
            value={riskFilter}
            onChange={(event) =>
              setRiskFilter(event.target.value as "All" | RiskLevel)
            }
          >
            <option value="All">All risk</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </label>
        <div className="segmented-control" aria-label="View mode">
          <button
            className={mode === "board" ? "active" : ""}
            onClick={() => setMode("board")}
          >
            Board
          </button>
          <button
            className={mode === "table" ? "active" : ""}
            onClick={() => setMode("table")}
          >
            Table
          </button>
        </div>
      </section>

      {error ? <div className="status-banner">{error}</div> : null}

      <div className="workspace">
        <section className="opportunity-area">
          {loading ? (
            <div className="empty-state">Loading opportunities...</div>
          ) : mode === "board" ? (
            <Board
              opportunities={filteredOpportunities}
              selectedId={selectedId}
              onSelect={selectOpportunity}
            />
          ) : (
            <Table
              opportunities={filteredOpportunities}
              selectedId={selectedId}
              onSelect={selectOpportunity}
            />
          )}
        </section>

        <aside className="detail-panel" aria-label="Opportunity details">
          <div className="detail-head">
            <div>
              <p className="eyebrow">{selected ? "Selected" : "New"}</p>
              <h2>{selected ? selected.accountName : "Opportunity"}</h2>
            </div>
            {selected ? (
              <span className={`risk-pill risk-${selected.riskLevel.toLowerCase()}`}>
                {selected.riskLevel}
              </span>
            ) : null}
          </div>

          <form className="opportunity-form" onSubmit={saveOpportunity}>
            <label>
              <span>Account</span>
              <input
                required
                value={draft.accountName}
                onChange={(event) =>
                  updateDraft("accountName", event.target.value)
                }
              />
            </label>
            <label>
              <span>Opportunity</span>
              <input
                required
                value={draft.opportunityName}
                onChange={(event) =>
                  updateDraft("opportunityName", event.target.value)
                }
              />
            </label>
            <div className="form-grid">
              <label>
                <span>Owner</span>
                <input
                  value={draft.owner}
                  onChange={(event) => updateDraft("owner", event.target.value)}
                />
              </label>
              <label>
                <span>Amount</span>
                <input
                  inputMode="numeric"
                  value={draft.amount}
                  onChange={(event) => updateDraft("amount", event.target.value)}
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                <span>Stage</span>
                <select
                  value={draft.stage}
                  onChange={(event) => {
                    const stage = event.target.value as Stage;
                    const baseline =
                      STAGES.find((item) => item.id === stage)?.progress ?? 15;
                    setDraft((current) => ({
                      ...current,
                      stage,
                      progress: Math.max(current.progress, baseline),
                    }));
                  }}
                >
                  {STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Risk</span>
                <select
                  value={draft.riskLevel}
                  onChange={(event) =>
                    updateDraft("riskLevel", event.target.value as RiskLevel)
                  }
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </label>
            </div>
            <div className="range-pair">
              <label>
                <span>Progress {draft.progress}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={draft.progress}
                  onChange={(event) =>
                    updateDraft("progress", Number(event.target.value))
                  }
                />
              </label>
              <label>
                <span>Probability {draft.probability}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={draft.probability}
                  onChange={(event) =>
                    updateDraft("probability", Number(event.target.value))
                  }
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                <span>Close date</span>
                <input
                  type="date"
                  value={draft.closeDate}
                  onChange={(event) =>
                    updateDraft("closeDate", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Next step date</span>
                <input
                  type="date"
                  value={draft.nextStepDate}
                  onChange={(event) =>
                    updateDraft("nextStepDate", event.target.value)
                  }
                />
              </label>
            </div>
            <label>
              <span>Next step</span>
              <input
                value={draft.nextStep}
                onChange={(event) => updateDraft("nextStep", event.target.value)}
              />
            </label>
            <label>
              <span>Notes</span>
              <textarea
                value={draft.notes}
                onChange={(event) => updateDraft("notes", event.target.value)}
              />
            </label>
            <div className="form-actions">
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? "Saving" : selected ? "Save" : "Create"}
              </button>
              {selected ? (
                <>
                  <button
                    className="secondary-button"
                    disabled={saving || selected.stage === "Commit"}
                    onClick={() => void advanceSelected()}
                    type="button"
                  >
                    Advance
                  </button>
                  <button
                    className="ghost-button"
                    disabled={saving}
                    onClick={() => void archiveSelected()}
                    type="button"
                  >
                    Archive
                  </button>
                </>
              ) : null}
            </div>
          </form>
        </aside>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "watch" | "risk";
}) {
  return (
    <article className={`metric-card ${tone ? `metric-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Board({
  opportunities,
  selectedId,
  onSelect,
}: {
  opportunities: Opportunity[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (!opportunities.length) {
    return <div className="empty-state">No open opportunities match.</div>;
  }

  return (
    <div className="board" aria-label="Opportunities by stage">
      {STAGES.map((stage) => {
        const rows = opportunities.filter((item) => item.stage === stage.id);
        return (
          <section className="lane" key={stage.id}>
            <div
              className="lane-head"
              style={{ "--accent": stage.accent } as CSSProperties}
            >
              <span>{stage.id}</span>
              <strong>{rows.length}</strong>
            </div>
            <div className="lane-list">
              {rows.map((item) => (
                <button
                  className={
                    item.id === selectedId
                      ? "opportunity-card selected"
                      : "opportunity-card"
                  }
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                >
                  <span className={`risk-dot risk-${item.riskLevel.toLowerCase()}`} />
                  <strong>{item.accountName}</strong>
                  <span>{item.opportunityName}</span>
                  <div className="card-meta">
                    <span>{formatCompact(item.amount)}</span>
                    <span>{item.probability}%</span>
                  </div>
                  <ProgressBar value={item.progress} />
                  <small>{item.nextStep || "Next step open"}</small>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Table({
  opportunities,
  selectedId,
  onSelect,
}: {
  opportunities: Opportunity[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (!opportunities.length) {
    return <div className="empty-state">No open opportunities match.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Stage</th>
            <th>Value</th>
            <th>Progress</th>
            <th>Next step</th>
            <th>Close</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((item) => (
            <tr
              className={item.id === selectedId ? "selected-row" : ""}
              key={item.id}
              onClick={() => onSelect(item.id)}
            >
              <td>
                <strong>{item.accountName}</strong>
                <span>{item.opportunityName}</span>
              </td>
              <td>{item.stage}</td>
              <td>
                <strong>{formatCurrency(item.amount)}</strong>
                <span>{item.probability}% weighted</span>
              </td>
              <td>
                <ProgressBar value={item.progress} />
              </td>
              <td>
                <strong>{item.nextStep || "Open"}</strong>
                <span>{dateLabel(item.nextStepDate)}</span>
              </td>
              <td>{dateLabel(item.closeDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track" aria-label={`${value}% progress`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
