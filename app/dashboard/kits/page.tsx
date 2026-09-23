"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import { ClipboardList, LogIn, UserPlus } from "lucide-react";

export default function KitsPage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold">My Kits</h2>
        <p className="text-white/40 text-sm mt-0.5">All your interview preparation kits</p>
      </div>

      <div className="h-px bg-white/[0.05]" />

      {isAuthenticated ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
          <ClipboardList className="w-12 h-12 text-white/10" />
          <div>
            <h3 className="text-white font-semibold">No kits yet</h3>
            <p className="text-white/40 text-sm mt-1">Head to Interview Prep to create your first kit</p>
          </div>
          <Link
            href="/dashboard/interview-prep"
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
          >
            Create Kit
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
          <ClipboardList className="w-12 h-12 text-white/10" />
          <div>
            <h3 className="text-white font-semibold">Sign in to see your kits</h3>
            <p className="text-white/40 text-sm mt-1">Your interview prep kits will appear here</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signup?redirect=/dashboard/kits"
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Sign up
            </Link>
            <Link
              href="/auth/signin?redirect=/dashboard/kits"
              className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign in
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
