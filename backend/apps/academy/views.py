import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.users.permissions import IsAdmin

from .models import AcademyApplication
from .serializers import (
    AcademyApplicationSerializer,
    CreateAcademyApplicationSerializer,
)

logger = logging.getLogger("academy")


@api_view(["POST"])
@permission_classes([AllowAny])
def create_application(request):
    """Public: submit an application from the Academy page."""
    serializer = CreateAcademyApplicationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    application = serializer.save()

    logger.info(
        f"Academy application | id={application.pk} "
        f"program={application.program} phone={application.phone}"
    )
    return Response(
        AcademyApplicationSerializer(application).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_application_list(request):
    """Admin: list applications, newest first. Filter with ?status= and ?program=."""
    qs = AcademyApplication.objects.all()

    if status_param := request.query_params.get("status"):
        qs = qs.filter(status=status_param)
    if program_param := request.query_params.get("program"):
        qs = qs.filter(program=program_param)

    return Response(AcademyApplicationSerializer(qs, many=True).data)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAdmin])
def admin_application_detail(request, pk):
    """Admin: read, update status/notes, or delete one application."""
    try:
        application = AcademyApplication.objects.get(pk=pk)
    except AcademyApplication.DoesNotExist:
        return Response({"error": "Заявка не найдена."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(AcademyApplicationSerializer(application).data)

    if request.method == "DELETE":
        application.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # Only these two are editable by staff; the applicant's own data stays intact.
    serializer = AcademyApplicationSerializer(
        application,
        data={key: request.data[key] for key in ("status", "admin_notes") if key in request.data},
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)
