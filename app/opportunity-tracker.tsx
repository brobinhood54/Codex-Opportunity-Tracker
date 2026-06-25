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
type DashboardView = "opportunities" | "accounts";
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
  createdAt: string;
  updatedAt: string;
};

type AccountSummary = AccountProfile & {
  latestStage: string;
  lastActivityDate: string;
  nextStep: string;
  openOpportunityCount: number;
  sourceCount: number;
  totalPipeline: number;
  transcriptCount: number;
  weightedPipeline: number;
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
  owner?: string;
  answerOwner?: string;
  kind?: string;
  askedBy?: string;
  answeredBy?: string;
  answer?: string;
  action?: string;
  priority?: string;
  time?: string;
  timeline?: string;
};

type QuestionView = "person" | "timeline" | "open";
type QuestionFilter = "all" | "open" | "answered";
type QuestionStatus = "answered" | "deferred" | "action" | "open";

type EnrichedQuestion = TranscriptQuestion & {
  callDate: string;
  person: TranscriptPerson;
  status: QuestionStatus;
  title: string;
};

type TranscriptSignal = {
  label: string;
  tone: string;
  category?: string;
  summary?: string;
  evidence?: string;
  confidence?: string;
};

type TranscriptPerson = {
  name: string;
  title?: string;
  company?: string;
  side?: "customer" | "oasis" | "unknown";
  role?: string;
  influence?: string;
  mentionCount?: number;
  questionCount?: number;
};

