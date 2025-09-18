/**
 * salesAgent.js
 * AI-powered sales agent conversation service
 */

const axios = require('axios');

class SalesAgentService {
  constructor() {
    this.systemPrompt = `You are a polite and professional real estate sales agent making a follow-up call to a buyer who showed interest in a property.

Your conversation flow:

1. INTRODUCTION: Start by introducing yourself and asking if it's a good time to talk.
   - If yes, continue.
   - If no, politely ask if you can take just 2 minutes.
   - If still no, ask for a convenient time to follow up and confirm it.

2. ENGAGEMENT: Once engaged, ask if they are interested in discussing the property they enquired about.

3. IF INTERESTED: Guide them towards a site visit:
   - Ask for preferred day/time
   - Confirm their availability  
   - Note any special requirements
   - Provide property highlights

4. IF NOT INTERESTED: Politely ask for the reason:
   - Budget constraints
   - Location issues
   - Timing not right
   - Already bought elsewhere
   - Thank them for their time and log the feedback

Throughout the conversation:
- Be concise, polite, and natural
- Always confirm details and next steps clearly
- Reference specific property details when relevant
- Keep responses under 2-3 sentences
- End with gratitude and next steps

IMPORTANT: You have access to specific property information. Use it naturally in conversation.`;
  }

