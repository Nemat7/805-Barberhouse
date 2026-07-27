const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Absolute URL for an uploaded file (barber photos), which the API returns as a path. */
export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${BASE}${path}`;
}

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access");
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(`API ${status}`);
  }
}

function extractMessage(body: Record<string, unknown>): string {
  if (typeof body.error === "string") return body.error;
  if (typeof body.detail === "string") return body.detail;
  const first = Object.values(body)[0];
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  return "Что-то пошло не так.";
}

export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return extractMessage(err.body);
  if (err instanceof Error) return err.message;
  return "Неизвестная ошибка.";
}

// ── JWT-aware fetch ───────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (res.status === 401 && retry) {
    const ok = await tryRefresh();
    if (ok) return apiFetch(path, opts, false);
    clearTokens();
    throw new ApiError(401, { detail: "Session expired" });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body as Record<string, unknown>);
  }

  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  const refresh =
    typeof window !== "undefined" ? localStorage.getItem("refresh") : null;
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE}/api/v1/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access, data.refresh ?? refresh);
    return true;
  } catch {
    return false;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Barber {
  id: number;
  full_name: string;
  phone: string;
  photo: string | null;
  specialty: string;
  bio: string;
  is_active: boolean;
}

export interface Service {
  id: number;
  name_ru: string;
  name_en: string;
  description_ru: string;
  description_en: string;
  price: string;
  duration_minutes: number;
  is_active: boolean;
  order: number;
}

export interface BookingResult {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  total_price: string;
  total_duration: number;
  status: string;
  notes: string;
  cancelled_reason: string;
  created_at: string;
  client: { id: number; full_name: string; phone: string };
  barber: { id: number; full_name: string; specialty: string; photo: string | null };
  services: { id: number; name_ru: string; name_en: string }[];
}

export interface WeeklySchedule {
  id?: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_day_off: boolean;
}

export interface ScheduleOverride {
  id?: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_day_off: boolean;
  reason: string;
}

export interface UserProfile {
  id: number;
  full_name: string;
  phone: string;
  role: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function staffLogin(phone: string, password: string): Promise<{
  access: string;
  refresh: string;
  user: { id: number; full_name: string; phone: string; role: string; barber_profile_id: number | null };
}> {
  const res = await fetch(`${BASE}/api/v1/auth/staff-login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body as Record<string, unknown>);
  }
  return res.json();
}

export async function sendOtp(phone: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/auth/send-otp/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body as Record<string, unknown>);
  }
}

export async function verifyOtp(
  phone: string,
  code: string,
  fullName: string,
): Promise<{ access: string; refresh: string; user: UserProfile & { role: string } }> {
  const res = await fetch(`${BASE}/api/v1/auth/verify-otp/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code, full_name: fullName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body as Record<string, unknown>);
  }
  return res.json();
}

// ── Barbers & Services ────────────────────────────────────────────────────────

export async function getBarbers(): Promise<Barber[]> {
  return apiFetch("/api/v1/barbers/");
}

export async function getServices(): Promise<Service[]> {
  return apiFetch("/api/v1/services/");
}

// ── Availability ──────────────────────────────────────────────────────────────

export async function getAvailability(
  barberId: number,
  date: string,
  serviceIds: number[],
): Promise<{ available_slots: string[]; total_duration_minutes: number }> {
  const params = new URLSearchParams({ barber_id: String(barberId), date });
  serviceIds.forEach((id) => params.append("service_ids", String(id)));
  return apiFetch(`/api/v1/availability/?${params}`);
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile> {
  return apiFetch("/api/v1/auth/profile/");
}

// ── My Bookings ───────────────────────────────────────────────────────────────

export async function getMyBookings(): Promise<BookingResult[]> {
  return apiFetch("/api/v1/bookings/my/");
}

export async function cancelBooking(
  pk: number,
  reason?: string,
): Promise<BookingResult> {
  return apiFetch(`/api/v1/bookings/${pk}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? "" }),
  });
}

