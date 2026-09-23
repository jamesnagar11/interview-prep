"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import { BrainCircuit, ArrowRight, Sparkles, BookOpen, Calendar, BarChart3, CheckCircle, Zap } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-Generated Kits",
    description: "Paste a job description and company URL. We research the company and build your full prep kit automatically.",
  },
  {
    icon: BookOpen,
    title: "Question Bank & Flashcards",
    description: "Categorised interview questions with answer outlines, plus smart flashcards to drill key concepts.",
  },
  {
    icon: Calendar,
    title: "Day-by-Day Schedule",
    description: "Tell us how many days you have. We'll build you a structured study plan that fits your timeline.",
  },
  {
    icon: BarChart3,
    title: "Track Your Progress",
    description: "Practice flashcards, mark confidence levels, and see exactly what you've covered and what needs work.",
  },
];

const steps = [
  { num: "01", title: "Paste the Job Description", desc: "Drop in any JD plus the company website URL." },
  { num: "02", title: "We Do the Research", desc: "AI crawls the company site, finds interview intel, and combines everything." },
  { num: "03", title: "Get Your Kit", desc: "Company brief, question bank, flashcards and a study schedule — ready in minutes." },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#06080f] text-white overflow-x-hidden">
      {/* ─── Ambient background ─── */}
      <div className="fixed inset-0 pointer-events-none select-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-violet-600/[0.07] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.05] rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-pink-500/[0.04] rounded-full blur-[100px]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ─── Navbar ─── */}
      <nav className="relative z-10 flex items-center justify-between max-w-6xl mx-auto px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">PrepKit</span>
        </Link>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-violet-600/20"
            >
              Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="px-4 py-2 text-white/60 hover:text-white font-medium text-sm transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-violet-600/20"
              >
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-32 max-w-5xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold mb-8 backdrop-blur-sm">
          <Zap className="w-3 h-3" />
          AI-Powered Interview Preparation
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6">
          <span className="text-white">Land your </span>
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            dream job
          </span>
          <br />
          <span className="text-white">with a kit built for </span>
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">you</span>
          </span>
        </h1>

        {/* Sub */}
        <p className="text-white/50 text-lg sm:text-xl max-w-2xl leading-relaxed mb-10">
          Paste a job description and the company URL. PrepKit researches the company, generates a
          question bank, flashcards, and a day-by-day study schedule — all tailored to your role.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link
            href={isAuthenticated ? "/dashboard" : "/auth/signup"}
            className="group flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-base transition-all shadow-2xl shadow-violet-600/30 hover:shadow-violet-500/40 hover:-translate-y-0.5"
          >
            <Sparkles className="w-4 h-4" />
            {isAuthenticated ? "Go to Dashboard" : "Build my prep kit — free"}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-6 py-4 border border-white/[0.12] text-white/70 hover:text-white hover:border-white/25 font-semibold rounded-2xl text-base transition-all backdrop-blur-sm"
          >
            See the dashboard
          </Link>
        </div>

        {/* Social proof row */}
        <div className="flex items-center gap-6 text-white/30 text-sm">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500/70" />
            Free to start
          </div>
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500/70" />
            No credit card
          </div>
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500/70" />
            Ready in minutes
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Three steps to interview-ready</h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {steps.map(({ num, title, desc }) => (
            <div
              key={num}
              className="relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-violet-500/20 hover:bg-white/[0.04] transition-all group"
            >
              <div className="text-5xl font-black text-white/[0.04] group-hover:text-violet-500/10 transition-colors mb-4 select-none">
                {num}
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Everything you need to prepare</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex gap-4 p-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl hover:border-violet-500/20 hover:bg-white/[0.04] transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 group-hover:bg-violet-500/15 transition-colors">
                <Icon className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-24">
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-violet-900/30 via-indigo-900/20 to-transparent p-12 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 pointer-events-none" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-500/30">
              <BrainCircuit className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to ace your next interview?
            </h2>
            <p className="text-white/50 text-lg mb-8 max-w-xl mx-auto">
              Join hundreds of candidates who use PrepKit to walk into interviews with confidence.
            </p>
            <Link
              href={isAuthenticated ? "/dashboard" : "/auth/signup"}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-base transition-all shadow-2xl shadow-violet-600/30 hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4" />
              {isAuthenticated ? "Go to Dashboard" : "Get started — it's free"}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-white/[0.05] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-white/25 text-sm">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4" />
            <span className="font-semibold">PrepKit</span>
          </div>
          <p>AI-powered interview preparation. Built for candidates who want to be ready.</p>
        </div>
      </footer>
    </div>
  );
}
