"""
HealthCareAssistant - LangGraph-backed healthcare assistant
- Keeps per-session memory using LangGraph checkpointers
- Composes a simple single-node graph with a system prompt
"""

from typing import TypedDict, List
from django.conf import settings
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver


class ConversationState(TypedDict):
    messages: List[BaseMessage]
    disease: str  # optional semantic tag (we also use the latest user text)


def _build_graph():
    llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY)

    def node_assistant(state: ConversationState):
        system_msg = SystemMessage(content=(
            "You are an empathetic expert healthcare assistant. "
            "Provide:\n"
            "1) Possible disease name (or differential),\n"
            "2) General over-the-counter options or supportive care (no prescriptions),\n"
            "3) A 7-day diet plan,\n"
            "4) Helpful yoga/exercises,\n"
            "5) Future recommendations.\n"
            "If chronic/recurring, suggest uploading medical reports. "
            "Be clear that this is not a medical diagnosis and advise consulting a doctor."
        ))
        messages = [system_msg] + state["messages"]
        resp = llm.invoke(messages)
        new_messages = state["messages"] + [AIMessage(content=resp.content)]
        return {"messages": new_messages, "disease": state.get("disease", "")}

    g = StateGraph(ConversationState)
    g.add_node("assistant", node_assistant)
    g.add_edge(START, "assistant")
    g.add_edge("assistant", END)

    # In-memory checkpointer (per-thread memory). You can replace with a DB-backed one later.
    memory = InMemorySaver()
    return g.compile(checkpointer=memory)


class HealthCareAssistant:
    def __init__(self):
        self.workflow = _build_graph()

    def respond(self, user_text: str, session_id: str):
        """Add HumanMessage and get assistant reply with memory bound to session_id."""
        result = self.workflow.invoke(
            {"messages": [HumanMessage(content=user_text)], "disease": user_text},
            config={"configurable": {"thread_id": session_id}}
        )
        msgs: List[BaseMessage] = result["messages"]
        return msgs[-1].content if msgs else "No response."

    def get_state_messages(self, session_id: str) -> List[BaseMessage]:
        state = self.workflow.get_state(config={"configurable": {"thread_id": session_id}})
        return state.values.get("messages", []) if state and state.values else []

    def reset(self, session_id: str):
        # Reset by writing an empty state for the thread_id
        self.workflow.update_state(
            {"messages": [], "disease": ""},
            config={"configurable": {"thread_id": session_id}}
        )