"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage, type Language } from "@/lib/i18n";
import { useAuth, isStaffUser } from "@/lib/auth";
import { AuthModal } from "@/components/auth-modal";

const navHrefs = [
  { href: "/book", key: "bookNow" as const },
  { href: "/academy", key: "academy" as const },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const isStaff = isStaffUser(user);
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const staffRoutes = ["/calendar", "/bookings", "/barbers", "/services"];
  const onStaffPage = staffRoutes.some((r) => pathname.startsWith(r));

  function handleSignOut() {
    logout();
    setDropdownOpen(false);
    router.push(onStaffPage ? "/login" : "/");
  }

  const initials = user?.full_name?.trim()[0]?.toUpperCase() ?? "?";

  // On the login page — show only logo + language toggle
  if (pathname === "/login") {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center shrink-0">
            <Image src="/logo-nav.png" alt="The Barber House" width={140} height={60} className="h-9 w-auto object-contain" priority />
          </Link>
          <div className="flex items-center border border-white/20 rounded-md overflow-hidden">
            {(["ru", "en"] as Language[]).map((lang) => (
              <button key={lang} onClick={() => setLanguage(lang)}
                className={cn("px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors",
                  language === lang ? "bg-white text-black" : "text-white/50 hover:text-white hover:bg-white/10")}>
                {lang}
              </button>
            ))}
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" onClick={close} className="flex items-center shrink-0">
            <Image src="/logo-nav.png" alt="The Barber House" width={140} height={60} className="h-9 w-auto object-contain" priority />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {/* Hide Book Now / Academy for staff */}
            {!isStaff && navHrefs.map(({ href, key }) => (
              <Link key={href} href={href}
                className={cn("px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === href ? "bg-white text-black" : "text-white/70 hover:text-white hover:bg-white/10")}>
                {t.nav[key]}
              </Link>
            ))}

            {/* Auth area */}
            {isAuthenticated ? (
              isStaff ? (
                // Staff: just a Sign Out button, no profile dropdown
                <button onClick={handleSignOut}
                  className="ml-2 px-4 py-2 rounded-md text-sm font-medium border border-white/30 text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  {t.nav.signOut}
                </button>
              ) : (
                // Client: avatar + dropdown with My Profile / Sign Out
                <div className="relative ml-2" ref={dropdownRef}>
                  <button onClick={() => setDropdownOpen((v) => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                    <span className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold">{initials}</span>
                    <span className="text-sm font-medium max-w-[100px] truncate">{user?.full_name?.split(" ")[0]}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-white/50" />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-zinc-100 overflow-hidden">
                      <Link href="/profile" onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-3 text-sm text-zinc-800 hover:bg-zinc-50 transition-colors">
                        {t.nav.myProfile}
                      </Link>
                      <button onClick={handleSignOut}
                        className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-zinc-100">
                        {t.nav.signOut}
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <button onClick={() => setShowAuth(true)}
                className="ml-2 px-4 py-2 rounded-md text-sm font-medium border border-white/30 text-white hover:bg-white hover:text-black transition-colors">
                {t.nav.signIn}
              </button>
            )}

            {/* Language toggle */}
            <div className="ml-3 flex items-center border border-white/20 rounded-md overflow-hidden">
              {(["ru", "en"] as Language[]).map((lang) => (
                <button key={lang} onClick={() => setLanguage(lang)}
                  className={cn("px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors",
                    language === lang ? "bg-white text-black" : "text-white/50 hover:text-white hover:bg-white/10")}>
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile right side */}
          <div className="flex md:hidden items-center gap-2">
            <div className="flex items-center border border-white/20 rounded-md overflow-hidden">
              {(["ru", "en"] as Language[]).map((lang) => (
                <button key={lang} onClick={() => setLanguage(lang)}
                  className={cn("px-2.5 py-1.5 text-[11px] font-semibold uppercase transition-colors",
                    language === lang ? "bg-white text-black" : "text-white/50 hover:text-white")}>
                  {lang}
                </button>
              ))}
            </div>
            <button onClick={() => setOpen((v) => !v)} aria-label="Toggle menu"
              className="w-9 h-9 flex items-center justify-center rounded-md text-white hover:bg-white/10 transition-colors">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </header>

      {/* Mobile slide-down menu */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black pt-16 md:hidden">
          <nav className="flex flex-col px-6 py-8 gap-2">
            {!isStaff && navHrefs.map(({ href, key }) => (
              <Link key={href} href={href} onClick={close}
                className={cn("font-display tracking-widest text-4xl py-4 border-b border-white/10 transition-colors",
                  pathname === href ? "text-white" : "text-white/50 hover:text-white")}>
                {t.nav[key].toUpperCase()}
              </Link>
            ))}

            {isAuthenticated ? (
              isStaff ? (
                <button onClick={() => { close(); handleSignOut(); }}
                  className="font-display tracking-widest text-4xl py-4 text-left text-red-400 hover:text-red-300 transition-colors">
                  {t.nav.signOut.toUpperCase()}
                </button>
              ) : (
                <>
                  <Link href="/profile" onClick={close}
                    className="font-display tracking-widest text-4xl py-4 border-b border-white/10 text-white/50 hover:text-white transition-colors">
                    {t.nav.myProfile.toUpperCase()}
                  </Link>
                  <button onClick={() => { close(); handleSignOut(); }}
                    className="font-display tracking-widest text-4xl py-4 text-left text-red-400 hover:text-red-300 transition-colors">
                    {t.nav.signOut.toUpperCase()}
                  </button>
                </>
              )
            ) : (
              <button onClick={() => { close(); setShowAuth(true); }}
                className="font-display tracking-widest text-4xl py-4 text-left text-white/50 hover:text-white transition-colors">
                {t.nav.signIn.toUpperCase()}
              </button>
            )}
          </nav>
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
