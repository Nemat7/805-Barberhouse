"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarScheduler } from "@/components/ui/calendar-scheduler";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  getBarbers,
  getServices,
  getAvailability,
  createBookingPublic,
  apiErrorMessage,
  type Barber,
  type Service,
  type BookingResult,
} from "@/lib/api";
import { ChevronRight, Check, Loader2 } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StepSection({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  return (
    <div ref={ref} className={cn("scroll-mt-20", dark ? "dark bg-background text-foreground" : "bg-white")}>
      {children}
    </div>
  );
}

function StepHeader({ number, label, done, dark = false }: { number: number; label: string; done: boolean; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
        done ? "bg-zinc-300 text-zinc-600" : dark ? "bg-white text-black" : "bg-black text-white",
      )}>
        {done ? <Check className="w-3.5 h-3.5" /> : number}
      </div>
      <h2 className={cn(
        "font-display tracking-wide sm:tracking-widest text-2xl sm:text-3xl md:text-4xl leading-none",
        dark ? "text-white" : "text-black",
        done && "opacity-40",
      )}>
        {label.toUpperCase()}
      </h2>
    </div>
  );
}

function ContinueBtn({ disabled, loading, onClick, label }: { disabled?: boolean; loading?: boolean; onClick: () => void; label: string }) {
  return (
    <Button
      size="lg"
      disabled={disabled || loading}
      onClick={onClick}
      className="h-12 px-10 bg-black text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 tracking-widest uppercase text-xs font-semibold"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{label}<ChevronRight className="ml-2 h-4 w-4" /></>}
    </Button>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="mt-3 text-sm text-red-600">{msg}</p>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BookPage() {
  const { t, language } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const tb = t.book;

  const [visibleStep, setVisibleStep] = useState(1);

  // Skip step 1 if already logged in
  useEffect(() => {
    if (isAuthenticated) setVisibleStep(2);
  }, [isAuthenticated]);

  // ── Step 1: name + phone (no OTP) ──
  const [name, setName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const step1Ready = name.trim().length > 0 && phone.trim().length > 6;

  // ── Step 2: barber ──
  const [barbers, setBarbers] = useState<Barber[] | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<number | null>(null);

  // ── Step 3: services ──
  const [services, setServices] = useState<Service[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Step 4: availability + booking ──
  const [slots, setSlots] = useState<string[] | undefined>(undefined);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [result, setResult] = useState<BookingResult | null>(null);

  useEffect(() => {
    if (visibleStep >= 2 && barbers === null) {
      getBarbers().then(setBarbers).catch(() => setBarbers([]));
    }
  }, [visibleStep, barbers]);

  useEffect(() => {
    if (visibleStep >= 3 && services === null) {
      getServices().then(setServices).catch(() => setServices([]));
    }
  }, [visibleStep, services]);

  // ── Step 3 ──────────────────────────────────────────────────────────────────

  function toggleService(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSlots(undefined);
  }

  const selectedServices = (services ?? []).filter((s) => selectedIds.has(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + parseFloat(s.price), 0);
  const totalMinutes = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);

  // ── Step 4 ──────────────────────────────────────────────────────────────────

  async function handleDateChange(date: Date | undefined) {
    if (!date || !selectedBarberId || selectedIds.size === 0) { setSlots(undefined); return; }
    setSlotsLoading(true);
    setSlots(undefined);
    setBookingError("");
    try {
      const res = await getAvailability(selectedBarberId, format(date, "yyyy-MM-dd"), Array.from(selectedIds));
      setSlots(res.available_slots);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleConfirm({ date, time }: { date?: Date; time?: string }) {
    if (!date || !time || !selectedBarberId) return;
    setBookingError("");
    setBookingLoading(true);
    try {
      const res = await createBookingPublic({
        barber_id: selectedBarberId,
        service_ids: Array.from(selectedIds),
        date: format(date, "yyyy-MM-dd"),
        start_time: time,
        client_phone: isAuthenticated && user ? user.phone : phone.trim(),
        client_name: isAuthenticated && user ? user.full_name : name.trim(),
      });
      setResult(res);
    } catch (err) {
      setBookingError(apiErrorMessage(err));
    } finally {
      setBookingLoading(false);
    }
  }

  // ── Success ─────────────────────────────────────────────────────────────────

  if (result) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h2 className="font-display text-5xl text-black mb-4 tracking-wider">
            {tb.success.title.toUpperCase()}
          </h2>
          <p className="text-zinc-500 text-sm mb-1">
            {result.date} · {result.start_time.slice(0, 5)}
          </p>
          <p className="text-zinc-700 font-medium mb-6">
            {result.total_price} сом · {result.total_duration} мин
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setVisibleStep(isAuthenticated ? 2 : 1);
              setSelectedBarberId(null);
              setSelectedIds(new Set());
              setSlots(undefined);
            }}
          >
            {tb.success.bookAnother}
          </Button>
        </div>
      </main>
    );
  }

  // ── Page ─────────────────────────────────────────────────────────────────────

  const step1Done = visibleStep > 1;
  const step2Done = !!selectedBarberId && visibleStep > 2;
  const step3Done = selectedIds.size > 0 && visibleStep > 3;

  return (
    <main>
      {/* Header */}
      <div className="bg-black text-white px-4 py-8 text-center">
        <p className="text-white/40 text-xs tracking-[0.25em] uppercase mb-2">The Barber House</p>
        <h1 className="font-display text-4xl sm:text-6xl md:text-8xl tracking-wide sm:tracking-widest">
          {tb.pageTitle.toUpperCase()}
        </h1>
      </div>

      {/* ── Step 1: Name + Phone ── */}
      <section className="bg-white px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-2xl mx-auto">
          <StepHeader number={1} label={tb.step1.title} done={step1Done} />

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="name">{tb.step1.fullName}</Label>
              <Input
                id="name"
                placeholder={tb.step1.fullNamePlaceholder}
                value={name}
                disabled={step1Done}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{tb.step1.phone}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={tb.step1.phonePlaceholder}
                value={phone}
                disabled={step1Done}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {visibleStep === 1 && (
            <div className="mt-8">
              <ContinueBtn
                disabled={!step1Ready}
                onClick={() => setVisibleStep(2)}
                label={t.common.continue}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Step 2: Barber ── */}
      {visibleStep >= 2 && (
        <StepSection>
          <section className="bg-zinc-50 px-4 sm:px-6 py-10 sm:py-14 border-t border-zinc-100">
            <div className="max-w-2xl mx-auto">
              <StepHeader number={2} label={tb.step2.title} done={step2Done} />

              {barbers === null ? (
                <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-xl bg-zinc-100 animate-pulse" />
                  ))}
                </div>
              ) : barbers.length === 0 ? (
                <p className="mt-8 text-sm text-zinc-500">
                  {language === "ru" ? "Барберы не найдены." : "No barbers found."}
                </p>
              ) : (
                <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {barbers.map((b) => {
                    const active = selectedBarberId === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => { setSelectedBarberId(b.id); setSlots(undefined); }}
                        className={cn(
                          "border rounded-xl p-4 text-center transition-all duration-150",
                          "hover:border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
                          active ? "border-black bg-black text-white" : "border-zinc-200 text-zinc-900",
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-sm font-bold overflow-hidden",
                          active ? "bg-white text-black" : "bg-zinc-100 text-black",
                        )}>
                          {b.photo
                            ? <img src={b.photo} alt={b.full_name} className="w-full h-full object-cover" />
                            : b.full_name[0]
                          }
                        </div>
                        <p className="font-semibold text-sm leading-tight">{b.full_name}</p>
                        {b.specialty && (
                          <p className={cn("text-xs mt-1 leading-snug", active ? "text-zinc-300" : "text-zinc-500")}>
                            {b.specialty}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {visibleStep === 2 && (
                <div className="mt-8">
                  <ContinueBtn disabled={!selectedBarberId} onClick={() => setVisibleStep(3)} label={t.common.continue} />
                </div>
              )}
            </div>
          </section>
        </StepSection>
      )}

      {/* ── Step 3: Services ── */}
      {visibleStep >= 3 && (
        <StepSection>
          <section className="bg-white px-4 sm:px-6 py-10 sm:py-14 border-t border-zinc-100">
            <div className="max-w-2xl mx-auto">
              <StepHeader number={3} label={tb.step3.title} done={step3Done} />

              {services === null ? (
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-zinc-100 animate-pulse" />
                  ))}
                </div>
              ) : services.length === 0 ? (
                <p className="mt-8 text-sm text-zinc-500">
                  {language === "ru" ? "Услуги не найдены." : "No services found."}
                </p>
              ) : (
                <>
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {services.map((s) => {
                      const active = selectedIds.has(s.id);
                      const svcName = language === "ru" ? s.name_ru : s.name_en;
                      const desc = language === "ru" ? s.description_ru : s.description_en;
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleService(s.id)}
                          className={cn(
                            "border rounded-xl p-5 text-left transition-all duration-150 relative",
                            "hover:border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
                            active ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-zinc-900",
                          )}
                        >
                          {active && (
                            <span className="absolute top-3 right-3 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-black" />
                            </span>
                          )}
                          <p className="font-semibold text-sm mb-1 pr-6">{svcName}</p>
                          <p className={cn("text-xs mb-3 leading-snug", active ? "text-zinc-300" : "text-zinc-500")}>{desc}</p>
                          <p className={cn("text-xs font-semibold", active ? "text-white" : "text-black")}>
                            {s.price} сом{" "}
                            <span className="font-normal text-zinc-400">· {s.duration_minutes} мин</span>
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {selectedIds.size > 0 && (
                    <div className="mt-6 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-sm font-semibold text-zinc-900">
                        {language === "ru" ? "Итого:" : "Total:"}{" "}
                        <span className="text-black">{totalPrice} сом · {totalMinutes} мин</span>
                      </p>
                    </div>
                  )}
                </>
              )}

              {visibleStep === 3 && (
                <div className="mt-8">
                  <ContinueBtn disabled={selectedIds.size === 0} onClick={() => setVisibleStep(4)} label={t.common.continue} />
                </div>
              )}
            </div>
          </section>
        </StepSection>
      )}

      {/* ── Step 4: Date & Time ── */}
      {visibleStep >= 4 && (
        <StepSection dark>
          <section className="px-4 sm:px-6 py-10 sm:py-14 border-t border-white/10">
            <div className="max-w-2xl mx-auto">
              <StepHeader number={4} label={tb.step4.title} done={false} dark />
              <div className="mt-8">
                <CalendarScheduler
                  availableSlots={slots}
                  loadingSlots={slotsLoading}
                  confirmLoading={bookingLoading}
                  onDateChange={handleDateChange}
                  onConfirm={handleConfirm}
                  dateLocale={language === "ru" ? ruLocale : undefined}
                  texts={{
                    availableTimes: tb.step4.availableTimes,
                    noSlots: language === "ru" ? "Нет доступного времени" : "No available slots",
                    reset: t.common.reset,
                    confirm: t.common.confirm,
                    selectDate: tb.step4.selectDate,
                    dateFormat: tb.step4.dateFormat,
                  }}
                />
                <ErrorMsg msg={bookingError} />
              </div>
            </div>
          </section>
        </StepSection>
      )}
    </main>
  );
}