type CallTranscript = {
  id: number;
  title: string;
  callDate: string;
  transcript: string;
  summary: string;
  attendees: (TranscriptPerson | string)[];
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
  const value = date.includes("T") ? new Date(date) : new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
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

function normalizePerson(person: TranscriptPerson | string): TranscriptPerson {
  if (typeof person === "string") {
    return {
      name: person,
      side: "unknown",
      role: "Unclassified",
      influence: "Low",
      mentionCount: 0,
      questionCount: 0,
    };
  }

  return {
    ...person,
    name: person.name || "Unknown person",
    side: person.side ?? "unknown",
    role: person.role || "Unclassified",
    influence: person.influence || "Low",
    mentionCount: person.mentionCount ?? 0,
    questionCount: person.questionCount ?? 0,
  };
}

function personMatches(a: string, b: string) {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left === right || left.startsWith(`${right} `) || right.startsWith(`${left} `);
}

function collectStakeholders(transcripts: CallTranscript[]) {
  const people: TranscriptPerson[] = [];

  for (const transcript of transcripts) {
    for (const attendee of transcript.attendees.map(normalizePerson)) {
      const existing = people.find((person) =>
        personMatches(person.name, attendee.name)
      );

      if (!existing) {
        people.push({ ...attendee });
        continue;
      }

      if (attendee.name.length > existing.name.length) existing.name = attendee.name;
      existing.title ||= attendee.title;
      existing.company ||= attendee.company;
      existing.role =
        existing.role === "Unclassified" ? attendee.role : existing.role;
      if (existing.side === "unknown" && attendee.side !== "unknown") {
        existing.side = attendee.side;
      }
      existing.influence =
        existing.influence === "High" || attendee.influence === "High"
          ? "High"
          : existing.influence === "Medium" || attendee.influence === "Medium"
            ? "Medium"
            : "Low";
      existing.mentionCount =
        (existing.mentionCount ?? 0) + (attendee.mentionCount ?? 0);
      existing.questionCount =
        (existing.questionCount ?? 0) + (attendee.questionCount ?? 0);
    }
  }

  return people
    .filter((person) => person.side !== "oasis")
    .sort((a, b) => {
      const influenceScore: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
      const influenceDelta =
        (influenceScore[b.influence ?? "Low"] ?? 1) -
        (influenceScore[a.influence ?? "Low"] ?? 1);
      if (influenceDelta) return influenceDelta;
      return (
        (b.mentionCount ?? 0) +
        (b.questionCount ?? 0) -
        ((a.mentionCount ?? 0) + (a.questionCount ?? 0))
      );
    });
}

function findQuestionPerson(
  stakeholders: TranscriptPerson[],
  question: TranscriptQuestion
) {
  const askedBy = question.askedBy || "Unknown speaker";
  const inferredSide =
    question.kind?.startsWith("oasis")
      ? "oasis"
      : question.kind?.startsWith("customer")
        ? "customer"
        : "unknown";
  return (
    stakeholders.find((person) => personMatches(person.name, askedBy)) ?? {
      name: askedBy,
      side: inferredSide,
      role:
        inferredSide === "oasis"
          ? "Oasis team"
          : question.owner === "Oasis"
            ? "Customer stakeholder"
            : "Deal participant",
      influence: "Low",
      mentionCount: 0,
      questionCount: 0,
    }
  );
}

function normalizeQuestionStatus(question: TranscriptQuestion): QuestionStatus {
  if (question.status === "deferred") return "deferred";
  if (question.status === "action") return "action";
  if (question.status === "answered" || question.answer) return "answered";
  return "open";
}

function questionStatusLabel(status: QuestionStatus) {
  if (status === "answered") return "Answered";
  if (status === "deferred") return "Deferred";
  if (status === "action") return "Follow-up owed";
  return "Open loop";
}

function questionIsOpen(question: EnrichedQuestion) {
  return question.status !== "answered";
}

function questionMatchesFilter(question: EnrichedQuestion, filter: QuestionFilter) {
  if (filter === "answered") return question.status === "answered";
  if (filter === "open") return questionIsOpen(question);
  return true;
}

function questionPriorityRank(question: EnrichedQuestion) {
  const priorityScore: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  const statusScore: Record<QuestionStatus, number> = {
    action: 4,
    open: 3,
    deferred: 2,
    answered: 1,
  };
  return (
    (statusScore[question.status] ?? 1) * 10 +
    (priorityScore[question.priority ?? "Low"] ?? 1)
  );
}

function answerOwnerLabel(question: TranscriptQuestion) {
  return question.answerOwner || question.owner || "Mutual";
}

function timelineCueFromText(...values: Array<string | undefined>) {
  const source = values.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const normalized = source.toLowerCase();
  const explicitDate = source.match(
    /\b(?:by|before|on|after|during)?\s*((?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\.?\s+\d{1,2}(?:,?\s+20\d{2})?|\d{1,2}\/\d{1,2}(?:\/(?:20)?\d{2})?)\b/i
  );
  if (explicitDate?.[0]) return explicitDate[0].trim();

  const cues: Array<[RegExp, string]> = [
    [/\bbefore\s+(?:the\s+)?next\s+check-?in\b/i, "Before next check-in"],
    [/\bnext\s+check-?in\b/i, "Next check-in"],
    [/\bbefore\s+(?:the\s+)?next\s+call\b/i, "Before next call"],
    [/\bnext\s+call\b/i, "Next call"],
    [/\bbefore\s+(?:the\s+)?next\s+meeting\b/i, "Before next meeting"],
    [/\bnext\s+meeting\b/i, "Next meeting"],
    [/\bbefore\s+scoring\s+begins\b/i, "Before scoring begins"],
    [/\bpoc\s+kickoff\b/i, "POC kickoff"],
    [/\bthis\s+week\b/i, "This week"],
    [/\bnext\s+week\b/i, "Next week"],
    [/\bimmediately\b/i, "Immediately"],
    [/\basap\b/i, "ASAP"],
    [/\bafter\s+(?:the\s+)?vendor\s+assessment\b/i, "After vendor assessment"],
    [/\bafter\s+(?:the\s+)?security\s+review\b/i, "After security review"],
  ];

  for (const [pattern, label] of cues) {
    if (pattern.test(normalized)) return label;
  }

  return "";
}

function questionTimelineLabel(question: EnrichedQuestion) {
  return (
    question.timeline ||
    timelineCueFromText(question.question, question.answer, question.action) ||
    "No timeline captured"
  );
}

function isCustomerDealQuestion(question: TranscriptQuestion, person: TranscriptPerson) {
  if (question.kind?.startsWith("oasis")) return false;
  if (person.side === "oasis") return false;
  if (question.kind?.startsWith("customer")) return true;
  return person.side === "customer";
}

function parseSourceLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [titlePart, urlPart] = line.split(/\s+\|\s+/, 2);
      const isUrlOnly = /^https?:\/\//i.test(titlePart);
      return {
        title: titlePart,
        url: urlPart || (isUrlOnly ? titlePart : ""),
      };
    });
}

