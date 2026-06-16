import type { Metadata } from "next";
import { Oswald, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";

const oswald = Oswald({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-bebas",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Barber House",
  description:
    "Барбершоп и академия барберинга в Окснарде, Калифорния. Запишитесь на стрижку или в 805 Академию.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${oswald.variable} ${outfit.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <Navbar />
          <div className="pt-16">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
