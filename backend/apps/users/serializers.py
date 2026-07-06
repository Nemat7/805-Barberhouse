import re

from rest_framework import serializers

from .models import User
from .services import normalize_phone


def validate_tj_phone(value: str) -> str:
    """Normalize and validate Tajik phone number. Accepts input with or without +992."""
    cleaned = normalize_phone(value)
    if not re.fullmatch(r"\+992\d{9}", cleaned):
        raise serializers.ValidationError(
            "Введите 9-значный номер (например 888887444) или в формате +992XXXXXXXXX."
        )
    return cleaned


class SendOTPSerializer(serializers.Serializer):
    phone = serializers.CharField()

    def validate_phone(self, value):
        return validate_tj_phone(value)


class VerifyOTPSerializer(serializers.Serializer):
    phone = serializers.CharField()
    code = serializers.CharField(min_length=4, max_length=6)
    # Only required for new users — ignored for existing ones
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_phone(self, value):
        return validate_tj_phone(value)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "phone", "full_name", "role", "date_joined"]
        read_only_fields = ["id", "phone", "role", "date_joined"]


class UserListSerializer(serializers.ModelSerializer):
    """Minimal user info for admin lists."""
    class Meta:
        model = User
        fields = ["id", "phone", "full_name", "role", "is_active", "date_joined"]
        read_only_fields = fields
