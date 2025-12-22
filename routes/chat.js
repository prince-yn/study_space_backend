const express = require('express');
const router = express.Router();
const verifyToken = require('../auth_middleware');
const { generateWithFallback } = require('../config/gemini');
const Material = require('../models/Material');

// Context-aware chat endpoint
router.post('/ask', verifyToken, async (req, res) => {
    const { question, contextType, contextId } = req.body;

    try {
        if (!question || !question.trim()) {
            return res.status(400).json({ status: 'error', message: 'Question is required' });
        }

        let contextPrompt = '';
        let conversationParts = [];

        // Build context based on type
        if (contextType === 'material' && contextId) {
            // Get material content as context
            const material = await Material.findById(contextId);
            if (material) {
                contextPrompt = `You are a helpful study assistant. The student is currently reading the following study material:

**Title:** ${material.title}

**Content:**
${material.content}

---

Based on this material, please answer the following question in a clear, educational manner. Use LaTeX syntax for mathematical formulas ($formula$ for inline, $$formula$$ for block).`;
            }
        } else if (contextType === 'subject' && contextId) {
            contextPrompt = `You are a helpful study assistant. The student is asking a question related to their subject. Provide clear, educational answers. Use LaTeX syntax for mathematical formulas.`;
        } else {
            contextPrompt = `You are a helpful study assistant. Answer questions clearly and educationally. Use LaTeX syntax for mathematical formulas ($formula$ for inline, $$formula$$ for block).`;
        }

        conversationParts.push(contextPrompt);
        conversationParts.push(`\n\nStudent's Question: ${question}`);

        // Send to Gemini with automatic fallback
        const result = await generateWithFallback(conversationParts.join('\n'));
        const response = await result.response;
        const answer = response.text();

        res.json({
            status: 'success',
            answer: answer
        });

    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process question',
            error: error.message
        });
    }
});

// Multi-turn conversation support
router.post('/conversation', verifyToken, async (req, res) => {
    const { messages, contextType, contextId } = req.body;

    try {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Messages array is required' });
        }

        let contextPrompt = '';

        // Build context
        if (contextType === 'material' && contextId) {
            const material = await Material.findById(contextId);
            if (material) {
                contextPrompt = `Study Material Context:\n**${material.title}**\n\n${material.content.substring(0, 2000)}...\n\n---\n\n`;
            }
        }

        // Build conversation
        const conversationParts = [
            `You are a helpful study assistant. ${contextPrompt}Provide clear, educational answers. Use LaTeX for math.`
        ];

        messages.forEach(msg => {
            if (msg.role === 'user') {
                conversationParts.push(`\nStudent: ${msg.content}`);
            } else if (msg.role === 'assistant') {
                conversationParts.push(`\nAssistant: ${msg.content}`);
            }
        });

        // Send to Gemini with automatic fallback
        const result = await generateWithFallback(conversationParts.join('\n'));
        const response = await result.response;
        const answer = response.text();

        res.json({
            status: 'success',
            answer: answer
        });

    } catch (error) {
        console.error("Conversation Error:", error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process conversation',
            error: error.message
        });
    }
});

module.exports = router;
