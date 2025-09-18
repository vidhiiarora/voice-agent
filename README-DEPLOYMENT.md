# 🚀 Deployment Guide - Voice Agent

## ✅ Production-Ready Code Changes Complete

All necessary changes have been made for production deployment:

- ✅ **Redis Integration**: Auto-switches between in-memory (dev) and Redis (production)
- ✅ **Environment Detection**: Automatically detects production environment
- ✅ **Production Configuration**: Environment templates and deployment files created
- ✅ **Frontend URL Auto-detection**: Works with any domain automatically

---

## 🎯 **EASIEST DEPLOYMENT: Railway.app (Recommended)**

### Total Time: **~10 minutes**

#### Step 1: Sign Up & Connect
```bash
# 1. Go to https://railway.app and sign up with GitHub
# 2. Connect your GitHub repository containing this code
```

#### Step 2: Deploy Backend
```bash
# 1. In Railway dashboard, click "New Project"
# 2. Select "Deploy from GitHub repo" 
# 3. Choose your voice-agent repository
# 4. Railway will auto-detect Node.js and deploy
```

#### Step 3: Add Redis Database
```bash
# 1. In your project, click "New Service"
# 2. Select "Database" → "Redis"
# 3. Railway automatically provides REDIS_URL environment variable
```

#### Step 4: Set Environment Variables
```bash
# In Railway project settings → Variables tab, add:

NODE_ENV=production
SERPER_API_KEY=your_serper_api_key
OPENAI_API_KEY=your_openai_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

#### Step 5: Deploy Frontend
```bash
# 1. Add new service → Static Site
# 2. Select "frontend" folder
# 3. Railway auto-deploys static files
```

#### Step 6: Update BASE_URL
```bash
# Once deployed, copy your Railway domain (e.g., https://yourapp-production.up.railway.app)
# Add this to environment variables:
BASE_URL=https://yourapp-production.up.railway.app
```

**🎉 Done! Your app is live and production-ready.**

---

## 🔧 Alternative Deployment Options

### **Option B: Heroku**
```bash
# 1. Install Heroku CLI
# 2. Login and create app
heroku login
heroku create your-voice-agent-app

# 3. Add Redis addon
heroku addons:create heroku-redis:mini

# 4. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set OPENAI_API_KEY=your_key
heroku config:set TWILIO_ACCOUNT_SID=your_sid
# ... add all other variables

# 5. Deploy
git push heroku main
```

### **Option C: DigitalOcean App Platform**
```bash
# 1. Go to https://cloud.digitalocean.com/apps
# 2. Create app from GitHub repository
# 3. Add Redis database component
# 4. Set environment variables in app settings
# 5. Deploy
```

### **Option D: Vercel (Frontend) + Railway (Backend)**
```bash
# Backend: Deploy to Railway (steps above)
# Frontend: Deploy to Vercel
npm install -g vercel
cd frontend
vercel --prod
```

---

## 🔑 Required API Keys & Setup

### **1. Twilio (Voice Calling)**
```bash
# Get keys from: https://console.twilio.com/
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### **2. OpenAI (AI Responses)**
```bash
# Get key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
```

### **3. Serper.dev (Property Search)**
```bash
# Get key from: https://serper.dev/api-key
SERPER_API_KEY=your_serper_key
```

---

## 🌍 Domain & SSL Setup

### **Custom Domain (Optional)**
```bash
# 1. In Railway/Heroku dashboard
# 2. Go to Settings → Custom Domain
# 3. Add your domain (e.g., voiceagent.yourdomain.com)
# 4. Update DNS CNAME record to point to Railway domain
# 5. SSL certificate is automatically provided
```

---

## 📊 Production Monitoring

### **Health Check Endpoint**
```bash
# Your app automatically includes:
GET https://yourdomain.com/
# Returns: "Housing.com AI Voice Agent is running"
```

### **Environment Verification**
```bash
# Check logs for:
🔴 Production mode detected - Using Redis for session storage
# vs
🟡 Development mode - Using in-memory storage
```

---

## 🚨 Troubleshooting

### **Common Issues:**

1. **"Redis connection failed"**
   ```bash
   # Ensure REDIS_URL environment variable is set
   # Railway/Heroku auto-provides this when you add Redis service
   ```

2. **"Twilio webhook errors"**
   ```bash
   # Ensure BASE_URL is set to your production domain
   BASE_URL=https://yourdomain.com
   ```

3. **"Frontend can't connect to backend"**
   ```bash
   # Code auto-detects backend URL
   # Ensure both frontend and backend are on same domain
   # Or enable CORS for cross-origin requests
   ```

---

## 🎯 **Quick Start Summary**

**For fastest deployment:**

1. **Sign up at Railway.app** (2 min)
2. **Connect GitHub repo** (1 min)
3. **Add Redis database** (1 min)
4. **Set environment variables** (3 min)
5. **Deploy** (3 min auto-deploy)

**Total: ~10 minutes to production! 🚀**

The app automatically handles:
- ✅ Development vs Production environments
- ✅ Redis vs In-memory storage
- ✅ Frontend/Backend URL detection
- ✅ SSL certificates
- ✅ Auto-restart on failures