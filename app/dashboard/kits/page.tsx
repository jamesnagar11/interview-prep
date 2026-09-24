"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import { listKits, createKit, subscribeToKit, STATUS_LABELS } from "@/lib/api/kits";
import type { KitSummary, AppendixAKit, KitStatus } from "@/lib/api/kits";
import {
  BrainCircuit,
  Plus,
  ClipboardList,
  LogIn,
  UserPlus,
  Briefcase,
  Calendar,
  Hash,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileText,
  Globe,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: KitStatus }) {
  const colors: Record<KitStatus, string> = {
    READY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    FAILED: "bg-rose-500/15 text-rose-300 border-rose-500/25",
    PENDING: "bg-white/10 text-white/50 border-white/10",
    RUNNING: "bg-violet-500/15 text-violet-300 border-violet-500/25",
    DRAFT: "bg-white/10 text-white/50 border-white/10",
    RESEARCHING: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    EXTRACTING: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
    GENERATING: "bg-violet-500/15 text-violet-300 border-violet-500/25",
    CHECKING_COVERAGE: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    SCHEDULING: "bg-teal-500/15 text-teal-300 border-teal-500/25",
  };
  const isLive = !["READY", "FAILED"].includes(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${colors[status]}`}
    >
      {isLive && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {status === "READY" ? "Ready" : status === "FAILED" ? "Failed" : "In progress"}
    </span>
  );
}

// ─── Kit Card ─────────────────────────────────────────────────────────────────

function KitCard({ kit }: { kit: KitSummary }) {
  const router = useRouter();
  const displayName =
    kit.companyName ||
    (() => {
      try {
        const h = new URL(kit.companyUrl).hostname.replace(/^www\./, "").split(".")[0] ?? kit.companyUrl;
        return h.charAt(0).toUpperCase() + h.slice(1);
      } catch {
        return kit.companyUrl;
      }
    })();

  return (
    <button
      onClick={() => router.push(`/dashboard/kits/${kit.id}`)}
      className="group w-full text-left bg-[#0f1117] border border-white/[0.07] hover:border-violet-500/30 rounded-2xl p-5 transition-all duration-200 hover:shadow-xl hover:shadow-violet-900/10 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <StatusBadge status={kit.status} />
          </div>
          <h3 className="text-white font-semibold text-sm truncate">
            {kit.roleTitle || "Untitled Role"}
          </h3>
          <p className="text-white/40 text-xs mt-0.5 truncate">{displayName}</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center shrink-0 ml-3 group-hover:border-violet-500/40 transition-colors">
          <Briefcase className="w-4 h-4 text-violet-400" />
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-white/35">
        <span className="flex items-center gap-1">
          <Hash className="w-3 h-3" />
          {kit.questionCount} Qs
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {kit.daysAvailable}d
        </span>
        <span className="ml-auto">
          {new Date(kit.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </button>
  );
}

// ─── CreateKitModal ───────────────────────────────────────────────────────────

function CreateKitModal({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (kitId: string) => void;
}) {
  const { token } = useAuthStore();
  const [form, setForm] = useState({ jd: "", company_url: "", days: "7" });
  const [kitStatus, setKitStatus] = useState<KitStatus | "idle">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setErrorMsg(null);
      setKitStatus("PENDING");
      const daysNum = Math.min(parseInt(form.days, 10) || 7, 70);
      const { kitId } = await createKit(form.jd, form.company_url, daysNum, token);
      onNavigate(kitId); // navigate immediately — the detail page handles the live stream
    } catch (err: any) {
      setKitStatus("FAILED");
      setErrorMsg(err.message || "Failed to submit");
    }
  };

  const isWorking = kitStatus !== "idle" && kitStatus !== "FAILED";

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
            <label className="flex items-center gap-2 text-white/60 text-sm font-medium" htmlFor="kf-jd">
              <FileText className="w-4 h-4" />Job Description
            </label>
            <textarea
              id="kf-jd" name="jd" rows={5}
              placeholder="Paste the full job description here…"
              value={form.jd} onChange={handleChange} required disabled={isWorking}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm resize-none disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-white/60 text-sm font-medium" htmlFor="kf-url">
              <Globe className="w-4 h-4" />Company Website
            </label>
            <input
              id="kf-url" name="company_url" type="url"
              placeholder="https://company.com"
              value={form.company_url} onChange={handleChange} required disabled={isWorking}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-white/60 text-sm font-medium" htmlFor="kf-days">
              <Calendar className="w-4 h-4" />Days until interview <span className="text-white/25 font-normal">(max 70)</span>
            </label>
            <input
              id="kf-days" name="days" type="number" min={1} max={70}
              placeholder="e.g. 7"
              value={form.days} onChange={handleChange} required disabled={isWorking}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm disabled:opacity-50"
            />
          </div>

          {kitStatus !== "idle" && kitStatus !== "FAILED" && (
            <div className="py-2 px-3 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center gap-3 text-xs text-white/70">
              <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
              <span>Creating kit…</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={isWorking}
              className="flex-1 py-3 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isWorking || !form.jd || !form.company_url || !form.days}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-600/20">
              {isWorking ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : <><Sparkles className="w-4 h-4" />Generate Kit</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── KitsPage ─────────────────────────────────────────────────────────────────

export default function KitsPage() {
  const { isAuthenticated, token } = useAuthStore();
  const router = useRouter();
  const [kits, setKits] = useState<KitSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listKits(token);
      setKits(list);
    } catch (e: any) {
      setError(e.message || "Failed to load kits");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && token) load();
    else setLoading(false);
  }, [isAuthenticated, token]);

  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
          <ClipboardList className="w-12 h-12 text-white/10" />
          <div>
            <h3 className="text-white font-semibold">Sign in to see your kits</h3>
            <p className="text-white/40 text-sm mt-1">Your interview prep kits will appear here</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/signup?redirect=/dashboard/kits"
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors">
              <UserPlus className="w-4 h-4" />Sign up
            </Link>
            <Link href="/auth/signin?redirect=/dashboard/kits"
              className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-colors">
              <LogIn className="w-4 h-4" />Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-2xl font-bold">My Kits</h2>
          <p className="text-white/40 text-sm mt-0.5">All your interview preparation kits</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} title="Refresh"
            className="p-2.5 text-white/30 hover:text-white/70 hover:bg-white/[0.05] rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCreate(true)} id="create-kit-btn"
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-600/20">
            <Plus className="w-4 h-4" />Create Kit
          </button>
        </div>
      </div>

      <div className="h-px bg-white/[0.05]" />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400" />
          <p className="text-white/60">{error}</p>
          <button onClick={load}
            className="px-4 py-2 bg-white/[0.05] hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors border border-white/10">
            Try again
          </button>
        </div>
      ) : !kits || kits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-5 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/[0.08] flex items-center justify-center">
            <BrainCircuit className="w-10 h-10 text-violet-400" />
          </div>
          <div>
            <h3 className="text-white text-lg font-semibold">No kits yet</h3>
            <p className="text-white/40 text-sm mt-1 max-w-sm">
              Click <strong className="text-white/60">Create Kit</strong> to generate your first personalised interview prep kit
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-600/20">
            <Plus className="w-4 h-4" />Create your first kit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kits.map((kit) => (
            <KitCard key={kit.id} kit={kit} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateKitModal
          onClose={() => setShowCreate(false)}
          onNavigate={(kitId) => router.push(`/dashboard/kits/${kitId}`)}
        />
      )}
    </div>
  );
}
