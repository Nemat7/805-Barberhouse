from rest_framework import serializers

from apps.users.serializers import validate_tj_phone

from .models import AcademyApplication


class AcademyApplicationSerializer(serializers.ModelSerializer):
    program_display = serializers.CharField(source="get_program_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = AcademyApplication
        fields = [
            "id", "full_name", "phone", "program", "program_display",
            "message", "status", "status_display", "admin_notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CreateAcademyApplicationSerializer(serializers.ModelSerializer):
    """Public submission — the applicant cannot set status or internal notes."""

    class Meta:
        model = AcademyApplication
        fields = ["full_name", "phone", "program", "message"]

    def validate_phone(self, value):
        return validate_tj_phone(value)

    def validate_full_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Укажите имя.")
        return value.strip()
