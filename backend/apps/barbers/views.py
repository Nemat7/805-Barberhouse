from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions import IsAdmin, IsSuperuser

from .models import BarberProfile, ScheduleOverride, Service, WeeklySchedule
from .serializers import (
    BarberScheduleSerializer,
    BarberSerializer,
    ScheduleOverrideSerializer,
    ServiceSerializer,
    WeeklyScheduleSerializer,
)


# ── Public endpoints ──────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([AllowAny])
def barber_list(request):
    """List all active barbers (public)."""
    barbers = BarberProfile.objects.filter(is_active=True).select_related("user")
    return Response(BarberSerializer(barbers, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def service_list(request):
    """List all active services (public)."""
    services = Service.objects.filter(is_active=True)
    return Response(ServiceSerializer(services, many=True).data)


# ── Admin: barber management (superuser only) ─────────────────────────────────

@api_view(["POST"])
@permission_classes([IsSuperuser])
def admin_create_barber(request):
    """Create a new user + barber profile in one step."""
    from apps.users.models import User

    full_name = request.data.get("full_name", "").strip()
    phone     = request.data.get("phone", "").strip()
    password  = request.data.get("password", "").strip()

    if not full_name or not phone or not password:
        return Response(
            {"error": "full_name, phone and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from apps.users.services import normalize_phone
    phone = normalize_phone(phone)

    if User.objects.filter(phone=phone).exists():
        return Response({"error": "A user with this phone already exists."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(
        phone=phone,
        full_name=full_name,
        password=password,
        role=User.ROLE_BARBER,
    )

    specialty = request.data.get("specialty", "")
    bio       = request.data.get("bio", "")

    serializer = BarberSerializer(data={"specialty": specialty, "bio": bio, "is_active": True})
    serializer.is_valid(raise_exception=True)
    barber = serializer.save(user=user)

    return Response(BarberSerializer(barber).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([IsAdmin])
def admin_barber_detail(request, pk):
    """Get or update a barber (admin only)."""
    try:
        barber = BarberProfile.objects.select_related("user").get(pk=pk)
    except BarberProfile.DoesNotExist:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(BarberScheduleSerializer(barber).data)

    serializer = BarberSerializer(barber, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(BarberSerializer(barber).data)


# ── Admin: schedule management ────────────────────────────────────────────────

@api_view(["GET", "PUT"])
@permission_classes([IsAdmin])
def admin_weekly_schedule(request, barber_pk):
    """
    GET  → return all 7 days of weekly schedule for this barber.
    PUT  → replace the full weekly schedule (expects a list of 7 entries).
    """
    try:
        barber = BarberProfile.objects.get(pk=barber_pk)
    except BarberProfile.DoesNotExist:
        return Response({"error": "Barber not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        schedule = WeeklySchedule.objects.filter(barber=barber).order_by("day_of_week")
        return Response(WeeklyScheduleSerializer(schedule, many=True).data)

    # PUT: replace entire weekly schedule
    serializer = WeeklyScheduleSerializer(data=request.data, many=True)
    serializer.is_valid(raise_exception=True)

    WeeklySchedule.objects.filter(barber=barber).delete()
    entries = [
        WeeklySchedule(barber=barber, **entry)
        for entry in serializer.validated_data
    ]
    WeeklySchedule.objects.bulk_create(entries)

    schedule = WeeklySchedule.objects.filter(barber=barber).order_by("day_of_week")
    return Response(WeeklyScheduleSerializer(schedule, many=True).data)


@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def admin_schedule_overrides(request, barber_pk):
    """List or create date overrides for a barber."""
    try:
        barber = BarberProfile.objects.get(pk=barber_pk)
    except BarberProfile.DoesNotExist:
        return Response({"error": "Barber not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        overrides = ScheduleOverride.objects.filter(barber=barber).order_by("date")
        return Response(ScheduleOverrideSerializer(overrides, many=True).data)

    serializer = ScheduleOverrideSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    override, _ = ScheduleOverride.objects.update_or_create(
        barber=barber,
        date=serializer.validated_data["date"],
        defaults=serializer.validated_data,
    )
    return Response(ScheduleOverrideSerializer(override).data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAdmin])
def admin_schedule_override_delete(request, barber_pk, override_pk):
    """Delete a specific date override."""
    try:
        override = ScheduleOverride.objects.get(pk=override_pk, barber_id=barber_pk)
    except ScheduleOverride.DoesNotExist:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    override.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Admin: service management ─────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def admin_service_list(request):
    if request.method == "GET":
        services = Service.objects.all()
        return Response(ServiceSerializer(services, many=True).data)

    serializer = ServiceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    service = serializer.save()
    return Response(ServiceSerializer(service).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAdmin])
def admin_service_detail(request, pk):
    try:
        service = Service.objects.get(pk=pk)
    except Service.DoesNotExist:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(ServiceSerializer(service).data)
    if request.method == "PATCH":
        serializer = ServiceSerializer(service, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    service.is_active = False
    service.save(update_fields=["is_active"])
    return Response(status=status.HTTP_204_NO_CONTENT)
