"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { Check, Scissors, BookOpen, Award, ChevronRight, Instagram, Loader2 } from "lucide-react";
import { applyToAcademy, apiErrorMessage, type AcademyProgram } from "@/lib/api";

// ── Static data (non-translated) ──────────────────────────────────────────────

const programsStatic = [
  { id: "little-barber", price: "3 000 сомони", badge: null },
  { id: "barber",        price: "5 000 сомони", badge: "mostPopular" as const },
  { id: "top-barber",    price: "7 000 сомони", badge: null },
] as const;

const instructorsStatic = [
  { id: "1", name: "Marcus Webb", years: "15", photo: "https://images.unsplash.com/photo-1534339480783-6816b5baf8ac?w=400&h=400&fit=crop&crop=face" },
  { id: "2", name: "Dante Cruz",  years: "10", photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face" },
  { id: "3", name: "Jayla Monroe",years: "8",  photo: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=face" },
  { id: "4", name: "Rios Aguilar",years: "12", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face" },
] as const;

const galleryImages = [
  { src: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&h=700&fit=crop", alt: "fade" },
  { src: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600&h=400&fit=crop", alt: "cut" },
  { src: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&h=400&fit=crop", alt: "beard" },
  { src: "https://images.unsplash.com/photo-1587909209111-5097ee578ec3?w=600&h=700&fit=crop", alt: "shop" },
  { src: "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&h=400&fit=crop", alt: "student" },
  { src: "https://images.unsplash.com/photo-1560869713-7d0a29430803?w=600&h=400&fit=crop", alt: "razor" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AcademyPage() {
  const { t } = useLanguage();
  const ta = t.academy;

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [program, setProgram] = useState<AcademyProgram>("undecided");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const enrollRef = useRef<HTMLElement>(null);

  /** "Apply" on a program card preselects it, then scrolls to the form. */
  function applyForProgram(id: AcademyProgram) {
    setProgram(id);
    enrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await applyToAcademy({
        full_name: fullName.trim(),
        phone: phone.trim(),
        program,
        message: message.trim(),
      });
      setFormSubmitted(true);
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Merge static + translated program data
  const programs = programsStatic.map((p) => ({
    ...p,
    ...ta.programs[p.id as keyof typeof ta.programs],
    badgeLabel: p.badge ? ta.mostPopular : null,
  }));

  // Merge static + translated instructor data
  const instructors = instructorsStatic.map((i) => ({
    ...i,
    ...ta.instructors[i.id as keyof typeof ta.instructors],
  }));

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative bg-black text-white min-h-[70vh] flex items-center justify-center px-4 sm:px-6 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 border border-white/20 rounded-full px-4 py-1.5 text-xs tracking-[0.2em] uppercase text-white/60 mb-8">
            <BookOpen className="w-3 h-3" />
            {ta.heroTag}
          </div>
          <h1 className="font-display text-4xl sm:text-7xl md:text-9xl tracking-wide sm:tracking-widest mb-6">
            805
            <br />
            {ta.heroTitle.toUpperCase()}
          </h1>
          <p className="text-zinc-400 text-lg max-w-md mx-auto leading-relaxed">{ta.heroSubtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
            <Button asChild size="lg" className="bg-white text-black hover:bg-zinc-100">
              <a href="#programs">{ta.viewPrograms}</a>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 hover:text-white">
              <a href="#enroll">{ta.applyNow}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section className="bg-white py-12 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-zinc-400 mb-4">{ta.aboutTag}</p>
            <h2 className="font-display text-3xl sm:text-5xl md:text-6xl tracking-wide sm:tracking-widest mb-6">
              {ta.aboutHeadingLine1.toUpperCase()}
              <br />
              {ta.aboutHeadingLine2.toUpperCase()}
            </h2>
            <div className="space-y-4 text-zinc-600 leading-relaxed">
              <p>{ta.aboutP1}</p>
              <p>{ta.aboutP2}</p>
            </div>
            <div className="grid grid-cols-3 gap-6 mt-10">
              {[ta.stat1, ta.stat2, ta.stat3].map(({ value, label }) => (
                <div key={label}>
                  <p className="font-display text-4xl tracking-wider">{value}</p>
                  <p className="text-sm text-zinc-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&h=1000&fit=crop"
                alt="Barber at work"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-black text-white rounded-xl p-5 max-w-[200px]">
              <Scissors className="w-5 h-5 mb-2" />
              <p className="text-sm font-medium">{ta.smallClassBadge}</p>
              <p className="text-xs text-zinc-400 mt-1">{ta.smallClassText}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Programs / Pricing ── */}
      <section id="programs" className="bg-zinc-50 py-12 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.3em] uppercase text-zinc-400 mb-4">{ta.programsTag}</p>
            <h2 className="font-display text-3xl sm:text-5xl md:text-6xl tracking-wide sm:tracking-widest mb-4">
              {ta.programsTitle.toUpperCase()}
            </h2>
            <p className="text-zinc-500 max-w-md mx-auto">{ta.programsSubtitle}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {programs.map((program) => (
              <Card
                key={program.id}
                className={cn(
                  "flex flex-col relative",
                  program.badgeLabel
                    ? "border-black shadow-[0_0_0_2px_black]"
                    : "border-zinc-200",
                )}
              >
                {program.badgeLabel && (
                  <span className="absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                    {program.badgeLabel}
                  </span>
                )}
                <CardHeader>
                  <CardTitle className="font-medium text-base">{program.name}</CardTitle>
                  <div className="my-3">
                    <span className="font-display text-3xl tracking-wider">{program.price}</span>
                  </div>
                  <CardDescription className="flex items-center gap-1.5 text-sm">
                    <Award className="w-3.5 h-3.5" />
                    {program.duration}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div className="bg-zinc-50 rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-400">{ta.sessionTypeLabel}</span>
                      <span className="font-medium text-zinc-700 text-right">{program.sessionType}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-400">{ta.hoursLabel}</span>
                      <span className="font-medium text-zinc-700 text-right">{program.hours}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-400">{ta.scheduleLabel}</span>
                      <span className="font-medium text-zinc-700">{program.schedule}</span>
                    </div>
                  </div>
                  <hr className="border-dashed border-zinc-200" />
                  <ul className="space-y-2.5 text-sm">
                    {program.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-zinc-400 pt-2 border-t border-dashed border-zinc-200">
                    {program.certificate}
                  </p>
                </CardContent>
                <CardFooter className="mt-auto">
                  <Button
                    onClick={() => applyForProgram(program.id)}
                    variant={program.badgeLabel ? "default" : "outline"}
                    className={cn("w-full", program.badgeLabel ? "bg-black text-white hover:bg-zinc-800" : "")}
                  >
                    {ta.applyForProgram}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Instructors ── */}
      <section className="bg-white py-12 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.3em] uppercase text-zinc-400 mb-4">{ta.teamTag}</p>
            <h2 className="font-display text-3xl sm:text-5xl md:text-6xl tracking-wide sm:tracking-widest mb-4">
              {ta.teamTitle.toUpperCase()}
            </h2>
            <p className="text-zinc-500 max-w-md mx-auto">{ta.teamSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {instructors.map((instructor) => (
              <div key={instructor.id} className="group">
                <div className="aspect-square rounded-xl overflow-hidden bg-zinc-100 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={instructor.photo}
                    alt={instructor.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <h3 className="font-semibold text-base">{instructor.name}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{instructor.role}</p>
                <p className="text-xs text-zinc-400 mt-1">{instructor.specialty}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Scissors className="w-3 h-3 text-zinc-400" />
                  <span className="text-xs text-zinc-400">
                    {instructor.years} {ta.expLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gallery ── */}
      <section className="bg-zinc-950 py-12 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs tracking-[0.3em] uppercase text-zinc-500 mb-4">{ta.galleryTag}</p>
            <h2 className="font-display text-3xl sm:text-5xl text-white tracking-wide sm:tracking-widest">
              {ta.galleryTitle.toUpperCase()}
            </h2>
          </div>

          {/* Mobile: equal 2-col grid. Desktop: 3-col masonry with tall accent images */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:grid-rows-[200px_200px_200px]">
            {galleryImages.map((img, i) => (
              <div
                key={i}
                className={cn(
                  "overflow-hidden rounded-xl bg-zinc-800",
                  /* tall accent only on md+ */
                  i === 0 ? "md:row-span-2" : "",
                  i === 3 ? "md:row-span-2" : "",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  style={{
                    /* equal square on mobile, natural height on desktop */
                    aspectRatio: "1 / 1",
                    height: "100%",
                    minHeight: "140px",
                  }}
                />
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              <Instagram className="w-4 h-4" />
              {ta.followUs}
            </a>
          </div>
        </div>
      </section>

      {/* ── Enrollment Form ── */}
      <section id="enroll" ref={enrollRef} className="bg-white py-12 sm:py-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          {formSubmitted ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-display text-3xl sm:text-5xl tracking-wide sm:tracking-widest mb-3">
                {ta.successTitle.toUpperCase()}
              </h2>
              <p className="text-zinc-500">{ta.successSubtitle}</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-12">
                <p className="text-xs tracking-[0.3em] uppercase text-zinc-400 mb-4">{ta.enrollTag}</p>
                <h2 className="font-display text-3xl sm:text-5xl md:text-6xl tracking-wide sm:tracking-widest mb-4">
                  {ta.enrollTitle.toUpperCase()}
                </h2>
                <p className="text-zinc-500">{ta.enrollSubtitle}</p>
              </div>

              <form onSubmit={handleApply} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="enroll-name">{ta.fullName}</Label>
                    <Input
                      id="enroll-name"
                      placeholder={ta.fullNamePlaceholder}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="enroll-phone">{ta.phone}</Label>
                    <Input
                      id="enroll-phone"
                      type="tel"
                      placeholder={ta.phonePlaceholder}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enroll-program">{ta.programOfInterest}</Label>
                  <select
                    id="enroll-program"
                    value={program}
                    onChange={(e) => setProgram(e.target.value as AcademyProgram)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm shadow-black/5 transition-shadow focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
                  >
                    {programsStatic.map((p) => (
                      <option key={p.id} value={p.id}>
                        {ta.programs[p.id as keyof typeof ta.programs].name}
                      </option>
                    ))}
                    <option value="undecided">{ta.notSureYet}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enroll-message">
                    {ta.tellUs}{" "}
                    <span className="text-zinc-400 font-normal">({ta.optional})</span>
                  </Label>
                  <textarea
                    id="enroll-message"
                    rows={4}
                    placeholder={ta.tellUsPlaceholder}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm shadow-black/5 transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 resize-none"
                  />
                </div>

                {formError && <p className="text-sm text-red-600">{formError}</p>}

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || !fullName.trim() || !phone.trim()}
                  className="w-full h-12 bg-black text-white hover:bg-zinc-800 text-base disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {ta.submitApplication}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-black text-white py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Image
            src="/logo-nav.png"
            alt="The Barber House"
            width={120}
            height={52}
            className="h-8 w-auto object-contain"
          />
          <p className="text-zinc-500 text-sm text-center">
            Dushanbe, TJ · +992 000 805 000
          </p>
          <div className="flex gap-4">
            <Link href="/" className="text-zinc-400 hover:text-white text-sm transition-colors">
              {t.nav.bookNow}
            </Link>
            <a
              href="https://instagram.com/805_barberhouse"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white text-sm transition-colors"
            >
              Instagram
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
