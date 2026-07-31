from django.urls import path

from . import views

urlpatterns = [
    path("academy/applications/", views.create_application, name="academy-apply"),
    path("admin/academy/applications/", views.admin_application_list, name="admin-academy-list"),
    path(
        "admin/academy/applications/<int:pk>/",
        views.admin_application_detail,
        name="admin-academy-detail",
    ),
]
