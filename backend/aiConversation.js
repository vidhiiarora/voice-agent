/**
 * aiConversation.js
 * AI-powered conversation service for Housing.com sales agent
 */

const axios = require('axios');

class AIConversationService {
  constructor() {
    this.systemPrompt = `You are an AI sales agent from Housing.com. You have initiated a call with the user to help them in their property search.

Your role is to act like a professional, friendly property consultant. You should:

1. Introduce yourself as their personal property assistant from Housing.com
2. Ask relevant questions to understand their requirements:
   - Budget (in lakhs or crores)
   - City and locality preference
   - Property type (buy/rent)
   - BHK configuration (1BHK, 2BHK, 3BHK, etc.)
   - Timeline for purchase/rental
   - Any specific amenities or preferences
3. Guide the conversation naturally, like a real estate salesperson would
4. Keep responses concise and conversational (max 2-3 sentences)
5. Be empathetic and helpful
6. Summarize requirements back to confirm understanding
7. Remember what the user has already told you

When you have enough information, indicate readiness to search for properties by saying "Let me search for properties matching your criteria."

Keep your tone warm, professional, and genuinely helpful. Avoid being too salesy or pushy.`;
  }

  async generateResponse(userMessage, conversationHistory, userRequirements) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // Fallback response when OpenAI is not configured
      return this.getFallbackResponse(userMessage, userRequirements);
    }

    try {
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory,
        { 
          role: 'system', 
          content: `Current user requirements gathered: ${JSON.stringify(userRequirements, null, 2)}` 
        },
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

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      return this.getFallbackResponse(userMessage, userRequirements);
    }
  }

  getFallbackResponse(userMessage, requirements) {
    const lower = userMessage.toLowerCase();
    
    // Check if this is the first interaction
    if (!requirements.conversationStarted) {
      return "Hello! I'm Sarah from Housing.com, your personal property assistant. I'm here to help you find the perfect home. To get started, could you tell me what type of property you're looking for - are you planning to buy or rent?";
    }

    // Check if user is confirming to search
    if (requirements.waitingForConfirmation && 
        (lower.includes('yes') || lower.includes('ok') || lower.includes('sure') || 
         lower.includes('proceed') || lower.includes('search') || lower.includes('find'))) {
      return "Perfect! Let me search for properties matching your criteria. I'll find the best options for you.";
    }

    // Check if user wants to modify requirements
    if (requirements.waitingForConfirmation && 
        (lower.includes('no') || lower.includes('change') || lower.includes('modify') || 
         lower.includes('different') || lower.includes('wrong'))) {
      return "No problem! What would you like to change in your requirements? Please tell me your updated preferences.";
    }

    // Check for specific requirements
    if (!requirements.propertyType) {
      if (lower.includes('buy') || lower.includes('purchase')) {
        return "Great! You're looking to buy a property. What's your budget range, and which city are you considering?";
      } else if (lower.includes('rent') || lower.includes('rental')) {
        return "Perfect! You're looking for a rental property. What's your monthly budget, and which city would you prefer?";
      } else {
        return "I'd be happy to help! Are you looking to buy or rent a property?";
      }
    }

    if (!requirements.city) {
      return "Which city are you looking in? And do you have any specific locality preferences?";
    }

    if (!requirements.bhk) {
      return "What type of configuration are you looking for - 1BHK, 2BHK, 3BHK, or something else?";
    }

    if (!requirements.budget) {
      return "Could you share your budget range? This will help me find properties that fit your financial comfort zone.";
    }

    // If we have complete requirements but not confirmed, ask for confirmation
    if (this.hasCompleteRequirements(requirements) && !requirements.confirmed && !requirements.waitingForConfirmation) {
      const summary = this.generateRequirementsSummary(requirements);
      return `Let me confirm your requirements: ${summary}. Should I search for properties matching these criteria?`;
    }

    return "I understand. Could you tell me more about your specific requirements so I can help you better?";
  }

  generateRequirementsSummary(requirements) {
    const parts = [];
    if (requirements.propertyType) parts.push(`${requirements.propertyType === 'buy' ? 'buying' : 'renting'}`);
    if (requirements.bhk) parts.push(`a ${requirements.bhk}`);
    if (requirements.locality && requirements.city) parts.push(`in ${requirements.locality}, ${requirements.city}`);
    else if (requirements.city) parts.push(`in ${requirements.city}`);
    if (requirements.budget) parts.push(`with budget ${requirements.budget}`);
    
    return parts.join(' ');
  }

  extractRequirements(userMessage, currentRequirements) {
    const lower = userMessage.toLowerCase();
    const updated = { ...currentRequirements };

    // Mark conversation as started
    updated.conversationStarted = true;

    // Extract property type
    if (!updated.propertyType) {
      if (lower.includes('buy') || lower.includes('purchase') || lower.includes('buying')) {
        updated.propertyType = 'buy';
      } else if (lower.includes('rent') || lower.includes('rental') || lower.includes('renting')) {
        updated.propertyType = 'rent';
      }
    }

    // Extract budget
    if (!updated.budget) {
      const budgetPatterns = [
        /(\d+)\s?(lakh|lakhs|l)/i,
        /(\d+)\s?(crore|crores|cr)/i,
        /(\d+)\s?k/i,
        /budget.*?(\d+)/i,
        /around\s?(\d+)/i,
        /(\d+)\s?(thousand|k)/i
      ];

      for (const pattern of budgetPatterns) {
        const match = lower.match(pattern);
        if (match) {
          let amount = parseInt(match[1]);
          if (pattern.source.includes('crore')) {
            updated.budget = `${amount} Crore`;
          } else if (pattern.source.includes('lakh')) {
            updated.budget = `${amount} Lakh`;
          } else if (pattern.source.includes('thousand') || pattern.source.includes('k')) {
            updated.budget = `${amount}K`;
          } else {
            updated.budget = `${amount} Lakh`;
          }
          break;
        }
      }
    }

    // Extract city and locality
    const indianCities = ['mumbai', 'delhi', 'bangalore', 'chennai', 'hyderabad', 'pune', 'kolkata', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'pimpri', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'kalyan', 'vasai', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'navi mumbai', 'allahabad', 'ranchi', 'howrah', 'coimbatore', 'jabalpur', 'gwalior', 'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kota', 'guwahati', 'chandigarh', 'solapur', 'hubballi', 'tiruchirappalli', 'bareilly', 'mysore', 'tiruppur', 'gurgaon', 'aligarh', 'jalandhar', 'bhubaneswar', 'salem', 'warangal', 'mira', 'bhiwandi', 'saharanpur', 'gorakhpur', 'bikaner', 'amravati', 'noida', 'jamshedpur', 'bhilai', 'cuttack', 'firozabad', 'kochi', 'nellore', 'bhavnagar', 'dehradun', 'durgapur', 'asansol', 'rourkela', 'nanded', 'kolhapur', 'ajmer', 'akola', 'gulbarga', 'jamnagar', 'ujjain', 'loni', 'siliguri', 'jhansi', 'ulhasnagar', 'jammu', 'sangli', 'mangalore', 'erode', 'belgaum', 'ambattur', 'tirunelveli', 'malegaon', 'gaya', 'jalgaon', 'udaipur', 'maheshtala'];
    
    // First, check for specific patterns like "Lajpat Nagar Delhi" or "in Delhi"
    const locationPatterns = [
      /in\s+([a-zA-Z\s]+?)\s+(delhi|mumbai|bangalore|chennai|hyderabad|pune|kolkata)/i,
      /([a-zA-Z\s]+?)\s+(delhi|mumbai|bangalore|chennai|hyderabad|pune|kolkata)/i,
      /in\s+(delhi|mumbai|bangalore|chennai|hyderabad|pune|kolkata)/i
    ];

    for (const pattern of locationPatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        if (match.length === 3) {
          // Pattern with locality and city: "Lajpat Nagar Delhi"
          const locality = match[1].trim();
          const city = match[2].trim();
          if (!updated.locality && locality) updated.locality = locality;
          if (!updated.city && indianCities.includes(city.toLowerCase())) updated.city = city;
        } else if (match.length === 2) {
          // Pattern with just city: "in Delhi"
          const city = match[1].trim();
          if (!updated.city && indianCities.includes(city.toLowerCase())) updated.city = city;
        }
        break;
      }
    }

    // Fallback: look for any Indian city in the message
    if (!updated.city) {
      for (const city of indianCities) {
        if (lower.includes(city)) {
          updated.city = city.charAt(0).toUpperCase() + city.slice(1);
          break;
        }
      }
    }

    // Extract BHK
    if (!updated.bhk) {
      const bhkMatch = lower.match(/(\d+)\s?(bhk|bedroom)/);
      if (bhkMatch) {
        updated.bhk = `${bhkMatch[1]}BHK`;
      }
    }

    // Extract locality if mentioned
    const localityPatterns = [
      /locality.*?([a-zA-Z\s]+)/i,
      /area.*?([a-zA-Z\s]+)/i,
      /near.*?([a-zA-Z\s]+)/i
    ];

    for (const pattern of localityPatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        updated.locality = match[1].trim();
        break;
      }
    }

    return updated;
  }

  shouldSearchProperties(requirements) {
    // Only search when we have complete requirements AND user has confirmed
    return requirements.propertyType && 
           requirements.city && 
           requirements.bhk && 
           requirements.confirmed === true;
  }

  hasCompleteRequirements(requirements) {
    // Check if we have all basic requirements to ask for confirmation
    return requirements.propertyType && 
           requirements.city && 
           requirements.bhk;
  }

  generateSearchQuery(requirements) {
    const queryParts = [];
    
    // Add property type first
    if (requirements.propertyType === 'buy') queryParts.push('buy');
    if (requirements.propertyType === 'rent') queryParts.push('rent');
    
    if (requirements.bhk) queryParts.push(requirements.bhk);
    if (requirements.locality) queryParts.push(requirements.locality);
    if (requirements.city) queryParts.push(requirements.city);
    if (requirements.budget) queryParts.push(requirements.budget);
    
    // Always include site:housing.com for search
    return queryParts.join(' ') + ' site:housing.com';
  }
}

module.exports = new AIConversationService();