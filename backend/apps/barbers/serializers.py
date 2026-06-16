from rest_framework import serializers

from .models import BarberProfile, ScheduleOverride, Service, WeeklySchedule


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = [
            "id", "name_ru", "name_en", "description_ru", "description_en",
            "price", "duration_minutes", "is_active", "order",
        ]


class BarberSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = BarberProfile
        fields = ["id", "full_name", "phone", "photo", "specialty", "bio", "is_active"]


class WeeklyScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklySchedule
        fields = ["id", "day_of_week", "start_time", "end_time", "is_day_off"]

    def validate(self, attrs):
        if not attrs.get("is_day_off"):
            if not attrs.get("start_time") or not attrs.get("end_time"):
                raise serializers.ValidationError(
                    "start_time and end_time are required when is_day_off is False."
                )
            if attrs["start_time"] >= attrs["end_time"]:
                raise serializers.ValidationError("start_time must be before end_time.")
        return attrs


class ScheduleOverrideSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleOverride
        fields = ["id", "date", "start_time", "end_time", "is_day_off", "reason"]

    def validate(self, attrs):
        if not attrs.get("is_day_off"):
            if not attrs.get("start_time") or not attrs.get("end_time"):
                raise serializers.ValidationError(
                    "start_time and end_time are required when is_day_off is False."
                )
            if attrs["start_time"] >= attrs["end_time"]:
                raise serializers.ValidationError("start_time must be before end_time.")
        return attrs


class BarberScheduleSerializer(serializers.ModelSerializer):
    """Full barber info including weekly schedule and overrides."""
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    weekly_schedule = WeeklyScheduleSerializer(many=True, read_only=True)
    schedule_overrides = ScheduleOverrideSerializer(many=True, read_only=True)

    class Meta:
        model = BarberProfile
        fields = [
            "id", "full_name", "photo", "specialty", "is_active",
            "weekly_schedule", "schedule_overrides",
        ]
