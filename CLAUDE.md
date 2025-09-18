# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend
```bash
cd backend
npm install
npm start              # Start server on port 3001
npm run dev            # Start with nodemon for auto-reload
```

**Note**: The SERPER_API_KEY is already configured in `.env` file. For OpenAI integration, add your API key to the `.env` file.

### Frontend
```bash
cd frontend
npm install
npm start              # Serve on port 3000 using 'serve'
```

### Full Stack Development
1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm start`
3. Access demo at `http://localhost:3000`

## Architecture Overview

This is an AI-powered voice agent for Housing.com property recommendations with professional sales agent capabilities:

**Backend** (Node.js/Express on port 3001):
- `server.js` - Main Express server with `/chat` and `/feedback` endpoints
- `aiConversation.js` - AI conversation service with professional sales agent persona
- `memory.js` - Enhanced session storage with conversation history and feedback tracking
- `googleSearch.js` - Serper.dev API wrapper for Google search results
- `tts.js` - Text-to-speech placeholder (returns text for frontend SpeechSynthesis)

**Frontend** (Static HTML/JS on port 3000):
- `public/index.html` - Professional UI with conversation flow, requirements panel, and feedback system

### Key Features
**AI Sales Agent Persona:**
- Professional, friendly Housing.com property consultant
- Natural conversation flow with context awareness
- Structured requirement gathering (budget, city, BHK, property type)
- Memory of previous conversation context

**Smart Property Search:**
- Searches housing.com via Google with extracted requirements
- Refines search based on user feedback
- Presents results with interactive feedback buttons

**Feedback Loop:**
- Users can like/dislike properties with reasons
- AI adjusts future searches based on feedback patterns
- Conversation continues naturally with refined suggestions

### Key Workflow
1. AI agent introduces itself as Housing.com consultant "Sarah"
2. Natural conversation to gather requirements (budget, city, BHK, property type)
3. Real-time requirement extraction and display in sidebar
4. **Confirmation step**: When complete requirements are gathered, AI asks for user confirmation
5. **Paid API search**: Property search only happens after user confirms (to save API costs)
6. Interactive property cards with like/dislike feedback
7. AI processes feedback and refines future searches
8. If user changes requirements, system resets and asks for new confirmation
9. Continuous conversation loop with context memory

### API Endpoints
- `POST /chat` - Main conversation endpoint with AI responses
- `POST /feedback` - Property feedback processing with refined search
- `GET /session/:id` - Retrieve session state and history
- `DELETE /session/:id` - Clear session for new conversation

### Environment Variables
- `SERPER_API_KEY` - Required for Google search (falls back to mock data if missing)
- `OPENAI_API_KEY` - Required for AI conversation (falls back to rule-based responses)
- `PORT` - Backend port (default 3001)

### Session Memory Structure
Enhanced session tracking includes:
- `requirements` - Extracted user requirements (propertyType, budget, city, bhk, locality)
- `conversationHistory` - Full conversation context for AI
- `currentState` - Conversation flow state tracking
- `propertySearchHistory` - All search queries and results
- `userFeedback` - Property feedback with reasons for refinement

## Production Notes
- Replace in-memory store with Redis
- Integrate OpenAI/GPT for robust slot extraction
- Use Google Cloud TTS or ElevenLabs for audio generation
- Add proper error handling and validation
- Implement authentication for production deployment