  async generateResponse(userMessage, conversationHistory, propertyInfo, customerInfo) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return this.getFallbackResponse(userMessage, conversationHistory, propertyInfo, customerInfo);
    }

    try {
      const messages = [
        { role: 'system', content: this.systemPrompt },
        { 
          role: 'system', 
          content: `Property Details: ${JSON.stringify(propertyInfo, null, 2)}` 
        },
        { 
          role: 'system', 
          content: `Customer Info: ${JSON.stringify(customerInfo, null, 2)}` 
        },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4',
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const aiResponse = response.data.choices[0].message.content.trim();
      
      // Check if conversation should end
      const shouldEnd = this.shouldEndCall(aiResponse, conversationHistory);
      const summary = shouldEnd ? this.generateCallSummary(conversationHistory, propertyInfo, customerInfo) : null;
      
      return {
        response: aiResponse,
        callEnded: shouldEnd,
        summary: summary
      };

    } catch (error) {
      console.error('OpenAI API error:', error.message);
      return this.getFallbackResponse(userMessage, conversationHistory, propertyInfo, customerInfo);
    }
  }

  getFallbackResponse(userMessage, conversationHistory, propertyInfo, customerInfo) {
    const lower = userMessage.toLowerCase();
    const customerName = customerInfo.name || 'there';
    const isFirstMessage = conversationHistory.length <= 1;
    
    // Introduction phase
    if (isFirstMessage) {
      return {
        response: `Hello ${customerName}! This is Sarah from Housing.com. I hope you're doing well. I'm calling regarding the ${propertyInfo.title || 'property'} you recently enquired about. Is this a good time to talk?`,
        callEnded: false,
        summary: null
      };
    }
    
    // Time availability responses
    if (lower.includes('no') || lower.includes('busy') || lower.includes('not a good time')) {
      if (conversationHistory.some(msg => msg.content.includes('2 minutes'))) {
        return {
          response: "I completely understand. When would be a convenient time for me to call you back? Would tomorrow evening around 6 PM work for you?",
          callEnded: false,
          summary: null
        };
      } else {
        return {
          response: "I understand you're busy. Could I take just 2 minutes of your time to share some exciting updates about this property?",
          callEnded: false,
          summary: null
        };
      }
    }
    
    // Positive responses
    if (lower.includes('yes') || lower.includes('sure') || lower.includes('ok') || lower.includes('good time')) {
      if (conversationHistory.some(msg => msg.content.includes('good time'))) {
        return {
          response: `Great! I wanted to discuss the ${propertyInfo.title || 'property'} in ${propertyInfo.location || 'prime location'}. Are you still interested in learning more about this ${propertyInfo.price || 'well-priced'} property?`,
          callEnded: false,
          summary: null
        };
      } else {
        return {
          response: "Wonderful! Thank you for your time. I'm calling about the property you showed interest in. Are you still looking for a property in this area?",
          callEnded: false,
          summary: null
        };
      }
    }
    
    // Interest in property
    if (lower.includes('interested') || lower.includes('tell me more') || lower.includes('details')) {
      return {
        response: `Excellent! This ${propertyInfo.bhk || 'beautiful'} property offers ${propertyInfo.amenities || 'great amenities'} and is ${propertyInfo.type === 'Sale' ? 'priced at ' + propertyInfo.price : 'available for rent at ' + propertyInfo.price}. Would you be interested in scheduling a site visit this weekend?`,
        callEnded: false,
        summary: null
      };
    }
    
    // Site visit scheduling
    if (lower.includes('visit') || lower.includes('see') || lower.includes('weekend') || lower.includes('saturday') || lower.includes('sunday')) {
      return {
        response: "Perfect! I can arrange a site visit for you. Would Saturday afternoon around 3 PM work for you, or would you prefer Sunday morning? I'll also share the exact location and my contact details.",
        callEnded: false,
        summary: null
      };
    }
    
    // Not interested responses
    if (lower.includes('not interested') || lower.includes('already bought') || lower.includes('found') || lower.includes('don\'t need')) {
      let reason = 'Customer not interested';
      if (lower.includes('budget')) reason = 'Budget constraints';
      if (lower.includes('location')) reason = 'Location not suitable';
      if (lower.includes('already')) reason = 'Already purchased elsewhere';
      if (lower.includes('timing')) reason = 'Timing not right';
      
      return {
        response: `I completely understand. Thank you for taking the time to speak with me today. If your situation changes in the future, please don't hesitate to reach out. Have a wonderful day!`,
        callEnded: true,
        summary: `Call completed. Reason: ${reason}. Customer was polite but not interested at this time.`
      };
    }
    
    // Confirmation responses
    if (lower.includes('confirm') || lower.includes('sounds good') || lower.includes('perfect')) {
      return {
        response: "Wonderful! I'll send you a confirmation message with all the details shortly. Thank you for your time today, and I look forward to showing you this beautiful property. Have a great day!",
        callEnded: true,
        summary: "Site visit scheduled successfully. Customer confirmed availability and expressed genuine interest."
      };
    }
    
    // Default responses
    return {
      response: "I understand. Could you please share what specific aspect you'd like to know more about? I'm here to help with any questions about the property, pricing, or scheduling a visit.",
      callEnded: false,
      summary: null
    };
  }

  shouldEndCall(response, conversationHistory) {
    const endIndicators = [
      'thank you for your time',
      'have a wonderful day',
      'have a great day',
      'call you back',
      'send you confirmation',
      'not interested',
      'already bought'
    ];
    
    const responseLower = response.toLowerCase();
    return endIndicators.some(indicator => responseLower.includes(indicator));
  }

  generateCallSummary(conversationHistory, propertyInfo, customerInfo) {
    const totalMessages = conversationHistory.length;
    const callDuration = Math.max(1, Math.floor(totalMessages / 2)); // Estimate duration
    
    // Analyze conversation for outcome
    const lastFewMessages = conversationHistory.slice(-4).map(msg => msg.content.toLowerCase()).join(' ');
    
    let outcome = 'Discussed property details';
    let nextSteps = 'Follow up later';
    
    if (lastFewMessages.includes('visit') || lastFewMessages.includes('schedule')) {
      outcome = 'Site visit scheduled';
      nextSteps = 'Send visit confirmation and location details';
    } else if (lastFewMessages.includes('not interested') || lastFewMessages.includes('already bought')) {
      outcome = 'Customer not interested';
      nextSteps = 'Update lead status as closed';
    } else if (lastFewMessages.includes('call back') || lastFewMessages.includes('later')) {
      outcome = 'Follow-up call requested';
      nextSteps = 'Schedule callback as per customer preference';
    }
    
    return `${outcome}. Property: ${propertyInfo.title || 'Property discussed'}. Duration: ~${callDuration} minutes. Next steps: ${nextSteps}`;
  }

  extractCustomerFeedback(conversationHistory) {
    const feedback = {
      interested: false,
      reasons: [],
      concerns: [],
      timeline: null
    };
    
    const fullConversation = conversationHistory.map(msg => msg.content.toLowerCase()).join(' ');
    
    // Interest level
    if (fullConversation.includes('interested') || fullConversation.includes('like') || fullConversation.includes('good')) {
      feedback.interested = true;
    }
    
    // Extract concerns
    if (fullConversation.includes('budget') || fullConversation.includes('expensive')) {
      feedback.concerns.push('Budget');
    }
    if (fullConversation.includes('location') || fullConversation.includes('far')) {
      feedback.concerns.push('Location');
    }
    if (fullConversation.includes('small') || fullConversation.includes('space')) {
      feedback.concerns.push('Size/Space');
    }
    
    // Timeline
    if (fullConversation.includes('immediate') || fullConversation.includes('urgent')) {
      feedback.timeline = 'Immediate';
    } else if (fullConversation.includes('month') || fullConversation.includes('soon')) {
      feedback.timeline = 'Within a month';
    } else if (fullConversation.includes('year') || fullConversation.includes('later')) {
      feedback.timeline = 'Later this year';
    }
    
    return feedback;
  }
}

module.exports = new SalesAgentService();