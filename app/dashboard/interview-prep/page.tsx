"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import { createKit, subscribeToKit, MergedResult } from "@/lib/api/kits";
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
} from "lucide-react";

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

interface CreateKitFormProps {
  onClose: () => void;
  onKitComplete: (result: MergedResult) => void;
}

function CreateKitForm({ onClose, onKitComplete }: CreateKitFormProps) {
  const { token } = useAuthStore();
  const [form, setForm] = useState({ jd: "", company_url: "", days: "7" });
  const [statusState, setStatusState] = useState<"idle" | "PENDING" | "RUNNING" | "READY" | "FAILED">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg("Authentication token missing. Please sign in again.");
      return;
    }

    try {
      setErrorMsg(null);
      setStatusState("PENDING");

      const daysNum = parseInt(form.days, 10) || 7;
      const { kitId } = await createKit(form.jd, form.company_url, daysNum, token);

      // Subscribe live SSE stream
      subscribeToKit(kitId, token, {
        onStatus: (status) => {
          setStatusState(status);
        },
        onResult: (result) => {
          setStatusState("READY");
          onKitComplete(result);
          setTimeout(() => onClose(), 1200);
        },
        onError: (msg) => {
          setStatusState("FAILED");
          setErrorMsg(msg);
        },
      });
    } catch (err: any) {
      setStatusState("FAILED");
      setErrorMsg(err.message || "Failed to submit request");
    }
  };

  const isWorking = statusState === "PENDING" || statusState === "RUNNING";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!isWorking ? onClose : undefined} />

      <div className="relative w-full max-w-lg bg-[#0f1117] border border-white/[0.08] rounded-2xl p-6 shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold text-lg">New Interview Kit</h2>
            <p className="text-white/40 text-sm">Fill in the details to generate your kit</p>
          </div>
          {!isWorking && (
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors p-1"
            >
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
          {/* JD */}
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

          {/* Company URL */}
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

          {/* Days */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-white/60 text-sm font-medium" htmlFor="days">
              <Calendar className="w-4 h-4" />
              Days until interview
            </label>
            <input
              id="days"
              name="days"
              type="number"
              min={1}
              max={60}
              placeholder="e.g. 7"
              value={form.days}
              onChange={handleChange}
              required
              disabled={isWorking}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all text-sm disabled:opacity-50"
            />
          </div>

          {/* Status Indicator */}
          {statusState !== "idle" && (
            <div className="py-2 px-3 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center gap-3 text-xs text-white/70">
              {statusState === "PENDING" && (
                <>
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Request acknowledged (PENDING). Preparing background graph pipeline…</span>
                </>
              )}
              {statusState === "RUNNING" && (
                <>
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  <span>Pipeline RUNNING: Crawling company & extracting requirements in parallel…</span>
                </>
              )}
              {statusState === "READY" && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 font-medium">Kit generated successfully! Closing dialog…</span>
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
                  {statusState === "PENDING" ? "Initializing…" : "Analyzing & Building…"}
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

export default function InterviewPrepPage() {
  const { isAuthenticated } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [latestKit, setLatestKit] = useState<MergedResult | null>(null);

  console.log(`Kit: ${JSON.stringify(latestKit)}`);


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

      {/* Divider */}
      <div className="h-px bg-white/[0.05]" />

      {/* Content */}
      {isAuthenticated ? (
        latestKit ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Kit Overview Card */}
            <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full w-fit mb-2 border border-violet-500/20">
                    <Briefcase className="w-3.5 h-3.5" />
                    {latestKit.role.seniority} {latestKit.role.title}
                  </div>
                  <h3 className="text-2xl font-bold text-white">{latestKit.role.title}</h3>
                  <p className="text-white/40 text-sm mt-1">{latestKit.source.company_url}</p>
                </div>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/10 text-white text-sm font-semibold rounded-xl transition-colors border border-white/10"
                >
                  <Plus className="w-4 h-4" />
                  New Kit
                </button>
              </div>

              {/* Grid: Responsibilities & Requirements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Responsibilities */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3">
                  <h4 className="text-white/80 font-semibold text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-400" />
                    Key Responsibilities
                  </h4>
                  <ul className="space-y-2 text-sm text-white/70">
                    {latestKit.role.responsibilities.map((resp, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-violet-400 mt-1">•</span>
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Requirements */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3">
                  <h4 className="text-white/80 font-semibold text-sm flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-indigo-400" />
                    Extracted Requirements ({latestKit.role.requirements.length})
                  </h4>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {latestKit.role.requirements.map((req) => (
                      <div
                        key={req.id}
                        className="p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs space-y-1"
                      >
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
                </div>
              </div>

              {/* Research summary footer */}
              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/40">
                <div>Pages crawled: {latestKit.research.pagesUsed.length}</div>
                <div>Researched at: {new Date(latestKit.source.researched_at).toLocaleTimeString()}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/[0.08] flex items-center justify-center">
              <BrainCircuit className="w-10 h-10 text-violet-400" />
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold">No kits yet</h3>
              <p className="text-white/40 text-sm mt-1 max-w-sm">
                Click <strong className="text-white/60">Create Kit</strong> to generate your first personalised interview preparation kit
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-600/20"
            >
              <Plus className="w-4 h-4" />
              Create your first kit
            </button>
          </div>
        )
      ) : (
        <AuthPrompt />
      )}

      {/* Create kit modal */}
      {showForm && isAuthenticated && (
        <CreateKitForm
          onClose={() => setShowForm(false)}
          onKitComplete={(res) => setLatestKit(res)}
        />
      )}
    </div>
  );
}
