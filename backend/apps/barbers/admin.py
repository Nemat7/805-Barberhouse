from django.contrib import admin

from .models import BarberProfile, ScheduleOverride, Service, WeeklySchedule


class WeeklyScheduleInline(admin.TabularInline):
    model = WeeklySchedule
    extra = 0
    ordering = ("day_of_week",)


class ScheduleOverrideInline(admin.TabularInline):
    model = ScheduleOverride
    extra = 0
    ordering = ("date",)


@admin.register(BarberProfile)
class BarberProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "specialty", "is_active")
    list_filter = ("is_active",)
    search_fields = ("user__full_name", "user__phone")
    inlines = [WeeklyScheduleInline, ScheduleOverrideInline]


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name_ru", "price", "duration_minutes", "is_active", "order")
    list_filter = ("is_active",)
    list_editable = ("order", "is_active")
    ordering = ("order",)


@admin.register(WeeklySchedule)
class WeeklyScheduleAdmin(admin.ModelAdmin):
    list_display = ("barber", "day_of_week", "start_time", "end_time", "is_day_off")
    list_filter = ("day_of_week", "is_day_off")


@admin.register(ScheduleOverride)
class ScheduleOverrideAdmin(admin.ModelAdmin):
    list_display = ("barber", "date", "start_time", "end_time", "is_day_off", "reason")
    list_filter = ("is_day_off",)
    ordering = ("-date",)
