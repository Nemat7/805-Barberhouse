"use client";

import { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronUp, Check, Trash2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import {
  getBarbers,
  adminCreateBarber,
  adminUpdateBarber,
  adminGetSchedule,
  adminSaveSchedule,
  adminGetOverrides,
  adminCreateOverride,
  adminDeleteOverride,
  apiErrorMessage,
  Barber,
  WeeklySchedule,
  ScheduleOverride,
} from "@/lib/api";

// ── Time input ────────────────────────────────────────────────────────────────

function TimeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-40 disabled:bg-zinc-50"
    />
  );
}

// ── Schedule editor ───────────────────────────────────────────────────────────

function ScheduleEditor({
  barberId,
  days,
}: {
  barberId: number;
  days: string[];
}) {
  const { t } = useLanguage();
  const tb = t.admin.barbers;

  const defaultSlots = (): WeeklySchedule[] =>
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      start_time: "09:00",
      end_time: "21:00",
      is_day_off: i >= 6,
    }));

  const [schedule, setSchedule] = useState<WeeklySchedule[]>(defaultSlots());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    adminGetSchedule(barberId)
      .then((data) => {
        if (data.length === 7) setSchedule(data);
        else {
          const map = Object.fromEntries(data.map((d) => [d.day_of_week, d]));
          setSchedule(defaultSlots().map((d) => map[d.day_of_week] ?? d));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [barberId]);

  function update(idx: number, patch: Partial<WeeklySchedule>) {
    setSchedule((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await adminSaveSchedule(
        barberId,
        schedule.map(({ id: _, ...rest }) => rest),
      );
      setSchedule(saved.length === 7 ? saved : schedule);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {schedule.map((slot, i) => (
          <div key={i} className="flex items-center gap-3 flex-wrap">
            <span className="w-8 text-xs font-semibold text-zinc-500 uppercase">{days[i]}</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={slot.is_day_off}
                onChange={(e) => update(i, { is_day_off: e.target.checked })}
                className="rounded"
              />
              <span className="text-xs text-zinc-500">{tb.dayOff}</span>
            </label>
            {!slot.is_day_off && (
              <>
                <TimeInput value={slot.start_time.slice(0, 5)} onChange={(v) => update(i, { start_time: v })} />
                <span className="text-zinc-300 text-sm">–</span>
                <TimeInput value={slot.end_time.slice(0, 5)} onChange={(v) => update(i, { end_time: v })} />
              </>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {saved ? tb.scheduleSaved : tb.save}
      </button>
    </div>
  );
}

// ── Overrides editor ──────────────────────────────────────────────────────────

function OverridesEditor({ barberId }: { barberId: number }) {
  const { t } = useLanguage();
  const tb = t.admin.barbers;

  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<ScheduleOverride, "id">>({
    date: "",
    start_time: null,
    end_time: null,
    is_day_off: true,
    reason: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    adminGetOverrides(barberId)
      .then(setOverrides)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [barberId]);

  async function add() {
    if (!form.date) return;
    setSaving(true);
    try {
      const created = await adminCreateOverride(barberId, form);
      setOverrides((prev) => [...prev, created]);
      setAdding(false);
      setForm({ date: "", start_time: null, end_time: null, is_day_off: true, reason: "" });
    } catch {
    } finally {
      setSaving(false);
    }
  }

  async function remove(overrideId: number) {
    try {
      await adminDeleteOverride(barberId, overrideId);
      setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
    } catch {}
  }

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>;

  return (
    <div className="space-y-3">
      {overrides.length === 0 && !adding && (
        <p className="text-sm text-zinc-400">No overrides yet.</p>
      )}

      {overrides.map((o) => (
        <div key={o.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-100 p-3 text-sm">
          <div>
            <div className="font-medium text-zinc-800">{o.date}</div>
            {o.is_day_off ? (
              <div className="text-xs text-zinc-400">{tb.dayOff}</div>
            ) : (
              <div className="text-xs text-zinc-500">{o.start_time?.slice(0,5)} – {o.end_time?.slice(0,5)}</div>
            )}
            {o.reason && <div className="text-xs text-zinc-400 mt-0.5">{o.reason}</div>}
          </div>
          <button onClick={() => o.id !== undefined && remove(o.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-zinc-500 mb-1 block">{tb.overrideDate}</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_day_off}
                  onChange={(e) => setForm({ ...form, is_day_off: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-zinc-700">{tb.overrideDayOff}</span>
              </label>
            </div>
            {!form.is_day_off && (
              <>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{tb.overrideStart}</label>
                  <TimeInput value={form.start_time ?? "09:00"} onChange={(v) => setForm({ ...form, start_time: v })} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{tb.overrideEnd}</label>
                  <TimeInput value={form.end_time ?? "21:00"} onChange={(v) => setForm({ ...form, end_time: v })} />
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="text-xs text-zinc-500 mb-1 block">{tb.overrideReason}</label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                placeholder="E.g. Vacation"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
              {t.admin.services.cancel}
            </button>
            <button onClick={add} disabled={!form.date || saving} className="flex-1 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {tb.saveOverride}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1">
          {tb.addOverride}
        </button>
      )}
    </div>
  );
}

// ── Barber card ───────────────────────────────────────────────────────────────

function BarberCard({ barber, onUpdated }: { barber: Barber; onUpdated: (b: Barber) => void }) {
  const { t } = useLanguage();
  const tb = t.admin.barbers;

  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"info" | "schedule" | "overrides">("info");

  // Info form
  const [specialty, setSpecialty] = useState(barber.specialty);
  const [bio, setBio] = useState(barber.bio);
  const [isActive, setIsActive] = useState(barber.is_active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await adminUpdateBarber(barber.id, { specialty, bio, is_active: isActive });
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-zinc-100 overflow-hidden flex-shrink-0">
          {barber.photo ? (
            <img src={barber.photo} alt={barber.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400 font-semibold text-sm">
              {barber.full_name[0]}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-900 text-sm">{barber.full_name}</span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full", barber.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500")}>
              {barber.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 truncate">{barber.specialty || "—"}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {expanded && (
        <div className="border-t border-zinc-100">
          {/* Tabs */}
          <div className="flex border-b border-zinc-100">
            {(["info", "schedule", "overrides"] as const).map((key) => {
              const labels = { info: tb.specialty, schedule: tb.schedule, overrides: tb.overrides };
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-medium transition-colors",
                    tab === key ? "text-zinc-900 border-b-2 border-zinc-900 -mb-px" : "text-zinc-400 hover:text-zinc-700",
                  )}
                >
                  {labels[key]}
                </button>
              );
            })}
          </div>

          <div className="px-5 py-5">
            {tab === "info" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">{tb.specialty}</label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => { setSpecialty(e.target.value); setSaved(false); }}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">{tb.bio}</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => { setBio(e.target.value); setSaved(false); }}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => { setIsActive(e.target.checked); setSaved(false); }}
                    className="rounded"
                  />
                  <span className="text-sm text-zinc-700">{tb.isActive}</span>
                </label>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
                  {saved ? "Saved!" : tb.save}
                </button>
              </div>
            )}

            {tab === "schedule" && (
              <ScheduleEditor barberId={barber.id} days={tb.days as unknown as string[]} />
            )}

            {tab === "overrides" && (
              <OverridesEditor barberId={barber.id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create barber modal ───────────────────────────────────────────────────────

function CreateBarberModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (b: Barber) => void;
}) {
  const [fullName, setFullName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [password, setPassword]   = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio]             = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const barber = await adminCreateBarber({ full_name: fullName, phone, password, specialty, bio });
      onCreated(barber);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-zinc-900">Новый барбер</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500 block">Полное имя *</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иван Иванов"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 block">Телефон *</label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+992..."
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 block">Пароль *</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500 block">Специализация</label>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Классические стрижки, фейды..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500 block">Биография</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !fullName || !phone || !password}
              className="flex-1 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Создать барбера
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BarbersPage() {
  const { t } = useLanguage();
  const [barbers, setBarbers]   = useState<Barber[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    getBarbers()
      .then(setBarbers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleUpdated(updated: Barber) {
    setBarbers((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  function handleCreated(barber: Barber) {
    setBarbers((prev) => [barber, ...prev]);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="bg-white border-b border-zinc-200 px-4 md:px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-900">{t.admin.barbers.title}</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить барбера
        </button>
      </div>

      <div className="px-4 md:px-6 py-5 max-w-2xl space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : barbers.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-16">No barbers found.</p>
        ) : (
          barbers.map((b) => (
            <BarberCard key={b.id} barber={b} onUpdated={handleUpdated} />
          ))
        )}
      </div>

      {showCreate && (
        <CreateBarberModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
