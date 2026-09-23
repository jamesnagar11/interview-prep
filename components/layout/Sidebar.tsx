"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  LogIn,
  UserPlus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/interview-prep", label: "Interview Prep", icon: BrainCircuit, exact: false },
  { href: "/dashboard/kits", label: "My Kits", icon: ClipboardList, exact: false },
  { href: "/dashboard/flashcards", label: "Flashcards", icon: BookOpen, exact: false },
];

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0b0d15] border-r border-white/[0.06] transition-all duration-300 ease-in-out",
          collapsed ? "w-[68px]" : "w-64",
          "lg:relative lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center h-16 px-4 border-b border-white/[0.06] shrink-0",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
              <BrainCircuit className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <span className="font-bold text-white tracking-tight truncate">PrepKit</span>
            )}
          </Link>
          {/* Mobile close */}
          {!collapsed && (
            <button
              onClick={onMobileClose}
              className="lg:hidden text-white/40 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                  active
                    ? "bg-violet-500/10 text-violet-300"
                    : "text-white/50 hover:text-white hover:bg-white/[0.04]",
                  collapsed ? "justify-center" : ""
                )}
                title={collapsed ? label : undefined}
              >
                <Icon
                  className={cn(
                    "w-[18px] h-[18px] shrink-0 transition-colors",
                    active ? "text-violet-400" : "text-white/35 group-hover:text-white/60"
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{label}</span>
                    {active && (
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: auth section */}
        <div className="px-2 pb-4 pt-2 border-t border-white/[0.06] space-y-1 shrink-0">
          {isAuthenticated ? (
            <>
              {/* User info */}
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                  collapsed ? "justify-center" : ""
                )}
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {user?.name?.charAt(0).toUpperCase() ?? "U"}
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate leading-tight">{user?.name}</p>
                    <p className="text-white/35 text-xs truncate">{user?.email}</p>
                  </div>
                )}
              </div>

              <button
                onClick={logout}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/8 transition-all duration-150",
                  collapsed ? "justify-center" : ""
                )}
                title={collapsed ? "Sign out" : undefined}
              >
                <LogOut className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && "Sign out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.04] transition-all duration-150",
                  collapsed ? "justify-center" : ""
                )}
                title={collapsed ? "Sign in" : undefined}
              >
                <LogIn className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && "Sign in"}
              </Link>
              <Link
                href="/auth/signup"
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all duration-150 shadow-sm",
                  collapsed ? "justify-center" : ""
                )}
                title={collapsed ? "Sign up" : undefined}
              >
                <UserPlus className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && "Sign up free"}
              </Link>
            </>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={onToggle}
          className="hidden lg:flex absolute -right-3 top-[4.5rem] w-6 h-6 rounded-full bg-[#161926] border border-white/10 items-center justify-center text-white/40 hover:text-white hover:border-white/25 transition-all shadow-md z-10"
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </aside>
    </>
  );
}
