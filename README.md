# Voice Agent — Hackathon Demo

This project is a **hackathon-ready scaffold** for a voice-enabled property recommendation agent.
It is a minimal working structure that demonstrates:
- Browser mic capture (Web Speech API) for STT (frontend)
- Backend session memory (simple in-memory store)
- Google SERP via Serper.dev (or mocked links if API key not provided)
- TTS fallback using browser SpeechSynthesis (frontend)

> NOTE: This project contains placeholders for production-grade steps like LLM calls, robust slot extraction, and real TTS audio generation.
> Replace placeholders with real API integrations for production.

## Quick start (local)

### Prereqs
- Node.js 18+
- (Optional) SERPER_API_KEY for Serper.dev or SerpAPI
- (Optional) OPENAI_API_KEY for LLM generation

### Backend
```bash
cd backend
npm install
# set SERPER_API_KEY env if available
export SERPER_API_KEY=your_key_here
node server.js
```
Backend listens on port 3001 by default.

### Frontend
You can serve the static frontend using the included simple server:
```bash
cd frontend
npm install
npm run start
# open http://localhost:3000/public/index.html  (or http://localhost:3000)
```

### Demo flow
1. Open the frontend in Chrome (Web Speech API recommended).
2. Click **Start**, speak (e.g., "Looking for 2BHK in Pune under 60 lakhs").
3. Bot will transcribe, call backend, and reply. Bot uses browser TTS to speak reply.

## Files of interest
- `backend/server.js` — main Express server
- `backend/memory.js` — in-memory session store
- `backend/googleSearch.js` — Serper.dev wrapper (uses SERPER_API_KEY)
- `frontend/public/index.html` — single-page demo UI (Web Speech + SpeechSynthesis)

## Extending / Production
- Replace in-memory memory with Redis.
- Use OpenAI / GPT-5 for robust conversation & slot extraction.
- Use Google Cloud TTS or ElevenLabs for high-quality audio and return audio URLs.
- Use Serper.dev / SerpAPI for reliable SERP results, or integrate housing.com partner APIs if available.

Good luck with the hackathon! 🎉
