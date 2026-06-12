"use client";

import {
  CSSProperties,
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Stage =
  | "Qualification"
  | "Discovery"
  | "POV Planning"
  | "POV"
  | "Decision / Negotiations"
  | "Legal / Procurement"
  | "Closed";

type RiskLevel = "Low" | "Medium" | "High";
type TabId =
  | "overview"
  | "context"
  | "stakeholders"
  | "partners"
  | "questions"
  | "pain"
  | "rfi"
  | "success"
  | "calls"
  | "research"
  | "gameplan";

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
  salesforceOpportunityId?: string;
  salesforceAccountId?: string;
  accountWebsite?: string;
  industry?: string;
  forecastCategory?: string;
  lastActivityDate?: string;
  sourceSystem?: string;
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

type AccountProfile = {
  id: number;
  accountName: string;
  industry: string;
  segment: string;
  health: string;
  score: number;
  notes: string;
  salesforceAccountId?: string;
  accountWebsite?: string;
};

type ContextSource = {
  id: number;
  sourceType: string;
  title: string;
  summary: string;
  sourceDate: string;
  status: string;
  createdAt: string;
};

type TranscriptQuestion = {
  question: string;
  status: string;
};

type TranscriptSignal = {
  label: string;
  tone: string;
};

type CallTranscript = {
  id: number;
  title: string;
  callDate: string;
  transcript: string;
  summary: string;
  attendees: string[];
  questions: TranscriptQuestion[];
  signals: TranscriptSignal[];
  createdAt: string;
};

type ResearchBrief = {
  id: number;
  title: string;
  status: string;
  summary: string;
  sources: { title?: string; url?: string }[];
  createdAt: string;
  updatedAt: string;
};

type AccountData = {
  profile: AccountProfile;
  opportunities: Opportunity[];
  sources: ContextSource[];
  transcripts: CallTranscript[];
  researchBriefs: ResearchBrief[];
};

const STAGES: { id: Stage; label: string; progress: number; accent: string }[] = [
  { id: "Qualification", label: "1. Qualification", progress: 15, accent: "#64eba7" },
  { id: "Discovery", label: "2. Discovery", progress: 30, accent: "#58c7e2" },
  { id: "POV Planning", label: "3. POV Planning", progress: 45, accent: "#9f8cff" },
  { id: "POV", label: "4. POV", progress: 60, accent: "#5eead4" },
  {
    id: "Decision / Negotiations",
    label: "5. Decision / Negotiations",
    progress: 75,
    accent: "#f0b33e",
  },
  {
    id: "Legal / Procurement",
    label: "6. Legal / Procurement",
    progress: 88,
    accent: "#ef7b67",
  },
  { id: "Closed", label: "7. Closed", progress: 100, accent: "#73e3a7" },
];

const ACCOUNT_TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "context", label: "Deal Context" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "partners", label: "Partners" },
  { id: "questions", label: "Questions" },
  { id: "pain", label: "Pain & Fit" },
  { id: "rfi", label: "RFI / RFP" },
  { id: "success", label: "Success Criteria" },
  { id: "calls", label: "Call Planning" },
  { id: "research", label: "Research" },
  { id: "gameplan", label: "Gameplan" },
];

