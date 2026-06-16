import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, phone, full_name, password=None, **extra_fields):
        if not phone:
            raise ValueError("Phone number is required")
        user = self.model(phone=phone, full_name=full_name, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, full_name, password=None, **extra_fields):
        extra_fields.setdefault("role", User.ROLE_SUPERUSER)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(phone, full_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CLIENT = "client"
    ROLE_BARBER = "barber"
    ROLE_ADMIN = "admin"
    ROLE_SUPERUSER = "superuser"

    ROLE_CHOICES = [
        (ROLE_CLIENT, "Client"),
        (ROLE_BARBER, "Barber"),
        (ROLE_ADMIN, "Admin"),
        (ROLE_SUPERUSER, "Superuser"),
    ]

    phone = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_CLIENT)
    # Mobile app push notifications — populated when mobile app is built
    device_token = models.CharField(max_length=255, null=True, blank=True)
    device_platform = models.CharField(max_length=10, null=True, blank=True)  # ios / android
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        app_label = "users"
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.full_name} ({self.phone})"

    @property
    def is_admin_or_above(self):
        return self.role in (self.ROLE_ADMIN, self.ROLE_SUPERUSER)


class OTPCode(models.Model):
    phone = models.CharField(max_length=20, db_index=True)
    code = models.CharField(max_length=6)
    txn_id = models.UUIDField(default=uuid.uuid4, unique=True)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "users"
        db_table = "otp_codes"
        indexes = [
            models.Index(fields=["phone", "is_used"]),
        ]

    def __str__(self):
        return f"OTP for {self.phone} ({'used' if self.is_used else 'active'})"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at
