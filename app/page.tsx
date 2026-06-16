"use client";

import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n";

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-black flex flex-col items-center justify-center px-6">
      {/* Branding */}
      <div className="text-center mb-16 select-none">
        <p className="text-white/30 text-xs tracking-[0.4em] uppercase mb-8">
          {t.home.location}
        </p>
        <Image
          src="/logo.png"
          alt="The Barber House"
          width={600}
          height={258}
          className="w-[clamp(280px,60vw,560px)] h-auto mx-auto"
          priority
        />
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Link
          href="/book"
          className="flex-1 flex items-center justify-center h-14 bg-white text-black text-sm font-semibold tracking-widest uppercase rounded-lg hover:bg-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {t.home.bookNow}
        </Link>
        <Link
          href="/academy"
          className="flex-1 flex items-center justify-center h-14 border border-white/30 text-white text-sm font-semibold tracking-widest uppercase rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {t.home.academy}
        </Link>
      </div>
    </main>
  );
}
