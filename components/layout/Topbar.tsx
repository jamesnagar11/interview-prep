"use client";

import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import { Menu, BrainCircuit } from "lucide-react";
import Link from "next/link";

interface TopbarProps {
  onMenuClick: () => void;
}

const pageLabels: { pattern: string; label: string; exact?: boolean }[] = [
  { pattern: "/dashboard/interview-prep", label: "Interview Prep" },
  { pattern: "/dashboard/kits", label: "My Kits" },
  { pattern: "/dashboard/flashcards", label: "Flashcards" },
  { pattern: "/dashboard", label: "Dashboard", exact: true },
];

function getPageLabel(pathname: string) {
  for (const { pattern, label, exact } of pageLabels) {
    if (exact ? pathname === pattern : pathname === pattern || pathname.startsWith(pattern + "/")) {
      return label;
    }
  }
  return "PrepKit";
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const pageLabel = getPageLabel(pathname);

  return (
    <header className="h-16 flex items-center gap-4 px-4 sm:px-6 border-b border-white/[0.06] bg-[#0b0d15]/80 backdrop-blur-md shrink-0 sticky top-0 z-30">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-white/50 hover:text-white transition-colors p-1 -ml-1"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* App name + page breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <BrainCircuit className="w-4 h-4 text-violet-400" />
          <span className="text-white/50 text-sm font-medium hidden sm:block">PrepKit</span>
        </Link>
        <span className="text-white/25 text-sm hidden sm:block">/</span>
        <span className="text-white text-sm font-semibold truncate">{pageLabel}</span>
      </div>

      {/* Right: user pill or sign-in prompt */}
      {isAuthenticated && user ? (
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-full pl-1 pr-3 py-1 shrink-0">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-white/70 text-sm font-medium hidden sm:block max-w-[120px] truncate">
            {user.name}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/auth/signin"
            className="text-white/50 hover:text-white text-sm font-medium transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Sign up
          </Link>
        </div>
      )}
    </header>
  );
}
