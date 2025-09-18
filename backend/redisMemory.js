const redis = require('redis');

class RedisMemory {
    constructor() {
        this.isRedis = true;
        this.connected = false;
        
        // Create Redis client
        const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379';
        console.log('Connecting to Redis:', redisUrl.replace(/:[^@]*@/, ':***@')); // Hide password in logs
        
        this.client = redis.createClient({
            url: redisUrl,
            retry_strategy: (options) => {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    console.error('Redis connection refused');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    console.error('Redis retry time exhausted');
                    return new Error('Retry time exhausted');
                }
                if (options.attempt > 10) {
                    console.error('Redis max attempts reached');
                    return undefined;
                }
                return Math.min(options.attempt * 100, 3000);
            }
        });

        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
            this.connected = false;
        });

        this.client.on('connect', () => {
            console.log('Redis Client Connected');
            this.connected = true;
        });

        this.client.on('ready', () => {
            console.log('Redis Client Ready');
            this.connected = true;
        });

        // Connect to Redis
        this.connect();
    }

    async connect() {
        try {
            await this.client.connect();
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            this.connected = false;
        }
    }

    createDefaultSession() {
        return {
            requirements: {
                propertyType: null,
                budget: null,
                city: null,
                bhk: null,
                locality: null,
                confirmed: false,
                waitingForConfirmation: false
            },
            conversationHistory: [],
            currentState: 'introduction',
            propertySearchHistory: [],
            userFeedback: [],
            callInfo: null,
            propertyInfo: null,
            customerInfo: null,
            meetingInfo: null
        };
    }

    async get(sessionId) {
        if (!this.connected) {
            console.warn('Redis not connected, returning default session');
            return this.createDefaultSession();
        }

        try {
            const data = await this.client.get(`session:${sessionId}`);
            if (data) {
                return JSON.parse(data);
            }
            return this.createDefaultSession();
        } catch (error) {
            console.error('Redis get error:', error);
            return this.createDefaultSession();
        }
    }

    async set(sessionId, data) {
        if (!this.connected) {
            console.warn('Redis not connected, cannot save session');
            return;
        }

        try {
            // Set with 24 hour expiration
            await this.client.setEx(`session:${sessionId}`, 86400, JSON.stringify(data));
        } catch (error) {
            console.error('Redis set error:', error);
        }
    }

    async clear(sessionId) {
        if (!this.connected) {
            return;
        }

        try {
            await this.client.del(`session:${sessionId}`);
        } catch (error) {
            console.error('Redis clear error:', error);
        }
    }

    // Memory interface compatibility methods
    getRequirements(sessionId) {
        return this.get(sessionId).then(session => session.requirements);
    }

    async updateRequirements(sessionId, requirements) {
        const session = await this.get(sessionId);
        session.requirements = requirements;
        await this.set(sessionId, session);
    }

    async addToConversationHistory(sessionId, role, message) {
        const session = await this.get(sessionId);
        session.conversationHistory.push({
            role,
            content: message,
            timestamp: new Date().toISOString()
        });
        // Keep only last 50 messages to prevent unlimited growth
        if (session.conversationHistory.length > 50) {
            session.conversationHistory = session.conversationHistory.slice(-50);
        }
        await this.set(sessionId, session);
    }

    getConversationHistory(sessionId) {
        return this.get(sessionId).then(session => session.conversationHistory);
    }

    async updateConversationState(sessionId, state) {
        const session = await this.get(sessionId);
        session.currentState = state;
        await this.set(sessionId, session);
    }

    async addPropertySearchResult(sessionId, query, results) {
        const session = await this.get(sessionId);
        session.propertySearchHistory.push({
            query,
            results,
            timestamp: new Date().toISOString()
        });
        await this.set(sessionId, session);
    }

    async addUserFeedback(sessionId, propertyId, feedback, reason) {
        const session = await this.get(sessionId);
        session.userFeedback.push({
            propertyId,
            feedback,
            reason,
            timestamp: new Date().toISOString()
        });
        await this.set(sessionId, session);
    }

    getUserFeedback(sessionId) {
        return this.get(sessionId).then(session => session.userFeedback);
    }

    async setCallInfo(sessionId, callInfo) {
        const session = await this.get(sessionId);
        session.callInfo = callInfo;
        await this.set(sessionId, session);
    }

    async setPropertyInfo(sessionId, propertyInfo) {
        const session = await this.get(sessionId);
        session.propertyInfo = propertyInfo;
        await this.set(sessionId, session);
    }

    async setCustomerInfo(sessionId, customerInfo) {
        const session = await this.get(sessionId);
        session.customerInfo = customerInfo;
        await this.set(sessionId, session);
    }

    async setMeetingInfo(sessionId, meetingInfo) {
        const session = await this.get(sessionId);
        session.meetingInfo = meetingInfo;
        await this.set(sessionId, session);
    }

    async disconnect() {
        if (this.connected && this.client) {
            await this.client.disconnect();
        }
    }
}

module.exports = RedisMemory;