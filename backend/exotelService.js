/**
 * exotelService.js
 * Service to handle Exotel API calls and voice call management
 */

const axios = require('axios');

class ExotelService {
  constructor() {
    this.accountSid = 'housing8';
    this.apiKey = 'f1c1ac7dddc2e77ee76f60b4cceb6d47b1ebf65ec8a717c4';
    this.apiToken = '16dfdfe13ab5f3450d4ebe56dea47a8159f5fb8c22b93895';
    this.subdomain = 'api.exotel.com';
    this.baseUrl = `https://${this.subdomain}/v1/Accounts/${this.accountSid}`;
    
    // Basic Auth for API calls
    this.authHeader = Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64');
  }

  /**
   * Initiate an outbound call to customer
   * @param {string} customerPhone - Customer's phone number
   * @param {string} propertyUrl - Property URL for context
   * @param {string} sessionId - Chat session ID
   */
  async initiateCall(customerPhone, propertyUrl, sessionId) {
    try {
      console.log(`Initiating Exotel call to ${customerPhone} for session ${sessionId}`);
      
      const callData = {
        From: '01141197298', // Replace with your Exotel virtual number
        To: customerPhone,
        Url: `${process.env.BASE_URL || 'http://localhost:3001'}/exotel/call-connected`, // Webhook URL
        StatusCallback: `${process.env.BASE_URL || 'http://localhost:3001'}/exotel/call-status`,
        StatusCallbackMethod: 'POST',
        // Custom parameters to track session
        CustomField1: sessionId,
        CustomField2: propertyUrl
      };

      const response = await axios.post(`${this.baseUrl}/Calls/connect`, callData, {
        headers: {
          'Authorization': `Basic ${this.authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('Exotel call initiated:', response.data);
      
      return {
        success: true,
        callSid: response.data.Call?.Sid,
        status: response.data.Call?.Status,
        sessionId: sessionId
      };

    } catch (error) {
      console.error('Exotel call initiation error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Create call flow XML for voice bot interaction
   * @param {string} sessionId - Session ID for tracking
   * @param {string} websocketUrl - WebSocket URL for streaming
   */
  generateCallFlowXML(sessionId, websocketUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="alice">Hello! This is Sarah from Housing.com. I'm calling regarding the property you enquired about. Please hold on while I connect you to our system.</Say>
      <Stream url="${websocketUrl}" track="both_tracks">
        <Parameter name="sessionId" value="${sessionId}" />
      </Stream>
    </Response>`;
  }

  /**
   * End an active call
   * @param {string} callSid - Exotel call SID
   */
  async endCall(callSid) {
    try {
      const response = await axios.post(`${this.baseUrl}/Calls/${callSid}`, {
        Status: 'completed'
      }, {
        headers: {
          'Authorization': `Basic ${this.authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error ending call:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get call details and status
   * @param {string} callSid - Exotel call SID
   */
  async getCallDetails(callSid) {
    try {
      const response = await axios.get(`${this.baseUrl}/Calls/${callSid}`, {
        headers: {
          'Authorization': `Basic ${this.authHeader}`
        }
      });

      return { success: true, call: response.data };
    } catch (error) {
      console.error('Error fetching call details:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse webhook data from Exotel
   * @param {object} webhookData - Webhook payload from Exotel
   */
  parseWebhookData(webhookData) {
    return {
      callSid: webhookData.CallSid,
      from: webhookData.From,
      to: webhookData.To,
      status: webhookData.CallStatus,
      duration: webhookData.CallDuration,
      sessionId: webhookData.CustomField1,
      propertyUrl: webhookData.CustomField2,
      timestamp: new Date()
    };
  }
}

module.exports = new ExotelService();