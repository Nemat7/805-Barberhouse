from django.db import models

from apps.barbers.models import BarberProfile, Service
from apps.users.models import User


class Booking(models.Model):
    STATUS_CONFIRMED = "confirmed"
    STATUS_CANCELLED = "cancelled"
    STATUS_COMPLETED = "completed"
    STATUS_RESCHEDULED = "rescheduled"

    STATUS_CHOICES = [
        (STATUS_CONFIRMED, "Confirmed / Подтверждено"),
        (STATUS_CANCELLED, "Cancelled / Отменено"),
        (STATUS_COMPLETED, "Completed / Завершено"),
        (STATUS_RESCHEDULED, "Rescheduled / Перенесено"),
    ]

    client = models.ForeignKey(User, on_delete=models.PROTECT, related_name="bookings")
    barber = models.ForeignKey(BarberProfile, on_delete=models.PROTECT, related_name="bookings")
    services = models.ManyToManyField(Service, related_name="bookings")

    date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()  # start_time + sum of service durations
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_duration = models.PositiveIntegerField(help_text="Total duration in minutes")

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_CONFIRMED, db_index=True
    )
    notes = models.TextField(blank=True)
    cancelled_reason = models.CharField(max_length=300, blank=True)

    # NULL → client booked themselves; set → admin created a manual/walk-in booking
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_bookings",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "bookings"
        db_table = "bookings"
        ordering = ["date", "start_time"]
        indexes = [
            models.Index(fields=["barber", "date", "status"]),
            models.Index(fields=["client", "status"]),
            models.Index(fields=["date", "status"]),
        ]
        verbose_name = "Booking"
        verbose_name_plural = "Bookings"

    def __str__(self):
        return (
            f"{self.client.full_name} → {self.barber} | "
            f"{self.date} {self.start_time}–{self.end_time}"
        )
