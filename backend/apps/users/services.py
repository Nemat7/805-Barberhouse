import logging
import random
import uuid
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

from .models import OTPCode, User

logger = logging.getLogger("sms")


# ── Phone normalization ───────────────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    """
    Normalise any user-entered phone to +992XXXXXXXXX.
    Accepts '888887444', '992888887444', '+992 88 888 74 44', etc.
    Returns the input stripped if it contains no digits (validation happens elsewhere).
    """
    digits = "".join(c for c in raw if c.isdigit())
    if not digits:
        return raw.strip()
    if digits.startswith("992") and len(digits) == 12:
        return f"+{digits}"
    return f"+992{digits}"


# ── OsonSMS transport ─────────────────────────────────────────────────────────

def _osonsms_send(
    phone: str,
    msg: str,
    txn_id: str,
    is_confidential: bool = False,
) -> tuple[bool, str | None]:
    """
    Low-level call to the OsonSMS gateway. `phone` may be in any format —
    the API expects 992XXXXXXXXX with no '+'.
    Returns (success, user_facing_error_message).
    """
    params = {
        "from": settings.OSONSMS_SENDER,
        "phone_number": "".join(c for c in phone if c.isdigit()),
        "msg": msg,
        "login": settings.OSONSMS_LOGIN,
        "txn_id": txn_id,
    }
    if is_confidential:
        params["is_confidential"] = "true"

    try:
        resp = requests.get(
            settings.OSONSMS_URL,
            headers={"Authorization": f"Bearer {settings.OSONSMS_TOKEN}"},
            params=params,
            timeout=20,
        )
    except requests.RequestException as exc:
        logger.error(f"SMS network error to {phone}: {exc}")
        return False, "SMS-сервис недоступен. Попробуйте позже."

    data = resp.json() if resp.content else {}

    if resp.status_code == 201:
        logger.info(f"SMS sent to {phone} | msg_id={data.get('msg_id')}")
        return True, None

    err = data.get("error", {})
    logger.error(
        f"SMS failed to {phone} | http={resp.status_code} "
        f"code={err.get('code')} msg={err.get('msg')}"
    )
    # 402/119 = out of balance — worth surfacing distinctly for staff to notice
    if resp.status_code == 402:
        return False, "SMS-сервис временно недоступен. Обратитесь к администратору."
    return False, "Не удалось отправить SMS. Попробуйте ещё раз."


# ── OTP sending ───────────────────────────────────────────────────────────────

def send_otp(phone: str) -> tuple[bool, str | None]:
    """
    Send a 4-digit OTP to the given phone via osonsms.
    Returns (success, error_message).
    In DEBUG mode (without OSONSMS_FORCE_SEND), prints code to console instead.
    """
    phone = normalize_phone(phone)

    # Rate limit: max 3 OTP requests per phone per 10 minutes
    recent = OTPCode.objects.filter(
        phone=phone,
        created_at__gte=timezone.now() - timedelta(minutes=10),
    ).count()
    if recent >= 3:
        return False, "Слишком много запросов. Подождите 10 минут."

    code = str(random.randint(1000, 9999))
    txn_id = str(uuid.uuid4())

    OTPCode.objects.create(
        phone=phone,
        code=code,
        txn_id=txn_id,
        expires_at=timezone.now() + timedelta(minutes=5),
    )

    # Development: log code to console, skip real SMS
    if settings.DEBUG and not settings.OSONSMS_FORCE_SEND:
        logger.info(f"[DEV] OTP for {phone}: {code}")
        return True, None

    # Production: send via osonsms (is_confidential → code not stored in their logs)
    return _osonsms_send(
        phone,
        f"Ваш код: {code}. Действителен 5 минут.",
        txn_id,
        is_confidential=True,
    )


def verify_otp(phone: str, code: str) -> tuple[bool, str | None]:
    """
    Verify OTP code. Marks it as used on success.
    Returns (success, error_message).
    """
    phone = normalize_phone(phone)
    try:
        otp = OTPCode.objects.filter(
            phone=phone,
            code=code,
            is_used=False,
        ).latest("created_at")
    except OTPCode.DoesNotExist:
        return False, "Неверный код."

    if otp.is_expired:
        return False, "Код истёк. Запросите новый."

    otp.is_used = True
    otp.save(update_fields=["is_used"])
    return True, None


def get_or_create_user(phone: str, full_name: str | None = None) -> tuple[User, bool]:
    """Get existing user by phone or create a new client account."""
    phone = normalize_phone(phone)
    user, created = User.objects.get_or_create(
        phone=phone,
        defaults={
            "full_name": full_name or "",
            "role": User.ROLE_CLIENT,
        },
    )
    # Update name on first login if provided and user was just created
    if created and full_name:
        user.full_name = full_name
        user.save(update_fields=["full_name"])
    return user, created


# ── Booking notifications ─────────────────────────────────────────────────────

def send_sms(phone: str, message: str, txn_id: str | None = None) -> bool:
    """
    Send a plain (non-OTP) SMS notification.
    Returns True on success.
    """
    if settings.DEBUG and not settings.OSONSMS_FORCE_SEND:
        logger.info(f"[DEV] SMS to {phone}: {message}")
        return True

    ok, _ = _osonsms_send(phone, message, txn_id or str(uuid.uuid4()))
    return ok
