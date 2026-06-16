"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, addDays, subDays, isToday, startOfWeek } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarScheduler } from "@/components/ui/calendar-scheduler";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useAuth, isAdminUser } from "@/lib/auth";
import {
  adminGetBookings,
  adminUpdateBooking,
  adminCreateBooking,
  getBarbers,
  getServices,
  getAvailability,
  apiErrorMessage,
  type BookingResult,
  type Barber,
  type Service,
} from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOT_H = 60;           // px per 30-min slot
const GRID_START = 9 * 60;   // 09:00
const GRID_END   = 21 * 60;  // 21:00
const SLOTS = (GRID_END - GRID_START) / 30; // 24

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function slotLabel(i: number) {
  const mins = GRID_START + i * 30;
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ── Booking block ─────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  confirmed:   "bg-emerald-500 border-emerald-400",
  rescheduled: "bg-blue-500 border-blue-400",
  completed:   "bg-zinc-500 border-zinc-400",
  cancelled:   "bg-red-900/60 border-red-700",
};

function BookingBlock({
  booking,
  onClick,
  language,
}: {
  booking: BookingResult;
  onClick: () => void;
  language: string;
}) {
  const startMin = toMinutes(booking.start_time);
  const top    = ((startMin - GRID_START) / 30) * SLOT_H;
  const height = Math.max((booking.total_duration / 30) * SLOT_H - 2, SLOT_H * 0.75);

  if (startMin < GRID_START || startMin >= GRID_END) return null;

  const isCancelled = booking.status === "cancelled";

  return (
    <button
      onClick={onClick}
      style={{ top, height, left: 4, right: 4 }}
      className={cn(
        "absolute rounded-xl border px-2.5 py-1.5 text-left overflow-hidden",
        "transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        statusColors[booking.status] ?? "bg-emerald-500 border-emerald-400",
        isCancelled ? "opacity-50" : "",
      )}
    >
      <p className="text-[11px] text-white/70 leading-none mb-0.5">
        {booking.start_time.slice(0, 5)}–{booking.end_time.slice(0, 5)}
      </p>
      <p className={cn("text-xs font-bold leading-tight text-white truncate", isCancelled && "line-through")}>
        {booking.client?.full_name || "—"}
      </p>
      {height > SLOT_H * 1.2 && (
        <>
          {booking.client?.phone && (
            <p className="text-[10px] text-white/60 leading-tight mt-0.5 truncate">
              {booking.client.phone}
            </p>
          )}
          <p className="text-[10px] text-white/70 leading-tight mt-0.5 truncate">
            {booking.services.map((s) => language === "ru" ? s.name_ru : s.name_en).join(", ")}
          </p>
        </>
      )}
    </button>
  );
}

// ── Date strip ────────────────────────────────────────────────────────────────

