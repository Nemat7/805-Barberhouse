import logging
from datetime import datetime, timedelta

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.barbers.models import Service
from apps.users.models import User
from apps.users.permissions import IsAdmin, IsAdminOrBarber
from apps.users.services import get_or_create_user

from .models import Booking
from .serializers import (
    AvailabilitySerializer,
    BookingSerializer,
    CancelSerializer,
    CreateBookingSerializer,
    RescheduleSerializer,
)
from .services import (
    get_available_slots,
    notify_booking_cancelled,
    notify_booking_confirmed,
    notify_booking_rescheduled,
)

logger = logging.getLogger("bookings")


# ── Public: availability ──────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([AllowAny])
def availability(request):
    """
    GET /api/v1/availability/?barber_id=1&date=2026-06-01&service_ids=1,2
    Returns list of available start times for the given barber, date, and services.
    """
    serializer = AvailabilitySerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data
    services = list(Service.objects.filter(pk__in=data["service_ids"], is_active=True))
    if not services:
        return Response({"error": "Услуги не найдены."}, status=status.HTTP_400_BAD_REQUEST)

    total_minutes = sum(s.duration_minutes for s in services)
    slots = get_available_slots(data["barber_id"], data["date"], total_minutes)

    return Response({"available_slots": slots, "total_duration_minutes": total_minutes})


