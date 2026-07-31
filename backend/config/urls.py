from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("django-admin/", admin.site.urls),

    # API v1
    path("api/v1/auth/", include("apps.users.urls")),
    path("api/v1/", include("apps.barbers.urls")),
    path("api/v1/", include("apps.bookings.urls")),
    path("api/v1/", include("apps.academy.urls")),

    # Auto-generated API docs (Swagger UI)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # No separate web server sits in front of Django on Railway, so uploaded
    # barber photos are served here. Fine at this volume (a few dozen images).
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]
