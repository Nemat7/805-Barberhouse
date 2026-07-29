from rest_framework import serializers

from .models import BarberProfile, ScheduleOverride, Service, ServicePrice, WeeklySchedule


class ServiceSerializer(serializers.ModelSerializer):
    """
    `price` is the base price — or, when the serializer is given a `category`
    in context, the price for that barber category. `prices` carries the full
    per-category map, and is writable so admin screens can edit every tier.
    """
    prices = serializers.DictField(
        child=serializers.DecimalField(max_digits=10, decimal_places=2),
        required=False,
    )

    class Meta:
        model = Service
        fields = [
            "id", "name_ru", "name_en", "description_ru", "description_en",
            "price", "prices", "duration_minutes", "is_active", "order",
        ]

    def validate_prices(self, value):
        valid = {key for key, _ in BarberProfile.CATEGORY_CHOICES}
        unknown = set(value) - valid
        if unknown:
            raise serializers.ValidationError(
                f"Unknown categories: {', '.join(sorted(unknown))}."
            )
        return value

    def _save_prices(self, service, prices):
        for category, price in prices.items():
            ServicePrice.objects.update_or_create(
                service=service, category=category, defaults={"price": price}
            )

    def create(self, validated_data):
        prices = validated_data.pop("prices", {})
        service = super().create(validated_data)
        self._save_prices(service, prices)
        return service

    def update(self, instance, validated_data):
        prices = validated_data.pop("prices", None)
        service = super().update(instance, validated_data)
        if prices is not None:
            self._save_prices(service, prices)
        return service

    def to_representation(self, instance):
        data = super().to_representation(instance)
        by_category = {cp.category: str(cp.price) for cp in instance.category_prices.all()}
        data["prices"] = {
            key: by_category.get(key, str(instance.price))
            for key, _ in BarberProfile.CATEGORY_CHOICES
        }
        if category := self.context.get("category"):
            data["price"] = str(instance.price_for(category))
        return data


class BarberSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = BarberProfile
        fields = [
            "id", "full_name", "phone", "photo", "category", "category_display",
            "specialty", "bio", "is_active",
        ]


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