# ── Client: own bookings ──────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_bookings(request):
    """List the authenticated client's bookings."""
    bookings = (
        Booking.objects.filter(client=request.user)
        .select_related("client", "barber__user")
        .prefetch_related("services")
        .order_by("-date", "-start_time")
    )
    return Response(BookingSerializer(bookings, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_booking(request):
    """Client creates a booking for themselves."""
    serializer = CreateBookingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    booking = _create_booking_atomic(
        client=request.user,
        barber=d["barber"],
        services=d["services"],
        date=d["date"],
        start_time=d["start_time"],
        end_time=d["end_time"],
        total_duration=d["total_duration"],
        total_price=d["total_price"],
        notes=d.get("notes", ""),
        created_by=None,
    )
    if booking is None:
        return Response(
            {"error": "Это время уже занято. Пожалуйста, выберите другое."},
            status=status.HTTP_409_CONFLICT,
        )

    notify_booking_confirmed(booking)
    logger.info(f"Booking created | id={booking.pk} client={request.user.pk}")
    return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_booking(request, pk):
    """Client cancels their own booking."""
    try:
        booking = Booking.objects.get(pk=pk, client=request.user)
    except Booking.DoesNotExist:
        return Response({"error": "Запись не найдена."}, status=status.HTTP_404_NOT_FOUND)

    if booking.status not in Booking.ACTIVE_STATUSES:
        return Response(
            {"error": "Только активные записи можно отменить."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = CancelSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    booking.status = Booking.STATUS_CANCELLED
    booking.cancelled_reason = serializer.validated_data.get("reason", "")
    booking.save(update_fields=["status", "cancelled_reason", "updated_at"])

    notify_booking_cancelled(booking)
    logger.info(f"Booking cancelled by client | id={booking.pk}")
    return Response(BookingSerializer(booking).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reschedule_booking(request, pk):
    """Client reschedules their own booking."""
    try:
        booking = Booking.objects.get(pk=pk, client=request.user)
    except Booking.DoesNotExist:
        return Response({"error": "Запись не найдена."}, status=status.HTTP_404_NOT_FOUND)

    if booking.status not in Booking.ACTIVE_STATUSES:
        return Response(
            {"error": "Только активные записи можно перенести."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = RescheduleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    new_date = serializer.validated_data["date"]
    new_start = serializer.validated_data["start_time"]
    new_end = (
        datetime.combine(new_date, new_start) + timedelta(minutes=booking.total_duration)
    ).time()

    updated = _reschedule_atomic(booking, new_date, new_start, new_end)
    if not updated:
        return Response(
            {"error": "Это время уже занято. Пожалуйста, выберите другое."},
            status=status.HTTP_409_CONFLICT,
        )

    notify_booking_rescheduled(booking)
    logger.info(f"Booking rescheduled by client | id={booking.pk}")
    return Response(BookingSerializer(booking).data)


# ── Admin: all bookings ───────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAdminOrBarber])
def admin_booking_list(request):
    """
    Admin → all bookings (filterable by date, barber, status).
    Barber → only their own bookings.
    """
    qs = (
        Booking.objects.select_related("client", "barber__user")
        .prefetch_related("services")
        .order_by("date", "start_time")
    )

    if request.user.role == User.ROLE_BARBER:
        qs = qs.filter(barber=request.user.barber_profile)

    # Filters
    if date_param := request.query_params.get("date"):
        qs = qs.filter(date=date_param)
    if barber_param := request.query_params.get("barber_id"):
        qs = qs.filter(barber_id=barber_param)
    if status_param := request.query_params.get("status"):
        qs = qs.filter(status=status_param)

    return Response(BookingSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def public_create_booking(request):
    """Public guest booking — no auth required. client_phone + client_name identify the client."""
    serializer = CreateBookingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    phone = d.get("client_phone", "").strip()
    name = d.get("client_name", "").strip()
    if not phone:
        return Response({"error": "Номер телефона обязателен."}, status=status.HTTP_400_BAD_REQUEST)

    client, _ = get_or_create_user(phone, name or "Guest")

    booking = _create_booking_atomic(
        client=client,
        barber=d["barber"],
        services=d["services"],
        date=d["date"],
        start_time=d["start_time"],
        end_time=d["end_time"],
        total_duration=d["total_duration"],
        total_price=d["total_price"],
        notes=d.get("notes", ""),
        created_by=None,
    )
    if booking is None:
        return Response(
            {"error": "Это время уже занято. Пожалуйста, выберите другое."},
            status=status.HTTP_409_CONFLICT,
        )

    notify_booking_confirmed(booking)
    logger.info(f"Public booking created | id={booking.pk} phone={phone}")
    return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAdmin])
def admin_create_booking(request):
    """Admin creates a manual/walk-in booking (can specify client by phone)."""
    serializer = CreateBookingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    # Resolve client: phone provided → find or create; otherwise use request.user
    client = request.user
    if phone := d.get("client_phone"):
        client, _ = get_or_create_user(phone, d.get("client_name", ""))

    booking = _create_booking_atomic(
        client=client,
        barber=d["barber"],
        services=d["services"],
        date=d["date"],
        start_time=d["start_time"],
        end_time=d["end_time"],
        total_duration=d["total_duration"],
        total_price=d["total_price"],
        notes=d.get("notes", ""),
        created_by=request.user,
    )
    if booking is None:
        return Response(
            {"error": "Это время уже занято."},
            status=status.HTTP_409_CONFLICT,
        )

    notify_booking_confirmed(booking)
    logger.info(f"Manual booking created by admin | id={booking.pk} admin={request.user.pk}")
    return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([IsAdmin])
def admin_booking_detail(request, pk):
    """Admin: get or update any booking."""
    try:
        booking = (
            Booking.objects.select_related("client", "barber__user")
            .prefetch_related("services")
            .get(pk=pk)
        )
    except Booking.DoesNotExist:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(BookingSerializer(booking).data)

    # PATCH: admin can reschedule or cancel
    action = request.data.get("action")

    if action == "cancel":
        booking.status = Booking.STATUS_CANCELLED
        booking.cancelled_reason = request.data.get("reason", "Отменено администратором")
        booking.save(update_fields=["status", "cancelled_reason", "updated_at"])
        notify_booking_cancelled(booking)
        logger.info(f"Booking cancelled by admin | id={booking.pk} admin={request.user.pk}")

    elif action == "reschedule":
        serializer = RescheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_date = serializer.validated_data["date"]
        new_start = serializer.validated_data["start_time"]
        new_end = (
            datetime.combine(new_date, new_start) + timedelta(minutes=booking.total_duration)
        ).time()
        updated = _reschedule_atomic(booking, new_date, new_start, new_end)
        if not updated:
            return Response({"error": "Время занято."}, status=status.HTTP_409_CONFLICT)
        notify_booking_rescheduled(booking)
        logger.info(f"Booking rescheduled by admin | id={booking.pk}")

    elif action == "complete":
        booking.status = Booking.STATUS_COMPLETED
        booking.save(update_fields=["status", "updated_at"])

    return Response(BookingSerializer(booking).data)


# ── Atomic helpers ────────────────────────────────────────────────────────────

def _create_booking_atomic(
    client, barber, services, date, start_time, end_time,
    total_duration, total_price, notes, created_by
) -> Booking | None:
    """
    Create a booking inside a transaction with SELECT FOR UPDATE to prevent
    double-booking. Returns None if the slot is already taken.
    """
    with transaction.atomic():
        conflicts = Booking.objects.select_for_update().filter(
            barber=barber,
            date=date,
            status__in=Booking.ACTIVE_STATUSES,
            start_time__lt=end_time,
            end_time__gt=start_time,
        )
        if conflicts.exists():
            return None

        booking = Booking.objects.create(
            client=client,
            barber=barber,
            date=date,
            start_time=start_time,
            end_time=end_time,
            total_price=total_price,
            total_duration=total_duration,
            notes=notes,
            status=Booking.STATUS_CONFIRMED,
            created_by=created_by,
        )
        booking.services.set(services)
    return booking


def _reschedule_atomic(booking: Booking, new_date, new_start, new_end) -> bool:
    """
    Reschedule a booking atomically. Returns False if the new slot is taken.
    """
    with transaction.atomic():
        conflicts = Booking.objects.select_for_update().filter(
            barber=booking.barber,
            date=new_date,
            status__in=Booking.ACTIVE_STATUSES,
            start_time__lt=new_end,
            end_time__gt=new_start,
        ).exclude(pk=booking.pk)

        if conflicts.exists():
            return False

        booking.date = new_date
        booking.start_time = new_start
        booking.end_time = new_end
        booking.status = Booking.STATUS_RESCHEDULED
        booking.save(update_fields=["date", "start_time", "end_time", "status", "updated_at"])
    return True
