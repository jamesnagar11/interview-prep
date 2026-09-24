const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Requirement {
  id: string;
  text: string;
  kind: 'technical' | 'behavioural' | 'domain';
  priority: 'must' | 'nice';
}

export interface ExtractedRole {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface ResearchBundle {
  pagesUsed: string[];
  pagesSkipped: { url: string; reason: string }[];
  aboutText: string | null;
  hiringProcessText: string | null;
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

export type QuestionCategory = 'technical' | 'behavioural' | 'system-design' | 'company-fit';

export interface GeneratedQuestion {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  state: 'GENERATED' | 'EDITED' | 'PINNED';
  orderIndex: number;
}

export interface GeneratedFlashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  state: 'GENERATED' | 'EDITED' | 'PINNED';
  orderIndex: number;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface AppendixAKit {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: CompanyBrief;
  briefState: 'GENERATED' | 'EDITED';
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: GeneratedQuestion[];
  flashcards: GeneratedFlashcard[];
  schedule: Schedule;
  scheduleStale: boolean;
  coverage: { uncovered_requirement_ids: string[]; passes: number };
  _meta?: { warnings: string[] };
}

export type KitStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'DRAFT'
  | 'RESEARCHING'
  | 'EXTRACTING'
  | 'GENERATING'
  | 'CHECKING_COVERAGE'
  | 'SCHEDULING'
  | 'READY'
  | 'FAILED';

// Status → human-readable phase label
export const STATUS_LABELS: Record<KitStatus, string> = {
  PENDING: 'Preparing your kit…',
  RUNNING: 'Pipeline running…',
  DRAFT: 'Draft in progress…',
  RESEARCHING: 'Researching the company…',
  EXTRACTING: 'Extracting requirements from JD…',
  GENERATING: 'Generating interview questions…',
  CHECKING_COVERAGE: 'Checking coverage of requirements…',
  SCHEDULING: 'Building your study schedule…',
  READY: 'Kit ready!',
  FAILED: 'Generation failed',
};

export interface KitSummary {
  id: string;
  roleTitle: string | null;
  companyName: string | null;
  companyUrl: string;
  status: KitStatus;
  createdAt: string;
  daysAvailable: number;
  questionCount: number;
}

export interface PracticeSessionSummary {
  id: string;
  startedAt: string;
  endedAt: string;
  attemptCount: number;
  avgConfidence: number | null;
}

export interface PracticeAttemptDetail {
  id: string;
  flashcardId: string;
  front: string;
  back: string;
  confidence: number | null;
  skipped: boolean;
  attemptedAt: string;
}

export interface PracticeSessionDetail {
  id: string;
  startedAt: string;
  endedAt: string | null;
  attempts: PracticeAttemptDetail[];
}

// ─── BuilderDiff (used by the builder store and commitBuilderChanges) ─────────

export interface NewQuestionDraft {
  _tempId: string;
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  requirementIds: string[];
}

export interface NewFlashcardDraft {
  _tempId: string;
  front: string;
  back: string;
  requirementIds: string[];
}

export interface BuilderDiff {
  brief?: { summary?: string; what_they_do?: string };
  questions: {
    updates: Record<string, Partial<GeneratedQuestion>>;
    creates: NewQuestionDraft[];
    deletes: string[];
    reorders: Record<QuestionCategory, string[]>;
    pins: Record<string, boolean>;
  };
  flashcards: {
    updates: Record<string, Partial<GeneratedFlashcard>>;
    creates: NewFlashcardDraft[];
    deletes: string[];
    reorders: string[];
    pins: Record<string, boolean>;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(
  path: string,
  token: string,
  opts: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.msg || `HTTP ${res.status}`);
  }
  return res;
}

// ─── Kit CRUD ─────────────────────────────────────────────────────────────────

export async function listKits(token: string): Promise<KitSummary[]> {
  const res = await apiFetch("/api/kits", token);
  const data = await res.json();
  return data.kits;
}

export async function createKit(
  jd: string,
  companyUrl: string,
  days: number,
  token: string
): Promise<{ kitId: string; status: string }> {
  const res = await apiFetch("/api/kits", token, {
    method: "POST",
    body: JSON.stringify({ jd, companyUrl, days }),
  });
  return res.json();
}

export async function getKit(
  kitId: string,
  token: string
): Promise<{ status: KitStatus; kit?: AppendixAKit; scheduleStale?: boolean; briefState?: string; errorMessage?: string }> {
  const res = await apiFetch(`/api/kits/${kitId}`, token);
  return res.json();
}

export function subscribeToKit(
  kitId: string,
  token: string,
  handlers: {
    onStatus?: (status: KitStatus) => void;
    onResult: (result: AppendixAKit) => void;
    onError: (message: string) => void;
  }
): () => void {
  const url = `${API_BASE}/api/kits/${kitId}/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  es.addEventListener("status", (e: MessageEvent) => {
    try { handlers.onStatus?.(JSON.parse(e.data).status as KitStatus); } catch {}
  });

  es.addEventListener("result", (e: MessageEvent) => {
    try { handlers.onResult(JSON.parse(e.data) as AppendixAKit); } catch { handlers.onResult(e.data as any); }
    es.close();
  });

  es.addEventListener("error", (e: any) => {
    if (e.data) {
      try { handlers.onError(JSON.parse(e.data).message); } catch { handlers.onError("Kit generation failed"); }
    } else {
      handlers.onError("Connection lost");
    }
    es.close();
  });

  return () => es.close();
}

// ─── Builder — Brief ──────────────────────────────────────────────────────────

export async function patchBrief(
  kitId: string,
  data: { summary?: string; what_they_do?: string },
  token: string
): Promise<CompanyBrief> {
  const res = await apiFetch(`/api/kits/${kitId}/brief`, token, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return json.kit?.company_brief ?? json;
}

// ─── Builder — Questions ──────────────────────────────────────────────────────

export async function patchQuestion(
  kitId: string,
  qid: string,
  data: Partial<Pick<GeneratedQuestion, 'prompt' | 'answer_outline' | 'category' | 'difficulty'>>,
  token: string
): Promise<GeneratedQuestion> {
  const res = await apiFetch(`/api/kits/${kitId}/questions/${qid}`, token, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return json.kit ?? json;
}

export async function pinQuestion(
  kitId: string,
  qid: string,
  pinned: boolean,
  token: string
): Promise<void> {
  await apiFetch(`/api/kits/${kitId}/questions/${qid}/pin`, token, {
    method: "PATCH",
    body: JSON.stringify({ pinned }),
  });
}

export async function createQuestion(
  kitId: string,
  data: {
    category: QuestionCategory;
    prompt: string;
    answerOutline: string;
    difficulty: 1 | 2 | 3;
    requirementIds: string[];
  },
  token: string
): Promise<AppendixAKit> {
  const res = await apiFetch(`/api/kits/${kitId}/questions`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return json.kit;
}

export async function deleteQuestion(
  kitId: string,
  qid: string,
  token: string
): Promise<void> {
  await apiFetch(`/api/kits/${kitId}/questions/${qid}`, token, { method: "DELETE" });
}

export async function reorderQuestions(
  kitId: string,
  category: QuestionCategory,
  order: string[],
  token: string
): Promise<void> {
  await apiFetch(`/api/kits/${kitId}/questions/reorder`, token, {
    method: "PATCH",
    body: JSON.stringify({ category, order }),
  });
}

// ─── Builder — Flashcards ─────────────────────────────────────────────────────

export async function patchFlashcard(
  kitId: string,
  fid: string,
  data: Partial<Pick<GeneratedFlashcard, 'front' | 'back'>>,
  token: string
): Promise<AppendixAKit> {
  const res = await apiFetch(`/api/kits/${kitId}/flashcards/${fid}`, token, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return json.kit;
}

export async function pinFlashcard(
  kitId: string,
  fid: string,
  pinned: boolean,
  token: string
): Promise<void> {
  await apiFetch(`/api/kits/${kitId}/flashcards/${fid}/pin`, token, {
    method: "PATCH",
    body: JSON.stringify({ pinned }),
  });
}

export async function createFlashcard(
  kitId: string,
  data: { front: string; back: string; requirementIds: string[] },
  token: string
): Promise<AppendixAKit> {
  const res = await apiFetch(`/api/kits/${kitId}/flashcards`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return json.kit;
}

export async function deleteFlashcard(
  kitId: string,
  fid: string,
  token: string
): Promise<void> {
  await apiFetch(`/api/kits/${kitId}/flashcards/${fid}`, token, { method: "DELETE" });
}

export async function reorderFlashcards(
  kitId: string,
  order: string[],
  token: string
): Promise<void> {
  await apiFetch(`/api/kits/${kitId}/flashcards/reorder`, token, {
    method: "PATCH",
    body: JSON.stringify({ order }),
  });
}

// ─── Builder — Batch commit ────────────────────────────────────────────────────

export async function commitBuilderChanges(
  kitId: string,
  diff: BuilderDiff,
  token: string
): Promise<AppendixAKit> {
  const res = await apiFetch(`/api/kits/${kitId}/builder/commit`, token, {
    method: "POST",
    body: JSON.stringify(diff),
  });
  const json = await res.json();
  return json.kit;
}

// ─── Regenerate ───────────────────────────────────────────────────────────────

export async function regenerateBrief(
  kitId: string,
  token: string
): Promise<CompanyBrief> {
  const res = await apiFetch(`/api/kits/${kitId}/regenerate/brief`, token, { method: "POST" });
  const json = await res.json();
  return json.kit?.company_brief ?? json;
}

export async function regenerateQuestionCategory(
  kitId: string,
  category: QuestionCategory,
  token: string
): Promise<AppendixAKit> {
  const res = await apiFetch(`/api/kits/${kitId}/regenerate/questions/${category}`, token, { method: "POST" });
  const json = await res.json();
  return json.kit;
}

export async function regenerateSchedule(
  kitId: string,
  token: string
): Promise<AppendixAKit> {
  const res = await apiFetch(`/api/kits/${kitId}/regenerate/schedule`, token, { method: "POST" });
  const json = await res.json();
  return json.kit;
}

// ─── Manual schedule edit ─────────────────────────────────────────────────────

export async function patchSchedule(
  kitId: string,
  days: ScheduleDay[],
  token: string
): Promise<{ schedule: Schedule; warnings: string[] }> {
  const res = await apiFetch(`/api/kits/${kitId}/schedule`, token, {
    method: "PATCH",
    body: JSON.stringify({ days }),
  });
  const json = await res.json();
  return { schedule: json.kit?.schedule, warnings: json.warnings ?? [] };
}

// ─── Practice ─────────────────────────────────────────────────────────────────

export async function startPracticeSession(
  kitId: string,
  token: string
): Promise<{ sessionId: string }> {
  const res = await apiFetch(`/api/kits/${kitId}/practice/sessions`, token, { method: "POST" });
  const json = await res.json();
  return { sessionId: json.session?.id };
}

export async function recordAttempt(
  kitId: string,
  sessionId: string,
  data: { flashcardId: string; confidence: number | null; skipped: boolean },
  token: string
): Promise<void> {
  await apiFetch(`/api/kits/${kitId}/practice/sessions/${sessionId}/attempts`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function endPracticeSession(
  kitId: string,
  sessionId: string,
  token: string
): Promise<void> {
  await apiFetch(`/api/kits/${kitId}/practice/sessions/${sessionId}/end`, token, { method: "POST" });
}

export async function getPracticeQueue(
  kitId: string,
  token: string
): Promise<string[]> {
  const res = await apiFetch(`/api/kits/${kitId}/practice/queue`, token);
  const json = await res.json();
  return json.queue ?? [];
}

export async function listPracticeSessions(
  kitId: string,
  token: string
): Promise<PracticeSessionSummary[]> {
  const res = await apiFetch(`/api/kits/${kitId}/practice/sessions`, token);
  const json = await res.json();
  return json.sessions ?? [];
}

export async function getPracticeSessionDetail(
  kitId: string,
  sessionId: string,
  token: string
): Promise<PracticeSessionDetail> {
  const res = await apiFetch(`/api/kits/${kitId}/practice/sessions/${sessionId}`, token);
  const json = await res.json();
  return json.session;
}
