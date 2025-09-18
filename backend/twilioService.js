const twilio = require('twilio');
const OpenAI = require('openai');

class TwilioService {
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
        
        if (this.accountSid && this.authToken && 
            this.accountSid !== 'your_twilio_account_sid' && 
            this.authToken !== 'your_twilio_auth_token') {
            this.client = twilio(this.accountSid, this.authToken);
        } else {
            console.log('Twilio credentials not configured - voice calling will be disabled');
        }
        
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.activeCalls = new Map();
        this.callTranscripts = new Map();
    }

    async initiateCall(customerPhone, sessionId, propertyInfo = null) {
        if (!this.client) {
            throw new Error('Twilio not configured - missing credentials');
        }

        // Check if BASE_URL is accessible
        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        console.log(`🌐 Using webhook base URL: ${baseUrl}`);

        try {
            const webhookUrl = `${baseUrl}/twilio/voice-webhook/${sessionId}`;
            
            const call = await this.client.calls.create({
                to: customerPhone,
                from: this.phoneNumber,
                url: webhookUrl,
                method: 'POST',
                statusCallback: `${baseUrl}/twilio/status-webhook/${sessionId}`,
                statusCallbackMethod: 'POST',
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                record: true,
                recordingStatusCallback: `${baseUrl}/twilio/recording-webhook/${sessionId}`
            });

            this.activeCalls.set(sessionId, {
                callSid: call.sid,
                customerPhone,
                propertyInfo,
                status: 'initiated',
                startTime: new Date(),
                transcript: []
            });

            return {
                success: true,
                callSid: call.sid,
                status: call.status
            };
        } catch (error) {
            console.error('Error initiating Twilio call:', error);
            throw new Error(`Failed to initiate call: ${error.message}`);
        }
    }

    generateVoiceResponse(sessionId, message = null) {
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();

        if (message) {
            twiml.say({
                voice: 'Polly.Aditi',  // Indian English female voice
                language: 'en-IN'      // Indian English
            }, message);
        }

        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        
        twiml.gather({
            input: 'speech',
            timeout: 5,
            speechTimeout: 'auto',
            action: `${baseUrl}/twilio/gather-webhook/${sessionId}`,
            method: 'POST',
            language: 'en-IN'  // Indian English for speech recognition
        });

        twiml.say({
            voice: 'Polly.Aditi',  // Indian English female voice
            language: 'en-IN'
        }, "I didn't catch that. Could you please repeat?");

        twiml.redirect(`${baseUrl}/twilio/voice-webhook/${sessionId}`);

        return twiml.toString();
    }

    async processUserSpeech(speechResult, sessionId) {
        let callData = this.activeCalls.get(sessionId);
        if (!callData) {
            // Create a temporary call session for webhooks that don't have pre-existing calls
            console.log(`Creating temporary call session for ${sessionId}`);
            callData = {
                callSid: `temp-${sessionId}`,
                customerPhone: 'unknown',
                propertyInfo: null,
                status: 'in-progress',
                startTime: new Date(),
                transcript: []
            };
            this.activeCalls.set(sessionId, callData);
        }

        callData.transcript.push({
            type: 'user',
            message: speechResult,
            timestamp: new Date()
        });

        try {
            const aiResponse = await this.generateAIResponse(speechResult, callData);
            
            callData.transcript.push({
                type: 'ai',
                message: aiResponse,
                timestamp: new Date()
            });

            return this.generateVoiceResponse(sessionId, aiResponse);
        } catch (error) {
            console.error('Error processing speech:', error);
            return this.generateVoiceResponse(sessionId, "I'm sorry, I'm having trouble understanding. Could you please try again?");
        }
    }

    async generateAIResponse(userMessage, callData) {
        if (!this.openai.apiKey) {
            return this.getRuleBasedResponse(userMessage, callData);
        }

        const conversationHistory = callData.transcript.map(entry => ({
            role: entry.type === 'user' ? 'user' : 'assistant',
            content: entry.message
        }));

        const systemPrompt = `You are Sarah, a professional and friendly property consultant from Housing.com. You are currently on a voice call with a potential customer.

Current context:
${callData.propertyInfo ? `Property being discussed: ${JSON.stringify(callData.propertyInfo, null, 2)}` : 'No specific property being discussed yet.'}

Guidelines:
- Keep responses concise and conversational (under 50 words)
- Ask one question at a time
- Gather requirements: budget, city, BHK preference, property type
- If discussing a specific property, provide details and ask for interest
- Be helpful and professional
- Use natural speech patterns suitable for voice conversation`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...conversationHistory.slice(-10),
                    { role: "user", content: userMessage }
                ],
                max_tokens: 150,
                temperature: 0.7
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('OpenAI API error:', error);
            return this.getRuleBasedResponse(userMessage, callData);
        }
    }

    getRuleBasedResponse(userMessage, callData) {
        const message = userMessage.toLowerCase();
        
        if (message.includes('hello') || message.includes('hi')) {
            return "Hello! I'm Sarah from Housing.com. I'm here to help you find the perfect property. What type of property are you looking for?";
        }
        
        if (message.includes('budget') || message.includes('price')) {
            return "What's your budget range for the property you're looking for?";
        }
        
        if (message.includes('bhk') || message.includes('bedroom')) {
            return "How many bedrooms would you prefer? 1BHK, 2BHK, 3BHK, or more?";
        }
        
        if (message.includes('city') || message.includes('location')) {
            return "Which city or area are you interested in?";
        }
        
        if (callData.propertyInfo) {
            return `I have a great ${callData.propertyInfo.bhk || ''} property for you. It's located in ${callData.propertyInfo.location || 'a prime area'} with a price of ${callData.propertyInfo.price || 'competitive pricing'}. Would you like to know more details?`;
        }
        
        return "I understand. Could you tell me more about what you're looking for in a property? I'm here to help you find the perfect home.";
    }

    getCallStatus(sessionId) {
        return this.activeCalls.get(sessionId) || null;
    }

    async endCall(sessionId) {
        const callData = this.activeCalls.get(sessionId);
        if (callData && this.client) {
            try {
                await this.client.calls(callData.callSid).update({ status: 'completed' });
            } catch (error) {
                console.error('Error ending call:', error);
            }
        }
        
        if (callData) {
            callData.status = 'completed';
            callData.endTime = new Date();
        }
        
        return callData;
    }

    getCallTranscript(sessionId) {
        const callData = this.activeCalls.get(sessionId);
        return callData ? callData.transcript : [];
    }

    updateCallStatus(sessionId, status, callSid = null) {
        const callData = this.activeCalls.get(sessionId);
        if (callData) {
            callData.status = status;
            if (callSid) callData.callSid = callSid;
            
            if (status === 'completed') {
                callData.endTime = new Date();
            }
        }
    }
}

module.exports = new TwilioService();