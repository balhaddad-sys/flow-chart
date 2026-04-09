/**
 * MedQ Free AI Client
 * Uses Google Gemini API (free tier) instead of Claude for cost-effective AI features
 * 
 * Setup: Set GEMINI_API_KEY environment variable
 * Get free key at: https://makersuite.google.com/app/apikey
 */

const https = require('https');

// Model configuration
const MODELS = {
  LIGHT: "gemini-1.5-flash",   // Fast, cheap - for blueprints, questions
  HEAVY: "gemini-1.5-pro",     // More capable - for tutoring, fix plans
};

const MAX_TOKENS = {
  blueprint: 2048,
  questions: 4096,
  tutoring: 1024,
  fixPlan: 2048,
  documentExtract: 1200,
};

// Get API key from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY not set. AI features will fall back to basic mode.');
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Robust JSON extraction from model output
 */
function extractJsonFromText(text) {
  // Try direct parse first
  try {
    JSON.parse(text);
    return text;
  } catch {
    // continue to cleanup
  }

  // Strip markdown code fences and trim
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Try direct parse after cleaning
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // continue to brace-matching
  }

  // Find first JSON object or array boundaries
  const firstOpen = Math.min(
    cleaned.indexOf("{") === -1 ? Infinity : cleaned.indexOf("{"),
    cleaned.indexOf("[") === -1 ? Infinity : cleaned.indexOf("[")
  );
  
  if (firstOpen === Infinity) {
    throw new Error("No JSON object or array found in model output.");
  }

  const isArray = cleaned[firstOpen] === "[";
  const closeChar = isArray ? "]" : "}";
  const lastClose = cleaned.lastIndexOf(closeChar);

  if (lastClose <= firstOpen) {
    throw new Error("Malformed JSON boundaries in model output.");
  }

  return cleaned.slice(firstOpen, lastClose + 1);
}

/**
 * Call Gemini API
 */
async function callGemini(systemPrompt, userPrompt, tier, maxTokens, retries = 2) {
  const model = MODELS[tier];
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
      
      const response = await geminiGenerateContent(model, combinedPrompt);
      
      if (!response || !response.candidates || !response.candidates[0]) {
        throw new Error('Invalid response from Gemini API');
      }
      
      const content = response.candidates[0].content;
      const text = content.parts.map(p => p.text).join('');
      
      // Extract JSON
      const jsonStr = extractJsonFromText(text);
      const parsed = JSON.parse(jsonStr);
      
      return {
        success: true,
        data: parsed,
        model,
        tokensUsed: {
          prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
          completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        }
      };
    } catch (error) {
      console.error(`Gemini call attempt ${attempt + 1}/${retries + 1} failed:`, {
        model,
        tier,
        error: error.message,
      });

      if (attempt === retries) {
        return {
          success: false,
          error: error.message,
          model,
        };
      }

      // Exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

/**
 * Make HTTP request to Gemini API
 */
function geminiGenerateContent(model, prompt) {
  return new Promise((resolve, reject) => {
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    };

    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Vision support with Gemini
 */
async function callGeminiVision({ systemPrompt, base64Image, mediaType = "image/jpeg", userText, tier, maxTokens, retries = 2 }) {
  const model = MODELS[tier];
  const t0 = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await geminiGenerateContentWithImage(
        model,
        systemPrompt,
        base64Image,
        mediaType,
        userText
      );

      if (!response || !response.candidates || !response.candidates[0]) {
        throw new Error('Invalid response from Gemini API');
      }

      const content = response.candidates[0].content;
      const text = content.parts.map(p => p.text).join('');
      
      const jsonStr = extractJsonFromText(text);
      const parsed = JSON.parse(jsonStr);

      return {
        success: true,
        data: parsed,
        model,
        tokensUsed: response.usageMetadata,
        ms: Date.now() - t0,
      };
    } catch (error) {
      console.error(`Vision call attempt ${attempt + 1}/${retries + 1} failed:`, {
        model,
        tier,
        error: error.message,
      });

      if (attempt === retries) {
        return {
          success: false,
          error: error.message,
          model,
          ms: Date.now() - t0,
        };
      }

      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

/**
 * Make HTTP request to Gemini API with image
 */
function geminiGenerateContentWithImage(model, systemPrompt, base64Image, mediaType, userText) {
  return new Promise((resolve, reject) => {
    const payload = {
      contents: [{
        parts: [
          { text: systemPrompt },
          {
            inline_data: {
              mime_type: mediaType,
              data: base64Image,
            },
          },
          { text: userText },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    };

    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// Convenience wrappers
async function generateBlueprint(systemPrompt, userPrompt) {
  return callGemini(systemPrompt, userPrompt, "LIGHT", MAX_TOKENS.blueprint);
}

async function generateQuestions(systemPrompt, userPrompt) {
  return callGemini(systemPrompt, userPrompt, "LIGHT", MAX_TOKENS.questions);
}

async function getTutorResponse(systemPrompt, userPrompt) {
  return callGemini(systemPrompt, userPrompt, "HEAVY", MAX_TOKENS.tutoring);
}

async function generateFixPlan(systemPrompt, userPrompt) {
  return callGemini(systemPrompt, userPrompt, "HEAVY", MAX_TOKENS.fixPlan);
}

module.exports = {
  MODELS,
  MAX_TOKENS,
  callGemini,
  callGeminiVision,
  extractJsonFromText,
  generateBlueprint,
  generateQuestions,
  getTutorResponse,
  generateFixPlan,
};