export async function rescheduleBooking(
  pk: number,
  date: string,
  startTime: string,
): Promise<BookingResult> {
  return apiFetch(`/api/v1/bookings/${pk}/reschedule/`, {
    method: "POST",
    body: JSON.stringify({ date, start_time: startTime }),
  });
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export async function createBooking(payload: {
  barber_id: number;
  service_ids: number[];
  date: string;
  start_time: string;
  notes?: string;
}): Promise<BookingResult> {
  return apiFetch("/api/v1/bookings/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createBookingPublic(payload: {
  barber_id: number;
  service_ids: number[];
  date: string;
  start_time: string;
  client_phone: string;
  client_name: string;
  notes?: string;
}): Promise<BookingResult> {
  const res = await fetch(`${BASE}/api/v1/bookings/public/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body as Record<string, unknown>);
  }
  return res.json();
}

// ── Admin: bookings ───────────────────────────────────────────────────────────

export async function adminGetBookings(params: {
  date?: string;
  barber_id?: number | string;
  status?: string;
} = {}): Promise<BookingResult[]> {
  const p = new URLSearchParams();
  if (params.date) p.set("date", params.date);
  if (params.barber_id) p.set("barber_id", String(params.barber_id));
  if (params.status) p.set("status", params.status);
  return apiFetch(`/api/v1/admin/bookings/?${p}`);
}

export async function adminGetBooking(pk: number): Promise<BookingResult> {
  return apiFetch(`/api/v1/admin/bookings/${pk}/`);
}

export async function adminUpdateBooking(
  pk: number,
  data: {
    action: "cancel" | "complete" | "reschedule";
    reason?: string;
    date?: string;
    start_time?: string;
  },
): Promise<BookingResult> {
  return apiFetch(`/api/v1/admin/bookings/${pk}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function adminCreateBooking(payload: {
  barber_id: number;
  service_ids: number[];
  date: string;
  start_time: string;
  client_phone: string;
  client_name?: string;
  notes?: string;
}): Promise<BookingResult> {
  return apiFetch("/api/v1/admin/bookings/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Admin: barbers ────────────────────────────────────────────────────────────

export async function adminCreateBarber(data: {
  full_name: string;
  phone: string;
  password: string;
  specialty?: string;
  bio?: string;
}): Promise<Barber> {
  return apiFetch("/api/v1/admin/barbers/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function adminUpdateBarber(
  pk: number,
  data: { specialty?: string; bio?: string; is_active?: boolean },
): Promise<Barber> {
  return apiFetch(`/api/v1/admin/barbers/${pk}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function adminGetSchedule(barberPk: number): Promise<WeeklySchedule[]> {
  return apiFetch(`/api/v1/admin/barbers/${barberPk}/schedule/`);
}

export async function adminSaveSchedule(
  barberPk: number,
  schedule: Omit<WeeklySchedule, "id">[],
): Promise<WeeklySchedule[]> {
  return apiFetch(`/api/v1/admin/barbers/${barberPk}/schedule/`, {
    method: "PUT",
    body: JSON.stringify(schedule),
  });
}

export async function adminGetOverrides(barberPk: number): Promise<ScheduleOverride[]> {
  return apiFetch(`/api/v1/admin/barbers/${barberPk}/overrides/`);
}

export async function adminCreateOverride(
  barberPk: number,
  data: Omit<ScheduleOverride, "id">,
): Promise<ScheduleOverride> {
  return apiFetch(`/api/v1/admin/barbers/${barberPk}/overrides/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function adminDeleteOverride(
  barberPk: number,
  overridePk: number,
): Promise<void> {
  return apiFetch(`/api/v1/admin/barbers/${barberPk}/overrides/${overridePk}/`, {
    method: "DELETE",
  });
}

// ── Admin: services ───────────────────────────────────────────────────────────

export async function adminGetServices(): Promise<Service[]> {
  return apiFetch("/api/v1/admin/services/");
}

export async function adminCreateService(data: {
  name_ru: string;
  name_en: string;
  description_ru: string;
  description_en: string;
  price: string;
  duration_minutes: number;
  order?: number;
}): Promise<Service> {
  return apiFetch("/api/v1/admin/services/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function adminUpdateService(
  pk: number,
  data: Partial<Service>,
): Promise<Service> {
  return apiFetch(`/api/v1/admin/services/${pk}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
