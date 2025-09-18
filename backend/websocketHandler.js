/**
 * websocketHandler.js
 * WebSocket handler for real-time audio streaming with Exotel
 */

const WebSocket = require('ws');
const memory = require('./memory');
const salesAgent = require('./salesAgent');
const tts = require('./tts');

class WebSocketHandler {
  constructor() {
    this.connections = new Map(); // callSid -> connection info
    this.server = null;
  }

  /**
   * Initialize WebSocket server
   * @param {number} port - Port for WebSocket server
   */
  initializeServer(port = 8080) {
    this.server = new WebSocket.Server({ port });
    console.log(`WebSocket server started on port ${port}`);

    this.server.on('connection', (ws, req) => {
      console.log('New WebSocket connection from Exotel');
      this.handleConnection(ws, req);
    });

    this.server.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Handle new WebSocket connection from Exotel
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} req - HTTP request object
   */
  handleConnection(ws, req) {
    // Extract session info from URL parameters or headers
    const url = new URL(req.url, 'ws://localhost');
    const sessionId = url.searchParams.get('sessionId') || 'default';
    const callSid = url.searchParams.get('callSid') || 'unknown';

    console.log(`WebSocket connected for session: ${sessionId}, call: ${callSid}`);

    // Store connection info
    this.connections.set(callSid, {
      ws,
      sessionId,
      callSid,
      connected: true,
      audioBuffer: [],
      lastActivity: Date.now()
    });

    // Set up event handlers
    ws.on('message', (data) => {
      this.handleMessage(callSid, data);
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket closed for call ${callSid}: ${code} ${reason}`);
      this.handleDisconnection(callSid);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for call ${callSid}:`, error);
      this.handleDisconnection(callSid);
    });

