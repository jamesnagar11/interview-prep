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
} from "@/lib/api/kits";
import {
  BrainCircuit, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Plus, Trash2, Pin, PinOff, Pencil, Check, X,
  BookOpen, Calendar, Clock, Target, Layers, Info, AlertTriangle,
  RefreshCw, Sparkles, Save, Undo2, Briefcase,
  ArrowLeft, PlayCircle, CheckCircle2, Bookmark, Pause, Play,
  Flame, RotateCcw, HelpCircle, Eye, EyeOff, Sparkle, SlidersHorizontal,
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
  onClose,
}: {
  questions: GeneratedQuestion[];
  title: string;
  subtitle?: string;
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

  const toggleFlag = (qid: string) => {
    setFlagged((prev) => ({ ...prev, [qid]: !prev[qid] }));
  };

  const setRating = (qid: string, val: number) => {
    setRatings((prev) => ({ ...prev, [qid]: val }));
  };

  const setNote = (qid: string, note: string) => {
    setUserNotes((prev) => ({ ...prev, [qid]: note }));
  };

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
              <BrainCircuit className="w-5 h-5 text-violet-400" />
              {title}
            </h3>
            {subtitle && <p className="text-white/40 text-xs">{subtitle}</p>}
          </div>
        </div>

        {/* Stopwatch & Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-xl font-mono text-sm text-violet-300 shadow-sm">
            <Clock className="w-4 h-4 text-violet-400" />
            <span>{formatTime(secondsElapsed)}</span>
            <button onClick={() => setIsTimerRunning((r) => !r)} className="ml-1 text-violet-400 hover:text-violet-200">
              {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button onClick={() => setShowFinishedSummary(true)}
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
          <div className="flex items-center justify-between">
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
              {flagged[currentQ.id] ? "Flagged for Review" : "Flag Question"}
            </button>
          </div>

          {/* Question Text Card */}
          <div className="bg-[#0f111d] border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-xl font-semibold text-white leading-relaxed">{currentQ.prompt}</h2>
          </div>

          {/* Answer Outline Toggle & Self-Evaluation */}
          <div className="space-y-4">
            <button onClick={() => setShowAnswer((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl text-violet-300 font-semibold text-xs transition-all">
              {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showAnswer ? "Hide Key Answer Points" : "Reveal Answer Outline & Concepts"}
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

          {/* Response Scratchpad / Personal Notes */}
          <div className="space-y-1.5">
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5 text-violet-400" />Your Thoughts / Response Draft (Optional)
            </label>
            <textarea
              rows={3}
              value={userNotes[currentQ.id] || ""}
              onChange={(e) => setNote(currentQ.id, e.target.value)}
              placeholder="Type your bullet points, code snippets, or key arguments here to test your timing..."
              className="w-full bg-[#0d0f18] border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none"
            />
          </div>

          {/* Self-Rating Selection */}
          <div className="bg-[#0d0f18] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">How confident are you with this question?</p>
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

        {/* Question Navigation Palette Drawer */}
        <aside className="w-72 bg-[#0d0f18] border-l border-white/[0.08] p-5 flex flex-col shrink-0 overflow-y-auto space-y-5">
          <div>
            <h4 className="text-white font-bold text-sm mb-1">Question Palette</h4>
            <p className="text-white/40 text-xs">Jump to any question in this test set.</p>
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
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-violet-600" /> Current Question</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40" /> Self-Evaluated</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40" /> Flagged for Review</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white/[0.04] border border-white/10" /> Unanswered</div>
          </div>
        </aside>
      </div>

      {/* Footer Navigation Bar */}
      <footer className="px-6 py-4 bg-[#0d0f18] border-t border-white/[0.08] flex items-center justify-between shrink-0">
        <button
          onClick={() => {
            if (currentIndex > 0) {
              setCurrentIndex((i) => i - 1);
              setShowAnswer(false);
            }
          }}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-30 border border-white/10"
        >
          <ChevronLeft className="w-4 h-4" />Previous
        </button>

        <div className="text-white/40 text-xs font-mono">
          Evaluated {Object.keys(ratings).length} / {questions.length} questions
        </div>

        <button
          onClick={() => {
            if (currentIndex < questions.length - 1) {
              setCurrentIndex((i) => i + 1);
              setShowAnswer(false);
            } else {
              setShowFinishedSummary(true);
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
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-[#0f111d] border border-white/15 rounded-3xl p-6 max-w-md w-full space-y-5 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Practice Exam Complete!</h3>
              <p className="text-white/40 text-xs mt-1">Great job stepping through these interview prompts.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 bg-white/[0.02] border border-white/[0.06] p-3 rounded-2xl text-center">
              <div>
                <span className="text-white/40 text-[10px] block uppercase font-mono">Time Spent</span>
                <span className="text-white font-bold text-sm">{formatTime(secondsElapsed)}</span>
              </div>
              <div>
                <span className="text-white/40 text-[10px] block uppercase font-mono">Questions</span>
                <span className="text-white font-bold text-sm">{questions.length}</span>
              </div>
              <div>
                <span className="text-white/40 text-[10px] block uppercase font-mono">Evaluated</span>
                <span className="text-white font-bold text-sm">{Object.keys(ratings).length}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowFinishedSummary(false)} className="flex-1 py-2.5 bg-white/[0.05] hover:bg-white/10 text-white text-xs font-semibold rounded-xl border border-white/10">
                Review Answers
              </button>
              <button onClick={onClose} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20">
                Done & Return
              </button>
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

  const handleStartSession = async () => {
    setSessionStarting(true);
    try {
      const { sessionId: sid } = await startPracticeSession(kitId, token);
      const q = kit.flashcards.map((f) => f.id);
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

  // Landing Screen
  if (screen === "landing") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-pink-400" />Flashcard Practice Studio
          </h3>
          <button onClick={onExit} className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to Overview
          </button>
        </div>

        <button onClick={handleStartSession} disabled={sessionStarting}
          className="w-full flex items-center justify-center gap-3 p-5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-pink-950/30 disabled:opacity-50 text-base">
          {sessionStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
          Start Interactive Flashcard Practice
        </button>

        {sessionsLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-pink-400 animate-spin" /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-white/30 text-sm py-8 bg-white/[0.01] border border-white/[0.04] rounded-2xl">
            No completed flashcard sessions yet — launch your first session above!
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

  // Session Detail
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
            <h4 className="text-white font-bold">Session Detail ({new Date(detailSession.startedAt).toLocaleDateString()})</h4>
            {detailSession.attempts.map((a) => (
              <div key={a.id} className="p-4 bg-[#0f111a] border border-white/[0.07] rounded-xl space-y-1">
                <p className="text-white text-sm font-semibold">{a.front}</p>
                <p className="text-white/60 text-xs">{a.back}</p>
                <p className="text-xs text-pink-300 font-mono mt-1">
                  {a.skipped ? "Skipped" : `Confidence Rating: ${a.confidence}/10`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Summary Screen
  if (screen === "summary") {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-white text-xl font-bold">Deck Completed!</h3>
          <p className="text-white/40 text-sm mt-1">{attemptedCount} flashcards reviewed in this deck session.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={handleEndSession} disabled={sessionEnding}
            className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50">
            {sessionEnding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Session History
          </button>
          <button onClick={onExit} className="py-3 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/70 font-semibold rounded-xl transition-colors">
            Exit
          </button>
        </div>
      </div>
    );
  }

  // Card Flip Loop
  const progress = ((cardIndex + 1) / queue.length) * 100;

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between text-xs text-white/40 font-mono">
        <span>Card {cardIndex + 1} of {queue.length}</span>
        <button onClick={() => { if (window.confirm("Exit session?")) onExit(); }} className="flex items-center gap-1 hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />Exit Session
        </button>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full bg-pink-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(236,72,153,0.6)]" style={{ width: `${progress}%` }} />
      </div>

      {currentCard ? (
        <div className="flex flex-col items-center gap-6">
          <div className="w-full" style={{ perspective: "1000px" }}>
            <button
              onClick={() => setFlipped((v) => !v)}
              onKeyDown={(e) => ["Enter", " "].includes(e.key) && setFlipped((v) => !v)}
              className="w-full relative"
              style={{ height: 260, transformStyle: "preserve-3d", transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
            >
              {/* Front */}
              <div className="absolute inset-0 rounded-3xl bg-[#0f111a] border border-white/15 flex flex-col items-center justify-center p-8 text-center shadow-2xl"
                style={{ backfaceVisibility: "hidden" }}>
                <span className="text-[10px] text-violet-400 uppercase font-bold tracking-widest mb-4">Question / Term</span>
                <p className="text-white text-xl font-bold leading-snug">{currentCard.front}</p>
                {!flipped && <p className="text-white/30 text-xs mt-6">Click or press Space to reveal answer</p>}
              </div>

              {/* Back */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-pink-950/40 to-purple-950/40 border border-pink-500/30 flex flex-col items-center justify-center p-8 text-center shadow-2xl"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <span className="text-[10px] text-pink-300 uppercase font-bold tracking-widest mb-4">Answer Explanation</span>
                <p className="text-white/90 text-base leading-relaxed">{currentCard.back}</p>
              </div>
            </button>
          </div>

          {flipped ? (
            <div className="w-full space-y-3 animate-in fade-in duration-200">
              <p className="text-white/40 text-xs text-center font-semibold uppercase tracking-wider">How well did you know this?</p>
              <div className="grid grid-cols-5 gap-2">
                {CONFIDENCE_RATING_OPTIONS.map(({ label, value }) => (
                  <button key={value} onClick={() => handleAttempt(value, false)}
                    className="flex flex-col items-center gap-1 py-3 bg-white/[0.04] hover:bg-pink-500/20 hover:border-pink-500/40 border border-white/[0.08] rounded-xl text-xs text-white/70 hover:text-white transition-all">
                    <span className="font-bold text-base leading-none">{value}</span>
                    <span className="text-[9px] text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button onClick={() => setFlipped(true)}
              className="px-8 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-pink-600/30">
              Reveal Answer
            </button>
          )}
        </div>
      ) : (
        <p className="text-white/30 text-center py-10">No more cards in queue.</p>
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
  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "practice">("overview");
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
          <div className="flex gap-1.5 bg-[#0d0f18] border border-white/[0.08] p-1.5 rounded-2xl w-fit shadow-lg">
            {(["overview", "schedule", "practice"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                  activeTab === tab ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30" : "text-white/40 hover:text-white"
                }`}>
                {tab === "overview" && "Overview & Builder"}
                {tab === "schedule" && "Study Schedule"}
                {tab === "practice" && "Flashcard Studio"}
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
        </div>
      ) : null}

      {/* Question Mock Exam Modal */}
      {mockExamState.isOpen && (
        <MockQuestionPracticeView
          questions={mockExamState.questions}
          title={mockExamState.title}
          subtitle={`Interactive Mock Test • ${mockExamState.questions.length} Question Prompt${mockExamState.questions.length === 1 ? "" : "s"}`}
          onClose={() => setMockExamState({ isOpen: false, questions: [], title: "" })}
        />
      )}
    </div>
  );
}
