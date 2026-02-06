# Troubleshooting AI Chat Errors

If you're seeing "AI service error" when using AI Legal Research, follow these steps:

## Common Issues

### 1. Missing or Invalid API Key

**Error**: "AI service error" or "Invalid API key"

**Solution**:
1. Check your `.env` file has `CLAUDE_API_KEY` set
2. Get your API key from https://console.anthropic.com
3. Make sure the key starts with `sk-ant-api03-`
4. Restart your dev server after adding/updating the key
5. In production (Vercel), add the key in Settings → Environment Variables

**Test**:
```bash
# Check if key is set
echo $CLAUDE_API_KEY
```

### 2. API Key Not Set in Production

**Error**: "AI service not configured"

**Solution**:
- Go to Vercel → Your Project → Settings → Environment Variables
- Add `CLAUDE_API_KEY` with your Anthropic API key
- Redeploy your application

### 3. Rate Limit Exceeded

**Error**: "Rate limit exceeded"

**Solution**:
- Wait a few minutes and try again
- Check your Anthropic account usage limits
- Consider upgrading your Anthropic plan

### 4. Invalid Request Format

**Error**: "Invalid request format" or 400 status

**Check**:
- Ensure messages array is not empty
- Each message has `role` ("user" or "assistant") and `content` (string)
- No empty content strings

### 5. Model Not Found

**Error**: 404 or "model not found"

**Solution**:
- The code uses `claude-3-5-sonnet-20241022`
- Verify this model is available in your Anthropic account
- Check Anthropic API status: https://status.anthropic.com

## Debugging Steps

### Check Server Logs

Look for error messages in your terminal (dev server) or Vercel logs:

```bash
# Local dev server logs
npm run dev
# Look for "Claude API error:" messages
```

### Test API Key Manually

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Check Environment Variables

**Local**:
```bash
# In your project root
cat .env | grep CLAUDE
```

**Vercel**:
- Go to project → Settings → Environment Variables
- Verify `CLAUDE_API_KEY` is set for the correct environment (Production/Preview)

## Error Messages Explained

| Error Message | Meaning | Fix |
|--------------|---------|-----|
| "AI service not configured" | `CLAUDE_API_KEY` missing or placeholder | Set real API key in `.env` |
| "Invalid API key" | API key is wrong or expired | Get new key from Anthropic console |
| "Rate limit exceeded" | Too many requests | Wait and retry, or upgrade plan |
| "AI service error" | Generic API error | Check server logs for details |
| "No valid messages to process" | Empty or invalid message array | Ensure messages have content |

## Quick Fix Checklist

- [ ] `CLAUDE_API_KEY` is set in `.env` (local) or Vercel (production)
- [ ] API key starts with `sk-ant-api03-` (not placeholder)
- [ ] Dev server restarted after adding key
- [ ] Vercel redeployed after adding key
- [ ] Anthropic account has credits/quota
- [ ] Check server logs for specific error details

## Getting Help

If errors persist:

1. **Check server logs** for the full error message
2. **Test API key** manually with curl (see above)
3. **Verify Anthropic account** has active subscription/credits
4. **Check Anthropic status page**: https://status.anthropic.com

## Example Working Configuration

`.env`:
```env
CLAUDE_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Vercel Environment Variables:
- Key: `CLAUDE_API_KEY`
- Value: `sk-ant-api03-...` (your actual key)
- Environment: Production, Preview, Development (all)
