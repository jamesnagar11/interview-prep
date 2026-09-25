"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import { useBuilderStore, selectIsDirty, selectDisplayedKit } from "@/lib/store/builder";
import {
  getKit,
  subscribeToKit,
  STATUS_LABELS,
  pinQuestion,
  deleteQuestion as apiDeleteQuestion,
  pinFlashcard,
  deleteFlashcard as apiDeleteFlashcard,
  commitBuilderChanges,
  regenerateBrief,
  regenerateQuestionCategory,
  regenerateSchedule,
  patchSchedule,
  startPracticeSession,
  recordAttempt,
  endPracticeSession,
  listPracticeSessions,
  getPracticeSessionDetail,
  getPracticeQueue,
  saveMockExam,
  listMockExams,
  getMockExamDetail,
  generateMockExamAiReport,
} from "@/lib/api/kits";
import type {
  AppendixAKit,
  KitStatus,
  GeneratedQuestion,
  GeneratedFlashcard,
  QuestionCategory,
  ScheduleDay,
  PracticeSessionSummary,
  PracticeSessionDetail,
  NewQuestionDraft,
  NewFlashcardDraft,
  MockExamSummary,
  MockExamDetail,
  AiCoachReport,
  MockExamQuestionRecord,
} from "@/lib/api/kits";
import {
  BrainCircuit, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Plus, Trash2, Pin, PinOff, Pencil, Check, X,
  BookOpen, Calendar, Clock, Target, Layers, Info, AlertTriangle,
  RefreshCw, Sparkles, Save, Undo2, Briefcase,
  ArrowLeft, PlayCircle, CheckCircle2, Bookmark, Pause, Play,
  Flame, RotateCcw, HelpCircle, Eye, EyeOff, Sparkle, SlidersHorizontal,
  FileText, Trophy, TrendingUp, SkipForward, Download, Bot, Star,
  ClipboardList, ZapIcon, AlertOctagon, ThumbsUp, Lightbulb,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

// ─── Constants & Design System ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System Design",
  "company-fit": "Company Fit",
};

const CATEGORY_THEMES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  technical: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-300",
    border: "border-cyan-500/30",
    glow: "shadow-cyan-500/10",
  },
  behavioural: {
    bg: "bg-purple-500/10",
    text: "text-purple-300",
    border: "border-purple-500/30",
    glow: "shadow-purple-500/10",
  },
  "system-design": {
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    border: "border-amber-500/30",
    glow: "shadow-amber-500/10",
  },
  "company-fit": {
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    glow: "shadow-emerald-500/10",
  },
};

const CONFIDENCE_RATING_OPTIONS = [
  { label: "Need Review", value: 1, color: "bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30" },
  { label: "Shaky", value: 3, color: "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30" },
  { label: "Moderate", value: 5, color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/30" },
  { label: "Confident", value: 8, color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30" },
  { label: "Mastered!", value: 10, color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30" },
] as const;

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function DifficultyEnergyBar({ level, onClick }: { level: 1 | 2 | 3; onClick?: (d: 1 | 2 | 3) => void }) {
  const colors = {
    1: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    2: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
    3: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]",
  };

  const labels = { 1: "Easy", 2: "Medium", 3: "Hard" };

  return (
    <div className="flex items-center gap-1.5" title={`Difficulty: ${labels[level]}`}>
      <div className="flex items-center gap-1">
        {([1, 2, 3] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onClick?.(d)}
            className={`w-2 h-3.5 rounded-sm transition-all duration-300 ${
              d <= level ? colors[level] : "bg-white/10"
            } ${onClick ? "hover:scale-110 cursor-pointer" : "cursor-default"}`}
            aria-label={onClick ? `Set difficulty ${d}` : undefined}
          />
        ))}
      </div>
      <span className="text-[10px] text-white/40 font-mono tracking-wider uppercase">{labels[level]}</span>
    </div>
  );
}

