from django.urls import path

from . import views

urlpatterns = [
    # Public
    path("barbers/", views.barber_list, name="barber-list"),
    path("services/", views.service_list, name="service-list"),

    # Admin — barbers
    path("admin/barbers/", views.admin_create_barber, name="admin-create-barber"),
    path("admin/barbers/<int:pk>/", views.admin_barber_detail, name="admin-barber-detail"),

    # Admin — schedules
    path("admin/barbers/<int:barber_pk>/schedule/", views.admin_weekly_schedule, name="admin-weekly-schedule"),
    path("admin/barbers/<int:barber_pk>/overrides/", views.admin_schedule_overrides, name="admin-overrides"),
    path("admin/barbers/<int:barber_pk>/overrides/<int:override_pk>/", views.admin_schedule_override_delete, name="admin-override-delete"),

    # Admin — services
    path("admin/services/", views.admin_service_list, name="admin-service-list"),
    path("admin/services/<int:pk>/", views.admin_service_detail, name="admin-service-detail"),
]