    // Send initial message
    this.sendMessage(callSid, {
      event: 'connected',
      message: 'Voice bot connected successfully'
    });
  }

  /**
   * Handle incoming WebSocket messages from Exotel
   * @param {string} callSid - Call SID
   * @param {Buffer} data - Message data
   */
  async handleMessage(callSid, data) {
    const connection = this.connections.get(callSid);
    if (!connection) return;

    try {
      const message = JSON.parse(data.toString());
      console.log(`WebSocket message for ${callSid}:`, message.event || 'audio');

      connection.lastActivity = Date.now();

      switch (message.event) {
        case 'connected':
          await this.handleConnected(callSid, message);
          break;
          
        case 'start':
          await this.handleCallStart(callSid, message);
          break;
          
        case 'media':
          await this.handleAudioData(callSid, message);
          break;
          
        case 'stop':
          await this.handleCallEnd(callSid, message);
          break;
          
        case 'dtmf':
          await this.handleDTMF(callSid, message);
          break;
          
        default:
          console.log(`Unknown event: ${message.event}`);
      }

    } catch (error) {
      console.error(`Error processing message for ${callSid}:`, error);
    }
  }

  /**
   * Handle WebSocket connected event
   */
  async handleConnected(callSid, message) {
    console.log(`Call ${callSid} connected`);
    
    // Send initial greeting
    const greeting = "Hello! This is Sarah from Housing.com. I'm calling regarding the property you enquired about. Is this a good time to talk?";
    await this.sendVoiceResponse(callSid, greeting);
  }

  /**
   * Handle call start event
   */
  async handleCallStart(callSid, message) {
    console.log(`Call ${callSid} started streaming`);
    const connection = this.connections.get(callSid);
    if (connection) {
      // Initialize the sales conversation
      const sessionId = connection.sessionId;
      memory.updateConversationState(sessionId, 'voice_call_active');
    }
  }

  /**
   * Handle incoming audio data
   * @param {string} callSid - Call SID
   * @param {object} message - Audio message from Exotel
   */
  async handleAudioData(callSid, message) {
    const connection = this.connections.get(callSid);
    if (!connection) return;

    try {
      // Audio data is base64 encoded PCM
      const audioData = message.media?.payload;
      if (!audioData) return;

      // For now, we'll simulate speech recognition
      // In production, you'd decode the audio and run STT
      const transcribedText = await this.simulateSpeechToText(audioData);
      
      if (transcribedText) {
        console.log(`Transcribed: ${transcribedText}`);
        await this.processCustomerMessage(callSid, transcribedText);
      }

    } catch (error) {
      console.error(`Error processing audio for ${callSid}:`, error);
    }
  }

  /**
   * Process customer message and generate AI response
   * @param {string} callSid - Call SID
   * @param {string} customerMessage - Transcribed customer message
   */
  async processCustomerMessage(callSid, customerMessage) {
    const connection = this.connections.get(callSid);
    if (!connection) return;

    const sessionId = connection.sessionId;

    try {
      // Get session data
      const session = memory.get(sessionId);
      const conversationHistory = memory.getConversationHistory(sessionId);
      const propertyInfo = session.propertyInfo || {};
      const customerInfo = session.customerInfo || {};

      // Add customer message to history
      memory.addToConversationHistory(sessionId, 'user', customerMessage);

      // Generate AI response using sales agent
      const agentResult = await salesAgent.generateResponse(
        customerMessage,
        conversationHistory,
        propertyInfo,
        customerInfo
      );

      console.log(`AI Response: ${agentResult.response}`);

      // Add AI response to history
      memory.addToConversationHistory(sessionId, 'assistant', agentResult.response);

      // Convert to speech and send
      await this.sendVoiceResponse(callSid, agentResult.response);

      // Check if call should end
      if (agentResult.callEnded) {
        console.log(`Ending call ${callSid}: ${agentResult.summary}`);
        setTimeout(() => this.endCall(callSid), 2000); // Give time for final message
      }

    } catch (error) {
      console.error(`Error processing customer message for ${callSid}:`, error);
      await this.sendVoiceResponse(callSid, "I apologize, I'm having some technical difficulties. Let me try again.");
    }
  }

  /**
   * Convert text to speech and send via WebSocket
   * @param {string} callSid - Call SID
   * @param {string} text - Text to convert to speech
   */
  async sendVoiceResponse(callSid, text) {
    const connection = this.connections.get(callSid);
    if (!connection || !connection.connected) return;

    try {
      // Use existing TTS service
      const audioInfo = await tts.synthesize(text);
      
      // For now, we'll send text back to Exotel
      // In production, you'd convert text to audio and send as base64 PCM
      const audioResponse = await this.textToAudioBase64(text);
      
      this.sendMessage(callSid, {
        event: 'media',
        media: {
          payload: audioResponse
        }
      });

    } catch (error) {
      console.error(`Error sending voice response for ${callSid}:`, error);
    }
  }

  /**
   * Handle call end event
   */
  async handleCallEnd(callSid, message) {
    console.log(`Call ${callSid} ended`);
    const connection = this.connections.get(callSid);
    
    if (connection) {
      const sessionId = connection.sessionId;
      memory.updateConversationState(sessionId, 'call_ended');
      
      // Generate final summary
      const conversationHistory = memory.getConversationHistory(sessionId);
      const session = memory.get(sessionId);
      
      // You could save call recording, generate summary, etc.
    }
    
    this.handleDisconnection(callSid);
  }

  /**
   * Handle DTMF input
   */
  async handleDTMF(callSid, message) {
    const digit = message.dtmf?.digit;
    console.log(`DTMF input for ${callSid}: ${digit}`);
    
    // Handle keypress if needed (e.g., "Press 1 to continue")
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(callSid) {
    const connection = this.connections.get(callSid);
    if (connection) {
      connection.connected = false;
      this.connections.delete(callSid);
    }
  }

  /**
   * Send message via WebSocket
   */
  sendMessage(callSid, message) {
    const connection = this.connections.get(callSid);
    if (connection && connection.connected) {
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to ${callSid}:`, error);
      }
    }
  }

  /**
   * End a call
   */
  endCall(callSid) {
    const connection = this.connections.get(callSid);
    if (connection && connection.connected) {
      connection.ws.close();
      this.handleDisconnection(callSid);
    }
  }

  /**
   * Simulate speech-to-text conversion
   * In production, replace with actual STT service
   */
  async simulateSpeechToText(audioBase64) {
    // Simulate different customer responses for testing
    const responses = [
      "Yes, I'm interested in the property",
      "Can you tell me more about the location?",
      "What's the price?",
      "I'd like to schedule a visit",
      "Not interested, thank you",
      "Can you call back later?"
    ];
    
    // Simulate delay and return random response
    await new Promise(resolve => setTimeout(resolve, 500));
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Convert text to audio base64
   * In production, use actual TTS service
   */
  async textToAudioBase64(text) {
    // Placeholder: return empty audio data
    // In production, convert text to 16-bit PCM audio and encode as base64
    return Buffer.alloc(1600).toString('base64'); // 100ms of silence at 8kHz
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const stats = {
      activeConnections: this.connections.size,
      connections: []
    };

    this.connections.forEach((connection, callSid) => {
      stats.connections.push({
        callSid,
        sessionId: connection.sessionId,
        connected: connection.connected,
        lastActivity: connection.lastActivity
      });
    });

    return stats;
  }
}

module.exports = new WebSocketHandler();