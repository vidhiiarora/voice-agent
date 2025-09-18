/**
 * tts.js
 * Scaffolding for Text-to-Speech. Returns an object describing audio output.
 *
 * Two modes:
 *  - If GOOGLE_TTS_KEY_PATH set and GOOGLE_TTS_PROJECT configured, this can call Google TTS.
 *  - Otherwise returns base64 with Web Speech fallback (frontend will use SpeechSynthesis).
 *
 * For hackathon use, this returns a simple JSON with text field and frontend uses SpeechSynthesis.
 */

async function synthesize(text) {
  if (!text) return null;
  // Placeholder: In production, call Google Cloud TTS or ElevenLabs and store/return audio URL.
  // For hackathon demo, we'll return the text and let frontend play using Web Speech API.
  return { type: 'ssml_fallback', text };
}

module.exports = { synthesize };
