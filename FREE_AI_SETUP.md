# MedQ Free AI Setup Guide

## Overview
MedQ now uses **Google Gemini API** (free tier) instead of Anthropic Claude for all AI features. This significantly reduces costs while maintaining high-quality AI capabilities.

## What Changed

### Before (Expensive - Claude API)
- Required paid Anthropic API key (~$0.015 per 1K tokens)
- Monthly costs could add up quickly with heavy usage
- Dependencies: `@anthropic-ai/sdk`

### After (Free - Google Gemini)
- Uses Google Gemini free tier (60 requests/minute free)
- No cost for typical student usage
- Zero dependencies added (uses native Node.js `https`)
- Same JSON extraction and error handling

## Setup Instructions

### 1. Get Your Free Gemini API Key

1. Visit: https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIza...`)

### 2. Set Environment Variable

#### For Local Development
```bash
# In your functions directory
cd functions
echo "GEMINI_API_KEY=your_key_here" >> .env
```

Or manually create/edit `functions/.env`:
```
GEMINI_API_KEY=AIzaSyD...your_actual_key
```

#### For Firebase Deployment
```bash
firebase functions:secrets:set GEMINI_API_KEY
# Paste your key when prompted
```

### 3. Install Dependencies
```bash
cd functions
npm install
```

### 4. Test Locally
```bash
npm run serve
```

### 5. Deploy
```bash
npm run deploy
```

## Features Using Free AI

All AI-powered features now use Gemini:

1. **Document Processing** - Extract study material from PDFs/images
2. **Question Generation** - Create practice questions from your notes
3. **Tutoring Help** - Get explanations for wrong answers
4. **Fix Plans** - Personalized study plans based on weaknesses

## Rate Limits

### Gemini Free Tier
- **60 requests per minute** (more than enough for individual students)
- **1,500 requests per day** 
- Context window: Up to 1M tokens (Gemini 1.5 Flash)

### Fallback Behavior
If AI fails (rate limit, network issue), the app gracefully falls back to:
- Basic question selection (non-AI)
- Pre-built study templates
- Manual fix plan generation

## Cost Comparison

| Feature | Claude (Old) | Gemini (New) | Savings |
|---------|-------------|--------------|---------|
| Generate 10 questions | ~$0.15 | $0.00 | 100% |
| Tutor explanation | ~$0.05 | $0.00 | 100% |
| Fix plan | ~$0.08 | $0.00 | 100% |
| Process 10-page PDF | ~$0.50 | $0.00 | 100% |
| **Monthly (avg student)** | **~$30-50** | **$0.00** | **100%** |

## Troubleshooting

### "GEMINI_API_KEY not set" warning
- Ensure you've set the environment variable
- For local dev: check `functions/.env`
- For deployed: run `firebase functions:secrets:set GEMINI_API_KEY`

### AI features not working
1. Check Cloud Function logs: `firebase functions:log`
2. Verify API key is valid at: https://makersuite.google.com
3. Check rate limits haven't been exceeded

### Want to switch back to Claude?
1. Reinstall: `npm install @anthropic-ai/sdk`
2. Set `ANTHROPIC_API_KEY` environment variable
3. Update imports in function files to use `aiClient.js` instead of `freeAIClient.js`

## Migration Notes

### Files Added
- `/functions/ai/freeAIClient.js` - New Gemini client
- `/functions/.env.example` - Environment template
- `/FREE_AI_SETUP.md` - This guide

### Files Modified
- `/functions/package.json` - Removed `@anthropic-ai/sdk` dependency
- `/functions/index.js` - Added missing function exports
- `/functions/tutor/getTutorHelp.js` - Now uses free AI
- `/functions/analytics/runFixPlan.js` - Now uses free AI
- `/functions/ai/prompts.js` - Updated prompt formats

### Files Created (Missing Functions)
- `/functions/course/createCourse.js`
- `/functions/tutor/getTutorHelp.js`
- `/functions/analytics/runFixPlan.js`

## Support

For issues or questions:
1. Check Firebase logs first
2. Verify API key is set correctly
3. Review rate limits at Google AI Studio
4. Ensure all dependencies are installed

---

**Enjoy free AI-powered studying! 🎉**
