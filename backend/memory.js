/**
 * Enhanced session memory store for AI conversation tracking.
 * Automatically switches between in-memory (dev) and Redis (production).
 */

// Auto-detect production environment and use appropriate storage
const isProduction = process.env.NODE_ENV === 'production' || process.env.REDIS_URL || process.env.REDISCLOUD_URL;

let storage;

if (isProduction) {
  console.log('🔴 Production mode detected - Using Redis for session storage');
  const RedisMemory = require('./redisMemory');
  storage = new RedisMemory();
} else {
  console.log('🟡 Development mode - Using in-memory storage');
  // In-memory storage for development
  const store = new Map();
  
  storage = {
    isRedis: false,
    
    createDefaultSession() {
      return {
        requirements: {},
        conversationHistory: [],
        currentState: 'introduction',
        propertySearchHistory: [],
        userFeedback: [],
        callInfo: null,
        propertyInfo: null,
        customerInfo: null,
        meetingInfo: null
      };
    },
    
    get(sessionId) {
      const session = store.get(sessionId);
      if (!session) {
        return this.createDefaultSession();
      }
      return session;
    },
    
    set(sessionId, data) {
      store.set(sessionId, data);
    },
    
    clear(sessionId) {
      store.delete(sessionId);
    },
    
    // Compatibility methods for existing code
    async updateRequirements(sessionId, requirements) {
      const session = this.get(sessionId);
      session.requirements = { ...session.requirements, ...requirements };
      session.updatedAt = new Date().toISOString();
      this.set(sessionId, session);
      return session;
    },
    
    async addToConversationHistory(sessionId, role, message) {
      const session = this.get(sessionId);
      session.conversationHistory.push({
        role,
        content: message,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 messages to avoid token limit
      if (session.conversationHistory.length > 10) {
        session.conversationHistory = session.conversationHistory.slice(-10);
      }
      
      this.set(sessionId, session);
      return session;
    },
    
    async addPropertySearchResult(sessionId, searchQuery, results) {
      const session = this.get(sessionId);
      session.propertySearchHistory.push({
        query: searchQuery,
        results,
        timestamp: new Date().toISOString()
      });
      this.set(sessionId, session);
      return session;
    },
    
    async addUserFeedback(sessionId, propertyId, feedback, reason) {
      const session = this.get(sessionId);
      session.userFeedback.push({
        propertyId,
        feedback,
        reason,
        timestamp: new Date().toISOString()
      });
      this.set(sessionId, session);
      return session;
    },
    
    async updateConversationState(sessionId, state) {
      const session = this.get(sessionId);
      session.currentState = state;
      this.set(sessionId, session);
      return session;
    },
    
    async setCallInfo(sessionId, callInfo) {
      const session = this.get(sessionId);
      session.callInfo = callInfo;
      this.set(sessionId, session);
      return session;
    },
    
    async setPropertyInfo(sessionId, propertyInfo) {
      const session = this.get(sessionId);
      session.propertyInfo = propertyInfo;
      this.set(sessionId, session);
      return session;
    },
    
    async setCustomerInfo(sessionId, customerInfo) {
      const session = this.get(sessionId);
      session.customerInfo = customerInfo;
      this.set(sessionId, session);
      return session;
    },
    
    async setMeetingInfo(sessionId, meetingInfo) {
      const session = this.get(sessionId);
      session.meetingInfo = meetingInfo;
      this.set(sessionId, session);
      return session;
    },
    
    getConversationHistory(sessionId) {
      const session = this.get(sessionId);
      return session.conversationHistory || [];
    },
    
    getRequirements(sessionId) {
      const session = this.get(sessionId);
      return session.requirements || {};
    },
    
    getUserFeedback(sessionId) {
      const session = this.get(sessionId);
      return session.userFeedback || [];
    },
    
    getCallInfo(sessionId) {
      const session = this.get(sessionId);
      return session.callInfo;
    },
    
    getPropertyInfo(sessionId) {
      const session = this.get(sessionId);
      return session.propertyInfo;
    },
    
    getCustomerInfo(sessionId) {
      const session = this.get(sessionId);
      return session.customerInfo;
    }
  };
}

// Export unified interface that works with both Redis and in-memory storage
module.exports = storage;
