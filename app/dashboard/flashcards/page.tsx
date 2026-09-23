"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import { BookOpen, LogIn, UserPlus } from "lucide-react";

export default function FlashcardsPage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold">Flashcards</h2>
        <p className="text-white/40 text-sm mt-0.5">Practice with AI-generated flashcards</p>
      </div>

      <div className="h-px bg-white/[0.05]" />

      {isAuthenticated ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
          <BookOpen className="w-12 h-12 text-white/10" />
          <div>
            <h3 className="text-white font-semibold">No flashcards yet</h3>
            <p className="text-white/40 text-sm mt-1">Flashcards are generated when you create a kit</p>
          </div>
          <Link
            href="/dashboard/interview-prep"
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
          >
            Create a Kit
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
          <BookOpen className="w-12 h-12 text-white/10" />
          <div>
            <h3 className="text-white font-semibold">Sign in to access flashcards</h3>
            <p className="text-white/40 text-sm mt-1">Practice flashcards from your interview kits</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signup?redirect=/dashboard/flashcards"
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Sign up
            </Link>
            <Link
              href="/auth/signin?redirect=/dashboard/flashcards"
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
