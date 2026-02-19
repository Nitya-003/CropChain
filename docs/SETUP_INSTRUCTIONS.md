# CropChain AI Chatbot Setup Instructions

## Quick Setup

1. **Install Dependencies**
   ```bash
   npm install --legacy-peer-deps
   cd backend && npm install
   ```

2. **Configure Environment**
   ```bash
   # Copy environment files
   cp backend/.env.example backend/.env
   cp .env.example .env
   
   # Add your OpenAI API key to backend/.env (optional)
   echo "OPENAI_API_KEY=your_key_here" >> backend/.env
   ```

3. **Start Development Servers**
   ```bash
   # Terminal 1: Frontend
   npm run dev
   
   # Terminal 2: Backend  
   cd backend && npm run dev
   ```

4. **Test the AI Chatbot**
   - Open http://localhost:5173
   - Look for the floating chat button (bottom-right)
   - Try asking: "How do I track a batch?"

## Features

- ✅ AI-powered conversational interface
- ✅ Glassmorphic design with smooth animations
- ✅ Context-aware responses
- ✅ Real-time batch data queries
- ✅ Fallback mode (works without OpenAI API key)
- ✅ Mobile-responsive design

## API Endpoints

- `POST /api/ai/chat` - AI chat interface
- `GET /api/health` - Health check with AI status

## Troubleshooting

If you encounter issues:
1. Check that both servers are running
2. Verify CORS settings in backend/.env
3. Test API directly: `curl http://localhost:3001/api/health`

For detailed documentation, see `docs/AI_CHATBOT.md`
