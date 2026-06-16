from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "client", "barber", "date", "start_time", "end_time",
        "status", "total_price", "total_duration", "created_at",
    )
    list_filter = ("status", "date", "barber")
    search_fields = ("client__full_name", "client__phone", "barber__user__full_name")
    ordering = ("-date", "-start_time")
    readonly_fields = ("created_at", "updated_at", "created_by", "total_price", "total_duration")
    filter_horizontal = ("services",)

    fieldsets = (
        ("Booking", {"fields": ("client", "barber", "services", "date", "start_time", "end_time")}),
        ("Totals", {"fields": ("total_price", "total_duration")}),
        ("Status", {"fields": ("status", "notes", "cancelled_reason")}),
        ("Meta", {"fields": ("created_by", "created_at", "updated_at")}),
    )
