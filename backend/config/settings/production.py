from decouple import config
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa

# Never fall back to the local-dev database defaults in production — that
# surfaces as a confusing "connection to localhost refused" traceback.
if not DATABASE_URL:  # noqa: F405
    raise ImproperlyConfigured(
        "DATABASE_URL is not set. On Railway, add a variable on the web "
        "service referencing the database: DATABASE_URL=${{Postgres.DATABASE_URL}}"
    )


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

if not ALLOWED_HOSTS:
    # Otherwise Django rejects every request with an opaque 400 and no log line.
    raise ImproperlyConfigured(
        "ALLOWED_HOSTS is empty. Set it to the deployed domain, e.g. "
        "ALLOWED_HOSTS=my-app.up.railway.app (comma-separated for several)."
    )

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
