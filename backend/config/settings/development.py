from .base import *  # noqa

DEBUG = True
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True

# In development, OTP codes are printed to console — no real SMS sent
# unless OSONSMS_FORCE_SEND=True in .env
