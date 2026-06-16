from django.db import models

from apps.users.models import User

DAYS_OF_WEEK = [
    (0, "Понедельник / Monday"),
    (1, "Вторник / Tuesday"),
    (2, "Среда / Wednesday"),
    (3, "Четверг / Thursday"),
    (4, "Пятница / Friday"),
    (5, "Суббота / Saturday"),
    (6, "Воскресенье / Sunday"),
]


class BarberProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="barber_profile")
    photo = models.ImageField(upload_to="barbers/", null=True, blank=True)
    specialty = models.CharField(max_length=200)
    bio = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = "barbers"
        db_table = "barber_profiles"
        verbose_name = "Barber"
        verbose_name_plural = "Barbers"

    def __str__(self):
        return self.user.full_name


class Service(models.Model):
    name_ru = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    description_ru = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price in somoni")
    duration_minutes = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0, help_text="Display order")

    class Meta:
        app_label = "barbers"
        db_table = "services"
        ordering = ["order", "name_ru"]
        verbose_name = "Service"
        verbose_name_plural = "Services"

    def __str__(self):
        return f"{self.name_ru} — {self.price} сомони ({self.duration_minutes} мин)"


class WeeklySchedule(models.Model):
    """Recurring weekly working hours for a barber."""
    barber = models.ForeignKey(
        BarberProfile, on_delete=models.CASCADE, related_name="weekly_schedule"
    )
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    is_day_off = models.BooleanField(default=False)

    class Meta:
        app_label = "barbers"
        db_table = "weekly_schedules"
        unique_together = ["barber", "day_of_week"]
        verbose_name = "Weekly Schedule"
        verbose_name_plural = "Weekly Schedules"

    def __str__(self):
        day = dict(DAYS_OF_WEEK)[self.day_of_week]
        if self.is_day_off:
            return f"{self.barber} — {day}: Выходной"
        return f"{self.barber} — {day}: {self.start_time}–{self.end_time}"


class ScheduleOverride(models.Model):
    """One-off date override — takes priority over WeeklySchedule."""
    barber = models.ForeignKey(
        BarberProfile, on_delete=models.CASCADE, related_name="schedule_overrides"
    )
    date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    is_day_off = models.BooleanField(default=False)
    reason = models.CharField(max_length=200, blank=True, help_text="Holiday, sick day, etc.")

    class Meta:
        app_label = "barbers"
        db_table = "schedule_overrides"
        unique_together = ["barber", "date"]
        verbose_name = "Schedule Override"
        verbose_name_plural = "Schedule Overrides"

    def __str__(self):
        if self.is_day_off:
            return f"{self.barber} — {self.date}: Выходной ({self.reason})"
        return f"{self.barber} — {self.date}: {self.start_time}–{self.end_time}"