function DateStrip({ selected, onChange }: { selected: Date; onChange: (d: Date) => void }) {
  const { language } = useLanguage();
  const locale = language === "ru" ? ruLocale : undefined;
  const stripRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const days = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    // scroll selected day into view
    const idx = days.findIndex((d) => format(d, "yyyy-MM-dd") === format(selected, "yyyy-MM-dd"));
    if (stripRef.current && idx >= 0) {
      const child = stripRef.current.children[idx] as HTMLElement;
      child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format(selected, "yyyy-MM-dd")]);

  return (
    <div ref={stripRef} className="flex overflow-x-auto scrollbar-none gap-1 px-2 py-2">
      {days.map((day) => {
        const isSelected = format(day, "yyyy-MM-dd") === format(selected, "yyyy-MM-dd");
        const today = isToday(day);
        const dayNum = format(day, "d");
        const dayName = format(day, "EEE", { locale }).slice(0, 2);
        return (
          <button
            key={day.toISOString()}
            onClick={() => onChange(day)}
            className={cn(
              "flex-shrink-0 w-12 py-2 rounded-xl flex flex-col items-center gap-0.5 transition-colors",
              isSelected
                ? "bg-white text-black"
                : today
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/10",
            )}
          >
            <span className="text-[10px] font-medium uppercase">{dayName}</span>
            <span className="text-base font-bold leading-none">{dayNum}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Booking drawer ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-zinc-400 w-24 shrink-0 text-sm">{label}</span>
      <span className="text-zinc-900 break-words text-sm">{value}</span>
    </div>
  );
}

function BookingDrawer({
  booking, onClose, onUpdated, language, t,
}: {
  booking: BookingResult;
  onClose: () => void;
  onUpdated: (b: BookingResult) => void;
  language: string;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const td = t.admin.detail;
  const [action, setAction] = useState<"idle" | "cancel" | "complete" | "reschedule">("idle");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [slots, setSlots] = useState<string[] | undefined>(undefined);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const statusLabel = t.admin.statusLabels[booking.status as keyof typeof t.admin.statusLabels] ?? booking.status;

  async function handleDateChange(date: Date | undefined) {
    if (!date) { setSlots(undefined); return; }
    setSlotsLoading(true);
    try {
      const res = await getAvailability(booking.barber.id, format(date, "yyyy-MM-dd"), booking.services.map((s) => s.id));
      setSlots(res.available_slots);
    } catch { setSlots([]); }
    finally { setSlotsLoading(false); }
  }

  async function handleAction(payload: Parameters<typeof adminUpdateBooking>[1]) {
    setError(""); setLoading(true);
    try {
      const updated = await adminUpdateBooking(booking.id, payload);
      onUpdated(updated); setAction("idle");
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-zinc-900">{td.title} #{booking.id}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3 border-b">
          <Row label={td.client}   value={booking.client?.full_name || "—"} />
          <Row label={td.phone}    value={booking.client?.phone || "—"} />
          <Row label={td.barber}   value={booking.barber.full_name} />
          <Row label={td.date}     value={booking.date} />
          <Row label={td.time}     value={`${booking.start_time.slice(0,5)} – ${booking.end_time.slice(0,5)}`} />
          <Row label={td.duration} value={`${booking.total_duration} ${td.min}`} />
          <Row label={td.price}    value={`${booking.total_price} сом`} />
          <Row label={td.services} value={booking.services.map((s) => language === "ru" ? s.name_ru : s.name_en).join(", ")} />
          <Row label={td.status}   value={statusLabel} />
          {booking.notes && <Row label={td.notes} value={booking.notes} />}
          {booking.cancelled_reason && <Row label={td.cancelReason} value={booking.cancelled_reason} />}
        </div>

        {(booking.status === "confirmed" || booking.status === "rescheduled") && (
          <div className="px-5 py-4 space-y-3">
            {action === "idle" && (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setAction("reschedule")}>{td.reschedule}</Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAction("complete")}>{td.complete}</Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setAction("cancel")}>{td.cancel}</Button>
              </div>
            )}
            {action === "complete" && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-700">{td.confirmComplete}</p>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={loading} onClick={() => handleAction({ action: "complete" })}>
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : td.complete}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAction("idle")}>{t.common.reset}</Button>
                </div>
              </div>
            )}
            {action === "cancel" && (
              <div className="space-y-3">
                <Label className="text-xs">{td.cancelReason}</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="..." className="text-sm" />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={loading} onClick={() => handleAction({ action: "cancel", reason })}>
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : td.confirmCancel}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAction("idle")}>{t.common.reset}</Button>
                </div>
              </div>
            )}
            {action === "reschedule" && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-zinc-700">{td.chooseNewTime}</p>
                <CalendarScheduler
                  availableSlots={slots}
                  loadingSlots={slotsLoading}
                  confirmLoading={loading}
                  onDateChange={handleDateChange}
                  onConfirm={({ date, time }) => {
                    if (date && time) handleAction({ action: "reschedule", date: format(date, "yyyy-MM-dd"), start_time: time });
                  }}
                  texts={{
                    availableTimes: language === "ru" ? "Доступное время" : "Available times",
                    noSlots: language === "ru" ? "Нет свободного времени" : "No slots",
                    reset: t.common.reset,
                    confirm: td.confirmReschedule,
                    selectDate: language === "ru" ? "Выберите дату" : "Select date",
                  }}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <Button size="sm" variant="ghost" onClick={() => setAction("idle")}>← {language === "ru" ? "Назад" : "Back"}</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Walk-in modal ─────────────────────────────────────────────────────────────

function WalkinModal({
  barbers, services, onClose, onCreated, language, t,
}: {
  barbers: Barber[];
  services: Service[];
  onClose: () => void;
  onCreated: (b: BookingResult) => void;
  language: string;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const tw = t.admin.walkin;
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const [barberId, setBarberId] = useState<number | null>(barbers.length === 1 ? barbers[0].id : null);
  const [serviceIds, setServiceIds] = useState<Set<number>>(new Set());
  const [clientPhone, setClientPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<string[] | undefined>(undefined);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleService(id: number) {
    setServiceIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setSlots(undefined);
  }

  async function handleDateChange(date: Date | undefined) {
    if (!date || !barberId || serviceIds.size === 0) { setSlots(undefined); return; }
    setSlotsLoading(true);
    try {
      const res = await getAvailability(barberId, format(date, "yyyy-MM-dd"), Array.from(serviceIds));
      setSlots(res.available_slots);
    } catch { setSlots([]); }
    finally { setSlotsLoading(false); }
  }

  async function handleConfirm({ date, time }: { date?: Date; time?: string }) {
    if (!date || !time || !barberId || serviceIds.size === 0) return;
    setError(""); setLoading(true);
    try {
      const booking = await adminCreateBooking({
        barber_id: barberId,
        service_ids: Array.from(serviceIds),
        date: format(date, "yyyy-MM-dd"),
        start_time: time,
        client_phone: clientPhone.trim(),
        client_name: clientName.trim(),
        notes,
      });
      onCreated(booking); onClose();
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold">{tw.title}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-zinc-400" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tw.clientPhone}</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+992..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tw.clientName}</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="..." />
            </div>
          </div>

          {barbers.length > 1 && (
            <div>
              <Label className="text-xs mb-2 block">{tw.selectBarber}</Label>
              <div className="flex flex-wrap gap-2">
                {barbers.map((b) => {
                  const photoUrl = b.photo ? (b.photo.startsWith("http") ? b.photo : `${BASE}${b.photo}`) : null;
                  return (
                    <button key={b.id} onClick={() => { setBarberId(b.id); setSlots(undefined); }}
                      className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors",
                        barberId === b.id ? "bg-black text-white border-black" : "border-zinc-200 hover:border-black")}>
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-200 flex-shrink-0">
                        {photoUrl
                          ? <img src={photoUrl} alt={b.full_name} className="w-full h-full object-cover" />
                          : <span className="w-full h-full flex items-center justify-center text-[10px] font-bold">{b.full_name[0]}</span>
                        }
                      </div>
                      {b.full_name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs mb-2 block">{tw.selectServices}</Label>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => {
                const active = serviceIds.has(s.id);
                return (
                  <button key={s.id} onClick={() => toggleService(s.id)}
                    className={cn("px-3 py-1.5 rounded-lg border text-sm transition-colors",
                      active ? "bg-black text-white border-black" : "border-zinc-200 hover:border-black")}>
                    {language === "ru" ? s.name_ru : s.name_en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{tw.notes}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {barberId && serviceIds.size > 0 && (
            <div>
              <Label className="text-xs mb-2 block">{tw.dateTime}</Label>
              <CalendarScheduler
                availableSlots={slots}
                loadingSlots={slotsLoading}
                confirmLoading={loading}
                onDateChange={handleDateChange}
                onConfirm={handleConfirm}
                texts={{
                  availableTimes: language === "ru" ? "Доступное время" : "Available times",
                  noSlots: language === "ru" ? "Нет свободного времени" : "No slots",
                  reset: t.common.reset,
                  confirm: tw.create,
                  selectDate: language === "ru" ? "Выберите дату" : "Select date",
                }}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const ta = t.admin;
  const isAdmin = isAdminUser(user);
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const [date, setDate] = useState(new Date());
  const [allBarbers, setAllBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<BookingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingResult | null>(null);
  const [showWalkin, setShowWalkin] = useState(false);

  const dateStr = format(date, "yyyy-MM-dd");
  const dateLabel = format(date, language === "ru" ? "d MMMM yyyy" : "MMMM d, yyyy", {
    locale: language === "ru" ? ruLocale : undefined,
  });

  useEffect(() => {
    Promise.all([getBarbers(), getServices()]).then(([b, s]) => {
      setAllBarbers(b);
      setServices(s);
    });
  }, []);

  const barbers = isAdmin
    ? allBarbers
    : allBarbers.filter((b) => b.id === user?.barber_profile_id);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminGetBookings({ date: dateStr });
      setBookings(data);
    } catch { setBookings([]); }
    finally { setLoading(false); }
  }, [dateStr]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  function handleUpdated(updated: BookingResult) {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setSelectedBooking(updated);
  }

  const byBarber: Record<number, BookingResult[]> = {};
  barbers.forEach((b) => { byBarber[b.id] = []; });
  bookings.forEach((bk) => { if (byBarber[bk.barber.id]) byBarber[bk.barber.id].push(bk); });

  const gridH = SLOTS * SLOT_H;

  return (
    <div className="flex flex-col h-full bg-zinc-950 min-h-screen">

      {/* ── Top toolbar ── */}
      <div className="bg-zinc-950 border-b border-white/10 sticky top-0 z-20">
        {/* Date strip */}
        <DateStrip selected={date} onChange={setDate} />

        {/* Selected date + controls */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <button onClick={() => setDate((d) => subDays(d, 1))} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-sm font-semibold text-white capitalize">{dateLabel}</p>
              {isToday(date) && <p className="text-[10px] text-white/30 tracking-widest uppercase">{language === "ru" ? "Сегодня" : "Today"}</p>}
            </div>
            <button onClick={() => setDate((d) => addDays(d, 1))} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isToday(date) && (
              <button onClick={() => setDate(new Date())} className="px-2.5 py-1 text-xs text-white/50 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-colors">
                {ta.calendar.today}
              </button>
            )}
          </div>

          <button
            onClick={() => setShowWalkin(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {ta.calendar.addWalkin}
          </button>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
          </div>
        ) : barbers.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-sm text-white/30">
            {language === "ru" ? "Нет барберов" : "No barbers"}
          </div>
        ) : (
          <div className="flex min-w-0">
            {/* Time column */}
            <div className="flex-shrink-0 w-14 border-r border-white/10">
              {/* Spacer for barber header */}
              <div className="h-20 border-b border-white/10" />
              <div style={{ height: gridH }} className="relative">
                {Array.from({ length: SLOTS }).map((_, i) => (
                  <div key={i} style={{ top: i * SLOT_H, height: SLOT_H }} className="absolute w-full flex items-start pt-1.5 pr-2 justify-end">
                    {i % 2 === 0 && (
                      <span className="text-[10px] text-white/30 leading-none font-medium">{slotLabel(i)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Barber columns */}
            {barbers.map((barber, idx) => {
              const photoUrl = barber.photo
                ? (barber.photo.startsWith("http") ? barber.photo : `${BASE}${barber.photo}`)
                : null;

              return (
                <div key={barber.id} className={cn("flex-1 min-w-[140px]", idx > 0 && "border-l border-white/10")}>
                  {/* Barber header */}
                  <div className="h-20 border-b border-white/10 flex flex-col items-center justify-center gap-1.5 px-2 bg-zinc-900/60">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-zinc-700 ring-2 ring-white/10 flex-shrink-0">
                      {photoUrl ? (
                        <img src={photoUrl} alt={barber.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-base">
                          {barber.full_name[0]}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-white/80 text-center leading-tight truncate w-full px-1">
                      {barber.full_name}
                    </p>
                  </div>

                  {/* Slot grid */}
                  <div style={{ height: gridH }} className="relative">
                    {Array.from({ length: SLOTS }).map((_, i) => (
                      <div
                        key={i}
                        style={{ top: i * SLOT_H, height: SLOT_H }}
                        className={cn(
                          "absolute w-full border-b",
                          i % 2 === 0 ? "border-white/[0.06]" : "border-white/[0.03]",
                        )}
                      />
                    ))}

                    {/* Bookings */}
                    {(byBarber[barber.id] ?? []).map((bk) => (
                      <BookingBlock
                        key={bk.id}
                        booking={bk}
                        language={language}
                        onClick={() => setSelectedBooking(bk)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedBooking && (
        <BookingDrawer
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdated={handleUpdated}
          language={language}
          t={t}
        />
      )}

      {/* Walk-in modal */}
      {showWalkin && (
        <WalkinModal
          barbers={barbers}
          services={services}
          onClose={() => setShowWalkin(false)}
          onCreated={(booking) => setBookings((prev) => [...prev, booking])}
          language={language}
          t={t}
        />
      )}
    </div>
  );
}
