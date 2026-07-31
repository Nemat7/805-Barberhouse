from django.db import models


class AcademyApplication(models.Model):
    """A request from the public Academy page to join a training program."""

    # Keys match the program ids used by the Academy page on the frontend.
    PROGRAM_LITTLE_BARBER = "little-barber"
    PROGRAM_BARBER = "barber"
    PROGRAM_TOP_BARBER = "top-barber"
    PROGRAM_UNDECIDED = "undecided"

    PROGRAM_CHOICES = [
        (PROGRAM_LITTLE_BARBER, "Little Barber"),
        (PROGRAM_BARBER, "Barber"),
        (PROGRAM_TOP_BARBER, "Top Barber"),
        (PROGRAM_UNDECIDED, "Not decided yet"),
    ]

    STATUS_NEW = "new"
    STATUS_CONTACTED = "contacted"
    STATUS_ENROLLED = "enrolled"
    STATUS_REJECTED = "rejected"

    STATUS_CHOICES = [
        (STATUS_NEW, "New"),
        (STATUS_CONTACTED, "Contacted"),
        (STATUS_ENROLLED, "Enrolled"),
        (STATUS_REJECTED, "Rejected"),
    ]

    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, db_index=True)
    program = models.CharField(
        max_length=30, choices=PROGRAM_CHOICES, default=PROGRAM_UNDECIDED
    )
    message = models.TextField(blank=True, help_text="What the applicant told us")

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW, db_index=True
    )
    admin_notes = models.TextField(blank=True, help_text="Internal notes, not shown to the applicant")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "academy"
        db_table = "academy_applications"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]
        verbose_name = "Academy Application"
        verbose_name_plural = "Academy Applications"

    def __str__(self):
        return f"{self.full_name} ({self.phone}) — {self.get_program_display()}"
