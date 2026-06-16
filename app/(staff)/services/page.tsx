"use client";

import { useState, useEffect } from "react";
import { Loader2, Pencil, Check, X, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import {
  adminGetServices,
  adminCreateService,
  adminUpdateService,
  Service,
} from "@/lib/api";

// ── Service form ──────────────────────────────────────────────────────────────

interface ServiceFormData {
  name_ru: string;
  name_en: string;
  description_ru: string;
  description_en: string;
  price: string;
  duration_minutes: number;
  is_active: boolean;
}

const emptyForm = (): ServiceFormData => ({
  name_ru: "",
  name_en: "",
  description_ru: "",
  description_en: "",
  price: "",
  duration_minutes: 30,
  is_active: true,
});

function ServiceForm({
  initial,
  onSave,
  onCancel,
  saving,
  labels,
}: {
  initial: ServiceFormData;
  onSave: (data: ServiceFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  labels: {
    nameRu: string; nameEn: string; descRu: string; descEn: string;
    price: string; duration: string; active: string; save: string; cancel: string;
  };
}) {
  const [form, setForm] = useState<ServiceFormData>(initial);

  function field(key: keyof ServiceFormData, label: string, type: "text" | "number" | "textarea" = "text") {
    return (
      <div key={key}>
        <label className="text-xs text-zinc-500 mb-1.5 block">{label}</label>
        {type === "textarea" ? (
          <textarea
            rows={2}
            value={String(form[key])}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/20"
          />
        ) : (
          <input
            type={type}
            value={String(form[key])}
            onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {field("name_ru", labels.nameRu)}
        {field("name_en", labels.nameEn)}
        {field("description_ru", labels.descRu, "textarea")}
        {field("description_en", labels.descEn, "textarea")}
        {field("price", labels.price)}
        {field("duration_minutes", labels.duration, "number")}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          className="rounded"
        />
        <span className="text-sm text-zinc-700">{labels.active}</span>
      </label>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          {labels.cancel}
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name_ru.trim() || !form.name_en.trim() || !form.price.trim()}
          className="flex-1 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {labels.save}
        </button>
      </div>
    </div>
  );
}

// ── Service row ───────────────────────────────────────────────────────────────

function ServiceRow({
  service,
  onUpdated,
  labels,
}: {
  service: Service;
  onUpdated: (s: Service) => void;
  labels: {
    nameRu: string; nameEn: string; descRu: string; descEn: string;
    price: string; duration: string; active: string; save: string; cancel: string;
    edit: string; deactivate: string; activate: string;
  };
}) {
  const { language } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function save(data: ServiceFormData) {
    setSaving(true);
    try {
      const updated = await adminUpdateService(service.id, data);
      onUpdated(updated);
      setEditing(false);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  async function toggle() {
    setToggling(true);
    try {
      const updated = await adminUpdateService(service.id, { is_active: !service.is_active });
      onUpdated(updated);
    } catch {
    } finally {
      setToggling(false);
    }
  }

  const name = language === "ru" ? service.name_ru : service.name_en;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-5 py-4">
        {!editing ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold text-sm ${service.is_active ? "text-zinc-900" : "text-zinc-400"}`}>{name}</span>
                {!service.is_active && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-400">Inactive</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span>{service.duration_minutes} min</span>
                <span>·</span>
                <span className="font-medium text-zinc-700">{service.price} сом</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={toggle}
                disabled={toggling}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                title={service.is_active ? labels.deactivate : labels.activate}
              >
                {toggling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : service.is_active ? (
                  <ToggleRight className="w-5 h-5 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-900">{labels.edit}</h3>
              <button onClick={() => setEditing(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ServiceForm
              initial={{
                name_ru: service.name_ru,
                name_en: service.name_en,
                description_ru: service.description_ru,
                description_en: service.description_en,
                price: service.price,
                duration_minutes: service.duration_minutes,
                is_active: service.is_active,
              }}
              onSave={save}
              onCancel={() => setEditing(false)}
              saving={saving}
              labels={labels}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const { t } = useLanguage();
  const ts = t.admin.services;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [savingNew, setSavingNew] = useState(false);

  useEffect(() => {
    adminGetServices()
      .then(setServices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleUpdated(updated: Service) {
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function create(data: ServiceFormData) {
    setSavingNew(true);
    try {
      const created = await adminCreateService({
        ...data,
        order: services.length + 1,
      });
      setServices((prev) => [...prev, created]);
      setAdding(false);
    } catch {
    } finally {
      setSavingNew(false);
    }
  }

  const formLabels = {
    nameRu: ts.nameRu,
    nameEn: ts.nameEn,
    descRu: ts.descRu,
    descEn: ts.descEn,
    price: ts.price,
    duration: ts.duration,
    active: ts.active,
    save: ts.save,
    cancel: ts.cancel,
    edit: ts.editService,
    deactivate: ts.deactivate,
    activate: ts.activate,
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="bg-white border-b border-zinc-200 px-4 md:px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-900">{ts.title}</h1>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {ts.addService}
          </button>
        )}
      </div>

      <div className="px-4 md:px-6 py-5 max-w-2xl space-y-3">
        {/* Add new service form */}
        {adding && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-900">{ts.newService}</h3>
              <button onClick={() => setAdding(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ServiceForm
              initial={emptyForm()}
              onSave={create}
              onCancel={() => setAdding(false)}
              saving={savingNew}
              labels={formLabels}
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : services.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-16">No services yet.</p>
        ) : (
          services
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <ServiceRow key={s.id} service={s} onUpdated={handleUpdated} labels={formLabels} />
            ))
        )}
      </div>
    </div>
  );
}
