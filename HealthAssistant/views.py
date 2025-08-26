from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from .models import ChatMessage
from .HealthCareAssistant import HealthCareAssistant
import json, uuid

assistant = HealthCareAssistant()

def chatbot_ui(request):
    """Serve the chat UI (templates/HealthAssistant/chatbot.html)."""
    return render(request, "HealthAssistant/chatbot.html")

@csrf_exempt
def chat_api(request):
    """POST { message, session_id? } -> { reply, session_id }"""
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request"}, status=400)

    try:
        data = json.loads(request.body.decode("utf-8"))
        user_message = data.get("message", "").strip()
        session_id = (data.get("session_id") or request.session.get("chat_session_id") 
                      or str(uuid.uuid4()))
        request.session["chat_session_id"] = session_id

        if not user_message:
            return JsonResponse({"error": "Message is required"}, status=400)

        # Save user message
        ChatMessage.objects.create(
            session_id=session_id, role="user", content=user_message
        )

        # Get AI reply (LangGraph memory per session)
        ai_reply = assistant.respond(user_message, session_id=session_id)

        # Save assistant message
        ChatMessage.objects.create(
            session_id=session_id, role="assistant", content=ai_reply
        )

        return JsonResponse({"reply": ai_reply, "session_id": session_id})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def chat_history(request, session_id: str):
    """GET -> history for a session (from DB)."""
    if request.method != "GET":
        return JsonResponse({"error": "Invalid request"}, status=400)

    msgs = ChatMessage.objects.filter(session_id=session_id).order_by("created_at")
    data = [
        {"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
        for m in msgs
    ]
    return JsonResponse({"messages": data})

@csrf_exempt
def reset_session(request, session_id: str):
    """DELETE -> clear LangGraph memory and DB rows for a session."""
    if request.method not in ["POST", "DELETE"]:
        return JsonResponse({"error": "Invalid request"}, status=400)

    try:
        # Clear graph memory
        assistant.reset(session_id)
        # Clear DB messages
        ChatMessage.objects.filter(session_id=session_id).delete()
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)