const EMPTY_DRAFT: Draft = {
  accountName: "",
  opportunityName: "",
  owner: "",
  stage: "Qualification",
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

function stageLabel(stage: Stage | string) {
  return STAGES.find((item) => item.id === stage)?.label ?? stage;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [importingCsv, setImportingCsv] = useState(false);
  const [importMessage, setImportMessage] = useState("");
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
      const response = await fetch("/api/opportunities", { cache: "no-store" });
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

  const loadAccount = useCallback(async (nextAccountName: string) => {
    setAccountLoading(true);
    setAccountError("");

    try {
      const response = await fetch(
        `/api/accounts?accountName=${encodeURIComponent(nextAccountName)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as {
        account?: AccountData;
        error?: string;
      };

      if (!response.ok || !payload.account) {
        throw new Error(payload.error ?? "Unable to load account.");
      }

      setAccountData(payload.account);
    } catch (loadError) {
      setAccountError(
        loadError instanceof Error ? loadError.message : "Unable to load account."
      );
    } finally {
      setAccountLoading(false);
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
    if (!opportunity) return;

    setSelectedId(id);
    selectedIdRef.current = id;
    setDraft(toDraft(opportunity));
    setAccountName(opportunity.accountName);
    setActiveTab("overview");
    void loadAccount(opportunity.accountName);
  }

  function returnToDashboard() {
    setAccountName(null);
    setAccountData(null);
    setAccountError("");
    setActiveTab("overview");
    void loadOpportunities();
  }

  async function importSalesforceCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportingCsv(true);
    setImportMessage("");
    setError("");

    try {
      const csvText = await file.text();
      const response = await fetch("/api/opportunities/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const payload = (await response.json()) as {
        created?: number;
        error?: string;
        importedIds?: number[];
        opportunities?: Opportunity[];
        skipped?: number;
        updated?: number;
      };

      if (!response.ok || !payload.opportunities) {
        throw new Error(payload.error ?? "Unable to import Salesforce CSV.");
      }

      const rows = payload.opportunities;
      const importedId = payload.importedIds?.[0] ?? rows[0]?.id ?? null;
      const importedOpportunity =
        rows.find((row) => row.id === importedId) ?? rows[0] ?? null;

      setOpportunities(rows);
      setSelectedId(importedOpportunity?.id ?? null);
      selectedIdRef.current = importedOpportunity?.id ?? null;
      setDraft(importedOpportunity ? toDraft(importedOpportunity) : EMPTY_DRAFT);
      setImportMessage(
        `Imported ${payload.created ?? 0} new and updated ${
          payload.updated ?? 0
        }.`
      );

      if (importedOpportunity && rows.length === 1) {
        setAccountName(importedOpportunity.accountName);
        setActiveTab("context");
        void loadAccount(importedOpportunity.accountName);
      }
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import Salesforce CSV."
      );
    } finally {
      setImportingCsv(false);
    }
  }

  async function saveOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const isEditing = Boolean(selected);
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
        if (isEditing) {
          return current.map((item) => (item.id === saved.id ? saved : item));
        }
        return [saved, ...current];
      });
      setSelectedId(saved.id);
      selectedIdRef.current = saved.id;
      setDraft(toDraft(saved));
      if (!isEditing) {
        setAccountName(saved.accountName);
        setActiveTab("context");
        void loadAccount(saved.accountName);
      }
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
        current.map((item) => (item.id === saved.id ? saved : item))
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

  if (accountName) {
    return (
      <AccountView
        accountData={accountData}
        accountError={accountError}
        accountLoading={accountLoading}
        accountName={accountName}
        activeTab={activeTab}
        onBack={returnToDashboard}
        onReload={() => void loadAccount(accountName)}
        onTabChange={setActiveTab}
        onAccountUpdate={setAccountData}
        primaryOpportunity={selected}
      />
    );
  }

  return (
    <main className="app-shell account-shell dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Deal Engine</p>
          <h1>Open opportunities</h1>
        </div>
        <div className="topbar-actions">
          <label className="secondary-button import-button">
            {importingCsv ? "Importing" : "Import CSV"}
            <input
              accept=".csv,text/csv"
              disabled={importingCsv}
              onChange={(event) => void importSalesforceCsv(event)}
              type="file"
            />
          </label>
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
                  <span>{stage.label}</span>
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
                {stage.label}
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
      {importMessage ? (
        <div className="status-banner success-banner">{importMessage}</div>
      ) : null}

      <div className="workspace">
        <section className="opportunity-area">
          {loading ? (
            <div className="empty-state">Loading opportunities...</div>
          ) : opportunities.length === 0 ? (
            <FirstAccountEmptyState />
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
              <p className="eyebrow">
                {selected ? "Selected" : opportunities.length ? "New" : "First account"}
              </p>
              <h2>
                {selected
                  ? selected.accountName
                  : opportunities.length
                    ? "Opportunity"
                    : "Real account"}
              </h2>
            </div>
            {selected ? (
              <button
                className="secondary-button compact-button"
                onClick={() => selectOpportunity(selected.id)}
                type="button"
              >
                Open account
              </button>
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
                      {stage.label}
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
                {saving
                  ? "Saving"
                  : selected
                    ? "Save"
                    : opportunities.length
                      ? "Create"
                      : "Create account"}
              </button>
              {selected ? (
                <>
                  <button
                    className="secondary-button"
                    disabled={saving || selected.stage === "Closed"}
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

function FirstAccountEmptyState() {
  return (
    <section className="first-account-state">
      <p className="eyebrow">No open opportunities</p>
      <h2>Start with one real account.</h2>
      <p>
        Add the account and current opportunity details, then the workspace opens
        so you can bring in Gmail, Slack, and call context.
      </p>
    </section>
  );
}

function AccountView({
  accountData,
  accountError,
  accountLoading,
  accountName,
  activeTab,
  onAccountUpdate,
  onBack,
  onReload,
  onTabChange,
  primaryOpportunity,
}: {
  accountData: AccountData | null;
  accountError: string;
  accountLoading: boolean;
  accountName: string;
  activeTab: TabId;
  onAccountUpdate: (account: AccountData) => void;
  onBack: () => void;
  onReload: () => void;
  onTabChange: (tab: TabId) => void;
  primaryOpportunity: Opportunity | null;
}) {
  const opportunities = accountData?.opportunities ?? [];
  const totalValue = opportunities.reduce((sum, item) => sum + item.amount, 0);
  const weightedValue = opportunities.reduce(
    (sum, item) => sum + item.amount * (item.probability / 100),
    0
  );
  const openQuestions =
    accountData?.transcripts.reduce(
      (sum, transcript) => sum + transcript.questions.length,
      0
    ) ?? 0;
  const stakeholders = uniqueValues(
    accountData?.transcripts.flatMap((transcript) => transcript.attendees) ?? []
  );

  return (
    <main className="app-shell account-shell">
      <header className="account-topbar">
        <div className="account-title-row">
          <button className="icon-button" onClick={onBack} type="button">
            Back
          </button>
          <div>
            <p className="eyebrow">Account workspace</p>
            <h1>{accountName}</h1>
            <div className="account-badges">
              <span>{accountData?.profile.industry ?? "Unknown"}</span>
              <span>
                {primaryOpportunity ? stageLabel(primaryOpportunity.stage) : "Prospect"}
              </span>
              <span>{accountData?.profile.health ?? "Loading"}</span>
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button" onClick={onReload}>
            Refresh
          </button>
          <button className="primary-button" onClick={() => onTabChange("context")}>
            Add context
          </button>
        </div>
      </header>

      <nav className="account-tabs" aria-label="Account sections">
        {ACCOUNT_TABS.map((tab) => (
          <button
            className={activeTab === tab.id ? "account-tab active" : "account-tab"}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {accountError ? <div className="status-banner">{accountError}</div> : null}

      {accountLoading && !accountData ? (
        <div className="empty-state">Loading account...</div>
      ) : (
        <section className="account-layout">
          <aside className="account-rail" aria-label="Account summary">
            <Metric label="Open opps" value={String(opportunities.length)} />
            <Metric label="Pipeline" value={formatCompact(totalValue)} />
            <Metric label="Weighted" value={formatCompact(weightedValue)} />
            <Metric label="Sources" value={String(accountData?.sources.length ?? 0)} />
            <Metric label="People" value={String(stakeholders.length)} />
            <Metric label="Questions" value={String(openQuestions)} tone="watch" />
          </aside>

          <section className="account-main">
            <AccountTabPanel
              accountData={accountData}
              accountName={accountName}
              activeTab={activeTab}
              onAccountUpdate={onAccountUpdate}
              primaryOpportunity={primaryOpportunity}
              stakeholders={stakeholders}
            />
          </section>
        </section>
      )}
    </main>
  );
}

function AccountTabPanel({
  accountData,
  accountName,
  activeTab,
  onAccountUpdate,
  primaryOpportunity,
  stakeholders,
}: {
  accountData: AccountData | null;
  accountName: string;
  activeTab: TabId;
  onAccountUpdate: (account: AccountData) => void;
  primaryOpportunity: Opportunity | null;
  stakeholders: string[];
}) {
  if (!accountData) {
    return <div className="empty-state">No account data loaded.</div>;
  }

  if (activeTab === "context") {
    return (
      <DealContextTab
        accountData={accountData}
        accountName={accountName}
        onAccountUpdate={onAccountUpdate}
      />
    );
  }

  if (activeTab === "stakeholders") {
    return <StakeholdersTab accountData={accountData} stakeholders={stakeholders} />;
  }

  if (activeTab === "questions") {
    return <QuestionsTab accountData={accountData} />;
  }

  if (activeTab === "pain") {
    return <PainFitTab accountData={accountData} />;
  }

  if (activeTab === "research") {
    return (
      <ResearchTab
        accountData={accountData}
        accountName={accountName}
        onAccountUpdate={onAccountUpdate}
      />
    );
  }

  if (activeTab === "gameplan") {
    return <GameplanTab accountData={accountData} primaryOpportunity={primaryOpportunity} />;
  }

  if (activeTab === "calls") {
    return <CallsTab accountData={accountData} />;
  }

  if (activeTab === "partners") {
    return <PlaceholderTab title="Partner roster" value="No partners recorded yet." />;
  }

  if (activeTab === "rfi") {
    return <PlaceholderTab title="RFI / RFP" value="No RFI documents loaded yet." />;
  }

  if (activeTab === "success") {
    return (
      <PlaceholderTab
        title="Success criteria"
        value="No success criteria document loaded yet."
      />
    );
  }

  return (
    <OverviewTab
      accountData={accountData}
      primaryOpportunity={primaryOpportunity}
      stakeholders={stakeholders}
    />
  );
}

function OverviewTab({
  accountData,
  primaryOpportunity,
  stakeholders,
}: {
  accountData: AccountData;
  primaryOpportunity: Opportunity | null;
  stakeholders: string[];
}) {
  const recentSources = accountData.sources.slice(0, 4);

  return (
    <div className="tab-stack">
      <section className="insight-panel next-step-panel">
        <p className="eyebrow">Next step</p>
        <h2>{primaryOpportunity?.nextStep || "No next step set"}</h2>
        <p>{primaryOpportunity?.notes || "Add deal context to sharpen the next move."}</p>
      </section>

      <section className="section-block">
        <div className="section-head">
          <h2>Account Snapshot</h2>
          <span>{accountData.profile.health}</span>
        </div>
        <div className="snapshot-grid">
          <InfoTile label="Score" value={String(accountData.profile.score)} />
          <InfoTile
            label="Stage"
            value={primaryOpportunity ? stageLabel(primaryOpportunity.stage) : "Prospect"}
          />
          <InfoTile label="Open value" value={formatCurrency(primaryOpportunity?.amount ?? 0)} />
          <InfoTile label="Stakeholders" value={String(stakeholders.length)} />
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <h2>Recent context</h2>
          <span>{recentSources.length}</span>
        </div>
        <SourceList sources={recentSources} />
      </section>
    </div>
  );
}

function DealContextTab({
  accountData,
  accountName,
  onAccountUpdate,
}: {
  accountData: AccountData;
  accountName: string;
  onAccountUpdate: (account: AccountData) => void;
}) {
  const [transcriptTitle, setTranscriptTitle] = useState("");
  const [transcriptDate, setTranscriptDate] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [connectorSaving, setConnectorSaving] = useState("");
  const [error, setError] = useState("");

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setTranscriptTitle((current) => current || file.name.replace(/\.[^.]+$/, ""));
    setTranscriptText(await file.text());
  }

  async function saveTranscript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transcript",
          accountName,
          title: transcriptTitle,
          callDate: transcriptDate,
          fileName,
          transcript: transcriptText,
        }),
      });
      const payload = (await response.json()) as {
        account?: AccountData;
        error?: string;
      };

      if (!response.ok || !payload.account) {
        throw new Error(payload.error ?? "Unable to save transcript.");
      }

      onAccountUpdate(payload.account);
      setTranscriptTitle("");
      setTranscriptDate("");
      setTranscriptText("");
      setFileName("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save transcript."
      );
    } finally {
      setSaving(false);
    }
  }

  async function queueConnectorSource(sourceType: "gmail" | "slack") {
    setConnectorSaving(sourceType);
    setError("");

    try {
      const label = sourceType === "gmail" ? "Gmail" : "Slack";
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "source",
          accountName,
          sourceType,
          title: `${label} sync requested`,
          summary: `${label} context lane is ready for connector-backed account history.`,
        }),
      });
      const payload = (await response.json()) as {
        account?: AccountData;
        error?: string;
      };

      if (!response.ok || !payload.account) {
        throw new Error(payload.error ?? `Unable to queue ${label} sync.`);
      }

      onAccountUpdate(payload.account);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to queue connector sync."
      );
    } finally {
      setConnectorSaving("");
    }
  }

  return (
    <div className="tab-stack">
      <section className="section-block">
        <div className="section-head">
          <h2>Sync from apps</h2>
          <span>{accountData.sources.length} sources</span>
        </div>
        <div className="connector-grid">
          <ConnectorCard
            actionLabel={connectorSaving === "gmail" ? "Queued" : "Queue sync"}
            disabled={Boolean(connectorSaving)}
            label="Gmail"
            onAction={() => void queueConnectorSource("gmail")}
            status="Connector lane"
          />
          <ConnectorCard
            actionLabel={connectorSaving === "slack" ? "Queued" : "Queue sync"}
            disabled={Boolean(connectorSaving)}
            label="Slack"
            onAction={() => void queueConnectorSource("slack")}
            status="Connector lane"
          />
          <ConnectorCard
            actionLabel="Ready"
            disabled
            label="Gong"
            status="Transcript upload"
          />
        </div>
      </section>

      <form className="section-block transcript-form" onSubmit={saveTranscript}>
        <div className="section-head">
          <h2>Drop call transcripts</h2>
          <span>{accountData.transcripts.length} calls</span>
        </div>
        <label className="file-drop">
          <input
            accept=".txt,.vtt,.srt,.md,.csv"
            onChange={(event) => void readFile(event)}
            type="file"
          />
          <strong>{fileName || "Choose transcript file"}</strong>
          <span>TXT, VTT, SRT, MD, CSV</span>
        </label>
        <div className="form-grid">
          <label>
            <span>Call title</span>
            <input
              value={transcriptTitle}
              onChange={(event) => setTranscriptTitle(event.target.value)}
              placeholder="POC check-in"
            />
          </label>
          <label>
            <span>Call date</span>
            <input
              type="date"
              value={transcriptDate}
              onChange={(event) => setTranscriptDate(event.target.value)}
            />
          </label>
        </div>
        <label>
          <span>Transcript text</span>
          <textarea
            className="transcript-textarea"
            required
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.target.value)}
            placeholder="Paste transcript text here..."
          />
        </label>
        {error ? <div className="status-banner">{error}</div> : null}
        <div className="form-actions">
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Importing" : "Import transcript"}
          </button>
        </div>
      </form>

      <section className="section-block">
        <div className="section-head">
          <h2>Imported calls</h2>
          <span>{accountData.transcripts.length}</span>
        </div>
        <TranscriptList transcripts={accountData.transcripts} />
      </section>
    </div>
  );
}

function StakeholdersTab({
  accountData,
  stakeholders,
}: {
  accountData: AccountData;
  stakeholders: string[];
}) {
  return (
    <div className="tab-stack">
      <section className="section-block">
        <div className="section-head">
          <h2>Stakeholder map</h2>
          <span>{stakeholders.length}</span>
        </div>
        {stakeholders.length ? (
          <div className="person-grid">
            {stakeholders.map((person) => (
              <article className="person-card" key={person}>
                <strong>{person}</strong>
                <span>Unclassified</span>
                <p>
                  Seen across{" "}
                  {
                    accountData.transcripts.filter((transcript) =>
                      transcript.attendees.includes(person)
                    ).length
                  }{" "}
                  call(s)
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">No stakeholders extracted yet.</div>
        )}
      </section>
    </div>
  );
}

function QuestionsTab({ accountData }: { accountData: AccountData }) {
  const questions = accountData.transcripts.flatMap((transcript) =>
    transcript.questions.map((question) => ({
      ...question,
      title: transcript.title,
      callDate: transcript.callDate,
    }))
  );

  return (
    <div className="tab-stack">
      <section className="section-block">
        <div className="section-head">
          <h2>Questions overview</h2>
          <span>{questions.length}</span>
        </div>
        {questions.length ? (
          <div className="question-list">
            {questions.map((question, index) => (
              <article className="question-card" key={`${question.question}-${index}`}>
                <div>
                  <strong>{question.question}</strong>
                  <span>
                    {question.callDate ? dateLabel(question.callDate) : "No date"} ·{" "}
                    {question.title}
                  </span>
                </div>
                <span className="risk-pill risk-medium">{question.status}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">No questions extracted yet.</div>
        )}
      </section>
    </div>
  );
}

function PainFitTab({ accountData }: { accountData: AccountData }) {
  const signals = accountData.transcripts.flatMap((transcript) =>
    transcript.signals.map((signal) => ({
      ...signal,
      title: transcript.title,
      summary: transcript.summary,
    }))
  );

  return (
    <div className="tab-stack">
      <section className="section-block">
        <div className="section-head">
          <h2>Pain & fit intelligence</h2>
          <span>{signals.length}</span>
        </div>
        {signals.length ? (
          <div className="signal-grid">
            {signals.map((signal, index) => (
              <article className={`signal-card signal-${signal.tone}`} key={index}>
                <strong>{signal.label}</strong>
                <span>{signal.title}</span>
                <p>{signal.summary}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">No pain or fit signals extracted yet.</div>
        )}
      </section>
    </div>
  );
}

function ResearchTab({
  accountData,
  accountName,
  onAccountUpdate,
}: {
  accountData: AccountData;
  accountName: string;
  onAccountUpdate: (account: AccountData) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function queueResearch() {
    setSaving(true);
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "research",
        accountName,
        title: "Public account research",
        summary:
          "10-Ks, articles, breach notices, leadership changes, public risk signals, and source-backed deal implications.",
      }),
    });
    const payload = (await response.json()) as { account?: AccountData };
    if (payload.account) {
      onAccountUpdate(payload.account);
    }
    setSaving(false);
  }

  return (
    <div className="tab-stack">
      <section className="section-block">
        <div className="section-head">
          <h2>Deep research</h2>
          <button className="secondary-button" disabled={saving} onClick={queueResearch}>
            {saving ? "Queued" : "Queue brief"}
          </button>
        </div>
        <div className="research-grid">
          <InfoTile label="Filings" value="10-K / 10-Q" />
          <InfoTile label="Security" value="Breach signals" />
          <InfoTile label="News" value="Recent articles" />
          <InfoTile label="Deal angle" value="Mapped actions" />
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <h2>Research briefs</h2>
          <span>{accountData.researchBriefs.length}</span>
        </div>
        {accountData.researchBriefs.length ? (
          <div className="source-list">
            {accountData.researchBriefs.map((brief) => (
              <article className="source-card" key={brief.id}>
                <span>{brief.status}</span>
                <strong>{brief.title}</strong>
                <p>{brief.summary}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">No research briefs queued yet.</div>
        )}
      </section>
    </div>
  );
}

function GameplanTab({
  accountData,
  primaryOpportunity,
}: {
  accountData: AccountData;
  primaryOpportunity: Opportunity | null;
}) {
  const openQuestions = accountData.transcripts.flatMap(
    (transcript) => transcript.questions
  );
  const signalCount = accountData.transcripts.reduce(
    (sum, transcript) => sum + transcript.signals.length,
    0
  );

  return (
    <div className="tab-stack">
      <section className="insight-panel">
        <p className="eyebrow">Deal gameplan</p>
        <h2>
          {primaryOpportunity?.nextStep ||
            "Import deal context to generate the next strategic move."}
        </h2>
        <p>
          {signalCount} signal(s), {openQuestions.length} question(s), and{" "}
          {accountData.sources.length} source(s) are available for planning.
        </p>
      </section>
      <section className="section-block">
        <div className="section-head">
          <h2>Risk radar</h2>
          <span>{primaryOpportunity?.riskLevel ?? "Medium"}</span>
        </div>
        <div className="signal-grid">
          <article className="signal-card signal-risk">
            <strong>Open questions</strong>
            <p>{openQuestions.length || "No extracted open questions yet."}</p>
          </article>
          <article className="signal-card signal-watch">
            <strong>Context coverage</strong>
            <p>{accountData.sources.length} saved source record(s).</p>
          </article>
        </div>
      </section>
    </div>
  );
}

function CallsTab({ accountData }: { accountData: AccountData }) {
  return (
    <div className="tab-stack">
      <section className="section-block">
        <div className="section-head">
          <h2>Call history</h2>
          <span>{accountData.transcripts.length}</span>
        </div>
        <TranscriptList transcripts={accountData.transcripts} />
      </section>
    </div>
  );
}

function PlaceholderTab({ title, value }: { title: string; value: string }) {
  return (
    <div className="tab-stack">
      <section className="section-block">
        <div className="section-head">
          <h2>{title}</h2>
          <span>0</span>
        </div>
        <div className="empty-state">{value}</div>
      </section>
    </div>
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

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="info-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ConnectorCard({
  actionLabel,
  disabled,
  label,
  onAction,
  status,
}: {
  actionLabel: string;
  disabled?: boolean;
  label: string;
  onAction?: () => void;
  status: string;
}) {
  return (
    <article className="connector-card">
      <div>
        <strong>{label}</strong>
        <span>{status}</span>
      </div>
      <button
        className="secondary-button compact-button"
        disabled={disabled}
        onClick={onAction}
        type="button"
      >
        {actionLabel}
      </button>
    </article>
  );
}

function SourceList({ sources }: { sources: ContextSource[] }) {
  if (!sources.length) {
    return <div className="empty-state">No saved sources yet.</div>;
  }

  return (
    <div className="source-list">
      {sources.map((source) => (
        <article className="source-card" key={source.id}>
          <span>{source.sourceType}</span>
          <strong>{source.title}</strong>
          <p>{source.summary || "No summary captured."}</p>
        </article>
      ))}
    </div>
  );
}

function TranscriptList({ transcripts }: { transcripts: CallTranscript[] }) {
  if (!transcripts.length) {
    return <div className="empty-state">No transcripts imported yet.</div>;
  }

  return (
    <div className="transcript-list">
      {transcripts.map((transcript) => (
        <article className="transcript-card" key={transcript.id}>
          <div className="transcript-card-head">
            <div>
              <span>{transcript.callDate ? dateLabel(transcript.callDate) : "No date"}</span>
              <strong>{transcript.title}</strong>
            </div>
            <span>{transcript.questions.length} Qs</span>
          </div>
          <p>{transcript.summary}</p>
          <div className="tag-row">
            {transcript.attendees.slice(0, 6).map((attendee) => (
              <span key={attendee}>{attendee}</span>
            ))}
          </div>
          <div className="tag-row">
            {transcript.signals.map((signal) => (
              <span key={`${signal.label}-${signal.tone}`}>{signal.label}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
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
              <span>{stage.label}</span>
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
              <td>{stageLabel(item.stage)}</td>
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
