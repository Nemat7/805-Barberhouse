from django.contrib.auth import authenticate

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import User
from .permissions import IsAdmin
from .serializers import (
    SendOTPSerializer,
    VerifyOTPSerializer,
    UserProfileSerializer,
    UserListSerializer,
)
from .services import send_otp, verify_otp, get_or_create_user, normalize_phone


# ── Auth ──────────────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([AllowAny])
def staff_login(request):
    """Password-based login for admin/barber/superuser roles only."""
    phone = request.data.get("phone", "").strip()
    password = request.data.get("password", "")

    if not phone or not password:
        return Response({"error": "Телефон и пароль обязательны."}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=normalize_phone(phone), password=password)
    if user is None:
        return Response({"error": "Неверный телефон или пароль."}, status=status.HTTP_401_UNAUTHORIZED)

    allowed = (User.ROLE_ADMIN, User.ROLE_BARBER, User.ROLE_SUPERUSER)
    if user.role not in allowed:
        return Response({"error": "Доступ запрещён."}, status=status.HTTP_403_FORBIDDEN)

    barber_profile_id = None
    if user.role == User.ROLE_BARBER:
        try:
            barber_profile_id = user.barber_profile.id
        except Exception:
            pass

    refresh = RefreshToken.for_user(user)
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "barber_profile_id": barber_profile_id,
        },
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def send_otp_view(request):
    """Step 1: send OTP to phone number."""
    serializer = SendOTPSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    phone = serializer.validated_data["phone"]
    success, error = send_otp(phone)

    if not success:
        return Response({"error": error}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    return Response({"message": "Код отправлен."})


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_otp_view(request):
    """Step 2: verify OTP → receive JWT tokens."""
    serializer = VerifyOTPSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    phone = serializer.validated_data["phone"]
    code = serializer.validated_data["code"]
    full_name = serializer.validated_data.get("full_name", "")

    success, error = verify_otp(phone, code)
    if not success:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

    user, is_new = get_or_create_user(phone, full_name)

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserProfileSerializer(user).data,
            "is_new_user": is_new,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Blacklist the refresh token to invalidate the session."""
    try:
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"error": "Refresh token required."}, status=status.HTTP_400_BAD_REQUEST)
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({"message": "Выход выполнен."})
    except TokenError:
        return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


# ── Profile ───────────────────────────────────────────────────────────────────

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """Get or update own profile."""
    if request.method == "GET":
        return Response(UserProfileSerializer(request.user).data)

    serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# ── Admin: user management ────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_user_list(request):
    """List all users (admin only)."""
    users = User.objects.all().order_by("-date_joined")
    serializer = UserListSerializer(users, many=True)
    return Response(serializer.data)


@api_view(["GET", "PATCH"])
@permission_classes([IsAdmin])
def admin_user_detail(request, pk):
    """Get or update any user (admin only)."""
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(UserListSerializer(user).data)

    serializer = UserListSerializer(user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)
