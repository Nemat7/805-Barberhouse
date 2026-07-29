from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from apps.barbers.models import BarberProfile, Service
from apps.barbers.serializers import BarberSerializer, ServiceSerializer
from apps.users.serializers import UserProfileSerializer

from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    client = UserProfileSerializer(read_only=True)
    barber = BarberSerializer(read_only=True)
    services = ServiceSerializer(many=True, read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "client", "barber", "services",
            "date", "start_time", "end_time",
            "total_price", "total_duration", "status",
            "notes", "cancelled_reason", "created_at", "updated_at",
        ]


class CreateBookingSerializer(serializers.Serializer):
    barber_id = serializers.IntegerField()
    service_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1, max_length=10
    )
    date = serializers.DateField()
    start_time = serializers.TimeField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    # Admin-only: create a booking on behalf of a walk-in client
    client_phone = serializers.CharField(required=False, allow_blank=True)
    client_name = serializers.CharField(required=False, allow_blank=True)

    def validate_date(self, value):
        today = timezone.localdate()
        max_date = today + timedelta(days=settings.BOOKING_MAX_DAYS_AHEAD)
        if value < today:
            raise serializers.ValidationError("Нельзя записаться на прошедшую дату.")
        if value > max_date:
            raise serializers.ValidationError(
                f"Нельзя записаться более чем на {settings.BOOKING_MAX_DAYS_AHEAD} дней вперёд."
            )
        return value

    def validate(self, attrs):
        # Validate barber
        try:
            attrs["barber"] = BarberProfile.objects.get(
                pk=attrs["barber_id"], is_active=True
            )
        except BarberProfile.DoesNotExist:
            raise serializers.ValidationError({"barber_id": "Барбер не найден."})

        # Validate services
        services = list(
            Service.objects.filter(pk__in=attrs["service_ids"], is_active=True)
            .prefetch_related("category_prices")
        )
        if len(services) != len(set(attrs["service_ids"])):
            raise serializers.ValidationError({"service_ids": "Одна или несколько услуг не найдены."})
        attrs["services"] = services

        # Calculate total duration and end_time
        total_minutes = sum(s.duration_minutes for s in services)
        start_dt = datetime.combine(attrs["date"], attrs["start_time"])
        end_dt = start_dt + timedelta(minutes=total_minutes)
        attrs["total_duration"] = total_minutes
        attrs["end_time"] = end_dt.time()
        # Priced against the chosen barber's category, never trusting the client
        attrs["total_price"] = sum(
            s.price_for(attrs["barber"].category) for s in services
        )

        return attrs


class RescheduleSerializer(serializers.Serializer):
    date = serializers.DateField()
    start_time = serializers.TimeField()

    def validate_date(self, value):
        today = timezone.localdate()
        max_date = today + timedelta(days=settings.BOOKING_MAX_DAYS_AHEAD)
        if value < today:
            raise serializers.ValidationError("Нельзя перенести на прошедшую дату.")
        if value > max_date:
            raise serializers.ValidationError("Дата слишком далеко.")
        return value


class CancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class AvailabilitySerializer(serializers.Serializer):
    barber_id = serializers.IntegerField()
    date = serializers.DateField()
    service_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1
    )
