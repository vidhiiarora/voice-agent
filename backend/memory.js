/**
 * Enhanced session memory store for AI conversation tracking.
 * For hackathon/demo purposes only. Use Redis for production.
 */
const store = new Map();

function get(sessionId) {
  const session = store.get(sessionId);
  if (!session) {
    return {
      requirements: {},
      conversationHistory: [],
      currentState: 'introduction',
      propertySearchHistory: [],
      userFeedback: [],
      callInfo: null,
      propertyInfo: null,
      customerInfo: null
    };
  }
  return session;
}

function update(sessionId, obj) {
  const cur = get(sessionId);
  const next = { ...cur, ...obj, updatedAt: new Date().toISOString() };
  store.set(sessionId, next);
  return next;
}

function updateRequirements(sessionId, requirements) {
  const session = get(sessionId);
  session.requirements = { ...session.requirements, ...requirements };
  session.updatedAt = new Date().toISOString();
  store.set(sessionId, session);
  return session;
}

function addToConversationHistory(sessionId, role, message) {
  const session = get(sessionId);
  session.conversationHistory.push({
    role,
    content: message,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 10 messages to avoid token limit
  if (session.conversationHistory.length > 10) {
    session.conversationHistory = session.conversationHistory.slice(-10);
  }
  
  store.set(sessionId, session);
  return session;
}

function addPropertySearchResult(sessionId, searchQuery, results) {
  const session = get(sessionId);
  session.propertySearchHistory.push({
    query: searchQuery,
    results,
    timestamp: new Date().toISOString()
  });
  store.set(sessionId, session);
  return session;
}

function addUserFeedback(sessionId, propertyId, feedback, reason) {
  const session = get(sessionId);
  session.userFeedback.push({
    propertyId,
    feedback, // 'like', 'dislike', 'interested', 'not_interested'
    reason,
    timestamp: new Date().toISOString()
  });
  store.set(sessionId, session);
  return session;
}

function updateConversationState(sessionId, state) {
  const session = get(sessionId);
  session.currentState = state; // 'introduction', 'gathering_requirements', 'searching', 'presenting_results', 'collecting_feedback', 'voice_call_active', 'call_ended'
  store.set(sessionId, session);
  return session;
}

// Call management functions
function setCallInfo(sessionId, callInfo) {
  const session = get(sessionId);
  session.callInfo = callInfo;
  store.set(sessionId, session);
  return session;
}

function setPropertyInfo(sessionId, propertyInfo) {
  const session = get(sessionId);
  session.propertyInfo = propertyInfo;
  store.set(sessionId, session);
  return session;
}

function setCustomerInfo(sessionId, customerInfo) {
  const session = get(sessionId);
  session.customerInfo = customerInfo;
  store.set(sessionId, session);
  return session;
}

function getCallInfo(sessionId) {
  const session = get(sessionId);
  return session.callInfo;
}

function getPropertyInfo(sessionId) {
  const session = get(sessionId);
  return session.propertyInfo;
}

function getCustomerInfo(sessionId) {
  const session = get(sessionId);
  return session.customerInfo;
}

function clear(sessionId) {
  store.delete(sessionId);
}

function getConversationHistory(sessionId) {
  const session = get(sessionId);
  return session.conversationHistory || [];
}

function getRequirements(sessionId) {
  const session = get(sessionId);
  return session.requirements || {};
}

function getUserFeedback(sessionId) {
  const session = get(sessionId);
  return session.userFeedback || [];
}

module.exports = { 
  get, 
  update, 
  updateRequirements,
  addToConversationHistory,
  addPropertySearchResult,
  addUserFeedback,
  updateConversationState,
  setCallInfo,
  setPropertyInfo,
  setCustomerInfo,
  getCallInfo,
  getPropertyInfo,
  getCustomerInfo,
  clear,
  getConversationHistory,
  getRequirements,
  getUserFeedback
};
