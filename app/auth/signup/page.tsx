"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import { signupApi } from "@/lib/api/auth";
import { BrainCircuit, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const { setToken } = useAuthStore();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await signupApi(form);
      if (res.success && res.token) {
        setToken(res.token);
        router.push(redirectTo);
      } else {
        setError(res.msg || "Signup failed. Please try again.");
      }
    } catch (error) {
      console.error(error);
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const signinHref = `/auth/signin${redirectTo !== "/dashboard" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`;

  return (
    <div className="min-h-screen bg-[#06080f] flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-violet-600/[0.07] rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back to home */}
        <Link
          href="/"
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors group"
        >
          <BrainCircuit className="w-4 h-4 text-violet-400" />
          <span className="font-semibold text-violet-400">PrepKit</span>
        </Link>

        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm shadow-2xl shadow-black/50">
          <div className="mb-8">
            <h1 className="text-white text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-white/40 text-sm mt-1.5">Start acing your interviews — free forever</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-white/60 text-sm font-medium block" htmlFor="signup-name">
                Full name
              </label>
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                value={form.name}
                onChange={handleChange}
                disabled={loading}
                className="w-full bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.15] focus:border-violet-500/60 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all text-sm disabled:opacity-50"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-white/60 text-sm font-medium block" htmlFor="signup-email">
                Email
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={handleChange}
                disabled={loading}
                className="w-full bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.15] focus:border-violet-500/60 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all text-sm disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-white/60 text-sm font-medium block" htmlFor="signup-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.15] focus:border-violet-500/60 rounded-xl px-4 py-3 pr-11 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all text-sm disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all mt-2 shadow-lg shadow-violet-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-white/30 text-sm text-center mt-6">
            Already have an account?{" "}
            <Link href={signinHref} className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