export default function OpportunityTracker() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [dashboardView, setDashboardView] =
    useState<DashboardView>("opportunities");
  const [mode, setMode] = useState<"board" | "table">("board");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"All" | Stage>("All");
  const [riskFilter, setRiskFilter] = useState<"All" | RiskLevel>("All");
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
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

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      const payload = (await response.json()) as {
        accounts?: AccountSummary[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load accounts.");
      }

      setAccounts(payload.accounts ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load accounts."
      );
    } finally {
      setAccountsLoading(false);
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
    // The tracker needs durable account and opportunity records when the app opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOpportunities();
    void loadAccounts();
  }, [loadAccounts, loadOpportunities]);

  function refreshDashboard() {
    setLoading(true);
    setAccountsLoading(true);
    setError("");
    void loadOpportunities();
    void loadAccounts();
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

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return accounts.filter((account) => {
      if (!normalizedQuery) return true;
      return `${account.accountName} ${account.industry} ${account.latestStage} ${account.nextStep}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [accounts, query]);

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

  const accountMetrics = useMemo(() => {
    const activeAccounts = accounts.filter(
      (account) => account.openOpportunityCount > 0
    ).length;
    const contextReady = accounts.filter(
      (account) => account.sourceCount + account.transcriptCount > 0
    ).length;
    const atRisk = accounts.filter((account) =>
      account.health.toLowerCase().includes("risk")
    ).length;
    const totalPipeline = accounts.reduce(
      (sum, account) => sum + account.totalPipeline,
      0
    );
    const weightedPipeline = accounts.reduce(
      (sum, account) => sum + account.weightedPipeline,
      0
    );
    const openOpportunities = accounts.reduce(
      (sum, account) => sum + account.openOpportunityCount,
      0
    );

    return {
      activeAccounts,
      atRisk,
      contextReady,
      openOpportunities,
      totalPipeline,
      weightedPipeline,
    };
  }, [accounts]);

  const accountStrip = useMemo(
    () => [
      {
        accent: "#64eba7",
        label: "With open opps",
        value: accountMetrics.activeAccounts,
      },
      {
        accent: "#58c7e2",
        label: "No open opp",
        value: Math.max(0, accounts.length - accountMetrics.activeAccounts),
      },
      {
        accent: "#9f8cff",
        label: "With context",
        value: accountMetrics.contextReady,
      },
      {
        accent: "#ef7b67",
        label: "At risk",
        value: accountMetrics.atRisk,
      },
    ],
    [accountMetrics, accounts.length]
  );

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startNew() {
    setDashboardView("opportunities");
    setSelectedId(null);
    selectedIdRef.current = null;
    setDraft(EMPTY_DRAFT);
  }

  function openAccount(nextAccountName: string) {
    const primary =
      opportunities.find((item) => item.accountName === nextAccountName) ?? null;

    setSelectedId(primary?.id ?? null);
    selectedIdRef.current = primary?.id ?? null;
    setDraft(
      primary ? toDraft(primary) : { ...EMPTY_DRAFT, accountName: nextAccountName }
    );
    setAccountName(nextAccountName);
    setActiveTab("overview");
    void loadAccount(nextAccountName);
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
    void loadAccounts();
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
      void loadAccounts();

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
      void loadAccounts();
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
      void loadAccounts();
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
      void loadAccounts();
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
          <h1>
            {dashboardView === "opportunities"
              ? "Open opportunities"
              : "All accounts"}
          </h1>
        </div>
        <div className="topbar-actions">
          <div className="segmented-control dashboard-switch" aria-label="Dashboard view">
            <button
              className={dashboardView === "opportunities" ? "active" : ""}
              onClick={() => setDashboardView("opportunities")}
              type="button"
            >
              Open opps
            </button>
            <button
              className={dashboardView === "accounts" ? "active" : ""}
              onClick={() => setDashboardView("accounts")}
              type="button"
            >
              Accounts
            </button>
          </div>
          <label className="secondary-button import-button">
            {importingCsv ? "Importing" : "Import CSV"}
            <input
              accept=".csv,text/csv"
              disabled={importingCsv}
              onChange={(event) => void importSalesforceCsv(event)}
              type="file"
            />
          </label>
          <button className="secondary-button" onClick={refreshDashboard}>
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
            {dashboardView === "opportunities" ? (
              <>
                <Metric label="Open" value={String(opportunities.length)} />
                <Metric label="Pipeline" value={formatCompact(metrics.value)} />
                <Metric label="Weighted" value={formatCompact(metrics.weighted)} />
                <Metric label="Progress" value={`${metrics.averageProgress}%`} />
                <Metric label="Next steps" value={String(metrics.dueSoon)} tone="watch" />
                <Metric label="High risk" value={String(metrics.highRisk)} tone="risk" />
              </>
            ) : (
              <>
                <Metric label="Accounts" value={String(accounts.length)} />
                <Metric
                  label="With opps"
                  value={String(accountMetrics.activeAccounts)}
                />
                <Metric
                  label="Open opps"
                  value={String(accountMetrics.openOpportunities)}
                />
                <Metric
                  label="Pipeline"
                  value={formatCompact(accountMetrics.totalPipeline)}
                />
                <Metric
                  label="Weighted"
                  value={formatCompact(accountMetrics.weightedPipeline)}
                />
                <Metric
                  label="Context"
                  value={String(accountMetrics.contextReady)}
                  tone="watch"
                />
              </>
            )}
          </div>
          <div className="stage-strip" aria-label="Stage distribution">
            {dashboardView === "opportunities"
              ? STAGES.map((stage) => {
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
                })
              : accountStrip.map((item) => (
                  <div
                    className="stage-chip account-chip"
                    key={item.label}
                    style={{ "--accent": item.accent } as CSSProperties}
                  >
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="pipeline-visual"
          src="/opportunity-pipeline.png"
          alt="Opportunity pipeline planning board"
        />
      </section>

      <section className="toolbar" aria-label="Dashboard filters">
        <label className="search-field">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              dashboardView === "opportunities"
                ? "Account, deal, owner, next step"
                : "Account, industry, stage, next step"
            }
          />
        </label>
        {dashboardView === "opportunities" ? (
          <>
            <label className="select-field">
              <span>Stage</span>
              <select
                value={stageFilter}
                onChange={(event) =>
                  setStageFilter(event.target.value as "All" | Stage)
                }
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
          </>
        ) : (
          <div className="account-toolbar-spacer" aria-hidden="true" />
        )}
      </section>

      {error ? <div className="status-banner">{error}</div> : null}
      {importMessage ? (
        <div className="status-banner success-banner">{importMessage}</div>
      ) : null}

      {dashboardView === "accounts" ? (
        <div className="workspace accounts-workspace">
          <section className="opportunity-area accounts-area">
            {accountsLoading ? (
              <div className="empty-state">Loading accounts...</div>
            ) : accounts.length === 0 ? (
              <FirstAccountEmptyState />
            ) : (
              <AccountDirectory
                accounts={filteredAccounts}
                onSelect={openAccount}
              />
            )}
          </section>
        </div>
      ) : (
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
      )}
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

function AccountDirectory({
  accounts,
  onSelect,
}: {
  accounts: AccountSummary[];
  onSelect: (accountName: string) => void;
}) {
  if (!accounts.length) {
    return <div className="empty-state">No accounts match.</div>;
  }

  return (
    <div className="table-wrap account-directory">
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Health</th>
            <th>Open opps</th>
            <th>Pipeline</th>
            <th>Stage</th>
            <th>Next step</th>
            <th>Context</th>
            <th>Activity</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => {
            const contextCount = account.sourceCount + account.transcriptCount;
            const health =
              account.health || (account.openOpportunityCount ? "Active" : "Prospect");
            const healthClass = health.toLowerCase().includes("risk")
              ? "risk-high"
              : "risk-low";

            return (
              <tr
                key={account.accountName}
                onClick={() => onSelect(account.accountName)}
              >
                <td>
                  <button className="account-name-button" type="button">
                    <strong>{account.accountName}</strong>
                    <span>{account.industry || "Unknown"}</span>
                  </button>
                </td>
                <td>
                  <span className={`risk-pill ${healthClass}`}>{health}</span>
                </td>
                <td>
                  <strong>{account.openOpportunityCount}</strong>
                  <span>
                    {account.openOpportunityCount === 1 ? "deal" : "deals"}
                  </span>
                </td>
                <td>
                  <strong>{formatCompact(account.totalPipeline)}</strong>
                  <span>{formatCompact(account.weightedPipeline)} weighted</span>
                </td>
                <td>{stageLabel(account.latestStage || "No open opp")}</td>
                <td>
                  <strong>
                    {account.nextStep ||
                      (account.openOpportunityCount ? "Open" : "No active deal")}
                  </strong>
                </td>
                <td>
                  <strong>{contextCount}</strong>
                  <span>
                    {account.transcriptCount} calls, {account.sourceCount} sources
                  </span>
                </td>
                <td>{dateLabel(account.lastActivityDate || account.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
  const activeOpportunity = primaryOpportunity ?? opportunities[0] ?? null;
  const totalValue = opportunities.reduce((sum, item) => sum + item.amount, 0);
  const weightedValue = opportunities.reduce(
    (sum, item) => sum + item.amount * (item.probability / 100),
    0
  );
  const [reprocessError, setReprocessError] = useState("");
  const [reprocessMessage, setReprocessMessage] = useState("");
  const [reprocessing, setReprocessing] = useState(false);
  const openQuestions =
    accountData?.transcripts.reduce(
      (sum, transcript) => sum + transcript.questions.length,
      0
    ) ?? 0;
  const stakeholders = collectStakeholders(accountData?.transcripts ?? []);

  async function reprocessCalls() {
    if (!accountData?.transcripts.length) return;

    setReprocessError("");
    setReprocessMessage("");
    setReprocessing(true);

    try {
      const response = await fetch("/api/accounts", {
        body: JSON.stringify({ action: "reprocess", accountName }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        account?: AccountData;
        error?: string;
        reprocessed?: number;
      };

      if (!response.ok || !payload.account) {
        throw new Error(payload.error ?? "Unable to reprocess calls.");
      }

      onAccountUpdate(payload.account);
      setReprocessMessage(
        `Reprocessed ${payload.reprocessed ?? accountData.transcripts.length} saved call(s).`
      );
    } catch (error) {
      setReprocessError(
        error instanceof Error ? error.message : "Unable to reprocess calls."
      );
    } finally {
      setReprocessing(false);
    }
  }

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
                {activeOpportunity ? stageLabel(activeOpportunity.stage) : "Prospect"}
              </span>
              <span>{accountData?.profile.health ?? "Loading"}</span>
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button" onClick={onReload} type="button">
            Refresh
          </button>
          <button
            className="secondary-button"
            disabled={!accountData?.transcripts.length || reprocessing}
            onClick={() => void reprocessCalls()}
            type="button"
          >
            {reprocessing ? "Reprocessing" : "Reprocess calls"}
          </button>
          <button
            className="primary-button"
            onClick={() => onTabChange("context")}
            type="button"
          >
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
      {reprocessError ? <div className="status-banner">{reprocessError}</div> : null}
      {reprocessMessage ? (
        <div className="status-banner success-banner">{reprocessMessage}</div>
      ) : null}

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
              primaryOpportunity={activeOpportunity}
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
  stakeholders: TranscriptPerson[];
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
      <SuccessCriteriaTab
        accountData={accountData}
        accountName={accountName}
        onAccountUpdate={onAccountUpdate}
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
  stakeholders: TranscriptPerson[];
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
  const [contextType, setContextType] = useState<"gmail" | "slack" | "manual">(
    "gmail"
  );
  const [contextTitle, setContextTitle] = useState("");
  const [contextDate, setContextDate] = useState("");
  const [contextSummary, setContextSummary] = useState("");
  const [contextSaving, setContextSaving] = useState(false);
  const [contextError, setContextError] = useState("");
  const [transcriptError, setTranscriptError] = useState("");

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
    setTranscriptError("");

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
      setTranscriptError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save transcript."
      );
    } finally {
      setSaving(false);
    }
  }

  function selectContextType(sourceType: "gmail" | "slack") {
    const label = sourceType === "gmail" ? "Gmail" : "Slack";
    setContextType(sourceType);
    setContextTitle((current) => current || `${label} deal context`);
  }

  async function saveContextSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContextSaving(true);
    setContextError("");

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "source",
          accountName,
          sourceType: contextType,
          title: contextTitle,
          sourceDate: contextDate,
          summary: contextSummary,
        }),
      });
      const payload = (await response.json()) as {
        account?: AccountData;
        error?: string;
      };

      if (!response.ok || !payload.account) {
        throw new Error(payload.error ?? "Unable to save context.");
      }

      onAccountUpdate(payload.account);
      setContextTitle("");
      setContextDate("");
      setContextSummary("");
    } catch (saveError) {
      setContextError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save context."
      );
    } finally {
      setContextSaving(false);
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
            actionLabel={contextType === "gmail" ? "Selected" : "Use"}
            disabled={contextSaving}
            label="Gmail"
            onAction={() => selectContextType("gmail")}
            status="Email context"
          />
          <ConnectorCard
            actionLabel={contextType === "slack" ? "Selected" : "Use"}
            disabled={contextSaving}
            label="Slack"
            onAction={() => selectContextType("slack")}
            status="Channel context"
          />
          <ConnectorCard
            actionLabel="Ready"
            disabled
            label="Gong"
            status="Transcript upload"
          />
        </div>
      </section>

      <form className="section-block context-form" onSubmit={saveContextSource}>
        <div className="section-head">
          <h2>Import app context</h2>
          <span>{contextType}</span>
        </div>
        <div className="form-grid">
          <label>
            <span>Source</span>
            <select
              value={contextType}
              onChange={(event) =>
                setContextType(event.target.value as "gmail" | "slack" | "manual")
              }
            >
              <option value="gmail">Gmail</option>
              <option value="slack">Slack</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={contextDate}
              onChange={(event) => setContextDate(event.target.value)}
            />
          </label>
        </div>
        <label>
          <span>Title</span>
          <input
            required
            value={contextTitle}
            onChange={(event) => setContextTitle(event.target.value)}
            placeholder="Champion email thread, security Slack thread"
          />
        </label>
        <label>
          <span>Summary</span>
          <textarea
            className="context-textarea"
            required
            value={contextSummary}
            onChange={(event) => setContextSummary(event.target.value)}
            placeholder="Paste the Codex-generated Gmail or Slack summary here..."
          />
        </label>
        {contextError ? <div className="status-banner">{contextError}</div> : null}
        <div className="form-actions">
          <button className="primary-button" disabled={contextSaving} type="submit">
            {contextSaving ? "Saving" : "Save context"}
          </button>
        </div>
      </form>

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
        {transcriptError ? (
          <div className="status-banner">{transcriptError}</div>
        ) : null}
        <div className="form-actions">
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Importing" : "Import transcript"}
          </button>
        </div>
      </form>

      <section className="section-block">
        <div className="section-head">
          <h2>Saved context</h2>
          <span>{accountData.sources.length}</span>
        </div>
        <SourceList sources={accountData.sources} />
      </section>

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
  stakeholders: TranscriptPerson[];
}) {
  const oasisTeam = accountData.transcripts
    .flatMap((transcript) => transcript.attendees.map(normalizePerson))
    .filter((person) => person.side === "oasis");

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
              <article className="person-card" key={person.name}>
                <div className="person-card-head">
                  <strong>{person.name}</strong>
                  <span className={`risk-pill ${
                    person.influence === "High"
                      ? "risk-high"
                      : person.influence === "Medium"
                        ? "risk-medium"
                        : "risk-low"
                  }`}>
                    {person.influence}
                  </span>
                </div>
                <span>{person.role || "Unclassified"}</span>
                {person.title || person.company ? (
                  <p>
                    {[person.title, person.company].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                <p>
                  {person.mentionCount ?? 0} turn(s), {person.questionCount ?? 0}{" "}
                  deal question(s)
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">No stakeholders extracted yet.</div>
        )}
      </section>
      {oasisTeam.length ? (
        <section className="section-block">
          <div className="section-head">
            <h2>Oasis team on calls</h2>
            <span>{oasisTeam.length}</span>
          </div>
          <div className="tag-row">
            {oasisTeam.map((person) => (
              <span key={person.name}>{person.name}</span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function QuestionsTab({ accountData }: { accountData: AccountData }) {
  const [view, setView] = useState<QuestionView>("person");
  const [filter, setFilter] = useState<QuestionFilter>("all");
  const stakeholders = collectStakeholders(accountData.transcripts);
  const questions = accountData.transcripts
    .flatMap((transcript) =>
      transcript.questions.map((question) => {
        const status = normalizeQuestionStatus(question);
        const person = findQuestionPerson(stakeholders, question);
        return {
          ...question,
          status,
          title: transcript.title,
          callDate: transcript.callDate,
          person,
        };
      })
    )
    .filter((question) => isCustomerDealQuestion(question, question.person))
    .sort((a, b) => {
      const dateDelta = (b.callDate || "").localeCompare(a.callDate || "");
      if (dateDelta) return dateDelta;
      return questionPriorityRank(b) - questionPriorityRank(a);
    });
  const activeFilter = view === "open" ? "open" : filter;
  const visibleQuestions = questions.filter((question) =>
    questionMatchesFilter(question, activeFilter)
  );
  const answered = questions.filter((question) => question.status === "answered").length;
  const deferred = questions.filter((question) => question.status === "deferred").length;
  const followUpOwed = questions.filter(
    (question) =>
      questionIsOpen(question) &&
      (question.status === "action" || question.owner === "Oasis")
  ).length;
  const openLoops = questions.filter(questionIsOpen).length;
  const personGroups = Array.from(
    visibleQuestions.reduce((groups, question) => {
      const key = question.person.name;
      const group = groups.get(key) ?? { person: question.person, questions: [] };
      group.questions.push(question);
      groups.set(key, group);
      return groups;
    }, new Map<string, { person: TranscriptPerson; questions: EnrichedQuestion[] }>())
  ).map(([, group]) => group);
  const timelineQuestions = [...visibleQuestions].sort((a, b) => {
    const dateDelta = (a.callDate || "").localeCompare(b.callDate || "");
    if (dateDelta) return dateDelta;
    return (a.time || "").localeCompare(b.time || "");
  });
  const openLoopQuestions = visibleQuestions
    .filter(questionIsOpen)
    .sort((a, b) => questionPriorityRank(b) - questionPriorityRank(a));
  const filterOptions: Array<[QuestionFilter, string]> =
    view === "open"
      ? [["open", "Open"]]
      : [
          ["all", "All"],
          ["open", "Open"],
          ["answered", "Answered"],
        ];

  return (
    <div className="tab-stack">
      <section className="section-block questions-overview">
        <div className="section-head">
          <h2>Questions overview</h2>
          <span>{questions.length} captured</span>
        </div>
        <div className="question-stat-row" aria-label="Question totals">
          <span className="question-stat stat-total">Total: {questions.length}</span>
          <span className="question-stat stat-answered">Answered: {answered}</span>
          <span className="question-stat stat-deferred">Deferred: {deferred}</span>
          <span className="question-stat stat-followup">Follow-up owed: {followUpOwed}</span>
          <span className="question-stat stat-open">{openLoops} open loops</span>
        </div>
        <div className="question-toolbar">
          <div className="question-control-group">
            <span>View:</span>
            {[
              ["person", "By Person"],
              ["timeline", "Timeline"],
              ["open", "Open Loops"],
            ].map(([id, label]) => (
              <button
                className={view === id ? "active" : ""}
                key={id}
                onClick={() => {
                  const nextView = id as QuestionView;
                  setView(nextView);
                  if (nextView === "open") setFilter("open");
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="question-control-group">
            <span>Filter:</span>
            {filterOptions.map(([id, label]) => (
              <button
                className={activeFilter === id ? "active" : ""}
                key={id}
                onClick={() => setFilter(id)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {questions.length ? (
          <>
            {view === "person" ? (
              <div className="question-person-list">
                {personGroups.map((group) => (
                  <section className="question-person-group" key={group.person.name}>
                    <div className="question-person-head">
                      <div>
                        <h3>{group.person.name}</h3>
                        <span>
                          {[group.person.title, group.person.company]
                            .filter(Boolean)
                            .join(" · ") || "Stakeholder"}
                        </span>
                      </div>
                      <div className="question-person-meta">
                        <span className="role-pill">{group.person.role}</span>
                        <strong>{group.questions.length} QS</strong>
                      </div>
                    </div>
                    <div className="question-list">
                      {group.questions.map((question, index) => (
                        <QuestionCard
                          key={`${question.person.name}-${question.question}-${index}`}
                          question={question}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}

            {view === "timeline" ? (
              <div className="question-timeline">
                {timelineQuestions.map((question, index) => (
                  <div className="question-timeline-row" key={`${question.question}-${index}`}>
                    <span>
                      {question.callDate ? dateLabel(question.callDate) : "No date"}
                      {question.time ? ` · ${question.time}` : ""}
                    </span>
                    <QuestionCard question={question} />
                  </div>
                ))}
              </div>
            ) : null}

            {view === "open" ? (
              <div className="question-list">
                {openLoopQuestions.map((question, index) => (
                  <QuestionCard key={`${question.question}-${index}`} question={question} />
                ))}
              </div>
            ) : null}

            {!visibleQuestions.length || (view === "open" && !openLoopQuestions.length) ? (
              <div className="empty-state">No questions match this view.</div>
            ) : null}
          </>
        ) : (
          <div className="empty-state">No deal questions or actions extracted yet.</div>
        )}
      </section>
    </div>
  );
}

function QuestionCard({ question }: { question: EnrichedQuestion }) {
  const statusClass =
    question.status === "answered"
      ? "answered"
      : question.status === "deferred"
        ? "deferred"
        : "open";
  const answerText =
    question.answer ||
    (question.status === "answered"
      ? "Answered on the call."
      : "No captured answer yet.");
  const askerDetails = [question.person.role, question.person.title, question.person.company]
    .filter(Boolean)
    .join(" · ");
  const timelineLabel = questionTimelineLabel(question);
  const answerOwner = answerOwnerLabel(question);
  const showLoopDetails = questionIsOpen(question);

  return (
    <article className={`question-card question-card-${statusClass}`}>
      <div className="question-card-main">
        <span className="question-source">
          from {question.callDate ? dateLabel(question.callDate) : "No date"}
          {question.time ? ` at ${question.time}` : ""} · {question.title}
        </span>
        <strong>&quot;{question.question}&quot;</strong>
        {showLoopDetails ? (
          <div className="question-loop-grid" aria-label="Open loop ownership">
            <span>
              <em>Asked by</em>
              {question.askedBy || question.person.name}
              {askerDetails ? <small>{askerDetails}</small> : null}
            </span>
            <span>
              <em>Answer owner</em>
              {answerOwner}
              {question.answeredBy ? <small>last response: {question.answeredBy}</small> : null}
            </span>
            <span>
              <em>Timeline</em>
              {timelineLabel}
              <small>
                {question.callDate
                  ? `source call ${dateLabel(question.callDate)}`
                  : "from transcript"}
              </small>
            </span>
          </div>
        ) : null}
        <p className={question.answer ? "question-answer" : "question-answer muted"}>
          {question.answer ? (
            <>
              <span className="question-answer-label">Captured answer</span>
              <span>{question.answeredBy || "Answer"}: {answerText}</span>
            </>
          ) : (
            answerText
          )}
        </p>
      </div>
      <div className="question-badges">
        <span className={`question-status-pill status-${statusClass}`}>
          {questionStatusLabel(question.status)}
        </span>
        <span className="risk-pill risk-medium">{answerOwner}</span>
        <span className={`risk-pill ${
          question.priority === "High"
            ? "risk-high"
            : question.priority === "Medium"
              ? "risk-medium"
              : "risk-low"
        }`}>
          {question.priority ?? "Low"}
        </span>
      </div>
    </article>
  );
}

function PainFitTab({ accountData }: { accountData: AccountData }) {
  const signals = accountData.transcripts.flatMap((transcript) =>
    transcript.signals.map((signal) => ({
      ...signal,
      title: transcript.title,
      summary: signal.summary || transcript.summary,
    }))
  );
  const byCategory = signals.reduce<Record<string, number>>((counts, signal) => {
    const category = signal.category ?? "Signal";
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="tab-stack">
      <section className="section-block">
        <div className="section-head">
          <h2>Opportunity position</h2>
          <span>
            {Object.entries(byCategory)
              .map(([category, count]) => `${category} ${count}`)
              .join(" · ") || "0"}
          </span>
        </div>
        {signals.length ? (
          <div className="signal-grid">
            {signals.map((signal, index) => (
              <article className={`signal-card signal-${signal.tone}`} key={index}>
                <span>{signal.category ?? "Signal"} · {signal.title}</span>
                <strong>{signal.label}</strong>
                <p>{signal.summary}</p>
                {signal.evidence ? (
                  <blockquote>{signal.evidence}</blockquote>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">No high-value deal signals extracted yet.</div>
        )}
      </section>
    </div>
  );
}

function SuccessCriteriaTab({
  accountData,
  accountName,
  onAccountUpdate,
}: {
  accountData: AccountData;
  accountName: string;
  onAccountUpdate: (account: AccountData) => void;
}) {
  const [title, setTitle] = useState("Success criteria");
  const [criteriaText, setCriteriaText] = useState("");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savedCriteria = accountData.sources.filter((source) =>
    /success criteria|scorecard|evaluation criteria|poc criteria|criteria/i.test(
      `${source.title} ${source.summary}`
    )
  );

  async function readCriteriaFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setTitle((current) => current || file.name.replace(/\.[^.]+$/, ""));
    setCriteriaText(await file.text());
  }

  async function saveCriteria(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "source",
          accountName,
          sourceType: "file",
          title,
          summary: criteriaText,
        }),
      });
      const payload = (await response.json()) as {
        account?: AccountData;
        error?: string;
      };

      if (!response.ok || !payload.account) {
        throw new Error(payload.error ?? "Unable to save success criteria.");
      }

      onAccountUpdate(payload.account);
      setTitle("Success criteria");
      setCriteriaText("");
      setFileName("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save success criteria."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tab-stack">
      <form className="section-block success-form" onSubmit={saveCriteria}>
        <div className="section-head">
          <h2>Upload success criteria</h2>
          <span>{savedCriteria.length}</span>
        </div>
        <label className="file-drop">
          <input
            accept=".txt,.md,.csv,.doc,.docx"
            onChange={(event) => void readCriteriaFile(event)}
            type="file"
          />
          <strong>{fileName || "Choose criteria file"}</strong>
          <span>TXT, MD, CSV, DOCX text export</span>
        </label>
        <label>
          <span>Title</span>
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          <span>Criteria text</span>
          <textarea
            className="research-textarea"
            required
            value={criteriaText}
            onChange={(event) => setCriteriaText(event.target.value)}
            placeholder="Paste evaluation criteria, POC scorecard, customer requirements, or success plan here..."
          />
        </label>
        {error ? <div className="status-banner">{error}</div> : null}
        <div className="form-actions">
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Saving" : "Save criteria"}
          </button>
        </div>
      </form>

      <section className="section-block">
        <div className="section-head">
          <h2>Saved criteria</h2>
          <span>{savedCriteria.length}</span>
        </div>
        <SourceList sources={savedCriteria} />
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
  const [briefTitle, setBriefTitle] = useState("Public account research");
  const [briefSummary, setBriefSummary] = useState("");
  const [briefSources, setBriefSources] = useState("");
  const [error, setError] = useState("");

  async function queueResearch() {
    setSaving(true);
    setError("");
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

  async function saveResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "research",
          accountName,
          title: briefTitle,
          status: "complete",
          summary: briefSummary,
          sources: parseSourceLines(briefSources),
        }),
      });
      const payload = (await response.json()) as {
        account?: AccountData;
        error?: string;
      };

      if (!response.ok || !payload.account) {
        throw new Error(payload.error ?? "Unable to save research.");
      }

      onAccountUpdate(payload.account);
      setBriefTitle("Public account research");
      setBriefSummary("");
      setBriefSources("");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save research."
      );
    } finally {
      setSaving(false);
    }
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

      <form className="section-block research-form" onSubmit={saveResearch}>
        <div className="section-head">
          <h2>Save research brief</h2>
          <span>complete</span>
        </div>
        <label>
          <span>Title</span>
          <input
            required
            value={briefTitle}
            onChange={(event) => setBriefTitle(event.target.value)}
          />
        </label>
        <label>
          <span>Summary</span>
          <textarea
            className="research-textarea"
            required
            value={briefSummary}
            onChange={(event) => setBriefSummary(event.target.value)}
            placeholder="Paste the account research brief here..."
          />
        </label>
        <label>
          <span>Sources</span>
          <textarea
            value={briefSources}
            onChange={(event) => setBriefSources(event.target.value)}
            placeholder="Source title | https://example.com"
          />
        </label>
        {error ? <div className="status-banner">{error}</div> : null}
        <div className="form-actions">
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Saving" : "Save brief"}
          </button>
        </div>
      </form>

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
                {brief.sources.length ? (
                  <div className="source-links">
                    {brief.sources.map((source, index) =>
                      source.url ? (
                        <a
                          href={source.url}
                          key={`${source.url}-${index}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {source.title || source.url}
                        </a>
                      ) : (
                        <span key={`${source.title}-${index}`}>
                          {source.title}
                        </span>
                      )
                    )}
                  </div>
                ) : null}
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
            {transcript.attendees.slice(0, 6).map((attendee) => {
              const person = normalizePerson(attendee);
              return <span key={person.name}>{person.name}</span>;
            })}
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
