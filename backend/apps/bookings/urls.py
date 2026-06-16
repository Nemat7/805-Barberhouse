from django.urls import path

from . import views

urlpatterns = [
    # Public
    path("availability/", views.availability, name="availability"),

    # Public guest booking (no auth)
    path("bookings/public/", views.public_create_booking, name="public-create-booking"),

    # Client
    path("bookings/", views.create_booking, name="create-booking"),
    path("bookings/my/", views.my_bookings, name="my-bookings"),
    path("bookings/<int:pk>/cancel/", views.cancel_booking, name="cancel-booking"),
    path("bookings/<int:pk>/reschedule/", views.reschedule_booking, name="reschedule-booking"),

    # Admin / Barber
    path("admin/bookings/", views.admin_booking_list, name="admin-booking-list"),
    path("admin/bookings/create/", views.admin_create_booking, name="admin-create-booking"),
    path("admin/bookings/<int:pk>/", views.admin_booking_detail, name="admin-booking-detail"),
]
