"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
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
}

function CreateKitForm({ onClose }: CreateKitFormProps) {
  const [form, setForm] = useState({ jd: "", company_url: "", days: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TODO: call create-kit API
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#0f1117] border border-white/[0.08] rounded-2xl p-6 shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold text-lg">New Interview Kit</h2>
            <p className="text-white/40 text-sm">Fill in the details to generate your kit</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
              disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all text-sm disabled:opacity-50"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.jd || !form.company_url || !form.days}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
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
      ) : (
        <AuthPrompt />
      )}

      {/* Create kit modal */}
      {showForm && isAuthenticated && (
        <CreateKitForm onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
