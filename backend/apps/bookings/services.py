import logging
from datetime import date, datetime, timedelta
from typing import List

from django.conf import settings
from django.utils import timezone

from apps.barbers.models import BarberProfile, ScheduleOverride, WeeklySchedule
from apps.users.services import send_sms

from .models import Booking

logger = logging.getLogger("bookings")


# ── Availability ──────────────────────────────────────────────────────────────

def get_barber_hours(barber_id: int, target_date: date):
    """
    Returns (start_time, end_time, is_day_off) for a barber on a specific date.
    ScheduleOverride takes priority over WeeklySchedule.
    """
    try:
        override = ScheduleOverride.objects.get(barber_id=barber_id, date=target_date)
        if override.is_day_off:
            return None, None, True
        return override.start_time, override.end_time, False
    except ScheduleOverride.DoesNotExist:
        pass

    day_of_week = target_date.weekday()  # 0 = Monday
    try:
        schedule = WeeklySchedule.objects.get(barber_id=barber_id, day_of_week=day_of_week)
        if schedule.is_day_off:
            return None, None, True
        return schedule.start_time, schedule.end_time, False
    except WeeklySchedule.DoesNotExist:
        return None, None, True  # No schedule entry → treat as day off


def get_available_slots(barber_id: int, target_date: date, duration_minutes: int) -> List[str]:
    """
    Return list of available start times ('HH:MM') for a barber on a given date,
    given that the appointment will last `duration_minutes`.
    """
    today = timezone.localdate()

    if target_date < today:
        return []
    if target_date > today + timedelta(days=settings.BOOKING_MAX_DAYS_AHEAD):
        return []

    start_time, end_time, is_day_off = get_barber_hours(barber_id, target_date)
    if is_day_off:
        return []

    # Existing confirmed bookings for this barber on this date
    booked = list(
        Booking.objects.filter(
            barber_id=barber_id,
            date=target_date,
            status=Booking.STATUS_CONFIRMED,
        ).values_list("start_time", "end_time")
    )

    step = timedelta(minutes=settings.BOOKING_SLOT_STEP_MINUTES)
    duration = timedelta(minutes=duration_minutes)

    slot_start_dt = datetime.combine(target_date, start_time)
    boundary_dt = datetime.combine(target_date, end_time)

    # If today, advance the starting cursor to the next clean slot boundary
    if target_date == today:
        now = timezone.localtime()
        now_dt = datetime.combine(target_date, now.time())
        # Round up to next step boundary
        remainder = now_dt.minute % settings.BOOKING_SLOT_STEP_MINUTES
        if remainder:
            now_dt += timedelta(minutes=settings.BOOKING_SLOT_STEP_MINUTES - remainder)
        now_dt = now_dt.replace(second=0, microsecond=0)
        slot_start_dt = max(slot_start_dt, now_dt)

    available = []
    current = slot_start_dt

    while current + duration <= boundary_dt:
        slot_s = current.time()
        slot_e = (current + duration).time()

        conflict = any(
            slot_s < b_end and slot_e > b_start
            for b_start, b_end in booked
        )
        if not conflict:
            available.append(current.strftime("%H:%M"))

        current += step

    return available


# ── SMS notifications ─────────────────────────────────────────────────────────

def notify_booking_confirmed(booking: Booking) -> None:
    services_str = ", ".join(
        s.name_ru for s in booking.services.all()
    )
    msg = (
        f"Запись подтверждена!\n"
        f"Дата: {booking.date.strftime('%d.%m.%Y')}, {booking.start_time.strftime('%H:%M')}\n"
        f"Барбер: {booking.barber.user.full_name}\n"
        f"Услуги: {services_str}\n"
        f"Сумма: {booking.total_price} сомони"
    )
    send_sms(booking.client.phone, msg)
    logger.info(f"Booking confirmed SMS sent | booking_id={booking.pk}")


def notify_booking_cancelled(booking: Booking) -> None:
    msg = (
        f"Ваша запись на {booking.date.strftime('%d.%m.%Y')} "
        f"в {booking.start_time.strftime('%H:%M')} отменена."
    )
    if booking.cancelled_reason:
        msg += f" Причина: {booking.cancelled_reason}"
    send_sms(booking.client.phone, msg)
    logger.info(f"Booking cancelled SMS sent | booking_id={booking.pk}")


def notify_booking_rescheduled(booking: Booking) -> None:
    msg = (
        f"Ваша запись перенесена.\n"
        f"Новая дата: {booking.date.strftime('%d.%m.%Y')}, "
        f"{booking.start_time.strftime('%H:%M')}\n"
        f"Барбер: {booking.barber.user.full_name}"
    )
    send_sms(booking.client.phone, msg)
    logger.info(f"Booking rescheduled SMS sent | booking_id={booking.pk}")
