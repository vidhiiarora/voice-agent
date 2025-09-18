/**
 * speechProcessor.js
 * Speech processing service for STT/TTS without external dependencies
 */

class SpeechProcessor {
  constructor() {
    // Initialize audio processing parameters
    this.sampleRate = 16000; // 16kHz for better quality
    this.channels = 1; // Mono
    this.bitDepth = 16;
  }

  /**
   * Convert base64 audio to text (Speech-to-Text)
   * This is a simulation - in production you'd use a real STT service
   * @param {string} audioBase64 - Base64 encoded PCM audio from Exotel
   * @returns {Promise<string>} Transcribed text
   */
  async speechToText(audioBase64) {
    try {
      // Decode base64 audio
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // For demo purposes, simulate speech recognition based on audio characteristics
      const simulatedResponses = this.getSimulatedResponses(audioBuffer);
      
      // Return a random response for simulation
      const response = simulatedResponses[Math.floor(Math.random() * simulatedResponses.length)];
      
      console.log(`STT Simulation: Audio length ${audioBuffer.length} bytes -> "${response}"`);
      return response;
      
    } catch (error) {
      console.error('Speech-to-text error:', error);
      return null;
    }
  }

  /**
   * Convert text to audio base64 (Text-to-Speech)
   * This integrates with existing TTS service and creates audio data for Exotel
   * @param {string} text - Text to convert to speech
   * @returns {Promise<string>} Base64 encoded PCM audio
   */
  async textToSpeech(text) {
    try {
      // Generate synthetic audio data for the text
      const audioData = this.generateSyntheticAudio(text);
      
      // Convert to base64 for Exotel WebSocket
      return audioData.toString('base64');
      
    } catch (error) {
      console.error('Text-to-speech error:', error);
      return null;
    }
  }

  /**
   * Generate synthetic audio data for text
   * In production, you'd use a real TTS engine
   * @param {string} text - Input text
   * @returns {Buffer} PCM audio data
   */
  generateSyntheticAudio(text) {
    // Calculate approximate duration (assuming ~150 WPM speech rate)
    const wordsPerMinute = 150;
    const words = text.split(' ').length;
    const durationSeconds = Math.max(1, (words / wordsPerMinute) * 60);
    
    // Generate audio buffer for the duration
    const sampleCount = Math.floor(this.sampleRate * durationSeconds);
    const audioBuffer = Buffer.alloc(sampleCount * 2); // 16-bit = 2 bytes per sample
    
    // Generate a simple tone pattern (in production, this would be actual speech)
    for (let i = 0; i < sampleCount; i++) {
      // Simple sine wave at different frequencies based on text
      const frequency = 200 + (text.charCodeAt(i % text.length) % 300); // 200-500 Hz
      const amplitude = 8000; // Amplitude for 16-bit audio
      const sample = Math.sin(2 * Math.PI * frequency * i / this.sampleRate) * amplitude;
      
      // Write 16-bit sample to buffer (little-endian)
      audioBuffer.writeInt16LE(Math.round(sample), i * 2);
    }
    
    return audioBuffer;
  }

  /**
   * Get simulated speech recognition responses
   * Based on conversation context and audio characteristics
   */
  getSimulatedResponses(audioBuffer) {
    // Simulate different types of customer responses based on audio length
    const audioLength = audioBuffer.length;
    
    if (audioLength < 1000) {
      // Short responses
      return [
        "Yes",
        "No", 
        "Okay",
        "Sure",
        "Hello"
      ];
    } else if (audioLength < 3000) {
      // Medium responses
      return [
        "Yes, I'm interested",
        "Can you tell me more?",
        "What's the price?",
        "Not right now",
        "I'm busy at the moment"
      ];
    } else {
      // Longer responses
      return [
        "Yes, I'm interested in the property you mentioned",
        "Can you tell me more about the location and amenities?",
        "What's the total price and what are the payment options?",
        "I'd like to schedule a site visit for this weekend",
        "I'm not interested right now, but thank you for calling",
        "This is not a good time to talk, can you call back later?",
        "I already found a property elsewhere, thank you"
      ];
    }
  }

  /**
   * Analyze audio characteristics
   * @param {Buffer} audioBuffer - PCM audio data
   * @returns {object} Audio characteristics
   */
  analyzeAudio(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
      return { volume: 0, duration: 0, quality: 'silent' };
    }

    const sampleCount = audioBuffer.length / 2; // 16-bit samples
    const durationSeconds = sampleCount / this.sampleRate;
    
    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i += 2) {
      const sample = audioBuffer.readInt16LE(i);
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / sampleCount);
    const volume = Math.min(100, (rms / 32767) * 100);
    
    // Determine quality based on volume and duration
    let quality = 'good';
    if (volume < 5) quality = 'silent';
    else if (volume < 15) quality = 'quiet';
    else if (volume > 80) quality = 'loud';
    
    return {
      volume: Math.round(volume),
      duration: Math.round(durationSeconds * 1000), // milliseconds
      quality,
      samples: sampleCount
    };
  }

  /**
   * Convert audio format if needed
   * @param {Buffer} audioBuffer - Input audio
   * @param {object} targetFormat - Target format specifications
   * @returns {Buffer} Converted audio
   */
  convertAudioFormat(audioBuffer, targetFormat = {}) {
    const {
      sampleRate = this.sampleRate,
      channels = this.channels,
      bitDepth = this.bitDepth
    } = targetFormat;
    
    // For simplicity, return as-is for now
    // In production, you'd implement proper audio format conversion
    return audioBuffer;
  }

  /**
   * Create silence audio buffer
   * @param {number} durationMs - Duration in milliseconds
   * @returns {Buffer} Silent audio buffer
   */
  createSilence(durationMs) {
    const sampleCount = Math.floor((this.sampleRate * durationMs) / 1000);
    return Buffer.alloc(sampleCount * 2); // 16-bit silence (zeros)
  }

  /**
   * Mix multiple audio buffers
   * @param {Buffer[]} audioBuffers - Array of audio buffers to mix
   * @returns {Buffer} Mixed audio buffer
   */
  mixAudio(audioBuffers) {
    if (!audioBuffers || audioBuffers.length === 0) {
      return Buffer.alloc(0);
    }
    
    if (audioBuffers.length === 1) {
      return audioBuffers[0];
    }
    
    // Find the longest buffer
    const maxLength = Math.max(...audioBuffers.map(buf => buf.length));
    const mixedBuffer = Buffer.alloc(maxLength);
    
    // Mix all buffers
    for (let i = 0; i < maxLength; i += 2) {
      let mixedSample = 0;
      let activeBuffers = 0;
      
      for (const buffer of audioBuffers) {
        if (i < buffer.length) {
          mixedSample += buffer.readInt16LE(i);
          activeBuffers++;
        }
      }
      
      // Average the samples to prevent clipping
      if (activeBuffers > 0) {
        mixedSample = Math.round(mixedSample / activeBuffers);
        mixedSample = Math.max(-32768, Math.min(32767, mixedSample)); // Clamp to 16-bit range
        mixedBuffer.writeInt16LE(mixedSample, i);
      }
    }
    
    return mixedBuffer;
  }
}

module.exports = new SpeechProcessor();