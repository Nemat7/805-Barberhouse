from decouple import config

from .base import *  # noqa


def _csv(name: str) -> list[str]:
    """Read a comma-separated env var into a clean list (no empty entries)."""
    return [item.strip() for item in config(name, default="").split(",") if item.strip()]


DEBUG = False

ALLOWED_HOSTS = _csv("ALLOWED_HOSTS")
CORS_ALLOWED_ORIGINS = _csv("CORS_ALLOWED_ORIGINS")

# Railway exposes the generated domain here — always trust our own host.
RAILWAY_DOMAIN = config("RAILWAY_PUBLIC_DOMAIN", default="")
if RAILWAY_DOMAIN:
    ALLOWED_HOSTS.append(RAILWAY_DOMAIN)

# Django 4+ requires the scheme for CSRF checks (Django admin login).
CSRF_TRUSTED_ORIGINS = [f"https://{host}" for host in ALLOWED_HOSTS if host != "*"]

# Security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# TLS terminates at the platform proxy, which forwards this header. Without it
# SECURE_SSL_REDIRECT sees plain HTTP internally and loops forever.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
