# Claude AI Integration Setup

This guide explains how to set up Claude AI for the AI Legal Research feature.

## Prerequisites

1. **Anthropic API Account**: Sign up at https://console.anthropic.com
2. **API Key**: Get your API key from Anthropic Console → API Keys

## Setup Steps

### 1. Get Your Claude API Key

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy the API key (starts with `sk-ant-api03-...`)

### 2. Add API Key to Environment Variables

#### Local Development (`.env`)

Add to your `.env` file:

```env
CLAUDE_API_KEY=sk-ant-api03-...
```

#### Production (Vercel)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add:
   - **Key**: `CLAUDE_API_KEY`
   - **Value**: Your API key from Anthropic
4. **Redeploy** your application

## How It Works

### API Route

- **Endpoint**: `POST /api/ai/chat`
- **Authentication**: Requires signed-in user (Clerk)
- **Request Body**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "What are the requirements for company registration in Ghana?" },
      { "role": "assistant", "content": "..." }
    ],
    "attachments": [
      {
        "type": "image/png",
        "data": "base64-encoded-image-data",
        "name": "document.png"
      }
    ]
  }
  ```

### Features

- **Conversation History**: Maintains context across messages
- **Image Support**: Can process images (PDFs, documents need text extraction)
- **Legal Focus**: System prompt optimized for African law and AfCFTA
- **Error Handling**: Graceful error messages for users

### Model Used

- **Model**: `claude-3-5-sonnet-20241022` (latest Claude 3.5 Sonnet)
- **Max Tokens**: 4096
- **System Prompt**: Optimized for legal research in African jurisdictions

## Tier Limits

The AI Research feature respects user tier limits:

- **Free**: 0 queries (locked)
- **Basic**: 10 queries/month
- **Pro**: 50 queries/month
- **Plus/Team**: Unlimited queries

Day pass users get Pro-level access (50 queries) for 24 hours.

## Troubleshooting

### "AI service not configured" Error

- Check that `CLAUDE_API_KEY` is set in `.env` (local) or Vercel (production)
- Restart dev server after adding to `.env`
- Redeploy on Vercel after adding environment variable

### "Unauthorized" Error

- User must be signed in to use AI Research
- Check Clerk authentication is working

### "AI service error" Error

- Check API key is valid and has credits
- Verify Anthropic API status: https://status.anthropic.com
- Check API rate limits (Claude has rate limits per tier)

### Slow Responses

- Claude API can take 5-15 seconds for complex queries
- Large images increase processing time
- Check network connection

## API Costs

Claude API pricing (as of 2024):
- **Claude 3.5 Sonnet**: ~$3 per 1M input tokens, ~$15 per 1M output tokens
- Average query: ~500-2000 tokens
- Monitor usage in Anthropic Console

## Security Notes

⚠️ **Never commit API keys to git**
- API keys are in `.env` (already in `.gitignore`)
- Use environment variables in production
- Rotate keys if exposed

## Testing

After setup:

1. Sign in to your app
2. Go to `/ai-research`
3. Ask a question like: "What are the requirements for company registration in Ghana?"
4. You should get a real Claude AI response

## Next Steps

- Monitor API usage in Anthropic Console
- Set up usage alerts if needed
- Consider caching common queries
- Add rate limiting per user if needed
