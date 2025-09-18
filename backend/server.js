/**
 * Backend - server.js
 * AI-powered voice agent for Housing.com property search
 * 
 * Environment variables needed:
 *  - SERPER_API_KEY      (for Serper.dev or SerpAPI alternative)
 *  - OPENAI_API_KEY      (for GPT-4 / OpenAI usage)
 *  - TTS_PROVIDER        (optional, e.g., "google" or "elevenlabs")
 *  - GOOGLE_TTS_KEY_PATH (optional, path to Google service account JSON)
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const memory = require('./memory');
const googleSearch = require('./googleSearch');
const tts = require('./tts');
const aiConversation = require('./aiConversation');
const propertyParser = require('./propertyParser');
const salesAgent = require('./salesAgent');
const exotelService = require('./exotelService');
const twilioService = require('./twilioService');
const websocketHandler = require('./websocketHandler');
const cors = require('cors');

const app = express();
app.use(bodyParser.json({limit: '10mb'}));
app.use(bodyParser.urlencoded({extended: true, limit: '10mb'}));
app.use(cors());

// Simple healthcheck
app.get('/', (req, res) => res.send('Housing.com AI Voice Agent is running'));

// Main chat endpoint with AI conversation
app.post('/chat', async (req, res) => {
  try {
    const { sessionId, text } = req.body;
    if (!sessionId || !text) {
      return res.status(400).json({ error: 'sessionId and text are required' });
    }

    console.log(`[${sessionId}] User: ${text}`);

    // Get current session state
    let session = memory.get(sessionId);
    
    // Add user message to conversation history
    memory.addToConversationHistory(sessionId, 'user', text);
    
    // Extract and update requirements from user message
    const currentRequirements = memory.getRequirements(sessionId);
    let updatedRequirements = aiConversation.extractRequirements(text, currentRequirements);
    
    // Handle confirmation logic
    const lower = text.toLowerCase();
    
    // If user is confirming to search
    if (updatedRequirements.waitingForConfirmation && 
        (lower.includes('yes') || lower.includes('ok') || lower.includes('sure') || 
         lower.includes('proceed') || lower.includes('search') || lower.includes('find'))) {
      updatedRequirements.confirmed = true;
      updatedRequirements.waitingForConfirmation = false;
    }
    
    // If user wants to modify requirements
    if (updatedRequirements.waitingForConfirmation && 
        (lower.includes('no') || lower.includes('change') || lower.includes('modify') || 
         lower.includes('different') || lower.includes('wrong'))) {
      // Reset confirmation flags to allow new requirements
      updatedRequirements.confirmed = false;
      updatedRequirements.waitingForConfirmation = false;
    }
    
    // If we have complete requirements but not confirmed yet, set waiting for confirmation
    if (aiConversation.hasCompleteRequirements(updatedRequirements) && 
        !updatedRequirements.confirmed && 
        !updatedRequirements.waitingForConfirmation) {
      updatedRequirements.waitingForConfirmation = true;
    }
    
    // If user provides new requirements while we're waiting for confirmation, reset
    if (updatedRequirements.waitingForConfirmation) {
      const hasNewRequirements = 
        JSON.stringify(currentRequirements.propertyType) !== JSON.stringify(updatedRequirements.propertyType) ||
        JSON.stringify(currentRequirements.city) !== JSON.stringify(updatedRequirements.city) ||
        JSON.stringify(currentRequirements.bhk) !== JSON.stringify(updatedRequirements.bhk) ||
        JSON.stringify(currentRequirements.budget) !== JSON.stringify(updatedRequirements.budget) ||
        JSON.stringify(currentRequirements.locality) !== JSON.stringify(updatedRequirements.locality);
      
      if (hasNewRequirements) {
        console.log(`[${sessionId}] New requirements detected, resetting confirmation`);
        updatedRequirements.confirmed = false;
        updatedRequirements.waitingForConfirmation = false;
        // Re-check if complete requirements after update
        if (aiConversation.hasCompleteRequirements(updatedRequirements)) {
          updatedRequirements.waitingForConfirmation = true;
        }
      }
    }
    
    memory.updateRequirements(sessionId, updatedRequirements);
    
    // Generate AI response based on conversation history and requirements
    const conversationHistory = memory.getConversationHistory(sessionId);
    const aiResponse = await aiConversation.generateResponse(text, conversationHistory, updatedRequirements);
    
    console.log(`[${sessionId}] Bot: ${aiResponse}`);
    
    // Add AI response to conversation history
    memory.addToConversationHistory(sessionId, 'assistant', aiResponse);
    
    let links = [];
    let searchPerformed = false;
    
    // Only search if user has confirmed (paid API call)
    const shouldSearch = aiConversation.shouldSearchProperties(updatedRequirements);
    const searchKeywords = aiResponse.toLowerCase().includes('search') || 
                          aiResponse.toLowerCase().includes('find') || 
                          aiResponse.toLowerCase().includes('looking') ||
                          aiResponse.toLowerCase().includes('properties');
    
    console.log(`[${sessionId}] Search check - shouldSearch: ${shouldSearch}, hasKeywords: ${searchKeywords}, confirmed: ${updatedRequirements.confirmed}, requirements:`, updatedRequirements);
    
    if (shouldSearch && searchKeywords) {
      const searchQuery = aiConversation.generateSearchQuery(updatedRequirements);
      console.log(`[${sessionId}] Performing PAID API search: ${searchQuery}`);
      
      links = await googleSearch.searchHousingLinks(searchQuery);
      memory.addPropertySearchResult(sessionId, searchQuery, links);
      memory.updateConversationState(sessionId, 'presenting_results');
      searchPerformed = true;
    }
    
    // Create TTS audio for the response
    const audioInfo = await tts.synthesize(aiResponse);
    
    // Prepare response
    const response = {
      replyText: aiResponse,
      links: links.slice(0, 5),
      audio: audioInfo,
      requirements: updatedRequirements,
      conversationState: session.currentState,
      searchPerformed
    };
    
    res.json(response);

  } catch (err) {
    console.error('Chat endpoint error:', err);
    res.status(500).json({ error: err.message || 'internal error' });
  }
});

// Feedback endpoint for property likes/dislikes
app.post('/feedback', async (req, res) => {
  try {
    const { sessionId, propertyId, feedback, reason } = req.body;
    if (!sessionId || !propertyId || !feedback) {
      return res.status(400).json({ error: 'sessionId, propertyId, and feedback are required' });
    }

    // Store user feedback
    memory.addUserFeedback(sessionId, propertyId, feedback, reason);
    
    // Generate AI response based on feedback
    const conversationHistory = memory.getConversationHistory(sessionId);
    const requirements = memory.getRequirements(sessionId);
    const userFeedback = memory.getUserFeedback(sessionId);
    
    let feedbackMessage;
    if (feedback === 'like' || feedback === 'interested') {
      feedbackMessage = `I'm glad you liked that property! ${reason ? `I noted that you liked it because: ${reason}. ` : ''}Would you like me to find more similar properties?`;
    } else {
      feedbackMessage = `I understand that property wasn't quite right. ${reason ? `I noted your concern: ${reason}. ` : ''}Let me search for better options that address your preferences.`;
    }
    
    // Add feedback to conversation
    memory.addToConversationHistory(sessionId, 'user', `Feedback on property: ${feedback} ${reason ? '- ' + reason : ''}`);
    memory.addToConversationHistory(sessionId, 'assistant', feedbackMessage);
    
    // If negative feedback, search for new properties with refined criteria
    let newLinks = [];
    if (feedback === 'dislike' || feedback === 'not_interested') {
      // Refine search based on feedback patterns
      const refinedQuery = refineSearchBasedOnFeedback(requirements, userFeedback);
      newLinks = await googleSearch.searchHousingLinks(refinedQuery);
      memory.addPropertySearchResult(sessionId, refinedQuery, newLinks);
    }
    
    const audioInfo = await tts.synthesize(feedbackMessage);
    
    res.json({
      replyText: feedbackMessage,
      links: newLinks.slice(0, 5),
      audio: audioInfo,
      feedbackProcessed: true
    });

  } catch (err) {
    console.error('Feedback endpoint error:', err);
    res.status(500).json({ error: err.message || 'internal error' });
  }
});

// Helper function to refine search based on user feedback
function refineSearchBasedOnFeedback(requirements, userFeedback) {
  let query = aiConversation.generateSearchQuery(requirements);
  
  // Analyze negative feedback patterns
  const negativeReasons = userFeedback
    .filter(f => f.feedback === 'dislike' || f.feedback === 'not_interested')
    .map(f => f.reason)
    .filter(r => r);
  
  // Add refinements based on common complaints
  if (negativeReasons.some(r => r.toLowerCase().includes('price') || r.toLowerCase().includes('expensive'))) {
    query += ' affordable budget';
  }
  if (negativeReasons.some(r => r.toLowerCase().includes('location') || r.toLowerCase().includes('area'))) {
    query += ' prime location central';
  }
  if (negativeReasons.some(r => r.toLowerCase().includes('small') || r.toLowerCase().includes('space'))) {
    query += ' spacious large';
  }
  
  return query;
}

// Property parsing endpoint
app.post('/parse-property', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Property URL is required' });
    }

    console.log(`Parsing property URL: ${url}`);
    
    try {
      const propertyInfo = await propertyParser.parsePropertyUrl(url);
      res.json({ success: true, property: propertyInfo });
    } catch (parseError) {
      console.warn('Property parsing failed, using sample data:', parseError.message);
      const sampleProperty = propertyParser.generateSampleProperty(url);
      res.json({ success: true, property: sampleProperty });
    }
  } catch (err) {
    console.error('Property parsing endpoint error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse property' });
  }
});

// Sales agent chat endpoint
app.post('/sales-chat', async (req, res) => {
  try {
    const { sessionId, text, propertyInfo, customerPhone, customerName } = req.body;
    if (!sessionId || !text) {
      return res.status(400).json({ error: 'sessionId and text are required' });
    }

    console.log(`[Sales ${sessionId}] Customer: ${text}`);

    // Get current session state
    let session = memory.get(sessionId);
    
    // Add customer message to conversation history
    memory.addToConversationHistory(sessionId, 'user', text);
    
    // Prepare customer info
    const customerInfo = {
      name: customerName,
      phone: customerPhone
    };
    
    // Generate sales agent response
    const conversationHistory = memory.getConversationHistory(sessionId);
    const agentResult = await salesAgent.generateResponse(text, conversationHistory, propertyInfo, customerInfo);
    
    console.log(`[Sales ${sessionId}] Agent: ${agentResult.response}`);
    
    // Add agent response to conversation history
    memory.addToConversationHistory(sessionId, 'assistant', agentResult.response);
    
    // Create TTS audio for the response
    const audioInfo = await tts.synthesize(agentResult.response);
    
    // Prepare response
    const response = {
      replyText: agentResult.response,
      audio: audioInfo,
      callEnded: agentResult.callEnded,
      summary: agentResult.summary
    };
    
    res.json(response);

  } catch (err) {
    console.error('Sales chat endpoint error:', err);
    res.status(500).json({ error: err.message || 'internal error' });
  }
});

// Get session details endpoint
app.get('/session/:id', (req, res) => {
  const id = req.params.id;
  const session = memory.get(id);
  res.json({ 
    session: {
      requirements: session.requirements,
      conversationState: session.currentState,
      conversationHistory: session.conversationHistory,
      propertySearchHistory: session.propertySearchHistory,
      userFeedback: session.userFeedback
    }
  });
});

// Clear session endpoint
app.delete('/session/:id', (req, res) => {
  const id = req.params.id;
  memory.clear(id);
  res.json({ message: 'Session cleared successfully' });
});

// Exotel voice call endpoints
app.post('/exotel/initiate-call', async (req, res) => {
  try {
    const { sessionId, customerPhone, customerName, propertyUrl, propertyInfo } = req.body;
    
    if (!sessionId || !customerPhone || !propertyUrl) {
      return res.status(400).json({ error: 'sessionId, customerPhone, and propertyUrl are required' });
    }

    console.log(`Initiating Exotel voice call for session ${sessionId} to ${customerPhone}`);

    // Store session data for the call
    memory.setPropertyInfo(sessionId, propertyInfo);
    memory.setCustomerInfo(sessionId, { name: customerName, phone: customerPhone });
    memory.updateConversationState(sessionId, 'initiating_voice_call');

    // Initiate the call via Exotel
    const callResult = await exotelService.initiateCall(customerPhone, propertyUrl, sessionId);
    
    if (callResult.success) {
      // Store call info in session
      memory.setCallInfo(sessionId, {
        callSid: callResult.callSid,
        status: callResult.status,
        customerPhone,
        initiatedAt: new Date().toISOString()
      });

      res.json({
        success: true,
        callSid: callResult.callSid,
        status: callResult.status,
        message: 'Voice call initiated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: callResult.error
      });
    }

  } catch (error) {
    console.error('Error initiating Exotel call:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate voice call' });
  }
});

// Get call status endpoint
app.get('/exotel/call-status/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;
    console.log(`Getting call status for ${callSid}`);

    const callDetails = await exotelService.getCallDetails(callSid);
    
    if (callDetails.success) {
      res.json({
        success: true,
        status: callDetails.call.Status,
        duration: callDetails.call.Duration,
        summary: callDetails.call.summary || null
      });
    } else {
      res.status(404).json({
        success: false,
        error: callDetails.error
      });
    }

  } catch (error) {
    console.error('Error getting call status:', error);
    res.status(500).json({ error: error.message || 'Failed to get call status' });
  }
});

// Exotel webhook for call status updates
app.post('/exotel/call-status', (req, res) => {
  try {
    console.log('Exotel call status webhook:', req.body);
    
    const webhookData = exotelService.parseWebhookData(req.body);
    const { sessionId, callSid, status } = webhookData;

    if (sessionId) {
      // Update session with call status
      const session = memory.get(sessionId);
      if (session.callInfo) {
        session.callInfo.status = status;
        session.callInfo.lastUpdate = new Date().toISOString();
        memory.setCallInfo(sessionId, session.callInfo);
      }

      // Update conversation state based on call status
      if (status === 'in-progress') {
        memory.updateConversationState(sessionId, 'voice_call_active');
      } else if (status === 'completed' || status === 'failed') {
        memory.updateConversationState(sessionId, 'call_ended');
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(200).send('OK'); // Always return OK to Exotel
  }
});

// Exotel webhook for when call is connected (returns call flow)
app.post('/exotel/call-connected', (req, res) => {
  try {
    console.log('Exotel call connected webhook:', req.body);
    
    const callSid = req.body.CallSid;
    const sessionId = req.body.CustomField1;
    
    // Generate WebSocket URL for this call
    const websocketUrl = `ws://localhost:8081?sessionId=${sessionId}&callSid=${callSid}`;
    
    // Return Exotel XML flow with WebSocket streaming
    const xmlFlow = exotelService.generateCallFlowXML(sessionId, websocketUrl);
    
    res.set('Content-Type', 'application/xml');
    res.send(xmlFlow);
    
  } catch (error) {
    console.error('Call connected webhook error:', error);
    // Return basic XML in case of error
    res.set('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="alice">Sorry, there was a technical issue. Please try calling back.</Say>
      <Hangup/>
    </Response>`);
  }
});

// Twilio voice call endpoints
app.post('/twilio/initiate-call', async (req, res) => {
  try {
    const { sessionId, customerPhone, customerName, propertyInfo } = req.body;
    
    if (!sessionId || !customerPhone) {
      return res.status(400).json({ error: 'sessionId and customerPhone are required' });
    }

    console.log(`Initiating Twilio voice call for session ${sessionId} to ${customerPhone}`);

    // Store session data for the call
    memory.setPropertyInfo(sessionId, propertyInfo);
    memory.setCustomerInfo(sessionId, { name: customerName, phone: customerPhone });
    memory.updateConversationState(sessionId, 'initiating_voice_call');

    // Initiate the call via Twilio
    const callResult = await twilioService.initiateCall(customerPhone, sessionId, propertyInfo);
    
    if (callResult.success) {
      // Store call info in session
      memory.setCallInfo(sessionId, {
        callSid: callResult.callSid,
        status: callResult.status,
        customerPhone,
        provider: 'twilio',
        initiatedAt: new Date().toISOString()
      });

      res.json({
        success: true,
        callSid: callResult.callSid,
        status: callResult.status,
        message: 'Twilio voice call initiated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: callResult.error
      });
    }

  } catch (error) {
    console.error('Error initiating Twilio call:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate voice call' });
  }
});

// Twilio voice webhook - handles incoming call or call initiation
app.post('/twilio/voice-webhook/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`🔵 Twilio voice webhook called for session ${sessionId}`);
    console.log('📞 Request body:', JSON.stringify(req.body, null, 2));

    // Get call info and property details
    const session = memory.get(sessionId);
    console.log('🗃️ Session data:', session ? 'Found' : 'Not found');
    
    const callData = twilioService.getCallStatus(sessionId);
    console.log('📋 Call data:', callData ? 'Found' : 'Not found');
    
    let welcomeMessage = "Hello! I'm Sarah from Housing.com. Thank you for your interest in our property.";
    
    if (session && session.propertyInfo) {
      welcomeMessage += ` I'm calling about the ${session.propertyInfo.bhk || ''} property in ${session.propertyInfo.location || 'your preferred area'}. How can I help you today?`;
    } else {
      welcomeMessage += " I'm here to help you find the perfect property. What are you looking for?";
    }
    
    console.log('🗣️ Welcome message:', welcomeMessage);
    
    const twimlResponse = twilioService.generateVoiceResponse(sessionId, welcomeMessage);
    console.log('📝 TwiML response:', twimlResponse);
    
    res.set('Content-Type', 'text/xml');
    res.send(twimlResponse);
    
  } catch (error) {
    console.error('❌ Twilio voice webhook error:', error);
    const twimlResponse = twilioService.generateVoiceResponse(req.params.sessionId, "Sorry, I'm having technical difficulties. Please try again later.");
    res.set('Content-Type', 'text/xml');
    res.send(twimlResponse);
  }
});

// Twilio gather webhook - processes user speech input
app.post('/twilio/gather-webhook/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const speechResult = req.body.SpeechResult || req.body.Digits || '';
    
    console.log(`Twilio gather webhook for session ${sessionId}, speech: "${speechResult}"`);
    
    if (!speechResult) {
      const twimlResponse = twilioService.generateVoiceResponse(sessionId, "I didn't catch that. Could you please repeat what you said?");
      res.set('Content-Type', 'text/xml');
      res.send(twimlResponse);
      return;
    }
    
    // Process the speech through AI
    const twimlResponse = await twilioService.processUserSpeech(speechResult, sessionId);
    
    res.set('Content-Type', 'text/xml');
    res.send(twimlResponse);
    
  } catch (error) {
    console.error('Twilio gather webhook error:', error);
    const twimlResponse = twilioService.generateVoiceResponse(req.params.sessionId, "I'm sorry, I'm having trouble processing your request. Please try again.");
    res.set('Content-Type', 'text/xml');
    res.send(twimlResponse);
  }
});

// Twilio call status webhook
app.post('/twilio/status-webhook/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { CallStatus, CallSid, CallDuration } = req.body;
    
    console.log(`Twilio status webhook for session ${sessionId}:`, req.body);
    
    // Update call status in our service
    twilioService.updateCallStatus(sessionId, CallStatus, CallSid);
    
    // Update session memory
    const session = memory.get(sessionId);
    if (session.callInfo) {
      session.callInfo.status = CallStatus;
      session.callInfo.duration = CallDuration;
      session.callInfo.lastUpdate = new Date().toISOString();
      memory.setCallInfo(sessionId, session.callInfo);
    }
    
    // Update conversation state based on call status
    if (CallStatus === 'in-progress') {
      memory.updateConversationState(sessionId, 'voice_call_active');
    } else if (CallStatus === 'completed' || CallStatus === 'failed') {
      memory.updateConversationState(sessionId, 'call_ended');
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Twilio status webhook error:', error);
    res.status(200).send('OK'); // Always return OK to Twilio
  }
});

// Twilio recording webhook
app.post('/twilio/recording-webhook/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { RecordingUrl, RecordingSid, CallSid } = req.body;
    
    console.log(`Twilio recording webhook for session ${sessionId}:`, req.body);
    
    // Store recording info in session
    const session = memory.get(sessionId);
    if (session.callInfo) {
      session.callInfo.recordingUrl = RecordingUrl;
      session.callInfo.recordingSid = RecordingSid;
      memory.setCallInfo(sessionId, session.callInfo);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Twilio recording webhook error:', error);
    res.status(200).send('OK'); // Always return OK to Twilio
  }
});

// Get Twilio call status endpoint
app.get('/twilio/call-status/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const callData = twilioService.getCallStatus(sessionId);
    
    if (callData) {
      res.json({
        success: true,
        status: callData.status,
        callSid: callData.callSid,
        transcript: twilioService.getCallTranscript(sessionId)
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Call data not found'
      });
    }
  } catch (error) {
    console.error('Error getting Twilio call status:', error);
    res.status(500).json({ error: error.message || 'Failed to get call status' });
  }
});

// End Twilio call endpoint
app.post('/twilio/end-call/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const callData = await twilioService.endCall(sessionId);
    
    res.json({
      success: true,
      message: 'Call ended successfully',
      callData
    });
  } catch (error) {
    console.error('Error ending Twilio call:', error);
    res.status(500).json({ error: error.message || 'Failed to end call' });
  }
});

// Initialize WebSocket server for voice streaming
websocketHandler.initializeServer(8081);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Housing.com AI Voice Agent listening on ${PORT}`);
  console.log('WebSocket server for voice streaming running on port 8081');
});
