"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarScheduler } from "@/components/ui/calendar-scheduler";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useAuth, isStaffUser } from "@/lib/auth";
import {
  getMyBookings,
  cancelBooking,
  rescheduleBooking,
  getAvailability,
  apiErrorMessage,
  type BookingResult,
} from "@/lib/api";

// ── Status badge ──────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rescheduled: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  completed: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        statusColors[status] ?? "bg-zinc-100 text-zinc-500 border-zinc-200",
      )}
    >
      {label}
    </span>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  canManage,
  language,
  tp,
  ta,
  onCancelled,
  onRescheduled,
}: {
  booking: BookingResult;
  canManage: boolean;
  language: string;
  tp: ReturnType<typeof useLanguage>["t"]["profile"];
  ta: ReturnType<typeof useLanguage>["t"]["auth"];
  onCancelled: (id: number) => void;
  onRescheduled: (updated: BookingResult) => void;
}) {
  const [mode, setMode] = useState<"idle" | "cancel" | "reschedule">("idle");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const [slots, setSlots] = useState<string[] | undefined>(undefined);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");

  const serviceIds = booking.services.map((s) => s.id);

  async function handleDateChange(date: Date | undefined) {
    if (!date) { setSlots(undefined); return; }
    setSlotsLoading(true);
    setSlots(undefined);
    try {
      const res = await getAvailability(
        booking.barber.id,
        format(date, "yyyy-MM-dd"),
        serviceIds,
      );
      setSlots(res.available_slots);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleReschedule({ date, time }: { date?: Date; time?: string }) {
    if (!date || !time) return;
    setRescheduleError("");
    setRescheduling(true);
    try {
      const updated = await rescheduleBooking(
        booking.id,
        format(date, "yyyy-MM-dd"),
        time,
      );
      onRescheduled(updated);
      setMode("idle");
    } catch (err) {
      setRescheduleError(apiErrorMessage(err));
    } finally {
      setRescheduling(false);
    }
  }

  async function handleCancel() {
    setCancelError("");
    setCancelling(true);
    try {
      await cancelBooking(booking.id, cancelReason);
      onCancelled(booking.id);
    } catch (err) {
      setCancelError(apiErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  const serviceNames = booking.services
    .map((s) => (language === "ru" ? s.name_ru : s.name_en))
    .join(", ");

  const statusLabel =
    tp.statusLabels[booking.status as keyof typeof tp.statusLabels] ??
    booking.status;

  return (
    <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white">
      {/* Card header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-zinc-900 text-sm">
              {booking.date} · {booking.start_time.slice(0, 5)}
            </p>
            <StatusBadge status={booking.status} label={statusLabel} />
          </div>
          <p className="text-sm text-zinc-600 mt-1 truncate">
            {booking.barber.full_name}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{serviceNames}</p>
          <p className="text-xs font-semibold text-zinc-700 mt-1">
            {booking.total_price} сом · {booking.total_duration} мин
          </p>
        </div>

        {/* Action buttons — only for upcoming manageable */}
        {canManage && mode === "idle" && (
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 px-3"
              onClick={() => setMode("reschedule")}
            >
              {tp.reschedule}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 px-3 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => setMode("cancel")}
            >
              {tp.cancel}
            </Button>
          </div>
        )}

        {/* Collapse button */}
        {canManage && mode !== "idle" && (
          <button
            onClick={() => { setMode("idle"); setCancelReason(""); setCancelError(""); setRescheduleError(""); setSlots(undefined); }}
            className="text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Cancel confirmation */}
      {mode === "cancel" && (
        <div className="px-5 pb-5 border-t border-zinc-100 pt-4 space-y-3">
          <p className="text-sm font-semibold text-zinc-800">{tp.cancelTitle}</p>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">{tp.cancelReasonLabel}</Label>
            <Input
              placeholder={tp.cancelReasonPlaceholder}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="text-sm"
            />
          </div>
          {cancelError && <p className="text-xs text-red-600">{cancelError}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-9"
              disabled={cancelling}
              onClick={handleCancel}
            >
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : tp.confirmCancel}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-9"
              onClick={() => setMode("idle")}
            >
              {ta.back}
            </Button>
          </div>
        </div>
      )}

      {/* Reschedule — inline calendar */}
      {mode === "reschedule" && (
        <div className="px-5 pb-5 border-t border-zinc-100 pt-4">
          <p className="text-sm font-semibold text-zinc-800 mb-4">
            {tp.chooseNewTime}
          </p>
          <CalendarScheduler
            availableSlots={slots}
            loadingSlots={slotsLoading}
            confirmLoading={rescheduling}
            onDateChange={handleDateChange}
            onConfirm={handleReschedule}
            dateLocale={language === "ru" ? ruLocale : undefined}
            texts={{
              availableTimes: language === "ru" ? "Доступное время" : "Available times",
              noSlots: language === "ru" ? "Нет доступного времени" : "No available slots",
              reset: language === "ru" ? "Сбросить" : "Reset",
              confirm: tp.confirmReschedule,
              selectDate: language === "ru" ? "Выберите дату" : "Select a date",
              dateFormat: language === "ru" ? "d MMMM yyyy" : "MMMM d, yyyy",
            }}
          />
          {rescheduleError && (
            <p className="mt-3 text-sm text-red-600">{rescheduleError}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t, language } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const tp = t.profile;

  const [bookings, setBookings] = useState<BookingResult[] | null>(null);
  const [loadError, setLoadError] = useState("");

  // The client cabinet is for clients only — staff go to their calendar
  const isStaff = isStaffUser(user);
  useEffect(() => {
    if (isAuthenticated && isStaff) router.replace("/calendar");
  }, [isAuthenticated, isStaff, router]);

  useEffect(() => {
    if (!isAuthenticated || isStaff) return;
    getMyBookings()
      .then(setBookings)
      .catch((err) => {
        setBookings([]);
        setLoadError(apiErrorMessage(err));
      });
  }, [isAuthenticated]);

  // Split into upcoming vs past
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (bookings ?? []).filter(
    (b) =>
      (b.status === "confirmed" || b.status === "rescheduled") &&
      b.date >= today,
  );
  const past = (bookings ?? []).filter(
    (b) =>
      !(
        (b.status === "confirmed" || b.status === "rescheduled") &&
        b.date >= today
      ),
  );

  function handleCancelled(id: number) {
    setBookings((prev) =>
      prev
        ? prev.map((b) =>
            b.id === id ? { ...b, status: "cancelled" } : b,
          )
        : prev,
    );
  }

  function handleRescheduled(updated: BookingResult) {
    setBookings((prev) =>
      prev ? prev.map((b) => (b.id === updated.id ? updated : b)) : prev,
    );
  }

  // Staff being redirected — render nothing to avoid a flash of the client cabinet
  if (isAuthenticated && isStaff) return null;

  // ── Not logged in ──
  if (!isAuthenticated) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">✂</span>
          </div>
          <h2 className="font-display text-3xl text-black tracking-widest mb-3">
            {tp.title.toUpperCase()}
          </h2>
          <p className="text-zinc-500 text-sm mb-8">{tp.signInPrompt}</p>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-semibold tracking-widest uppercase rounded-lg hover:bg-zinc-800 transition-colors"
          >
            {tp.bookNow}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-50">
      {/* Header */}
      <div className="bg-black text-white px-4 py-8 text-center">
        <p className="text-white/40 text-xs tracking-[0.25em] uppercase mb-2">
          The Barber House
        </p>
        <h1 className="font-display text-4xl sm:text-6xl tracking-wide sm:tracking-widest">
          {tp.title.toUpperCase()}
        </h1>
        {user && (
          <p className="mt-3 text-white/50 text-sm">
            {user.full_name} · {user.phone}
          </p>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Loading */}
        {bookings === null && !loadError && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        )}

        {loadError && (
          <p className="text-center text-sm text-red-600 py-8">{loadError}</p>
        )}

        {bookings !== null && bookings.length === 0 && (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-sm mb-6">{tp.emptyAll}</p>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-semibold tracking-widest uppercase rounded-lg hover:bg-zinc-800 transition-colors"
            >
              {tp.bookNow}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="font-display text-2xl tracking-widest text-black mb-4">
              {tp.upcoming.toUpperCase()}
            </h2>
            <div className="space-y-3">
              {upcoming.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  canManage
                  language={language}
                  tp={tp}
                  ta={t.auth}
                  onCancelled={handleCancelled}
                  onRescheduled={handleRescheduled}
                />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming empty state */}
        {bookings !== null && upcoming.length === 0 && past.length > 0 && (
          <section>
            <h2 className="font-display text-2xl tracking-widest text-black mb-4">
              {tp.upcoming.toUpperCase()}
            </h2>
            <div className="border border-dashed border-zinc-300 rounded-2xl p-8 text-center">
              <p className="text-zinc-400 text-sm mb-4">{tp.emptyUpcoming}</p>
              <Link
                href="/book"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-xs font-semibold tracking-widest uppercase rounded-lg hover:bg-zinc-800 transition-colors"
              >
                {tp.bookNow}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="font-display text-2xl tracking-widest text-black mb-4">
              {tp.past.toUpperCase()}
            </h2>
            <div className="space-y-3">
              {past.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  canManage={false}
                  language={language}
                  tp={tp}
                  ta={t.auth}
                  onCancelled={handleCancelled}
                  onRescheduled={handleRescheduled}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
