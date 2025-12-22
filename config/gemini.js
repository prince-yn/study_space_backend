const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


const MODEL_HIERARCHY = [
    'gemini-3-flash-preview', // Primary: fast frontier intelligence (Preview free tier)
    'gemini-2.5-flash',       // Fallback 1: balanced speed/performance, 1M context
    'gemini-2.0-flash',       // Fallback 2: reliable multimodal
    'gemini-2.5-flash-lite',  // Fallback 3: high-throughput efficiency
    'gemini-2.0-flash-lite',  // Fallback 4: lowest latency for simple tasks
];


// Default model for backwards compatibility
const model = genAI.getGenerativeModel({ model: MODEL_HIERARCHY[0] });

/**
 * Generate content with automatic model fallback on 503 errors
 * @param {Array|string} content - Content parts to send to Gemini
 * @param {Object} options - Optional generation config
 * @returns {Promise<Object>} - Generation result
 */
async function generateWithFallback(content, options = {}) {
    let lastError = null;
    
    for (const modelId of MODEL_HIERARCHY) {
        try {
            const currentModel = genAI.getGenerativeModel({ model: modelId });
            const result = await currentModel.generateContent(content, options);
            
            // Log which model was used (helpful for debugging)
            if (modelId !== MODEL_HIERARCHY[0]) {
                console.log(`[Gemini] Used fallback model: ${modelId}`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            
            // Only fallback on 503 (overloaded) or 429 (rate limit) errors
            if (error.status === 503 || error.status === 429) {
                console.warn(`[Gemini] Model ${modelId} unavailable (${error.status}), trying next...`);
                continue;
            }
            
            // For other errors, throw immediately
            throw error;
        }
    }
    
    // All models failed
    console.error('[Gemini] All models exhausted');
    throw lastError;
}

module.exports = { genAI, model, generateWithFallback, MODEL_HIERARCHY };
