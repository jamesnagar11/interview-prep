"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import { BrainCircuit, Plus, Clock, CheckCircle, AlertCircle, BookOpen } from "lucide-react";

const statCards = [
  { label: "Total Kits", value: "0", icon: BrainCircuit, color: "from-violet-500/20 to-indigo-500/20", iconColor: "text-violet-400" },
  { label: "Active Preps", value: "0", icon: Clock, color: "from-amber-500/20 to-orange-500/20", iconColor: "text-amber-400" },
  { label: "Completed", value: "0", icon: CheckCircle, color: "from-emerald-500/20 to-teal-500/20", iconColor: "text-emerald-400" },
  { label: "Flashcards", value: "0", icon: BookOpen, color: "from-pink-500/20 to-rose-500/20", iconColor: "text-pink-400" },
];

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Welcome header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white">
          {isAuthenticated ? `Welcome back, ${user?.name?.split(" ")[0]} 👋` : "Welcome to PrepKit"}
        </h2>
        <p className="text-white/40 text-sm">
          {isAuthenticated
            ? "Your personalized interview preparation hub"
            : "Sign in to start building your interview kits"}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, iconColor }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${color} border border-white/[0.06] p-4`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/50 text-xs font-medium mb-1">{label}</p>
                <p className="text-white text-2xl font-bold">{value}</p>
              </div>
              <div className={`p-2 rounded-lg bg-white/5 ${iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA section */}
      {isAuthenticated ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-violet-500/20">
            <BrainCircuit className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">Ready to start prepping?</h3>
            <p className="text-white/40 text-sm mt-1">Create your first interview preparation kit</p>
          </div>
          <Link
            href="/dashboard/interview-prep"
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-600/20"
          >
            <Plus className="w-4 h-4" />
            Create Kit
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-white/20 mx-auto" />
          <div>
            <h3 className="text-white font-semibold text-lg">Get started</h3>
            <p className="text-white/40 text-sm mt-1">Create an account to build personalized interview kits</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
            >
              Sign up free
            </Link>
            <Link
              href="/auth/signin"
              className="px-6 py-2.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
