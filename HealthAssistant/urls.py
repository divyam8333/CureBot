from django.urls import path
from . import views

urlpatterns = [
    path("", views.chatbot_ui, name="chat_ui"),
    path("api/chat/", views.chat_api, name="chat_api"),
    path("api/history/<str:session_id>/", views.chat_history, name="chat_history"),
    path("api/reset/<str:session_id>/", views.reset_session, name="reset_session"),
]
