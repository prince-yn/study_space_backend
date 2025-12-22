const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generationConfig = {
    maxOutputTokens: 8192,
    temperature: 0.7,
};

const MODEL_HIERARCHY = [
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
];

const model = genAI.getGenerativeModel({
    model: MODEL_HIERARCHY[0],
    generationConfig
});

async function generateWithFallback(content, options = {}) {
    let lastError = null;

    for (let i = 0; i < MODEL_HIERARCHY.length; i++) {
        const modelId = MODEL_HIERARCHY[i];
        
        try {
            const currentModel = genAI.getGenerativeModel({
                model: modelId,
                generationConfig: { ...generationConfig, ...options }
            });
            
            const result = await currentModel.generateContent(content);
            const response = await result.response;
            response.text();

            return result;
        } catch (error) {
            lastError = error;

            if (error.status === 503 || error.status === 429) {
                continue;
            }

            throw error;
        }
    }

    throw lastError;
}

module.exports = { genAI, model, generateWithFallback, MODEL_HIERARCHY, generationConfig };
