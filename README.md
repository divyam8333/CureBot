# CureBot 🩺🤖

**AI-powered Healthcare Assistant built with Django, LangGraph, and OpenAI**

CureBot is a **streaming-enabled medical chatbot** designed to provide **health guidance, Q\&A, and contextual assistance**. It features a modern chat UI with **resume chat**, **chat history saving**, and **document upload** for enhanced interactions.

---

## 🚀 Highlights

* **⚡ LangGraph-powered pipeline** → modular, stateful conversation flow.
* **💬 Real-time streaming responses** (typing effect).
* **📂 Resume past chats** with history saved in localStorage.
* **📝 Rename & delete conversations** for easy management.
* **📎 File/document upload** → assistant can reference context from uploaded files.
* **🌗 Dark/Light theme toggle** with system auto-detect.
* **🖼️ Modern UI** built with HTML, CSS, and Vanilla JS.
* **🔗 Django backend API** with OpenAI integration for real AI responses.

---

## 🛠️ Tech Stack

* **Backend**: Django + LangGraph + LangChain + OpenAI API
* **Frontend**: HTML5, CSS3, Vanilla JS
* **Persistence**: LocalStorage (chat history)
* **Streaming**: Django `StreamingHttpResponse` + OpenAI token streaming
* **Deployment-ready**: Works with Django static files setup

---

## 📂 Project Structure

```
CureBot/
│── HealthAssistant/        # Django app
│   ├── views.py             # Chat API with streaming
│   ├── models.py            # Future DB models
│   ├── urls.py              # API routing
│   ├── static/HealthAssistant/
│   │   ├── chatbot.js       # Frontend logic (streaming UI)
│   │   ├── styles.css       # Chat UI styling
│   │   └── chatbot.html     # Chat frontend
│   └── templates/           # Django templates (if extended)
│
│── HealthCareAssistant.py   # LangGraph pipeline for healthcare chat
│── manage.py
│── README.md
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repo

```bash
git clone https://github.com/divyam8333/CureBot.git
cd CureBot
```

### 2️⃣ Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate   # Mac/Linux
venv\Scripts\activate      # Windows
```

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

### 4️⃣ Configure Environment

In `CuraBot/settings.py`, set your OpenAI API key:

```python
OPENAI_API_KEY = "your-openai-key-here"
```

### 5️⃣ Run Server

```bash
python manage.py runserver
```

Visit: [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

## 🎥 Demo (Features)

* Ask: *"What is diabetes?"* → **streaming answer appears token by token**.
* Resume chat later → history persists.
* Rename a chat → updates in sidebar.
* Upload PDF/Docs → assistant references them in responses.

---

## 🛡️ Disclaimer

CureBot is **not a replacement for professional medical advice**. Always consult a healthcare provider for medical decisions.