function StateBadge({ state }: { state?: "GENERATED" | "EDITED" | "PINNED" }) {
  if (!state || state === "GENERATED") return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-extrabold tracking-wider border shadow-sm ${
      state === "PINNED" 
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-amber-500/10" 
        : "bg-violet-500/15 text-violet-300 border-violet-500/30 shadow-violet-500/10"
    }`}>
      {state === "PINNED" ? <Pin className="w-2.5 h-2.5" /> : null}
      {state.toLowerCase()}
    </span>
  );
}

function SectionSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
    </div>
  );
}

function GeneratingView({ status }: { status: KitStatus }) {
  const stages: KitStatus[] = ["RESEARCHING", "EXTRACTING", "GENERATING", "CHECKING_COVERAGE", "SCHEDULING"];
  const idx = stages.indexOf(status);
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="relative">
        <div className="absolute -inset-4 rounded-full bg-violet-600/20 blur-xl animate-pulse" />
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center relative">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-white font-semibold text-lg">{STATUS_LABELS[status]}</p>
        <p className="text-white/40 text-sm">Building your AI interview prepkit…</p>
      </div>
      <div className="flex items-center gap-2">
        {stages.map((s, i) => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${i < idx ? "w-8 bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]" : i === idx ? "w-12 bg-violet-400 animate-pulse" : "w-6 bg-white/10"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Save / Discard Banner ────────────────────────────────────────────────────

function SaveBanner({
  kitId, isDirty, saving, saveError, onSave, onDiscard,
}: {
  kitId: string; isDirty: boolean; saving: boolean; saveError: string | null;
  onSave: () => void; onDiscard: () => void;
}) {
  if (!isDirty && !saveError) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center gap-3 px-6 py-3 bg-[#0d0f18]/95 backdrop-blur-md border-b border-violet-500/20 shadow-xl shadow-black/50">
      <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
      <span className="text-white/80 text-sm font-medium flex-1">You have unsaved builder changes</span>
      {saveError && <span className="text-rose-400 text-xs bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">{saveError}</span>}
      <button onClick={onDiscard} disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 text-white/50 hover:text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40">
        <Undo2 className="w-3.5 h-3.5" />Discard
      </button>
      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-violet-600/30 disabled:opacity-50">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save Changes
      </button>
    </div>
  );
}

// ─── Brief Section ────────────────────────────────────────────────────────────

function BriefSection({
  brief, briefState, kitId, token,
  onUpdate, onRegenerate,
}: {
  brief: AppendixAKit["company_brief"];
  briefState: string;
  kitId: string; token: string;
  onUpdate: (fields: { summary?: string; what_they_do?: string }) => void;
  onRegenerate: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({ summary: brief.summary, what_they_do: brief.what_they_do });
  const [regen, setRegen] = useState(false);
  const isEdited = briefState === "EDITED";

  const confirm = () => {
    onUpdate(draft);
    setEditMode(false);
  };
  const cancel = () => {
    setDraft({ summary: brief.summary, what_they_do: brief.what_they_do });
    setEditMode(false);
  };

  const handleRegen = async () => {
    if (isEdited) return;
    setRegen(true);
    try { await onRegenerate(); } finally { setRegen(false); }
  };

  return (
    <section className="bg-[#0f111a]/80 backdrop-blur-md border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-semibold text-sm flex items-center gap-2">
          <Target className="w-4.5 h-4.5 text-violet-400" />
          Company Overview & Culture Brief
          {isEdited && <span className="px-2 py-0.5 bg-violet-500/15 text-violet-300 text-[9px] uppercase font-bold rounded-full border border-violet-500/25">edited</span>}
        </h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegen}
            disabled={regen || isEdited}
            title={isEdited ? "Clear manual edits before regenerating" : "Regenerate brief from public sources"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white/40 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {regen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Regenerate
          </button>
          <button onClick={() => setEditMode((v) => !v)}
            className="p-1.5 text-white/40 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-lg transition-all"
            aria-label="Edit brief">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editMode ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-white/40 text-xs font-medium">Company Summary</label>
            <textarea rows={3} value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
              className="w-full bg-white/[0.04] border border-violet-500/40 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-white/40 text-xs font-medium">What They Do & Mission</label>
            <textarea rows={2} value={draft.what_they_do} onChange={(e) => setDraft((d) => ({ ...d, what_they_do: e.target.value }))}
              className="w-full bg-white/[0.04] border border-violet-500/40 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={confirm} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition-colors">
              <Check className="w-3.5 h-3.5" />Confirm Brief
            </button>
            <button onClick={cancel} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/[0.05] hover:bg-white/10 text-white/60 text-xs font-medium rounded-lg transition-colors">
              <X className="w-3.5 h-3.5" />Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-white/80 leading-relaxed bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl">
          <p>{brief.summary || <span className="italic text-white/30">No summary provided</span>}</p>
          {brief.what_they_do && <p className="text-white/60 text-xs border-t border-white/[0.05] pt-2 mt-2">{brief.what_they_do}</p>}
        </div>
      )}
    </section>
  );
}

// ─── Question Card (Builder Mode - Glowing Theme Cards) ───────────────────────

function BuilderQuestionCard({
  q, kitId, token, requirements,
  onUpdate, onPin, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  q: GeneratedQuestion; kitId: string; token: string;
  requirements: AppendixAKit["role"]["requirements"];
  onUpdate: (fields: Partial<GeneratedQuestion>) => void;
  onPin: (pinned: boolean) => void;
  onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({ prompt: q.prompt, answer_outline: q.answer_outline, category: q.category, difficulty: q.difficulty });
  const [deleting, setDeleting] = useState(false);
  const [pinning, setPinning] = useState(false);
  const isTemp = q.id.startsWith("temp-");
  const theme = CATEGORY_THEMES[q.category] ?? { bg: "bg-white/5", text: "text-white/60", border: "border-white/10", glow: "" };

  const confirmEdit = () => {
    onUpdate(draft);
    setEditMode(false);
  };

  const handlePin = async () => {
    setPinning(true);
    try {
      if (!isTemp) await pinQuestion(kitId, q.id, q.state !== "PINNED", token);
      onPin(q.state !== "PINNED");
    } finally { setPinning(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this question?")) return;
    setDeleting(true);
    try {
      if (!isTemp) await apiDeleteQuestion(kitId, q.id, token);
      onDelete();
    } finally { setDeleting(false); }
  };

  return (
    <div className={`bg-[#0f111a]/80 backdrop-blur-md border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg ${
      q.state === "PINNED" ? "border-amber-500/30 shadow-amber-500/5" : "border-white/[0.08] hover:border-violet-500/30"
    }`}>
      <div className="flex items-start gap-3 p-4">
        {/* Reorder Buttons */}
        <div className="flex flex-col gap-1 shrink-0 mt-0.5 bg-white/[0.03] p-1 rounded-lg border border-white/[0.05]">
          <button onClick={onMoveUp} disabled={isFirst} aria-label="Move question up"
            className="p-1 text-white/30 hover:text-white hover:bg-white/[0.1] disabled:opacity-20 transition-colors rounded">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={isLast} aria-label="Move question down"
            className="p-1 text-white/30 hover:text-white hover:bg-white/[0.1] disabled:opacity-20 transition-colors rounded">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border ${theme.bg} ${theme.text} ${theme.border}`}>
              {CATEGORY_LABELS[q.category] ?? q.category}
            </span>
            <DifficultyEnergyBar level={q.difficulty} />
            <StateBadge state={q.state} />
            {isTemp && <span className="px-2 py-0.5 bg-teal-500/15 text-teal-300 text-[9px] uppercase font-bold rounded-full border border-teal-500/30">new</span>}
          </div>
          <p className="text-white/90 text-sm font-medium leading-relaxed">{q.prompt}</p>

          {/* Mapped requirements tags */}
          {q.requirement_ids.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {q.requirement_ids.map((rid) => (
                <span key={rid} className="px-2 py-0.5 rounded text-[9px] font-mono bg-white/[0.04] text-white/40 border border-white/[0.06]">
                  {rid}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handlePin} disabled={pinning} aria-label={q.state === "PINNED" ? "Unpin" : "Pin"}
            className={`p-2 rounded-xl transition-all ${q.state === "PINNED" ? "text-amber-400 bg-amber-500/15 border border-amber-500/30 shadow-md" : "text-white/30 hover:text-amber-400 hover:bg-amber-500/10"}`}>
            {q.state === "PINNED" ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>
          <button onClick={() => setEditMode((v) => !v)} aria-label="Edit question"
            className="p-2 text-white/30 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} disabled={deleting} aria-label="Delete question"
            className="p-2 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-40">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Collapse answer outline" : "Expand answer outline"}
            className="p-2 text-white/30 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] rounded-xl transition-all">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Edit Form */}
      {editMode && (
        <div className="border-t border-white/[0.08] bg-black/40 px-5 py-4 space-y-3">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 space-y-1 min-w-[160px]">
              <label className="text-white/40 text-xs font-semibold">Category</label>
              <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as QuestionCategory }))}
                className="w-full bg-[#141722] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/40">
                {(["technical", "behavioural", "system-design", "company-fit"] as const).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs font-semibold">Difficulty Level</label>
              <div className="flex gap-1.5 mt-1">
                {([1, 2, 3] as const).map((d) => (
                  <button key={d} type="button" onClick={() => setDraft((x) => ({ ...x, difficulty: d }))}
                    className={`w-8 h-8 rounded-xl text-xs font-bold border transition-all ${
                      draft.difficulty === d ? "bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/30" : "bg-white/[0.05] text-white/50 border-white/10 hover:bg-white/10"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-white/40 text-xs font-semibold">Question Prompt</label>
            <textarea rows={2} value={draft.prompt} onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
              className="w-full bg-[#141722] border border-white/15 rounded-xl px-3.5 py-2 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
          </div>
          <div className="space-y-1">
            <label className="text-white/40 text-xs font-semibold">Answer Key Outline</label>
            <textarea rows={3} value={draft.answer_outline} onChange={(e) => setDraft((d) => ({ ...d, answer_outline: e.target.value }))}
              className="w-full bg-[#141722] border border-white/15 rounded-xl px-3.5 py-2 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={confirmEdit} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-colors">
              <Check className="w-3.5 h-3.5" />Apply Changes
            </button>
            <button onClick={() => setEditMode(false)} className="px-4 py-2 text-white/50 hover:text-white text-xs font-medium transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Answer Outline Expand */}
      {expanded && !editMode && (
        <div className="px-5 pb-4 border-t border-white/[0.06] pt-3 bg-white/[0.01]">
          <p className="text-[10px] text-violet-400 uppercase font-bold tracking-wider mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />Answer Key & Talking Points
          </p>
          <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">{q.answer_outline}</p>
        </div>
      )}
    </div>
  );
}

// ─── Add Question Form ────────────────────────────────────────────────────────

function AddQuestionForm({
  defaultCategory,
  requirements,
  onAdd,
  onCancel,
}: {
  defaultCategory: QuestionCategory;
  requirements: AppendixAKit["role"]["requirements"];
  onAdd: (draft: NewQuestionDraft) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    category: defaultCategory,
    prompt: "",
    answer_outline: "",
    difficulty: 2 as 1 | 2 | 3,
    requirementIds: [] as string[],
  });

  const toggle = (id: string) =>
    setForm((f) => ({
      ...f,
      requirementIds: f.requirementIds.includes(id)
        ? f.requirementIds.filter((r) => r !== id)
        : [...f.requirementIds, id],
    }));

  const submit = () => {
    if (!form.prompt.trim() || !form.answer_outline.trim()) return;
    onAdd({
      _tempId: `temp-${uuidv4()}`,
      category: form.category,
      prompt: form.prompt,
      answer_outline: form.answer_outline,
      difficulty: form.difficulty,
      requirementIds: form.requirementIds,
    });
  };

  return (
    <div className="bg-teal-500/5 border border-teal-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-teal-400" />
        <p className="text-teal-300 text-xs font-bold uppercase tracking-wider">Create Custom Question</p>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 space-y-1 min-w-[160px]">
          <label className="text-white/40 text-xs font-semibold">Category</label>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as QuestionCategory }))}
            className="w-full bg-[#141722] border border-white/15 rounded-xl px-3 py-2 text-white text-xs focus:outline-none">
            {(["technical", "behavioural", "system-design", "company-fit"] as const).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-white/40 text-xs font-semibold">Difficulty</label>
          <div className="flex gap-1.5 mt-1">
            {([1, 2, 3] as const).map((d) => (
              <button key={d} type="button" onClick={() => setForm((f) => ({ ...f, difficulty: d }))}
                className={`w-8 h-8 rounded-xl text-xs font-bold border transition-colors ${form.difficulty === d ? "bg-teal-600 text-white border-teal-500" : "bg-white/[0.05] text-white/50 border-white/10 hover:bg-white/10"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-white/40 text-xs font-semibold">Question Prompt *</label>
        <textarea rows={2} value={form.prompt} onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))} placeholder="Interview question prompt text…"
          className="w-full bg-[#141722] border border-white/15 rounded-xl px-3.5 py-2.5 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/40" />
      </div>
      <div className="space-y-1">
        <label className="text-white/40 text-xs font-semibold">Answer Outline *</label>
        <textarea rows={3} value={form.answer_outline} onChange={(e) => setForm((f) => ({ ...f, answer_outline: e.target.value }))} placeholder="Key concepts, architecture, or STAR framework points…"
          className="w-full bg-[#141722] border border-white/15 rounded-xl px-3.5 py-2.5 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/40" />
      </div>
      {requirements.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-white/40 text-xs font-semibold">Covered Requirements</label>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {requirements.map((r) => (
              <button key={r.id} type="button" onClick={() => toggle(r.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-colors ${form.requirementIds.includes(r.id) ? "bg-teal-600 text-white border-teal-500" : "bg-white/[0.04] text-white/50 border-white/10 hover:bg-white/[0.08]"}`}>
                {r.id}: {r.text.slice(0, 30)}…
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={!form.prompt.trim() || !form.answer_outline.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40 shadow-lg shadow-teal-600/20">
          <Plus className="w-4 h-4" />Add Question
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-white/50 hover:text-white text-xs font-medium transition-colors">Cancel</button>
      </div>
    </div>
  );
}

// ─── Builder Flashcard (Tactile 3D Card Stack Visuals) ────────────────────────

function BuilderFlashcard({
  f, kitId, token,
  onUpdate, onPin, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  f: GeneratedFlashcard; kitId: string; token: string;
  onUpdate: (fields: Partial<GeneratedFlashcard>) => void;
  onPin: (pinned: boolean) => void;
  onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({ front: f.front, back: f.back });
  const [deleting, setDeleting] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [showBackPreview, setShowBackPreview] = useState(false);
  const isTemp = f.id.startsWith("temp-");

  const handlePin = async () => {
    setPinning(true);
    try {
      if (!isTemp) await pinFlashcard(kitId, f.id, f.state !== "PINNED", token);
      onPin(f.state !== "PINNED");
    } finally { setPinning(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this flashcard?")) return;
    setDeleting(true);
    try {
      if (!isTemp) await apiDeleteFlashcard(kitId, f.id, token);
      onDelete();
    } finally { setDeleting(false); }
  };

  return (
    <div className={`group relative bg-[#0f111a]/90 backdrop-blur-md border rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 shadow-lg ${
      f.state === "PINNED" ? "border-amber-500/30 shadow-amber-500/10" : "border-white/[0.08] hover:border-pink-500/40 hover:shadow-pink-500/10"
    }`}>
      {/* Top Card Stack Accent Line */}
      <div className="absolute top-0 left-4 right-4 h-0.5 bg-gradient-to-r from-violet-500 via-pink-500 to-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity rounded-t" />

      <div className="flex items-start gap-3">
        {/* Reorder handle */}
        <div className="flex flex-col gap-1 shrink-0 mt-0.5 bg-white/[0.03] p-1 rounded-lg border border-white/[0.05]">
          <button onClick={onMoveUp} disabled={isFirst} aria-label="Move flashcard up" className="p-1 text-white/30 hover:text-white disabled:opacity-20 rounded transition-colors">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={isLast} aria-label="Move flashcard down" className="p-1 text-white/30 hover:text-white disabled:opacity-20 rounded transition-colors">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-pink-500/15 text-pink-300 border border-pink-500/30">
              Flashcard
            </span>
            <StateBadge state={f.state} />
            {isTemp && <span className="px-2 py-0.5 bg-teal-500/15 text-teal-300 text-[9px] uppercase font-bold rounded-full border border-teal-500/30">new</span>}
          </div>

          {editMode ? (
            <div className="space-y-3 bg-black/40 p-3 rounded-xl border border-white/10">
              <div className="space-y-1">
                <label className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Front (Question / Concept)</label>
                <textarea rows={2} value={draft.front} onChange={(e) => setDraft((d) => ({ ...d, front: e.target.value }))} placeholder="Front side text"
                  className="w-full bg-[#141722] border border-white/15 rounded-xl px-3 py-2 text-white text-xs resize-none focus:outline-none focus:ring-1 focus:ring-pink-500/40" />
              </div>
              <div className="space-y-1">
                <label className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Back (Answer / Explanation)</label>
                <textarea rows={3} value={draft.back} onChange={(e) => setDraft((d) => ({ ...d, back: e.target.value }))} placeholder="Back side text"
                  className="w-full bg-[#141722] border border-white/15 rounded-xl px-3 py-2 text-white/80 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-pink-500/40" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { onUpdate(draft); setEditMode(false); }} className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-lg shadow-md">
                  <Check className="w-3.5 h-3.5" />Save Card
                </button>
                <button onClick={() => setEditMode(false)} className="text-white/40 hover:text-white text-xs px-2 font-medium">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl space-y-1">
                <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest block">Front</span>
                <p className="text-white text-sm font-semibold">{f.front}</p>
              </div>

              {showBackPreview ? (
                <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 p-3 rounded-xl space-y-1 animate-in fade-in duration-200">
                  <span className="text-[9px] font-bold text-pink-300 uppercase tracking-widest block">Back Answer</span>
                  <p className="text-white/90 text-xs leading-relaxed">{f.back}</p>
                </div>
              ) : (
                <button onClick={() => setShowBackPreview(true)} className="flex items-center gap-1.5 text-xs text-pink-400/80 hover:text-pink-300 font-medium py-1 transition-colors">
                  <Eye className="w-3.5 h-3.5" />Preview Answer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handlePin} disabled={pinning} aria-label={f.state === "PINNED" ? "Unpin flashcard" : "Pin flashcard"}
            className={`p-2 rounded-xl transition-colors ${f.state === "PINNED" ? "text-amber-400 bg-amber-500/15 border border-amber-500/30" : "text-white/30 hover:text-amber-400 hover:bg-amber-500/10"}`}>
            {f.state === "PINNED" ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setEditMode((v) => !v)} aria-label="Edit flashcard"
            className="p-2 text-white/30 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} disabled={deleting} aria-label="Delete flashcard"
            className="p-2 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors disabled:opacity-40">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mock Paper Question Practice Component ───────────────────────────────

function MockQuestionPracticeView({
  questions,
  title,
  subtitle,
  kitId,
  token,
  onClose,
}: {
  questions: GeneratedQuestion[];
  title: string;
  subtitle?: string;
  kitId: string;
  token: string;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [showFinishedSummary, setShowFinishedSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedExamId, setSavedExamId] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<AiCoachReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const examStartedAt = useRef(new Date().toISOString());

  // Keyboard: ArrowLeft/Right to navigate, Space to toggle answer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showFinishedSummary || showReport) return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") {
        setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
        setShowAnswer(false);
      }
      if (e.key === "ArrowLeft") {
        setCurrentIndex((i) => Math.max(i - 1, 0));
        setShowAnswer(false);
      }
      if (e.key === " ") { e.preventDefault(); setShowAnswer((v) => !v); }
      if (e.key === "f" || e.key === "F") {
        const q = questions[currentIndex];
        if (q) setFlagged((prev) => ({ ...prev, [q.id]: !prev[q.id] }));
      }
      if (["1","2","3","4","5"].includes(e.key)) {
        const q = questions[currentIndex];
        if (q) {
          const map: Record<string, number> = { "1": 2, "2": 4, "3": 6, "4": 8, "5": 10 };
          setRatings((prev) => ({ ...prev, [q.id]: map[e.key]! }));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [questions, currentIndex, showFinishedSummary, showReport]);

  // Stopwatch timer
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => setSecondsElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const currentQ = questions[currentIndex];
  if (!currentQ) return null;

  const theme = CATEGORY_THEMES[currentQ.category] ?? { bg: "bg-white/5", text: "text-white/60", border: "border-white/10", glow: "" };

  const toggleFlag = (qid: string) => setFlagged((prev) => ({ ...prev, [qid]: !prev[qid] }));
  const setRating = (qid: string, val: number) => setRatings((prev) => ({ ...prev, [qid]: val }));
  const setNote = (qid: string, note: string) => setUserNotes((prev) => ({ ...prev, [qid]: note }));

  const handleFinish = () => {
    setIsTimerRunning(false);
    setShowFinishedSummary(true);
  };

  const handleSaveExam = async () => {
    setSaving(true);
    try {
      const finishedAt = new Date().toISOString();
      const examQuestions: MockExamQuestionRecord[] = questions.map((q, i) => ({
        questionId: q.id,
        questionText: q.prompt,
        answerOutline: q.answer_outline,
        category: q.category,
        difficulty: q.difficulty,
        userNotes: userNotes[q.id] ?? undefined,
        confidence: ratings[q.id] ?? null,
        flagged: flagged[q.id] ?? false,
        position: i,
      }));
      const res = await saveMockExam(kitId, {
        title,
        startedAt: examStartedAt.current,
        finishedAt,
        durationSec: secondsElapsed,
        questions: examQuestions,
      }, token);
      setSavedExamId(res.examId);
    } catch (e: any) {
      alert("Failed to save exam: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!savedExamId) return;
    setGeneratingReport(true);
    try {
      const report = await generateMockExamAiReport(kitId, savedExamId, token);
      setAiReport(report);
      setShowReport(true);
    } catch (e: any) {
      alert("Failed to generate AI report: " + e.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleDownloadPDF = () => {
    const ratedQs = questions.filter((q) => ratings[q.id] !== undefined);
    const avgConf = ratedQs.length > 0
      ? (ratedQs.reduce((s, q) => s + (ratings[q.id] ?? 0), 0) / ratedQs.length).toFixed(1)
      : "N/A";

    const reportHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title} — Mock Exam Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #fff; color: #1a1a2e; }
  h1 { font-size: 24px; font-weight: 800; color: #4f46e5; }
  h2 { font-size: 16px; font-weight: 700; color: #4f46e5; border-bottom: 2px solid #e0e7ff; padding-bottom: 6px; margin-top: 32px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin: 20px 0; }
  .stat { background: #f5f3ff; border-radius: 12px; padding: 12px; text-align: center; }
  .stat-value { font-size: 22px; font-weight: 800; color: #4f46e5; }
  .stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
  .question { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 12px 0; page-break-inside: avoid; }
  .question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .q-number { font-weight: 800; color: #4f46e5; }
  .q-category { font-size: 11px; background: #ede9fe; color: #5b21b6; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; font-weight: 700; }
  .q-prompt { font-size: 14px; font-weight: 600; color: #111827; margin: 8px 0; }
  .q-answer { font-size: 12px; color: #374151; background: #f9fafb; border-left: 3px solid #818cf8; padding: 10px 12px; border-radius: 0 8px 8px 0; margin: 8px 0; }
  .q-notes { font-size: 12px; color: #6b7280; font-style: italic; margin: 6px 0; }
  .q-meta { display: flex; gap: 12px; margin-top: 8px; font-size: 11px; }
  .confidence { font-weight: 700; }
  .conf-high { color: #059669; }
  .conf-mid { color: #d97706; }
  .conf-low { color: #dc2626; }
  .flagged-badge { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  ${aiReport ? `.ai-section { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0; }
  .ai-grade { font-size: 48px; font-weight: 900; color: #059669; }
  .ai-score { font-size: 18px; color: #065f46; }
  .ai-item { padding: 6px 0; font-size: 13px; }
  .strength { color: #065f46; } .weakness { color: #991b1b; }` : ""}
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>${title}</h1>
<p class="meta">Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Duration: ${formatTime(secondsElapsed)}</p>
<div class="stats">
  <div class="stat"><div class="stat-value">${questions.length}</div><div class="stat-label">Questions</div></div>
  <div class="stat"><div class="stat-value">${Object.keys(ratings).length}</div><div class="stat-label">Rated</div></div>
  <div class="stat"><div class="stat-value">${Object.values(flagged).filter(Boolean).length}</div><div class="stat-label">Flagged</div></div>
  <div class="stat"><div class="stat-value">${avgConf}</div><div class="stat-label">Avg Confidence</div></div>
</div>
${aiReport ? `<div class="ai-section">
  <h2 style="margin-top:0;border:none">AI Coaching Report</h2>
  <div style="display:flex;align-items:baseline;gap:12px"><span class="ai-grade">${aiReport.grade}</span><span class="ai-score">${aiReport.overallScore}/100</span></div>
  <p>${aiReport.summary}</p>
  <p><strong>Strengths:</strong></p><ul>${aiReport.strengths.map((s) => `<li class="strength">${s}</li>`).join("")}</ul>
  <p><strong>Areas to Improve:</strong></p><ul>${aiReport.weaknesses.map((w) => `<li class="weakness">${w}</li>`).join("")}</ul>
  <p><strong>Next Steps:</strong></p><ol>${aiReport.nextSteps.map((n) => `<li>${n}</li>`).join("")}</ol>
  <p><em>${aiReport.motivationalNote}</em></p>
</div>` : ""}
<h2>Question-by-Question Review</h2>
${questions.map((q, i) => `
<div class="question">
  <div class="question-header">
    <span class="q-number">Q${i + 1}</span>
    <div style="display:flex;gap:8px;align-items:center">
      <span class="q-category">${q.category}</span>
      ${flagged[q.id] ? '<span class="flagged-badge">Flagged</span>' : ""}
    </div>
  </div>
  <div class="q-prompt">${q.prompt}</div>
  <div class="q-answer"><strong>Key Points:</strong><br>${q.answer_outline}</div>
  ${userNotes[q.id] ? `<div class="q-notes"><strong>Your Notes:</strong> ${userNotes[q.id]}</div>` : ""}
  <div class="q-meta">
    <span class="confidence ${ratings[q.id] >= 7 ? "conf-high" : ratings[q.id] >= 4 ? "conf-mid" : "conf-low"}">
      ${ratings[q.id] !== undefined ? `Confidence: ${ratings[q.id]}/10` : "Not rated"}
    </span>
    <span>Difficulty: ${"★".repeat(q.difficulty)}${"☆".repeat(3 - q.difficulty)}</span>
  </div>
</div>`).join("")}
</body></html>`;

    const blob = new Blob([reportHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_mock_exam_report.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // AI Coach Report Full-Screen View
  if (showReport && aiReport) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0c14]/95 backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in duration-300">
        <header className="flex items-center justify-between px-6 py-3 bg-[#0d0f18] border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowReport(false)} className="p-2 text-white/40 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] rounded-xl transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Bot className="w-5 h-5 text-violet-400" />AI Coaching Report
              </h3>
              <p className="text-white/40 text-xs">{title}</p>
            </div>
          </div>
          <button onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-violet-600/20 transition-all">
            <Download className="w-4 h-4" />Download Report
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full space-y-6">
          {/* Grade card */}
          <div className="bg-gradient-to-br from-violet-900/30 to-indigo-900/30 border border-violet-500/30 rounded-3xl p-6 text-center">
            <div className="text-7xl font-black text-white mb-2">{aiReport.grade}</div>
            <div className="text-2xl font-bold text-violet-300">{aiReport.overallScore}/100</div>
            <p className="text-white/60 text-sm mt-3 max-w-md mx-auto leading-relaxed">{aiReport.summary}</p>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
              <h4 className="text-emerald-300 font-bold text-sm flex items-center gap-2"><ThumbsUp className="w-4 h-4" />Strengths</h4>
              {aiReport.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-white/80">
                  <span className="text-emerald-400 mt-0.5">✓</span>{s}
                </div>
              ))}
            </div>
            <div className="bg-rose-900/20 border border-rose-500/30 rounded-2xl p-4 space-y-2">
              <h4 className="text-rose-300 font-bold text-sm flex items-center gap-2"><AlertOctagon className="w-4 h-4" />Areas to Improve</h4>
              {aiReport.weaknesses.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-white/80">
                  <span className="text-rose-400 mt-0.5">→</span>{w}
                </div>
              ))}
            </div>
          </div>

          {/* Focus Areas */}
          {aiReport.focusAreas.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-white font-bold text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-400" />Focus Areas & Study Plan</h4>
              {aiReport.focusAreas.map((area, i) => (
                <div key={i} className={`p-4 rounded-2xl border space-y-2 ${area.priority === "high" ? "bg-rose-900/10 border-rose-500/25" : area.priority === "medium" ? "bg-amber-900/10 border-amber-500/25" : "bg-white/[0.02] border-white/[0.08]"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">{area.area}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${area.priority === "high" ? "bg-rose-500/20 text-rose-300" : area.priority === "medium" ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/60"}`}>{area.priority}</span>
                  </div>
                  <p className="text-white/70 text-xs leading-relaxed">{area.advice}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {area.studyTopics.map((topic, j) => (
                      <span key={j} className="px-2 py-0.5 bg-violet-500/15 text-violet-300 text-[10px] rounded-lg border border-violet-500/20">{topic}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-[#0f111a] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <h4 className="text-white font-bold text-sm flex items-center gap-2"><Target className="w-4 h-4 text-teal-400" />Your Next Steps</h4>
            <ol className="space-y-2">
              {aiReport.nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Motivational Note */}
          <div className="text-center py-4 px-6 bg-gradient-to-r from-violet-900/20 to-indigo-900/20 border border-violet-500/20 rounded-2xl">
            <p className="text-violet-200 text-sm italic">"{aiReport.motivationalNote}"</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c14]/95 backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* Top Exam Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#0d0f18] border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 text-white/40 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-violet-400" />{title}
            </h3>
            {subtitle && <p className="text-white/40 text-xs">{subtitle}</p>}
          </div>
        </div>

        {/* Stopwatch & Stats */}
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-white/20 text-[10px]">← → navigate · Space=answer · F=flag · 1-5=rate</span>
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-xl font-mono text-sm text-violet-300 shadow-sm">
            <Clock className="w-4 h-4 text-violet-400" />
            <span>{formatTime(secondsElapsed)}</span>
            <button onClick={() => setIsTimerRunning((r) => !r)} className="ml-1 text-violet-400 hover:text-violet-200">
              {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button onClick={handleFinish}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all">
            <CheckCircle2 className="w-4 h-4" />Finish Exam
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question Area */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-5">
          {/* Question Meta Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 bg-violet-600 text-white font-extrabold text-xs rounded-lg shadow-md">
                Q{currentIndex + 1} of {questions.length}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${theme.bg} ${theme.text} ${theme.border}`}>
                {CATEGORY_LABELS[currentQ.category]}
              </span>
              <DifficultyEnergyBar level={currentQ.difficulty} />
            </div>

            <button onClick={() => toggleFlag(currentQ.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                flagged[currentQ.id] ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-white/[0.03] text-white/40 border-white/10 hover:text-white"
              }`}>
              <Bookmark className="w-4 h-4" />
              {flagged[currentQ.id] ? "Flagged" : "Flag (F)"}
            </button>
          </div>

          {/* Question Text Card */}
          <div className="bg-[#0f111d] border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-xl font-semibold text-white leading-relaxed">{currentQ.prompt}</h2>
          </div>

          {/* Answer Outline Toggle */}
          <div className="space-y-4">
            <button onClick={() => setShowAnswer((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl text-violet-300 font-semibold text-xs transition-all">
              {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showAnswer ? "Hide Key Answer Points" : "Reveal Answer Outline (Space)"}
            </button>

            {showAnswer && (
              <div className="bg-gradient-to-br from-violet-950/20 to-indigo-950/20 border border-violet-500/30 rounded-2xl p-5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkle className="w-4 h-4" />Key Talking Points & Concept Outline
                </p>
                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">{currentQ.answer_outline}</p>
              </div>
            )}
          </div>

          {/* Response Scratchpad */}
          <div className="space-y-1.5">
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5 text-violet-400" />Your Thoughts / Response Draft (Optional)
            </label>
            <textarea
              rows={3}
              value={userNotes[currentQ.id] || ""}
              onChange={(e) => setNote(currentQ.id, e.target.value)}
              placeholder="Type your bullet points, code snippets, or key arguments here..."
              className="w-full bg-[#0d0f18] border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none"
            />
          </div>

          {/* Self-Rating */}
          <div className="bg-[#0d0f18] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">How confident are you? (Keys 1-5)</p>
            <div className="grid grid-cols-5 gap-2">
              {CONFIDENCE_RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRating(currentQ.id, opt.value)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold border transition-all ${
                    ratings[currentQ.id] === opt.value
                      ? `${opt.color} ring-2 ring-violet-400 scale-[1.02]`
                      : "bg-white/[0.03] text-white/50 border-white/10 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className="text-base font-bold">{opt.value}</span>
                  <span className="text-[10px] text-center leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Question Navigation Palette */}
        <aside className="w-64 lg:w-72 bg-[#0d0f18] border-l border-white/[0.08] p-5 flex flex-col shrink-0 overflow-y-auto space-y-5 hidden sm:flex">
          <div>
            <h4 className="text-white font-bold text-sm mb-1">Question Palette</h4>
            <p className="text-white/40 text-xs">Jump to any question.</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isRated = ratings[q.id] !== undefined;
              const isFlagged = flagged[q.id];

              let colorStyle = "bg-white/[0.04] text-white/50 border-white/10 hover:bg-white/[0.08]";
              if (isCurrent) colorStyle = "bg-violet-600 text-white border-violet-400 shadow-md ring-2 ring-violet-400/50";
              else if (isFlagged) colorStyle = "bg-amber-500/20 text-amber-300 border-amber-500/40";
              else if (isRated) colorStyle = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

              return (
                <button
                  key={q.id}
                  onClick={() => { setCurrentIndex(idx); setShowAnswer(false); }}
                  className={`h-11 rounded-xl text-xs font-bold border flex flex-col items-center justify-center relative transition-all ${colorStyle}`}
                >
                  <span>Q{idx + 1}</span>
                  {isFlagged && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 border-t border-white/[0.08] pt-4 text-[11px] text-white/50">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-violet-600" /> Current</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40" /> Self-Evaluated</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40" /> Flagged</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white/[0.04] border border-white/10" /> Unanswered</div>
          </div>
        </aside>
      </div>

      {/* Footer Navigation Bar */}
      <footer className="px-6 py-4 bg-[#0d0f18] border-t border-white/[0.08] flex items-center justify-between shrink-0">
        <button
          onClick={() => { if (currentIndex > 0) { setCurrentIndex((i) => i - 1); setShowAnswer(false); } }}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-30 border border-white/10"
        >
          <ChevronLeft className="w-4 h-4" />Previous
        </button>

        <div className="text-white/40 text-xs font-mono">
          Rated {Object.keys(ratings).length} / {questions.length}
        </div>

        <button
          onClick={() => {
            if (currentIndex < questions.length - 1) {
              setCurrentIndex((i) => i + 1);
              setShowAnswer(false);
            } else {
              handleFinish();
            }
          }}
          className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-violet-600/30"
        >
          {currentIndex === questions.length - 1 ? "Finish Test" : "Next Question"}
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>

      {/* Finished Summary Modal */}
      {showFinishedSummary && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-[#0f111d] border border-white/15 rounded-3xl p-6 max-w-lg w-full space-y-5 text-center shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Practice Exam Complete!</h3>
              <p className="text-white/40 text-xs mt-1">Great job! Review your performance below.</p>
            </div>

            <div className="grid grid-cols-4 gap-2 bg-white/[0.02] border border-white/[0.06] p-3 rounded-2xl text-center">
              <div>
                <span className="text-white/40 text-[10px] block uppercase font-mono">Time</span>
                <span className="text-white font-bold text-sm">{formatTime(secondsElapsed)}</span>
              </div>
              <div>
                <span className="text-white/40 text-[10px] block uppercase font-mono">Questions</span>
                <span className="text-white font-bold text-sm">{questions.length}</span>
              </div>
              <div>
                <span className="text-white/40 text-[10px] block uppercase font-mono">Rated</span>
                <span className="text-white font-bold text-sm">{Object.keys(ratings).length}</span>
              </div>
              <div>
                <span className="text-white/40 text-[10px] block uppercase font-mono">Flagged</span>
                <span className="text-white font-bold text-sm">{Object.values(flagged).filter(Boolean).length}</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {!savedExamId ? (
                <button onClick={handleSaveExam} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Exam to History"}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" />Exam Saved Successfully
                </div>
              )}

              {savedExamId && (
                <button onClick={handleGenerateReport} disabled={generatingReport || Boolean(aiReport)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg disabled:opacity-60 transition-all">
                  {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                  {aiReport ? "Report Ready — View Below" : generatingReport ? "Generating AI Coaching Report..." : "Get AI Coaching Report"}
                </button>
              )}

              {aiReport && (
                <button onClick={() => setShowReport(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 font-bold text-sm rounded-xl transition-all">
                  <TrendingUp className="w-4 h-4" />View Full AI Coaching Report
                </button>
              )}

              <button onClick={handleDownloadPDF}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/70 text-sm font-semibold rounded-xl transition-colors">
                <Download className="w-4 h-4" />Download Report (HTML)
              </button>

              <div className="flex gap-2">
                <button onClick={() => setShowFinishedSummary(false)} className="flex-1 py-2.5 bg-white/[0.05] hover:bg-white/10 text-white text-xs font-semibold rounded-xl border border-white/10">
                  Review Answers
                </button>
                <button onClick={onClose} className="flex-1 py-2.5 bg-white/[0.03] hover:bg-white/[0.07] text-white/50 text-xs font-bold rounded-xl border border-white/[0.08]">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Overview / Builder Tab ───────────────────────────────────────────────────

function OverviewTab({
  kit, kitId, token, onLaunchMock,
}: {
  kit: AppendixAKit;
  kitId: string;
  token: string;
  onLaunchMock: (qs: GeneratedQuestion[], title: string) => void;
}) {
  const store = useBuilderStore();
  const [activeCategory, setActiveCategory] = useState<QuestionCategory>("technical");
  const [showAddQ, setShowAddQ] = useState(false);
  const [showAddF, setShowAddF] = useState(false);
  const [regenCategory, setRegenCategory] = useState<QuestionCategory | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const displayKit = selectDisplayedKit(store) ?? kit;
  const catQs = displayKit.questions.filter((q) => q.category === activeCategory);
  const catList: QuestionCategory[] = ["technical", "behavioural", "system-design", "company-fit"];

  const moveQuestion = (qid: string, dir: -1 | 1) => {
    const order = catQs.map((q) => q.id);
    const idx = order.indexOf(qid);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    store.setQuestionReorder(activeCategory, order);
  };

  const moveFlashcard = (fid: string, dir: -1 | 1) => {
    const order = displayKit.flashcards.map((f) => f.id);
    const idx = order.indexOf(fid);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    store.setFlashcardReorder(order);
  };

  const handleRegenCategory = async () => {
    setRegenCategory(activeCategory);
    try {
      const updatedKit = await regenerateQuestionCategory(kitId, activeCategory, token);
      store.setBaseKit(updatedKit);
      toast(updatedKit.questions.filter((q) => q.category === activeCategory).length === 0
        ? "Nothing to regenerate — every question is edited or pinned."
        : `${CATEGORY_LABELS[activeCategory]} questions regenerated.`
      );
    } catch (e: any) {
      toast(`Regeneration failed: ${e.message}`);
    } finally {
      setRegenCategory(null);
    }
  };

  const handleRegenBrief = async () => {
    const updatedBrief = await regenerateBrief(kitId, token);
    if (store.baseKit) {
      store.setBaseKit({ ...store.baseKit, company_brief: updatedBrief, briefState: "GENERATED" });
    }
  };

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#1a1d2e] border border-violet-500/30 rounded-xl text-white text-sm shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          {toastMsg}
        </div>
      )}

      {/* Warnings & Coverage Banners */}
      {(kit._meta?.warnings?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {kit._meta!.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2.5 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" /><span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Brief Section */}
      <BriefSection
        brief={displayKit.company_brief}
        briefState={kit.briefState ?? "GENERATED"}
        kitId={kitId} token={token}
        onUpdate={(fields) => store.editBrief(fields)}
        onRegenerate={handleRegenBrief}
      />

      {/* Role Requirements Overview */}
      <section className="bg-[#0f111a]/80 backdrop-blur-md border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-xl">
        <h4 className="text-white font-semibold text-sm flex items-center gap-2">
          <Layers className="w-4.5 h-4.5 text-indigo-400" />
          Extracted Role Requirements ({kit.role.requirements.length})
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {kit.role.requirements.map((req) => (
            <div key={req.id} className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-xs space-y-1.5 hover:border-violet-500/20 transition-all">
              <div className="flex items-center justify-between">
                <span className="font-mono text-violet-400 uppercase font-bold">{req.id}</span>
                <div className="flex gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold ${
                    req.priority === "must" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {req.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] uppercase font-bold bg-white/10 text-white/60">{req.kind}</span>
                </div>
              </div>
              <p className="text-white/80 leading-snug">{req.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Questions Section */}
      <section className="bg-[#0f111a]/80 backdrop-blur-md border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h4 className="text-white font-semibold text-sm flex items-center gap-2">
            <BrainCircuit className="w-4.5 h-4.5 text-violet-400" />
            Interview Question Bank ({displayKit.questions.length})
          </h4>

          <button
            onClick={() => onLaunchMock(displayKit.questions, `${kit.role.title} Full Question Bank Practice`)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-violet-600/25 transition-all"
          >
            <PlayCircle className="w-4 h-4" />Practice All (Mock Mode)
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {catList.map((cat) => {
            const count = displayKit.questions.filter((q) => q.category === cat).length;
            const theme = CATEGORY_THEMES[cat];
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  activeCategory === cat ? "bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/30" : "bg-white/[0.03] text-white/50 border-white/10 hover:bg-white/[0.07]"
                }`}>
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-white/40 text-xs">{catQs.length} {CATEGORY_LABELS[activeCategory]} question{catQs.length === 1 ? "" : "s"}</p>
          <div className="flex gap-2">
            {catQs.length > 0 && (
              <button
                onClick={() => onLaunchMock(catQs, `${CATEGORY_LABELS[activeCategory]} Category Mock Test`)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg transition-colors"
              >
                <PlayCircle className="w-3.5 h-3.5" />Test This Category
              </button>
            )}
            <button onClick={handleRegenCategory} disabled={regenCategory === activeCategory}
              className="flex items-center gap-1.5 px-3 py-1 text-xs text-white/40 hover:text-white border border-white/10 rounded-lg disabled:opacity-30 transition-colors">
              {regenCategory === activeCategory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Regenerate Category
            </button>
          </div>
        </div>

        {/* Question Cards List */}
        <div className="space-y-3">
          {catQs.map((q, i) => (
            <BuilderQuestionCard
              key={q.id} q={q} kitId={kitId} token={token}
              requirements={kit.role.requirements}
              onUpdate={(fields) => store.updateQuestion(q.id, fields)}
              onPin={(pinned) => store.setQuestionPin(q.id, pinned)}
              onDelete={() => {
                if (q.id.startsWith("temp-")) store.removeNewQuestion(q.id);
                else store.markQuestionDeleted(q.id);
              }}
              onMoveUp={() => moveQuestion(q.id, -1)}
              onMoveDown={() => moveQuestion(q.id, 1)}
              isFirst={i === 0} isLast={i === catQs.length - 1}
            />
          ))}
          {catQs.length === 0 && !showAddQ && (
            <p className="text-white/30 text-sm text-center py-6">No questions in this category yet</p>
          )}
        </div>

        {showAddQ ? (
          <AddQuestionForm
            defaultCategory={activeCategory}
            requirements={kit.role.requirements}
            onAdd={(draft) => { store.addNewQuestion(draft); setShowAddQ(false); }}
            onCancel={() => setShowAddQ(false)}
          />
        ) : (
          <button onClick={() => setShowAddQ(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 w-full text-white/50 hover:text-white bg-white/[0.02] hover:bg-white/[0.05] border border-dashed border-white/15 hover:border-violet-500/40 rounded-2xl text-xs font-bold transition-all">
            <Plus className="w-4 h-4 text-violet-400" />Add Custom Question to {CATEGORY_LABELS[activeCategory]}
          </button>
        )}
      </section>

      {/* Flashcards Section */}
      <section className="bg-[#0f111a]/80 backdrop-blur-md border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-xl">
        <h4 className="text-white font-semibold text-sm flex items-center gap-2">
          <BookOpen className="w-4.5 h-4.5 text-pink-400" />
          Interactive 3D Flashcards Studio ({displayKit.flashcards.length})
        </h4>

        <div className="space-y-3">
          {displayKit.flashcards.map((f, i) => (
            <BuilderFlashcard
              key={f.id} f={f} kitId={kitId} token={token}
              onUpdate={(fields) => store.updateFlashcard(f.id, fields)}
              onPin={(pinned) => store.setFlashcardPin(f.id, pinned)}
              onDelete={() => {
                if (f.id.startsWith("temp-")) store.removeNewFlashcard(f.id);
                else store.markFlashcardDeleted(f.id);
              }}
              onMoveUp={() => moveFlashcard(f.id, -1)}
              onMoveDown={() => moveFlashcard(f.id, 1)}
              isFirst={i === 0} isLast={i === displayKit.flashcards.length - 1}
            />
          ))}
          {displayKit.flashcards.length === 0 && !showAddF && (
            <p className="text-white/30 text-sm text-center py-6">No flashcards yet</p>
          )}
        </div>

        {showAddF ? (
          <div className="bg-pink-500/5 border border-pink-500/30 rounded-2xl p-5 space-y-3">
            <p className="text-pink-300 text-xs font-bold uppercase tracking-wider">New Flashcard</p>
            <AddFlashcardInline
              requirements={kit.role.requirements}
              onAdd={(draft) => { store.addNewFlashcard(draft); setShowAddF(false); }}
              onCancel={() => setShowAddF(false)}
            />
          </div>
        ) : (
          <button onClick={() => setShowAddF(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 w-full text-white/50 hover:text-white bg-white/[0.02] hover:bg-white/[0.05] border border-dashed border-white/15 hover:border-pink-500/40 rounded-2xl text-xs font-bold transition-all">
            <Plus className="w-4 h-4 text-pink-400" />Add Flashcard to Studio
          </button>
        )}
      </section>
    </div>
  );
}

// ─── Add Flashcard Inline Form ────────────────────────────────────────────────

function AddFlashcardInline({
  requirements, onAdd, onCancel,
}: {
  requirements: AppendixAKit["role"]["requirements"];
  onAdd: (draft: NewFlashcardDraft) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ front: "", back: "", requirementIds: [] as string[] });
  const toggle = (id: string) =>
    setForm((f) => ({ ...f, requirementIds: f.requirementIds.includes(id) ? f.requirementIds.filter((r) => r !== id) : [...f.requirementIds, id] }));
  const submit = () => {
    if (!form.front.trim() || !form.back.trim()) return;
    onAdd({ _tempId: `temp-${uuidv4()}`, front: form.front, back: form.back, requirementIds: form.requirementIds });
  };
  return (
    <div className="space-y-3">
      <input value={form.front} onChange={(e) => setForm((f) => ({ ...f, front: e.target.value }))} placeholder="Front side concept/term…"
        className="w-full bg-[#141722] border border-white/15 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-pink-500/40" />
      <textarea rows={3} value={form.back} onChange={(e) => setForm((f) => ({ ...f, back: e.target.value }))} placeholder="Back side answer/explanation…"
        className="w-full bg-[#141722] border border-white/15 rounded-xl px-3.5 py-2.5 text-white/80 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-pink-500/40" />
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={!form.front.trim() || !form.back.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl disabled:opacity-40 shadow-lg shadow-pink-600/20">
          <Plus className="w-4 h-4" />Add Flashcard
        </button>
        <button onClick={onCancel} className="text-white/40 hover:text-white text-xs px-2 font-medium">Cancel</button>
      </div>
    </div>
  );
}

// ─── Schedule Tab (Round-Robin Interleaved Visual Timeline) ────────────────────

function ScheduleTab({
  kit, kitId, token, onLaunchMock,
}: {
  kit: AppendixAKit; kitId: string; token: string;
  onLaunchMock: (qs: GeneratedQuestion[], title: string) => void;
}) {
  const store = useBuilderStore();
  const [activeDay, setActiveDay] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [localDays, setLocalDays] = useState<ScheduleDay[]>(kit.schedule.days);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [regenning, setRegenning] = useState(false);

  const displayKit = selectDisplayedKit(store) ?? kit;
  const stale = kit.scheduleStale;

  const handleRegenSchedule = async () => {
    if (!window.confirm("Regenerate schedule using the Round-Robin Interleaved algorithm?")) return;
    setRegenning(true);
    try {
      const updatedKit = await regenerateSchedule(kitId, token);
      store.setBaseKit(updatedKit);
      setLocalDays(updatedKit.schedule.days);
      setScheduleMsg("Schedule regenerated with Round-Robin interleaved topic distribution.");
    } catch (e: any) {
      setScheduleMsg(`Failed: ${e.message}`);
    } finally {
      setRegenning(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const { schedule } = await patchSchedule(kitId, localDays, token);
      if (store.baseKit) store.setBaseKit({ ...store.baseKit, schedule, scheduleStale: false });
      setEditMode(false);
      setScheduleMsg("Schedule saved.");
    } catch (e: any) {
      setScheduleMsg(`Failed: ${e.message}`);
    } finally {
      setSavingSchedule(false);
    }
  };

  const currentDay = localDays.find((d) => d.day === activeDay);
  const questionsForDay = currentDay
    ? currentDay.question_ids.map((qid) => displayKit.questions.find((q) => q.id === qid)).filter(Boolean) as GeneratedQuestion[]
    : [];

  return (
    <div className="space-y-6">
      {stale && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl shadow-xl">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-300">
            <p className="font-bold mb-0.5">Schedule Needs Synchronization</p>
            <p className="text-amber-300/70 text-xs">Your question set changed. Regenerate to balance your study plan evenly without duplicate question repetitions.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleRegenSchedule} disabled={regenning}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-600/20 disabled:opacity-50">
              Regenerate Schedule
            </button>
          </div>
        </div>
      )}

      {scheduleMsg && (
        <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl text-violet-300 text-xs font-medium">{scheduleMsg}</div>
      )}

      <div className="bg-[#0f111a]/80 backdrop-blur-md border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h4 className="text-white font-semibold text-sm flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-emerald-400" />
              {displayKit.schedule.days_available}-Day Round-Robin Interleaved Plan
            </h4>
            <p className="text-white/40 text-xs mt-0.5">Evenly distributed across days • Zero duplicate question repetitions</p>
          </div>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <button onClick={handleSaveSchedule} disabled={savingSchedule}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50">
                  {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Save Schedule
                </button>
                <button onClick={() => { setLocalDays(kit.schedule.days); setEditMode(false); }}
                  className="px-3 py-2 text-white/50 hover:text-white text-xs font-medium transition-colors">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={handleRegenSchedule} disabled={regenning}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white/60 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-xl disabled:opacity-30 transition-all">
                  {regenning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Regenerate
                </button>
                <button onClick={() => setEditMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white/60 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-xl transition-all">
                  <Pencil className="w-3.5 h-3.5" />Edit Schedule
                </button>
              </>
            )}
          </div>
        </div>

        {/* Day Nodes Palette */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {localDays.map((d) => {
            const count = d.question_ids.length;
            const isActive = activeDay === d.day;
            return (
              <button key={d.day} onClick={() => setActiveDay(d.day)}
                className={`shrink-0 flex flex-col items-center justify-center p-3 w-20 rounded-2xl text-xs font-bold transition-all border ${
                  isActive ? "bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/40" : "bg-white/[0.03] text-white/60 border-white/10 hover:bg-white/[0.08]"
                }`}>
                <span className="text-[10px] opacity-60 uppercase font-mono">Day</span>
                <span className="text-base font-extrabold">{d.day}</span>
                <span className="text-[9px] opacity-70 mt-0.5">{count} {count === 1 ? "q" : "qs"}</span>
              </button>
            );
          })}
        </div>

        {/* Active Day Detail Card */}
        {currentDay && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                  D{currentDay.day}
                </div>
                <div>
                  {editMode ? (
                    <input
                      value={currentDay.focus}
                      onChange={(e) => setLocalDays((ds) => ds.map((d) => d.day === activeDay ? { ...d, focus: e.target.value } : d))}
                      className="bg-[#141722] border border-violet-500/40 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none"
                    />
                  ) : (
                    <h5 className="text-white font-bold text-base">{currentDay.focus}</h5>
                  )}
                  <p className="text-white/40 text-xs">Day {currentDay.day} Study Allocation</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-emerald-300 font-mono bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                  <Clock className="w-3.5 h-3.5" />Estimated ~{currentDay.minutes} min
                </span>

                {questionsForDay.length > 0 && (
                  <button
                    onClick={() => onLaunchMock(questionsForDay, `Day ${currentDay.day} Practice Test: ${currentDay.focus}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    <PlayCircle className="w-4 h-4" />Practice Day {currentDay.day} (Mock)
                  </button>
                )}
              </div>
            </div>

            {/* Questions Scheduled for Day */}
            {questionsForDay.length > 0 ? (
              <div className="space-y-2.5 pt-2">
                {questionsForDay.map((q) => {
                  const theme = CATEGORY_THEMES[q.category] ?? { bg: "bg-white/5", text: "text-white/60", border: "border-white/10", glow: "" };
                  return (
                    <div key={q.id} className="p-3.5 bg-[#0f111a] border border-white/[0.06] rounded-xl text-sm flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold border ${theme.bg} ${theme.text} ${theme.border}`}>
                            {CATEGORY_LABELS[q.category]}
                          </span>
                          <DifficultyEnergyBar level={q.difficulty} />
                        </div>
                        <p className="text-white/90 text-xs font-medium leading-snug">{q.prompt}</p>
                      </div>

                      {editMode && (
                        <button
                          onClick={() => setLocalDays((ds) => ds.map((d) => d.day === activeDay
                            ? { ...d, question_ids: d.question_ids.filter((id) => id !== q.id) }
                            : d))}
                          className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 transition-colors p-1"
                          title="Remove question from this day"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-white/30 text-xs py-8 bg-white/[0.01] rounded-xl border border-white/[0.04]">
                Rest / Buffer Day — No new questions assigned for this day.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Flashcard Practice Mode ──────────────────────────────────────────────────

function FlashcardPracticeMode({
  kit, kitId, token, onExit,
}: {
  kit: AppendixAKit; kitId: string; token: string; onExit: () => void;
}) {
  type Screen = "landing" | "session" | "summary" | "detail";
  const [screen, setScreen] = useState<Screen>("landing");
  const [sessions, setSessions] = useState<PracticeSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [attemptedCount, setAttemptedCount] = useState(0);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [sessionEnding, setSessionEnding] = useState(false);
  const [detailSession, setDetailSession] = useState<PracticeSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleAttemptRef = useRef<(confidence: number | null, skipped: boolean) => Promise<void>>(async () => {});

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try { setSessions(await listPracticeSessions(kitId, token)); } catch {} finally { setSessionsLoading(false); }
  }, [kitId, token]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (screen !== "session") return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [screen]);

  useEffect(() => {
    if (screen !== "session") return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((v) => !v); }
      if (e.key === "s" || e.key === "S") { e.preventDefault(); handleAttemptRef.current(null, true); }
      if (["1","2","3","4","5"].includes(e.key)) {
        const map: Record<string, number> = { "1": 1, "2": 3, "3": 5, "4": 8, "5": 10 };
        handleAttemptRef.current(map[e.key]!, false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen]);

  if (kit.flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <BookOpen className="w-12 h-12 text-white/10" />
        <div>
          <h3 className="text-white font-semibold">No flashcards to practice</h3>
          <p className="text-white/40 text-sm mt-1">Add flashcards in the Overview tab first.</p>
        </div>
        <button onClick={onExit} className="px-4 py-2 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-xl transition-colors">
          Back to Overview
        </button>
      </div>
    );
  }

  const currentCardId = queue[cardIndex];
  const currentCard = kit.flashcards.find((f) => f.id === currentCardId);

  const handleAttempt = async (confidence: number | null, skipped: boolean) => {
    if (!sessionId || !currentCardId) return;
    setAttemptedCount((n) => n + 1);
    recordAttempt(kitId, sessionId, { flashcardId: currentCardId, confidence, skipped }, token).catch(() => {});
    if (cardIndex < queue.length - 1) {
      setCardIndex((i) => i + 1);
      setFlipped(false);
    } else {
      setScreen("summary");
    }
  };
  handleAttemptRef.current = handleAttempt;

  const handleStartSession = async () => {
    setSessionStarting(true);
    try {
      const { sessionId: sid } = await startPracticeSession(kitId, token);
      let q: string[];
      try {
        q = await getPracticeQueue(kitId, token);
        if (!q || q.length === 0) q = kit.flashcards.map((f) => f.id);
      } catch {
        q = kit.flashcards.map((f) => f.id);
      }
      setSessionId(sid);
      setQueue(q);
      setCardIndex(0);
      setFlipped(false);
      setAttemptedCount(0);
      setScreen("session");
    } catch (e: any) {
      alert("Failed to start practice session: " + e.message);
    } finally {
      setSessionStarting(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    setSessionEnding(true);
    try {
      await endPracticeSession(kitId, sessionId, token);
      await loadSessions();
      setScreen("landing");
    } catch (e: any) {
      alert("Failed to end session: " + e.message);
    } finally {
      setSessionEnding(false);
    }
  };

  const handleViewDetail = async (sid: string) => {
    setDetailLoading(true);
    setScreen("detail");
    try {
      const d = await getPracticeSessionDetail(kitId, sid, token);
      setDetailSession(d);
    } catch {} finally { setDetailLoading(false); }
  };

  if (screen === "landing") {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-pink-400" />Flashcard Practice Studio
          </h3>
          <button onClick={onExit} id="fc-back-overview" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to Overview
          </button>
        </div>

        <div className="bg-[#0f111a]/60 border border-pink-500/20 rounded-2xl p-4 text-xs text-white/50 space-y-1">
          <p className="font-bold text-pink-300 uppercase tracking-wider text-[10px]">Smart Personalized Queue</p>
          <p>Cards you struggled with previously appear first. Low-confidence cards are prioritized to boost mastery faster.</p>
        </div>

        <button onClick={handleStartSession} disabled={sessionStarting} id="fc-start-session"
          className="w-full flex items-center justify-center gap-3 p-5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-pink-950/30 disabled:opacity-50 text-base">
          {sessionStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
          Start Personalized Flashcard Session
        </button>

        {sessionsLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-pink-400 animate-spin" /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-white/30 text-sm py-8 bg-white/[0.01] border border-white/[0.04] rounded-2xl">
            No completed sessions yet — launch your first session above!
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider">Past Practice Sessions</h4>
            {sessions.map((s) => (
              <button key={s.id} onClick={() => handleViewDetail(s.id)}
                className="w-full flex items-center justify-between p-4 bg-[#0f111a] border border-white/[0.07] hover:border-pink-500/30 rounded-2xl transition-all">
                <div className="text-left">
                  <p className="text-white text-sm font-bold">
                    {new Date(s.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">{s.attemptCount} cards · avg confidence {s.avgConfidence ?? "—"}/10</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (screen === "detail") {
    return (
      <div className="space-y-4">
        <button onClick={() => setScreen("landing")} className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to Sessions
        </button>
        {detailLoading ? <SectionSpinner /> : !detailSession ? (
          <p className="text-white/40 text-sm">Failed to load session details.</p>
        ) : (
          <div className="space-y-3">
            <h4 className="text-white font-bold">Session on {new Date(detailSession.startedAt).toLocaleDateString()}</h4>
            {detailSession.attempts.map((a) => (
              <div key={a.id} className="p-4 bg-[#0f111a] border border-white/[0.07] rounded-xl space-y-1">
                <p className="text-white text-sm font-semibold">{a.front}</p>
                <p className="text-white/60 text-xs">{a.back}</p>
                <p className={`text-xs font-mono mt-1 ${a.skipped ? "text-white/30" : (a.confidence ?? 0) >= 7 ? "text-emerald-300" : "text-rose-300"}`}>
                  {a.skipped ? "Skipped" : `Confidence: ${a.confidence}/10`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (screen === "summary") {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-white text-xl font-bold">Deck Completed!</h3>
          <p className="text-white/40 text-sm mt-1">{attemptedCount} flashcards reviewed.</p>
          <p className="text-white/30 text-xs mt-1">Your next session will prioritize cards you found difficult.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={handleEndSession} disabled={sessionEnding} id="fc-save-session"
            className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50">
            {sessionEnding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Session
          </button>
          <button onClick={onExit} className="py-3 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/70 font-semibold rounded-xl transition-colors">
            Exit
          </button>
        </div>
      </div>
    );
  }

  // Card Session screen — FIXED: no scrolling, everything fits in viewport
  const progress = queue.length > 0 ? ((cardIndex + 1) / queue.length) * 100 : 0;

  return (
    <div ref={containerRef} tabIndex={-1} className="flex flex-col gap-3 outline-none focus:outline-none">
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-white/40 font-mono shrink-0">
        <span>Card {cardIndex + 1} of {queue.length}</span>
        <div className="flex items-center gap-3">
          <span className="hidden md:block text-white/20 text-[10px]">Space=flip · S=skip · 1-5=rate</span>
          <button id="fc-exit-session"
            onClick={() => { if (window.confirm("Exit session? Progress won't be saved.")) onExit(); }}
            className="flex items-center gap-1 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />Exit
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden shrink-0">
        <div className="h-full bg-pink-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(236,72,153,0.6)]" style={{ width: `${progress}%` }} />
      </div>

      {currentCard ? (
        <>
          {/* 3D Flip Card — clamped height, always fits in viewport without scroll */}
          <div className="w-full shrink-0" style={{ perspective: "1000px", height: "clamp(180px, 34vh, 270px)" }}>
            <button
              id="fc-card-flip"
              aria-label={flipped ? "Card answer — click to flip back" : "Flip card to reveal answer"}
              onClick={() => setFlipped((v) => !v)}
              className="w-full h-full relative focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 rounded-3xl"
              style={{ transformStyle: "preserve-3d", transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
            >
              {/* Front */}
              <div className="absolute inset-0 rounded-3xl bg-[#0f111a] border border-white/15 flex flex-col items-center justify-center p-5 sm:p-8 text-center shadow-2xl"
                style={{ backfaceVisibility: "hidden" }}>
                <span className="text-[10px] text-violet-400 uppercase font-bold tracking-widest mb-3">Question / Term</span>
                <p className="text-white font-bold leading-snug text-sm sm:text-base md:text-lg">{currentCard.front}</p>
                <p className="text-white/30 text-xs mt-4">Click or press Space to reveal</p>
              </div>
              {/* Back */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-pink-950/40 to-purple-950/40 border border-pink-500/30 flex flex-col items-center justify-center p-5 sm:p-8 text-center shadow-2xl overflow-y-auto"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <span className="text-[10px] text-pink-300 uppercase font-bold tracking-widest mb-3">Answer Explanation</span>
                <p className="text-white/90 leading-relaxed text-sm sm:text-base">{currentCard.back}</p>
              </div>
            </button>
          </div>

          {/* Action area — always visible, no scroll required */}
          <div className="shrink-0">
            {flipped ? (
              <div className="space-y-2 animate-in fade-in duration-200">
                <p className="text-white/40 text-xs text-center font-semibold uppercase tracking-wider">How well did you know this?</p>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {CONFIDENCE_RATING_OPTIONS.map(({ label, value }, idx) => (
                    <button key={value} id={`fc-rate-${value}`}
                      onClick={() => handleAttempt(value, false)}
                      title={`Rate ${value}/10 — Press key ${idx + 1}`}
                      className="flex flex-col items-center gap-0.5 py-2.5 sm:py-3 bg-white/[0.04] hover:bg-pink-500/20 hover:border-pink-500/40 border border-white/[0.08] rounded-xl text-xs text-white/70 hover:text-white transition-all active:scale-95">
                      <span className="font-bold text-sm sm:text-base leading-none">{value}</span>
                      <span className="text-[8px] sm:text-[9px] text-center leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
                <button id="fc-skip" onClick={() => handleAttempt(null, true)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-white/30 hover:text-white/60 text-xs border border-white/[0.06] hover:border-white/10 rounded-xl transition-colors">
                  <SkipForward className="w-3.5 h-3.5" />Skip this card
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button id="fc-reveal" onClick={() => setFlipped(true)}
                  className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-pink-600/30 active:scale-[0.98]">
                  Reveal Answer
                </button>
                <button id="fc-skip-before-reveal" onClick={() => handleAttempt(null, true)} title="Skip (press S)"
                  className="px-4 py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/40 hover:text-white rounded-xl transition-all" aria-label="Skip card">
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-white/30 text-center py-10">No more cards in queue.</p>
      )}
    </div>
  );
}

// ─── Mock Exam History Tab ────────────────────────────────────────────────────

function MockExamHistoryTab({
  kitId, token, onLaunchMock, kit,
}: {
  kitId: string;
  token: string;
  onLaunchMock: (qs: GeneratedQuestion[], title: string) => void;
  kit: AppendixAKit;
}) {
  const [exams, setExams] = useState<MockExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<MockExamDetail | null>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    setLoading(true);
    listMockExams(kitId, token)
      .then((data) => setExams(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [kitId, token]);

  const handleViewExam = async (examId: string) => {
    setExamLoading(true);
    try {
      const detail = await getMockExamDetail(kitId, examId, token);
      setSelectedExam(detail);
    } catch (e: any) {
      alert("Failed to load exam: " + e.message);
    } finally {
      setExamLoading(false);
    }
  };

  const handleGenerateReport = async (examId: string) => {
    setGeneratingReport(true);
    try {
      const report = await generateMockExamAiReport(kitId, examId, token);
      setSelectedExam((prev) => prev ? { ...prev, aiReport: report } : prev);
    } catch (e: any) {
      alert("Failed to generate AI report: " + e.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const formatDuration = (sec: number | null) => {
    if (!sec) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const getGradeColor = (score: number) => {
    if (score >= 80) return "text-emerald-300";
    if (score >= 60) return "text-amber-300";
    return "text-rose-300";
  };

  // Detail view
  if (selectedExam) {
    const rated = selectedExam.questions.filter((q) => q.confidence !== null);
    const avgConf = rated.length > 0 ? (rated.reduce((s, q) => s + (q.confidence ?? 0), 0) / rated.length).toFixed(1) : null;
    const flagged = selectedExam.questions.filter((q) => q.flagged);

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button onClick={() => setSelectedExam(null)} className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to Exam History
          </button>
          <div className="flex items-center gap-2">
            {!selectedExam.aiReport && (
              <button onClick={() => handleGenerateReport(selectedExam.id)} disabled={generatingReport}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-60 transition-all">
                {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                {generatingReport ? "Generating..." : "Get AI Coach Report"}
              </button>
            )}
          </div>
        </div>

        {/* Exam Header */}
        <div className="bg-[#0f111a]/80 border border-white/[0.08] rounded-2xl p-5 space-y-3">
          <h3 className="text-white font-bold text-lg">{selectedExam.title}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <div className="text-white font-bold text-xl">{selectedExam.questions.length}</div>
              <div className="text-white/40 text-[10px] uppercase">Questions</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <div className="text-white font-bold text-xl">{avgConf ?? "—"}</div>
              <div className="text-white/40 text-[10px] uppercase">Avg Confidence</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <div className="text-white font-bold text-xl">{flagged.length}</div>
              <div className="text-white/40 text-[10px] uppercase">Flagged</div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <div className="text-white font-bold text-xl">{formatDuration(selectedExam.durationSec)}</div>
              <div className="text-white/40 text-[10px] uppercase">Duration</div>
            </div>
          </div>
        </div>

        {/* AI Report */}
        {selectedExam.aiReport && (
          <div className="bg-gradient-to-br from-violet-900/20 to-indigo-900/20 border border-violet-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-bold text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-violet-400" />AI Coaching Report</h4>
              <div className={`text-3xl font-black ${getGradeColor(selectedExam.aiReport.overallScore)}`}>{selectedExam.aiReport.grade} <span className="text-base font-bold text-white/60">{selectedExam.aiReport.overallScore}/100</span></div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">{selectedExam.aiReport.summary}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-emerald-300 text-xs font-bold uppercase">Strengths</p>
                {selectedExam.aiReport.strengths.map((s, i) => <p key={i} className="text-white/70 text-xs flex gap-2"><span className="text-emerald-400">✓</span>{s}</p>)}
              </div>
              <div className="space-y-2">
                <p className="text-rose-300 text-xs font-bold uppercase">Needs Work</p>
                {selectedExam.aiReport.weaknesses.map((w, i) => <p key={i} className="text-white/70 text-xs flex gap-2"><span className="text-rose-400">→</span>{w}</p>)}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-violet-300 text-xs font-bold uppercase">Next Steps</p>
              {selectedExam.aiReport.nextSteps.map((s, i) => (
                <p key={i} className="text-white/70 text-xs flex gap-2">
                  <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>{s}
                </p>
              ))}
            </div>
            <p className="text-violet-200/60 text-xs italic text-center">"{selectedExam.aiReport.motivationalNote}"</p>
          </div>
        )}

        {/* Question Review */}
        <div className="space-y-3">
          <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider">Question-by-Question Review</h4>
          {selectedExam.questions.map((q, i) => (
            <div key={q.id ?? i} className={`p-4 border rounded-2xl space-y-2 ${q.flagged ? "bg-amber-900/10 border-amber-500/25" : "bg-[#0f111a] border-white/[0.07]"}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-violet-400">Q{i + 1}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-lg border ${CATEGORY_THEMES[q.category as QuestionCategory]?.bg ?? "bg-white/5"} ${CATEGORY_THEMES[q.category as QuestionCategory]?.text ?? "text-white/60"} ${CATEGORY_THEMES[q.category as QuestionCategory]?.border ?? "border-white/10"}`}>
                    {q.category}
                  </span>
                  {q.flagged && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">Flagged</span>}
                </div>
                {q.confidence !== null && q.confidence !== undefined ? (
                  <span className={`text-sm font-bold ${q.confidence >= 7 ? "text-emerald-300" : q.confidence >= 4 ? "text-amber-300" : "text-rose-300"}`}>
                    {q.confidence}/10
                  </span>
                ) : <span className="text-white/30 text-xs">Not rated</span>}
              </div>
              <p className="text-white text-sm font-semibold leading-snug">{q.questionText}</p>
              <details className="group">
                <summary className="text-xs text-violet-300 cursor-pointer hover:text-violet-200 transition-colors font-semibold">View answer outline</summary>
                <p className="text-white/60 text-xs mt-2 leading-relaxed bg-violet-900/10 border border-violet-500/20 rounded-xl p-3">{q.answerOutline}</p>
              </details>
              {q.userNotes && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
                  <p className="text-white/40 text-[10px] font-bold uppercase">Your Notes</p>
                  <p className="text-white/70 text-xs mt-1">{q.userNotes}</p>
                </div>
              )}
              {selectedExam.aiReport?.questionFeedback?.find((f) => f.position === i) && (
                <div className={`text-xs p-2.5 rounded-xl border ${selectedExam.aiReport.questionFeedback.find((f) => f.position === i)!.performance === "strong" ? "bg-emerald-900/15 border-emerald-500/25 text-emerald-200" : selectedExam.aiReport.questionFeedback.find((f) => f.position === i)!.performance === "needs_work" ? "bg-rose-900/15 border-rose-500/25 text-rose-200" : "bg-white/[0.03] border-white/[0.08] text-white/60"}`}>
                  <span className="font-bold">AI Feedback: </span>
                  {selectedExam.aiReport.questionFeedback.find((f) => f.position === i)!.feedback}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-violet-400" />Mock Exam History
        </h3>
        <button
          onClick={() => onLaunchMock(kit.questions, `${kit.role.title} Full Mock Exam`)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-violet-600/25 transition-all"
        >
          <PlayCircle className="w-4 h-4" />New Mock Exam
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-400 animate-spin" /></div>
      ) : exams.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
            <ClipboardList className="w-8 h-8 text-violet-400/50" />
          </div>
          <div>
            <h4 className="text-white font-semibold">No mock exams yet</h4>
            <p className="text-white/40 text-sm mt-1">Take your first mock exam to see your progress here.</p>
          </div>
          <button onClick={() => onLaunchMock(kit.questions, `${kit.role.title} Full Mock Exam`)}
            className="mx-auto flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-violet-600/25 transition-all">
            <PlayCircle className="w-4 h-4" />Start Your First Mock Exam
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => {
            return (
              <button key={exam.id} onClick={() => handleViewExam(exam.id)}
                className="w-full flex items-center justify-between p-4 bg-[#0f111a] border border-white/[0.07] hover:border-violet-500/30 rounded-2xl transition-all text-left group">
                <div className="space-y-1.5">
                  <p className="text-white font-bold text-sm group-hover:text-violet-300 transition-colors">{exam.title}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
                    <span>{new Date(exam.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span>{exam.questionCount} questions</span>
                    <span>{formatDuration(exam.durationSec)}</span>
                    {exam.hasAiReport && (
                      <span className="flex items-center gap-1 text-violet-300 font-semibold">
                        <Bot className="w-3.5 h-3.5" />AI Report
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-violet-400 transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      )}
      {examLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/10 rounded-2xl p-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            <p className="text-white text-sm font-semibold">Loading exam...</p>
          </div>
        </div>
      )}
    </div>
  );
}




// ─── Main Kit Detail Page Container ───────────────────────────────────────────

export default function KitDetailPage() {
  const { kitId } = useParams<{ kitId: string }>();
  const { token, isAuthenticated } = useAuthStore();
  const router = useRouter();

  const store = useBuilderStore();
  const isDirty = selectIsDirty(store);

  const [status, setStatus] = useState<KitStatus | null>(null);
  const [kit, setKit] = useState<AppendixAKit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "practice" | "mock-history">("overview");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Mock Exam State
  const [mockExamState, setMockExamState] = useState<{
    isOpen: boolean;
    questions: GeneratedQuestion[];
    title: string;
  }>({ isOpen: false, questions: [], title: "" });

  const loadKit = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getKit(kitId, token);
      setStatus(data.status);
      if (data.kit) {
        const enriched: AppendixAKit = {
          ...data.kit,
          briefState: (data.briefState as "GENERATED" | "EDITED") ?? "GENERATED",
          scheduleStale: data.scheduleStale ?? false,
        };
        setKit(enriched);
        store.setBaseKit(enriched);
      }
      setInitialLoading(false);

      if (data.status !== "READY" && data.status !== "FAILED") {
        const unsub = subscribeToKit(kitId, token, {
          onStatus: (s) => setStatus(s),
          onResult: (result) => {
            const enriched: AppendixAKit = {
              ...result,
              briefState: "GENERATED",
              scheduleStale: false,
            };
            setKit(enriched);
            store.setBaseKit(enriched);
            setStatus("READY");
          },
          onError: (msg) => {
            setStatus("FAILED");
            setLoadError(msg);
          },
        });
        unsubRef.current = unsub;
      }
    } catch (e: any) {
      setLoadError(e.message || "Failed to load kit");
      setInitialLoading(false);
    }
  }, [kitId, token]);

  useEffect(() => {
    if (isAuthenticated && token) loadKit();
    return () => { unsubRef.current?.(); };
  }, [kitId, isAuthenticated, token]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleSave = async () => {
    if (!token || !kitId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updatedKit = await commitBuilderChanges(kitId, store.diff, token);
      const enriched: AppendixAKit = {
        ...updatedKit,
        briefState: updatedKit.briefState ?? "GENERATED",
        scheduleStale: updatedKit.scheduleStale ?? false,
      };
      store.setBaseKit(enriched);
      setKit(enriched);
    } catch (e: any) {
      setSaveError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!window.confirm("Discard all unsaved changes?")) return;
    store.clearDiff();
  };

  const launchMockExam = (questions: GeneratedQuestion[], title: string) => {
    setMockExamState({ isOpen: true, questions, title });
  };

  if (!isAuthenticated) {
    router.replace("/auth/signin?redirect=/dashboard/kits");
    return null;
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <p className="text-white/60">{loadError}</p>
        <button onClick={() => router.back()} className="px-4 py-2 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-xl transition-colors">
          Go back
        </button>
      </div>
    );
  }

  const displayName = kit?.source?.company || (() => {
    try {
      const h = new URL(kit?.source?.company_url ?? "").hostname.replace(/^www\./, "").split(".")[0] ?? "";
      return h.charAt(0).toUpperCase() + h.slice(1);
    } catch { return kitId; }
  })();

  return (
    <div className="flex flex-col min-h-full">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-white/[0.06] text-xs font-medium">
        <Link href="/" className="text-white/30 hover:text-white/60 transition-colors">PrepKit</Link>
        <ChevronRight className="w-3.5 h-3.5 text-white/20" />
        <Link href="/dashboard" className="text-white/30 hover:text-white/60 transition-colors">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5 text-white/20" />
        <Link href="/dashboard/kits" className="text-white/30 hover:text-white/60 transition-colors">My Kits</Link>
        <ChevronRight className="w-3.5 h-3.5 text-white/20" />
        <span className="text-white/80 font-bold truncate max-w-48" title={kitId}>
          {kit?.role?.title || displayName || kitId}
        </span>
      </div>

      {/* Save Banner */}
      <SaveBanner kitId={kitId} isDirty={isDirty} saving={saving} saveError={saveError} onSave={handleSave} onDiscard={handleDiscard} />

      {/* Main Container */}
      {status && status !== "READY" && status !== "FAILED" ? (
        <div className="p-6"><GeneratingView status={status} /></div>
      ) : status === "FAILED" ? (
        <div className="p-6 flex flex-col items-center justify-center py-20 space-y-4 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400" />
          <div>
            <h3 className="text-white font-semibold">Generation failed</h3>
            <p className="text-white/40 text-sm mt-1">{loadError || "Something went wrong during kit generation."}</p>
          </div>
          <Link href="/dashboard/kits" className="px-4 py-2 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-xl transition-colors">
            Back to My Kits
          </Link>
        </div>
      ) : kit ? (
        <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
          {/* Header Card */}
          <div className="bg-[#0f111a]/90 backdrop-blur-md border border-white/[0.08] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500" />

            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-violet-300 bg-violet-500/10 px-3 py-1 rounded-full w-fit mb-2 border border-violet-500/20 shadow-sm">
                  <Briefcase className="w-3.5 h-3.5" />
                  {kit.role.seniority} {kit.role.title}
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{kit.role.title}</h2>
                <p className="text-white/40 text-xs font-mono mt-1">{kit.source.company_url}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => launchMockExam(kit.questions, `${kit.role.title} Full Mock Exam`)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-violet-600/30 transition-all"
                >
                  <PlayCircle className="w-4 h-4" />Full Mock Exam
                </button>
                <Link href="/dashboard/kits" className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-xs font-bold rounded-xl transition-colors border border-white/10">
                  <ArrowLeft className="w-3.5 h-3.5" />My Kits
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 text-xs font-semibold">
              <span className="px-3 py-1 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70">{kit.questions.length} questions</span>
              <span className="px-3 py-1 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70">{kit.flashcards.length} flashcards</span>
              <span className="px-3 py-1 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70">{kit.schedule.days_available}-day round-robin plan</span>
              <span className="px-3 py-1 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70">{kit.role.requirements.length} requirements</span>
            </div>
          </div>

          {/* Navigation Tab Bar */}
          <div className="flex flex-wrap gap-1.5 bg-[#0d0f18] border border-white/[0.08] p-1.5 rounded-2xl w-fit shadow-lg">
            {(["overview", "schedule", "practice", "mock-history"] as const).map((tab) => (
              <button key={tab} id={`tab-${tab}`} onClick={() => setActiveTab(tab)}
                className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                  activeTab === tab ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30" : "text-white/40 hover:text-white"
                }`}>
                {tab === "overview" && "Overview & Builder"}
                {tab === "schedule" && "Study Schedule"}
                {tab === "practice" && "Flashcard Studio"}
                {tab === "mock-history" && (
                  <span className="flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5" />Mock Exams
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Views */}
          {activeTab === "overview" && (
            <OverviewTab kit={kit} kitId={kitId} token={token!} onLaunchMock={launchMockExam} />
          )}
          {activeTab === "schedule" && (
            <ScheduleTab kit={kit} kitId={kitId} token={token!} onLaunchMock={launchMockExam} />
          )}
          {activeTab === "practice" && (
            <FlashcardPracticeMode kit={kit} kitId={kitId} token={token!} onExit={() => setActiveTab("overview")} />
          )}
          {activeTab === "mock-history" && (
            <MockExamHistoryTab kitId={kitId} token={token!} onLaunchMock={launchMockExam} kit={kit} />
          )}
        </div>
      ) : null}

      {/* Question Mock Exam Modal */}
      {mockExamState.isOpen && (
        <MockQuestionPracticeView
          questions={mockExamState.questions}
          title={mockExamState.title}
          subtitle={`Interactive Mock Test • ${mockExamState.questions.length} Question Prompt${mockExamState.questions.length === 1 ? "" : "s"}`}
          kitId={kitId}
          token={token!}
          onClose={() => setMockExamState({ isOpen: false, questions: [], title: "" })}
        />
      )}
    </div>
  );
}
