from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # Staff password login
    path("staff-login/", views.staff_login, name="staff-login"),

    # OTP auth
    path("send-otp/", views.send_otp_view, name="send-otp"),
    path("verify-otp/", views.verify_otp_view, name="verify-otp"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", views.logout_view, name="logout"),

    # Profile
    path("profile/", views.profile_view, name="profile"),

    # Admin
    path("admin/users/", views.admin_user_list, name="admin-user-list"),
    path("admin/users/<int:pk>/", views.admin_user_detail, name="admin-user-detail"),
]
