"use client";

import { useState, useEffect } from "react";
import { format, type Locale } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Loader2, Phone, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import {
  adminGetApplications,
  adminUpdateApplication,
  adminDeleteApplication,
  apiErrorMessage,
  ACADEMY_STATUSES,
  type AcademyApplication,
  type AcademyStatus,
} from "@/lib/api";

const statusStyles: Record<AcademyStatus, string> = {
  new:       "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  enrolled:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:  "bg-zinc-100 text-zinc-500 border-zinc-200",
};

// ── One application ───────────────────────────────────────────────────────────

function ApplicationCard({
  application,
  onUpdated,
  onDeleted,
  labels,
  locale,
}: {
  application: AcademyApplication;
  onUpdated: (a: AcademyApplication) => void;
  onDeleted: (id: number) => void;
  labels: ReturnType<typeof useLanguage>["t"]["admin"]["applications"];
  locale: Locale | undefined;
}) {
  const [notes, setNotes] = useState(application.admin_notes);
  const [saving, setSaving] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);
  const [error, setError] = useState("");

  async function changeStatus(status: AcademyStatus) {
    setError("");
    setSaving(true);
    try {
      onUpdated(await adminUpdateApplication(application.id, { status }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    setError("");
    setSaving(true);
    try {
      onUpdated(await adminUpdateApplication(application.id, { admin_notes: notes }));
      setSavedNotes(true);
      setTimeout(() => setSavedNotes(false), 2000);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(labels.confirmDelete)) return;
    try {
      await adminDeleteApplication(application.id);
      onDeleted(application.id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-zinc-900 text-sm">{application.full_name}</span>
            <span className={cn(
              "text-[11px] px-2 py-0.5 rounded-full border font-medium",
              statusStyles[application.status],
            )}>
              {labels.statusLabels[application.status]}
            </span>
          </div>
          <a
            href={`tel:${application.phone}`}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mt-1"
          >
            <Phone className="w-3.5 h-3.5" />
            {application.phone}
          </a>
        </div>
        <button
          onClick={remove}
          className="text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0"
          title={labels.delete}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500 mb-3">
        <span>
          <span className="text-zinc-400">{labels.program}: </span>
          <span className="font-medium text-zinc-800">{application.program_display}</span>
        </span>
        <span>
          <span className="text-zinc-400">{labels.submitted}: </span>
          {format(new Date(application.created_at), "d MMM yyyy, HH:mm", { locale })}
        </span>
      </div>

      {application.message && (
        <p className="text-sm text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap">
          {application.message}
        </p>
      )}

      {/* Status switcher */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {ACADEMY_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => changeStatus(s)}
            disabled={saving || s === application.status}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:cursor-default",
              s === application.status
                ? statusStyles[s]
                : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800",
            )}
          >
            {labels.statusLabels[s]}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-zinc-400 block">{labels.notes}</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSavedNotes(false); }}
          placeholder={labels.notesPlaceholder}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/20"
        />
        {notes !== application.admin_notes && (
          <button
            onClick={saveNotes}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {labels.saveNotes}
          </button>
        )}
        {savedNotes && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Check className="w-3 h-3" /> OK
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const { t, language } = useLanguage();
  const labels = t.admin.applications;
  const locale = language === "ru" ? ruLocale : undefined;

  const [applications, setApplications] = useState<AcademyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AcademyStatus | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    adminGetApplications(filter ? { status: filter } : {})
      .then(setApplications)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [filter]);

  function handleUpdated(updated: AcademyApplication) {
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  function handleDeleted(id: number) {
    setApplications((prev) => prev.filter((a) => a.id !== id));
  }

  const newCount = applications.filter((a) => a.status === "new").length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="bg-white border-b border-zinc-200 px-4 md:px-6 py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-zinc-900">{labels.title}</h1>
          {newCount > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {newCount} {labels.statusLabels.new.toLowerCase()}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          <button
            onClick={() => setFilter("")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filter === "" ? "bg-black text-white border-black" : "border-zinc-200 text-zinc-500 hover:text-zinc-900",
            )}
          >
            {labels.all}
          </button>
          {ACADEMY_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                filter === s ? "bg-black text-white border-black" : "border-zinc-200 text-zinc-500 hover:text-zinc-900",
              )}
            >
              {labels.statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-6 py-5 max-w-2xl space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 text-center py-16">{error}</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-16">{labels.empty}</p>
        ) : (
          applications.map((a) => (
            <ApplicationCard
              key={a.id}
              application={a}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              labels={labels}
              locale={locale}
            />
          ))
        )}
      </div>
    </div>
  );
}
