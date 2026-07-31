from django.contrib import admin

from .models import AcademyApplication


@admin.register(AcademyApplication)
class AcademyApplicationAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "program", "status", "created_at")
    list_filter = ("status", "program", "created_at")
    search_fields = ("full_name", "phone")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
