"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import {
  createKit,
  subscribeToKit,
  STATUS_LABELS,
  AppendixAKit,
  KitStatus,
  GeneratedQuestion,
} from "@/lib/api/kits";
import {
  BrainCircuit,
  Plus,
  FileText,
  Globe,
  Calendar,
  X,
  Loader2,
  LogIn,
  UserPlus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  BookOpen,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  Target,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System Design",
  "company-fit": "Company Fit",
};

const CATEGORY_COLORS: Record<string, string> = {
  technical: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  behavioural: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  "system-design": "bg-amber-500/10 text-amber-300 border-amber-500/20",
  "company-fit": "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

function DifficultyDots({ level }: { level: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((d) => (
        <div
          key={d}
          className={`w-1.5 h-1.5 rounded-full ${
            d <= level ? "bg-violet-400" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

// ─── AuthPrompt ────────────────────────────────────────────────────────────────

function AuthPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
        <BrainCircuit className="w-8 h-8 text-white/20" />
      </div>
      <div>
        <h3 className="text-white text-lg font-semibold">Sign in to create a kit</h3>
        <p className="text-white/40 text-sm mt-1 max-w-xs">
          Create personalised interview prep kits from any job description
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/auth/signup?redirect=/dashboard/interview-prep"
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-600/20"
        >
          <UserPlus className="w-4 h-4" />
          Sign up free
        </Link>
        <Link
          href="/auth/signin?redirect=/dashboard/interview-prep"
          className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Sign in
        </Link>
      </div>
    </div>
  );
}

// ─── CreateKitForm ─────────────────────────────────────────────────────────────

interface CreateKitFormProps {
  onClose: () => void;
  onKitComplete?: (result: AppendixAKit) => void;
  onNavigate?: (kitId: string) => void;
}

function CreateKitForm({ onClose, onKitComplete, onNavigate }: CreateKitFormProps) {
  const { token } = useAuthStore();
  const [form, setForm] = useState({ jd: "", company_url: "", days: "7" });
  const [kitStatus, setKitStatus] = useState<KitStatus | "idle">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg("Authentication token missing. Please sign in again.");
      return;
    }

    try {
      setErrorMsg(null);
      setKitStatus("PENDING");

      const daysNum = parseInt(form.days, 10) || 7;
      if (daysNum > 70) {
        setErrorMsg("Maximum 70 days supported.");
        setKitStatus("idle");
        return;
      }

      const { kitId } = await createKit(form.jd, form.company_url, daysNum, token);

      // Navigate immediately to the detail page — it handles the live stream
      if (onNavigate) {
        onNavigate(kitId);
        return;
      }

      // Legacy path: subscribe inline if no onNavigate provided
      subscribeToKit(kitId, token, {
        onStatus: (status) => setKitStatus(status),
        onResult: (result) => {
          setKitStatus("READY");
          onKitComplete?.(result);
          setTimeout(() => onClose(), 1200);
        },
        onError: (msg) => {
          setKitStatus("FAILED");
          setErrorMsg(msg);
        },
      });
    } catch (err: any) {
      setKitStatus("FAILED");
      setErrorMsg(err.message || "Failed to submit request");
    }
  };

  const isWorking = kitStatus !== "idle" && kitStatus !== "FAILED" && kitStatus !== "READY";
  const statusLabel = kitStatus !== "idle" ? STATUS_LABELS[kitStatus as KitStatus] : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!isWorking ? onClose : undefined} />

      <div className="relative w-full max-w-lg bg-[#0f1117] border border-white/[0.08] rounded-2xl p-6 shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold text-lg">New Interview Kit</h2>
            <p className="text-white/40 text-sm">Fill in the details to generate your kit</p>
          </div>
          {!isWorking && (
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-white/60 text-sm font-medium" htmlFor="jd">
              <FileText className="w-4 h-4" />
              Job Description
            </label>
            <textarea
              id="jd"
              name="jd"
              rows={5}
              placeholder="Paste the full job description here…"
              value={form.jd}
              onChange={handleChange}
              required
              disabled={isWorking}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all text-sm resize-none disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-white/60 text-sm font-medium" htmlFor="company_url">
              <Globe className="w-4 h-4" />
              Company Website
            </label>
            <input
              id="company_url"
              name="company_url"
              type="url"
              placeholder="https://company.com"
              value={form.company_url}
              onChange={handleChange}
              required
              disabled={isWorking}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all text-sm disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-white/60 text-sm font-medium" htmlFor="days">
              <Calendar className="w-4 h-4" />
              Days until interview <span className="text-white/25 font-normal">(max 70)</span>
            </label>
            <input
              id="days"
              name="days"
              type="number"
              min={1}
              max={70}
              placeholder="e.g. 7"
              value={form.days}
              onChange={handleChange}
              required
              disabled={isWorking}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all text-sm disabled:opacity-50"
            />
          </div>

          {kitStatus !== "idle" && (
            <div className="py-2 px-3 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center gap-3 text-xs text-white/70">
              {kitStatus === "READY" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 font-medium">Kit generated successfully! Closing…</span>
                </>
              ) : kitStatus === "FAILED" ? null : (
                <>
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  <span>{statusLabel}</span>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isWorking}
              className="flex-1 py-3 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isWorking || !form.jd || !form.company_url || !form.days}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-600/20"
            >
              {isWorking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {statusLabel || "Working…"}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Kit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── QuestionCard ──────────────────────────────────────────────────────────────

function QuestionCard({ q }: { q: GeneratedQuestion }) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[q.category] ?? "bg-white/10 text-white/60 border-white/20";

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold border ${catColor}`}>
              {CATEGORY_LABELS[q.category] ?? q.category}
            </span>
            <DifficultyDots level={q.difficulty} />
          </div>
          <p className="text-white/90 text-sm font-medium leading-snug">{q.prompt}</p>
        </div>
        <div className="shrink-0 text-white/30 mt-1">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
          <p className="text-xs text-white/40 uppercase font-semibold mb-1.5">Answer outline</p>
          <p className="text-white/70 text-sm leading-relaxed">{q.answer_outline}</p>
        </div>
      )}
    </div>
  );
}

// ─── KitView ──────────────────────────────────────────────────────────────────

function KitView({ kit, onNew }: { kit: AppendixAKit; onNew: () => void }) {
  const [activeCategory, setActiveCategory] = useState<string>("technical");
  const [activeDay, setActiveDay] = useState<number>(1);

  const categories = [...new Set(kit.questions.map((q) => q.category))];
  const questionsForCategory = kit.questions.filter((q) => q.category === activeCategory);
  const currentDay = kit.schedule.days.find((d) => d.day === activeDay);
  const questionsForDay = currentDay
    ? currentDay.question_ids
        .map((qid) => kit.questions.find((q) => q.id === qid))
        .filter(Boolean) as GeneratedQuestion[]
    : [];

  const isBriefEmpty = !kit.company_brief.summary || kit.company_brief.summary.startsWith("No public information");
  const hasWarnings = (kit._meta?.warnings?.length ?? 0) > 0;
  const hasUncovered = kit.coverage.uncovered_requirement_ids.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Soft notices: warnings + uncovered reqs */}
      {(hasWarnings || hasUncovered) && (
        <div className="space-y-2">
          {hasWarnings && kit._meta?.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl text-amber-300/80 text-xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400/60" />
              <span>{w}</span>
            </div>
          ))}
          {hasUncovered && (
            <div className="flex items-start gap-2.5 px-4 py-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl text-amber-300/80 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400/60" />
              <span>
                {kit.coverage.uncovered_requirement_ids.length} requirement
                {kit.coverage.uncovered_requirement_ids.length > 1 ? "s" : ""} weren't fully covered by generated questions
                ({kit.coverage.uncovered_requirement_ids.join(", ")})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Kit Header */}
      <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full w-fit mb-2 border border-violet-500/20">
              <Briefcase className="w-3.5 h-3.5" />
              {kit.role.seniority} {kit.role.title}
            </div>
            <h3 className="text-2xl font-bold text-white">{kit.role.title}</h3>
            <p className="text-white/40 text-sm mt-1">{kit.source.company_url}</p>
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/10 text-white text-sm font-semibold rounded-xl transition-colors border border-white/10"
          >
            <Plus className="w-4 h-4" />
            New Kit
          </button>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-2.5 py-1 bg-white/[0.04] rounded-lg text-white/50">
            {kit.questions.length} questions
          </span>
          <span className="px-2.5 py-1 bg-white/[0.04] rounded-lg text-white/50">
            {kit.flashcards.length} flashcards
          </span>
          <span className="px-2.5 py-1 bg-white/[0.04] rounded-lg text-white/50">
            {kit.schedule.days_available}-day plan
          </span>
          <span className="px-2.5 py-1 bg-white/[0.04] rounded-lg text-white/50">
            {kit.role.requirements.length} requirements extracted
          </span>
        </div>
      </div>

      {/* Company Brief */}
      <section className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-5 space-y-2">
        <h4 className="text-white/80 font-semibold text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-400" />
          Company Brief
        </h4>
        {isBriefEmpty ? (
          <p className="text-white/35 text-sm italic flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-white/25" />
            Couldn't find public information about this company.
          </p>
        ) : (
          <div className="space-y-2 text-sm text-white/70">
            <p>{kit.company_brief.summary}</p>
            {kit.company_brief.what_they_do && (
              <p className="text-white/50">{kit.company_brief.what_they_do}</p>
            )}
          </div>
        )}
      </section>

      {/* Requirements */}
      <section className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-5 space-y-3">
        <h4 className="text-white/80 font-semibold text-sm flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          Extracted Requirements ({kit.role.requirements.length})
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {kit.role.requirements.map((req) => (
            <div key={req.id} className="p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-white/40 uppercase">{req.id}</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                      req.priority === "must"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {req.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-white/10 text-white/60">
                    {req.kind}
                  </span>
                </div>
              </div>
              <p className="text-white/80">{req.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Questions — tabbed by category */}
      <section className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <h4 className="text-white/80 font-semibold text-sm flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-violet-400" />
          Interview Questions ({kit.questions.length})
        </h4>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                activeCategory === cat
                  ? "bg-violet-600 text-white border-violet-500"
                  : "bg-white/[0.04] text-white/50 border-white/10 hover:bg-white/[0.07]"
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat} ({kit.questions.filter((q) => q.category === cat).length})
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {questionsForCategory.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
          {questionsForCategory.length === 0 && (
            <p className="text-white/30 text-sm text-center py-4">No questions in this category</p>
          )}
        </div>
      </section>

      {/* Flashcards */}
      <section className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-5 space-y-3">
        <h4 className="text-white/80 font-semibold text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-pink-400" />
          Flashcards ({kit.flashcards.length})
          <span className="text-white/30 font-normal text-xs ml-1">— flip in Practice Mode (next iteration)</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          {kit.flashcards.map((f) => (
            <div key={f.id} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-1.5">
              <p className="text-white/80 text-xs font-medium">{f.front}</p>
              <p className="text-white/40 text-xs leading-relaxed">{f.back}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Schedule — day tabs */}
      <section className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <h4 className="text-white/80 font-semibold text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          {kit.schedule.days_available}-Day Study Schedule
        </h4>

        {/* Day selector scrollable row */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {kit.schedule.days.map((d) => (
            <button
              key={d.day}
              onClick={() => setActiveDay(d.day)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                activeDay === d.day
                  ? "bg-emerald-600 text-white border-emerald-500"
                  : "bg-white/[0.04] text-white/50 border-white/10 hover:bg-white/[0.07]"
              }`}
            >
              Day {d.day}
            </button>
          ))}
        </div>

        {currentDay && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-white font-semibold text-sm">{currentDay.focus}</h5>
              <span className="flex items-center gap-1 text-xs text-white/40 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                <Clock className="w-3 h-3" />
                {currentDay.minutes} min
              </span>
            </div>
            {questionsForDay.length > 0 ? (
              <div className="space-y-2">
                {questionsForDay.map((q) => (
                  <div key={q.id} className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold border ${CATEGORY_COLORS[q.category] ?? "bg-white/10 text-white/60 border-white/20"}`}>
                        {CATEGORY_LABELS[q.category] ?? q.category}
                      </span>
                      <DifficultyDots level={q.difficulty} />
                    </div>
                    <p className="text-white/80 text-xs">{q.prompt}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-sm">Review day — revisit previous questions</p>
            )}
          </div>
        )}
      </section>

      {/* Footer metadata */}
      <div className="pt-1 pb-4 flex items-center justify-between text-xs text-white/25">
        <div>Pages crawled: {kit.source.pages_used.length} · Coverage passes: {kit.coverage.passes}</div>
        <div>Researched: {new Date(kit.source.researched_at).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

// ─── InterviewPrepPage ─────────────────────────────────────────────────────────

export default function InterviewPrepPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-2xl font-bold">Interview Prep</h2>
          <p className="text-white/40 text-sm mt-0.5">Turn any job description into a full prep kit</p>
        </div>

        {isAuthenticated && (
          <button
            onClick={() => setShowForm(true)}
            id="create-kit-btn"
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-600/20"
          >
            <Plus className="w-4 h-4" />
            Create Kit
          </button>
        )}
      </div>

      <div className="h-px bg-white/[0.05]" />

      {isAuthenticated ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/[0.08] flex items-center justify-center">
            <BrainCircuit className="w-10 h-10 text-violet-400" />
          </div>
          <div>
            <h3 className="text-white text-lg font-semibold">Create a new kit</h3>
            <p className="text-white/40 text-sm mt-1 max-w-sm">
              Click <strong className="text-white/60">Create Kit</strong> above, or{" "}
              <Link href="/dashboard/kits" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">view your existing kits</Link>
            </p>
          </div>
        </div>
      ) : (
        <AuthPrompt />
      )}

      {showForm && isAuthenticated && (
        <CreateKitForm
          onClose={() => setShowForm(false)}
          onNavigate={(kitId) => router.push(`/dashboard/kits/${kitId}`)}
        />
      )}
    </div>
  );
}
