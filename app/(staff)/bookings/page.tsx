"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, ChevronDown, X, Phone, Clock, DollarSign, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import {
  adminGetBookings,
  adminUpdateBooking,
  adminGetBooking,
  getBarbers,
  getAvailability,
  BookingResult,
  Barber,
} from "@/lib/api";

const STATUSES = ["confirmed", "rescheduled", "completed", "cancelled"];

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  const colors: Record<string, string> = {
    confirmed: "bg-emerald-100 text-emerald-800",
    rescheduled: "bg-blue-100 text-blue-800",
    completed: "bg-zinc-100 text-zinc-600",
    cancelled: "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", colors[status] ?? "bg-zinc-100 text-zinc-600")}>
      {labels[status] ?? status}
    </span>
  );
}

// ── Booking drawer ────────────────────────────────────────────────────────────

function BookingDrawer({
  booking,
  barbers,
  onClose,
  onUpdated,
}: {
  booking: BookingResult;
  barbers: Barber[];
  onClose: () => void;
  onUpdated: (b: BookingResult) => void;
}) {
  const { t, language } = useLanguage();
  const td = t.admin.detail;
  const sl = t.admin.statusLabels;

  const [action, setAction] = useState<"cancel" | "complete" | "reschedule" | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // reschedule state
  const [reschedDate, setReschedDate] = useState(booking.date);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pickedSlot, setPickedSlot] = useState("");

  const serviceIds = booking.services.map((s) => s.id);

  async function fetchSlots(date: string) {
    setLoadingSlots(true);
    setSlots([]);
    setPickedSlot("");
    try {
      const res = await getAvailability(booking.barber.id, date, serviceIds);
      setSlots(res.available_slots);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    if (action === "reschedule") fetchSlots(reschedDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, reschedDate]);

  async function submit() {
    setErr("");
    setLoading(true);
    try {
      let updated: BookingResult;
      if (action === "cancel") {
        updated = await adminUpdateBooking(booking.id, { action: "cancel", reason });
      } else if (action === "complete") {
        updated = await adminUpdateBooking(booking.id, { action: "complete" });
      } else if (action === "reschedule" && pickedSlot) {
        updated = await adminUpdateBooking(booking.id, {
          action: "reschedule",
          date: reschedDate,
          start_time: pickedSlot,
        });
      } else return;
      onUpdated(updated);
      setAction(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const isDone = booking.status === "cancelled" || booking.status === "completed";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-sm bg-white h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-zinc-900">{td.title} #{booking.id}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-5 space-y-4 flex-1">
          {/* Status */}
          <div className="flex items-center gap-2">
            <StatusBadge status={booking.status} labels={sl} />
          </div>

          {/* Client */}
          <div className="rounded-xl border border-zinc-100 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-zinc-400" />
              <span className="font-medium text-zinc-900">{booking.client.full_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Phone className="w-4 h-4 text-zinc-400" />
              {booking.client.phone}
            </div>
          </div>

          {/* Details */}
          <div className="rounded-xl border border-zinc-100 p-4 space-y-2.5 text-sm">
            <Row label={td.barber} value={booking.barber.full_name} />
            <Row label={td.date} value={format(parseISO(booking.date), "d MMM yyyy")} />
            <Row label={td.time} value={`${booking.start_time.slice(0,5)} – ${booking.end_time.slice(0,5)}`} />
            <Row label={td.duration} value={`${booking.total_duration} ${td.min}`} />
            <Row label={td.price} value={`${booking.total_price} сом`} />
            {booking.notes && <Row label={td.notes} value={booking.notes} />}
          </div>

          {/* Services */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">{td.services}</p>
            <div className="space-y-1">
              {booking.services.map((s) => (
                <div key={s.id} className="text-sm text-zinc-700">
                  {language === "ru" ? s.name_ru : s.name_en}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {!isDone && !action && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setAction("cancel")}
                className="flex-1 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                {td.cancel}
              </button>
              <button
                onClick={() => setAction("complete")}
                className="flex-1 py-2.5 rounded-lg border border-zinc-200 text-zinc-700 text-sm font-medium hover:bg-zinc-50 transition-colors"
              >
                {td.complete}
              </button>
              <button
                onClick={() => setAction("reschedule")}
                className="flex-1 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                {td.reschedule}
              </button>
            </div>
          )}

          {/* Cancel form */}
          {action === "cancel" && (
            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium text-zinc-700">{td.cancelReason}</p>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/20"
                placeholder="Optional..."
              />
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button onClick={() => setAction(null)} className="flex-1 py-2.5 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                  Back
                </button>
                <button onClick={submit} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {td.confirmCancel}
                </button>
              </div>
            </div>
          )}

          {/* Complete confirm */}
          {action === "complete" && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-zinc-600">{td.confirmComplete}</p>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button onClick={() => setAction(null)} className="flex-1 py-2.5 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                  Back
                </button>
                <button onClick={submit} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {td.complete}
                </button>
              </div>
            </div>
          )}

          {/* Reschedule form */}
          {action === "reschedule" && (
            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium text-zinc-700">{td.chooseNewTime}</p>
              <input
                type="date"
                value={reschedDate}
                onChange={(e) => setReschedDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              />
              {loadingSlots ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-2">No slots available</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {slots.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPickedSlot(s)}
                      className={cn(
                        "py-2 rounded-lg text-sm font-medium border transition-colors",
                        pickedSlot === s
                          ? "bg-black text-white border-black"
                          : "border-zinc-200 text-zinc-700 hover:border-zinc-400",
                      )}
                    >
                      {s.slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button onClick={() => setAction(null)} className="flex-1 py-2.5 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                  Back
                </button>
                <button onClick={submit} disabled={loading || !pickedSlot} className="flex-1 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {td.confirmReschedule}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-400">{label}</span>
      <span className="text-zinc-900 font-medium text-right">{value}</span>
    </div>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  onClick,
  language,
  statusLabels,
}: {
  booking: BookingResult;
  onClick: () => void;
  language: string;
  statusLabels: Record<string, string>;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-zinc-200 p-4 hover:border-zinc-400 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-semibold text-zinc-900 text-sm truncate">{booking.client.full_name}</span>
            <StatusBadge status={booking.status} labels={statusLabels} />
          </div>
          <div className="text-xs text-zinc-500 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3" />
              {booking.barber.full_name}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {booking.start_time.slice(0, 5)} – {booking.end_time.slice(0, 5)} · {booking.total_duration} min
            </div>
            <div className="text-xs text-zinc-400 truncate">
              {booking.services.map((s) => language === "ru" ? s.name_ru : s.name_en).join(", ")}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-semibold text-zinc-900">{booking.total_price} сом</div>
          <div className="text-xs text-zinc-400">{format(parseISO(booking.date), "d MMM")}</div>
        </div>
      </div>
    </button>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-zinc-200 rounded-lg pl-3 pr-8 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-black/20 w-full cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const { t, language } = useLanguage();
  const tb = t.admin.bookings;
  const sl = t.admin.statusLabels;

  const today = format(new Date(), "yyyy-MM-dd");

  const [date, setDate] = useState("");
  const [barberId, setBarberId] = useState("");
  const [status, setStatus] = useState("");
  const [bookings, setBookings] = useState<BookingResult[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BookingResult | null>(null);

  useEffect(() => {
    getBarbers().then(setBarbers).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminGetBookings({
        date: date || undefined,
        barber_id: barberId || undefined,
        status: status || undefined,
      });
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [date, barberId, status]);

  useEffect(() => { load(); }, [load]);

  function handleUpdated(updated: BookingResult) {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setSelected(updated);
  }

  function clearFilters() {
    setDate("");
    setBarberId("");
    setStatus("");
  }

  const hasFilters = date || barberId || status;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar */}
      <div className="bg-white border-b border-zinc-200 px-4 md:px-6 py-4">
        <h1 className="text-lg font-bold text-zinc-900">{tb.title}</h1>
      </div>

      {/* Filters */}
      <div className="px-4 md:px-6 py-4 bg-white border-b border-zinc-100">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Date */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>

          {/* Barber */}
          <div className="w-44">
            <Select value={barberId} onChange={setBarberId}>
              <option value="">{tb.allBarbers}</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>{b.full_name}</option>
              ))}
            </Select>
          </div>

          {/* Status */}
          <div className="w-40">
            <Select value={status} onChange={setStatus}>
              <option value="">{tb.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{sl[s as keyof typeof sl]}</option>
              ))}
            </Select>
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-700 transition-colors">
              <X className="w-4 h-4" /> Clear
            </button>
          )}

          <div className="ml-auto text-sm text-zinc-400">
            {!loading && `${bookings.length} bookings`}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="px-4 md:px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-400 text-sm">{tb.noResults}</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {bookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onClick={() => setSelected(b)}
                language={language}
                statusLabels={sl}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      {selected && (
        <BookingDrawer
          booking={selected}
          barbers={barbers}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
