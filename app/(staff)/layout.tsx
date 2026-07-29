"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, List, Scissors, Star, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useAuth, isStaffUser, isAdminUser } from "@/lib/auth";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const ta = t.admin;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated || !isStaffUser(user)) {
      router.replace("/login");
    }
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || !isStaffUser(user)) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-white/40 text-sm tracking-widest">{ta.loading}</p>
      </div>
    );
  }

  const isAdmin = isAdminUser(user);

  const navItems = [
    { href: "/calendar",  icon: CalendarDays, label: ta.nav.calendar },
    { href: "/bookings",  icon: List,         label: ta.nav.bookings },
    ...(isAdmin ? [
      { href: "/barbers", icon: Scissors, label: ta.nav.barbers },
      { href: "/services", icon: Star,    label: ta.nav.services },
    ] : []),
  ];

  function handleSignOut() {
    logout();
    router.push("/login");
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-white/10">
        <p className="font-display text-xl text-white tracking-widest">
          {isAdmin ? "ADMIN" : "BARBER"}
        </p>
        <p className="text-white/30 text-xs mt-0.5 truncate">{user?.full_name}</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white hover:bg-white/10",
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t.nav.signOut}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-zinc-50 -mt-16">
      {/* Desktop sidebar — sits below the fixed navbar */}
      <aside className="hidden md:flex flex-col w-60 bg-zinc-950 fixed top-16 bottom-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile drawer — overlays the navbar, so it needs a higher z-index */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[70] w-60 bg-zinc-950 flex flex-col md:hidden transition-transform duration-200",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-60 pt-16 flex flex-col">
        <div className="md:hidden flex items-center justify-between px-4 h-14 bg-zinc-950 sticky top-16 z-20">
          <button onClick={() => setSidebarOpen(true)} className="text-white/60 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <p className="font-display text-white tracking-widest text-sm">
            {isAdmin ? "ADMIN" : "BARBER"}
          </p>
          <div className="w-5" />
        </div>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
