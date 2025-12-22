const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI with timeout settings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Generation config with reasonable limits
const generationConfig = {
    maxOutputTokens: 8192, // Limit output to avoid endless generation
    temperature: 0.7,
};

const MODEL_HIERARCHY = [
    'gemini-3-flash-preview', // 1. Best: 64K output cap + 220 tokens/sec speed. Fastest for long-form content.
    'gemini-2.5-flash',       // 2. High Capacity: 64K output cap. Reliable for massive text generation.
    'gemini-2.5-flash-lite',  // 3. Efficiency: 64K output cap. Lowest latency for high-volume long tasks.
    'gemini-2.0-flash',       // 4. Low Cap: Limited to 8,192 output tokens. Fast, but cuts off much sooner.
    'gemini-2.0-flash-lite',  // 5. Low Cap: Limited to 8,192 output tokens. Best for short, quick visual labels.
];


// Default model for backwards compatibility
const model = genAI.getGenerativeModel({
    model: MODEL_HIERARCHY[0],
    generationConfig
});

/**
 * Generate content with automatic model fallback on 503 errors
 * @param {Array|string} content - Content parts to send to Gemini
 * @param {Object} options - Optional generation config
 * @returns {Promise<Object>} - Generation result
 */
async function generateWithFallback(content, options = {}) {
    let lastError = null;
    
    console.log(`[Gemini] Starting generation with ${MODEL_HIERARCHY.length} models in hierarchy`);
    console.log(`[Gemini] Models: ${MODEL_HIERARCHY.join(' → ')}`);

    for (let i = 0; i < MODEL_HIERARCHY.length; i++) {
        const modelId = MODEL_HIERARCHY[i];
        const attemptNum = i + 1;
        
        try {
            console.log(`[Gemini] Attempt ${attemptNum}/${MODEL_HIERARCHY.length}: Trying ${modelId}...`);
            
            const currentModel = genAI.getGenerativeModel({
                model: modelId,
                generationConfig: { ...generationConfig, ...options }
            });
            
            const startTime = Date.now();
            const result = await currentModel.generateContent(content);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            // Check if we got a response
            const response = await result.response;
            const text = response.text();
            const tokenCount = text.length;
            
            console.log(`✅ [Gemini] SUCCESS with ${modelId} (${duration}s, ${tokenCount} chars)`);
            
            if (modelId !== MODEL_HIERARCHY[0]) {
                console.log(`⚠️  [Gemini] Note: Primary model failed, using fallback: ${modelId}`);
            }

            return result;
        } catch (error) {
            lastError = error;
            const errorMsg = error.message || error.toString();
            const errorStatus = error.status || 'unknown';
            
            console.error(`❌ [Gemini] FAILED with ${modelId} (Status: ${errorStatus})`);
            console.error(`   Error: ${errorMsg.substring(0, 200)}`);

            // Only fallback on 503 (overloaded) or 429 (rate limit) errors
            if (error.status === 503 || error.status === 429) {
                console.warn(`🔄 [Gemini] Falling back to next model (${attemptNum}/${MODEL_HIERARCHY.length} failed)...`);
                continue;
            }

            // For other errors, throw immediately
            console.error(`💥 [Gemini] Non-recoverable error (${errorStatus}), stopping fallback`);
            throw error;
        }
    }

    // All models failed
    console.error(`💀 [Gemini] ALL ${MODEL_HIERARCHY.length} MODELS EXHAUSTED - complete failure`);
    console.error(`   Last error: ${lastError?.message || lastError}`);
    throw lastError;
}

module.exports = { genAI, model, generateWithFallback, MODEL_HIERARCHY, generationConfig };
