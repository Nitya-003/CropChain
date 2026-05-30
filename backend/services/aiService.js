const axios = require('axios');

class AIService {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        this.provider = process.env.AI_PROVIDER;

        // Auto-detect provider if not explicitly set
        if (!this.provider) {
            if (this.geminiApiKey) {
                this.provider = 'gemini';
            } else if (this.openaiApiKey) {
                this.provider = 'openai';
            } else {
                this.provider = 'fallback';
            }
        }

        // Validate provider settings
        if (this.provider === 'gemini' && !this.geminiApiKey) {
            if (this.openaiApiKey) {
                this.provider = 'openai';
            } else {
                this.provider = 'fallback';
            }
        } else if (this.provider === 'openai' && !this.openaiApiKey) {
            if (this.geminiApiKey) {
                this.provider = 'gemini';
            } else {
                this.provider = 'fallback';
            }
        }

        this.maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 500;
        this.temperature = parseFloat(process.env.AI_TEMPERATURE) || 0.7;

        if (this.provider === 'gemini') {
            try {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
                this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
                console.log(`✓ AI chatbot initialized using Google Gemini (${this.modelName})`);
            } catch (error) {
                console.error('Failed to load Google Generative AI SDK, falling back to basic responses:', error.message);
                this.provider = 'fallback';
            }
        } else if (this.provider === 'openai') {
            this.apiKey = this.openaiApiKey;
            this.modelName = process.env.AI_MODEL || 'gpt-4o-mini';
            console.log(`✓ AI chatbot initialized using OpenAI (${this.modelName})`);
        } else {
            console.warn('OpenAI/Gemini API key not found. AI chatbot will use fallback responses.');
        }
    }

    // CropChain knowledge base for grounding the AI
    getCropChainContext() {
        return `You are CropAssistant, an AI helper for CropChain - a blockchain-based crop tracking system.

CROPCHAIN OVERVIEW:
- Farm-to-fork supply chain tracking using blockchain technology
- Tracks crops from farmer → mandi → transport → retailer
- Each batch has a unique ID (format: CROP-YYYY-XXXX) and QR code
- Immutable records ensure transparency and trust

SUPPLY CHAIN STAGES:
1. FARMER: Initial crop harvest and batch creation
2. MANDI: Agricultural market/wholesale processing
3. TRANSPORT: Logistics and distribution
4. RETAILER: Final sale to consumers

KEY FEATURES:
- Batch tracking with QR codes
- Immutable blockchain records
- Real-time supply chain updates
- Dashboard analytics for admins
- Mobile-friendly interface

USER ROLES:
- Farmers: Create batches, add harvest details
- Transporters: Update location and logistics info
- Retailers: Add final sale information
- Consumers: Track product origin via QR scan
- Admins: Monitor system-wide statistics

COMMON TERMS:
- Batch ID: Unique identifier for crop batches
- QR Code: Quick access to batch information
- Immutable Record: Cannot be changed once written to blockchain
- Supply Chain Update: Status change as product moves through stages
- Block Confirmation: Blockchain transaction verification

Be helpful, friendly, and focus on CropChain-specific guidance. Use agricultural terminology appropriately.`;
    }

    // Function definitions for OpenAI function calling
    getFunctionDefinitions() {
        return [
            {
                type: "function",
                function: {
                    name: 'search_batch',
                    description: 'Search for a specific crop batch by ID',
                    parameters: {
                        type: 'object',
                        properties: {
                            batchId: {
                                type: 'string',
                                description: 'The batch ID to search for (format: CROP-YYYY-XXXX)'
                            }
                        },
                        required: ['batchId']
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: 'get_batch_stats',
                    description: 'Get overall statistics about batches in the system',
                    parameters: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: 'explain_process',
                    description: 'Explain a specific CropChain process or feature',
                    parameters: {
                        type: 'object',
                        properties: {
                            topic: {
                                type: 'string',
                                description: 'The topic to explain (e.g., "batch creation", "QR scanning", "supply chain")'
                            }
                        },
                        required: ['topic']
                    }
                }
            }
        ];
    }

    // Convert OpenAI function definitions to Gemini function declarations
    getGeminiFunctionDeclarations() {
        const openAITools = this.getFunctionDefinitions();
        return openAITools.map(tool => {
            const fn = tool.function;
            const convertSchema = (schema) => {
                if (!schema) return schema;
                const newSchema = { ...schema };
                if (typeof newSchema.type === 'string') {
                    newSchema.type = newSchema.type.toUpperCase();
                }
                if (newSchema.properties) {
                    newSchema.properties = Object.fromEntries(
                        Object.entries(newSchema.properties).map(([key, val]) => [key, convertSchema(val)])
                    );
                }
                if (newSchema.items) {
                    newSchema.items = convertSchema(newSchema.items);
                }
                return newSchema;
            };

            return {
                name: fn.name,
                description: fn.description,
                parameters: convertSchema(fn.parameters)
            };
        });
    }

    // Execute function calls
    async executeFunction(functionName, parameters, batchService) {
        try {
            switch (functionName) {
                case 'search_batch':
                    const batch = await batchService.getBatch(parameters.batchId);
                    if (batch) {
                        return {
                            success: true,
                            data: {
                                batchId: batch.batchId,
                                farmerName: batch.farmerName,
                                cropType: batch.cropType,
                                quantity: batch.quantity,
                                currentStage: batch.currentStage,
                                origin: batch.origin,
                                harvestDate: batch.harvestDate,
                                updatesCount: batch.updates.length
                            }
                        };
                    } else {
                        return {
                            success: false,
                            message: `Batch ${parameters.batchId} not found. Please check the batch ID format (CROP-YYYY-XXXX).`
                        };
                    }

                case 'get_batch_stats':
                    const stats = await batchService.getDashboardStats();
                    return {
                        success: true,
                        data: {
                            totalBatches: stats.stats.totalBatches,
                            totalFarmers: stats.stats.totalFarmers,
                            totalQuantity: stats.stats.totalQuantity,
                            recentBatches: stats.stats.recentBatches
                        }
                    };

                case 'explain_process':
                    return this.getProcessExplanation(parameters.topic);

                default:
                    return {
                        success: false,
                        message: 'Unknown function requested.'
                    };
            }
        } catch (error) {
            console.error('Function execution error:', error);
            return {
                success: false,
                message: 'An error occurred while processing your request.'
            };
        }
    }

    // Process explanations
    getProcessExplanation(topic) {
        const explanations = {
            'batch creation': {
                success: true,
                explanation: 'To create a batch: 1) Go to "Add Batch" page, 2) Fill in farmer details, crop type, quantity, and harvest date, 3) Add certifications if applicable, 4) Submit to generate a unique batch ID and QR code, 5) The batch is recorded on the blockchain for immutable tracking.'
            },
            'qr scanning': {
                success: true,
                explanation: 'QR codes provide instant access to batch information. Consumers can scan the QR code on products to see the complete farm-to-fork journey, including farmer details, harvest date, and all supply chain updates.'
            },
            'supply chain': {
                success: true,
                explanation: 'The supply chain has 4 stages: Farmer (harvest) → Mandi (processing/wholesale) → Transport (logistics) → Retailer (final sale). Each stage update is recorded with timestamp, location, and actor details for complete traceability.'
            },
            'blockchain': {
                success: true,
                explanation: 'Blockchain ensures data immutability - once recorded, information cannot be altered. This creates trust between all parties and prevents fraud in the supply chain. Each update gets a unique hash for verification.'
            },
            'immutable record': {
                success: true,
                explanation: 'An immutable record means the data cannot be changed or deleted once written to the blockchain. This ensures the integrity of crop tracking information and builds trust among farmers, retailers, and consumers.'
            }
        };

        return explanations[topic.toLowerCase()] || {
            success: true,
            explanation: `I can help explain CropChain processes. Try asking about: batch creation, QR scanning, supply chain, blockchain, or immutable records.`
        };
    }

    // Main chat method
    async chat(message, batchService) {
        if (this.provider === 'fallback') {
            return this.getFallbackResponse(message);
        }

        if (this.provider === 'gemini') {
            try {
                const model = this.genAI.getGenerativeModel({
                    model: this.modelName,
                    systemInstruction: this.getCropChainContext(),
                    tools: [{ functionDeclarations: this.getGeminiFunctionDeclarations() }],
                    generationConfig: {
                        maxOutputTokens: this.maxTokens,
                        temperature: this.temperature
                    }
                });

                const chat = model.startChat();
                const result = await chat.sendMessage(message);
                const response = result.response;
                const functionCalls = response.functionCalls;

                if (functionCalls && functionCalls.length > 0) {
                    const toolCall = functionCalls[0];
                    const functionName = toolCall.name;
                    const parameters = toolCall.args;

                    const functionResult = await this.executeFunction(functionName, parameters, batchService);

                    // Send function result back to model
                    const followUpResult = await chat.sendMessage([
                        {
                            functionResponse: {
                                name: functionName,
                                response: functionResult
                            }
                        }
                    ]);

                    return {
                        success: true,
                        message: followUpResult.response.text(),
                        functionCalled: functionName,
                        functionResult: functionResult
                    };
                }

                return {
                    success: true,
                    message: response.text()
                };
            } catch (error) {
                console.error('Gemini API error:', error.message);
                return this.getFallbackResponse(message);
            }
        }

        // OpenAI Provider
        try {
            const messages = [
                {
                    role: 'system',
                    content: this.getCropChainContext()
                },
                {
                    role: 'user',
                    content: message
                }
            ];

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: this.modelName,
                messages: messages,
                tools: this.getFunctionDefinitions(),
                tool_choice: "auto",
                max_tokens: this.maxTokens,
                temperature: this.temperature
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const aiResponse = response.data.choices[0].message;

            // Handle function calls
            if (aiResponse.tool_calls) {
                const toolCall = aiResponse.tool_calls[0];
                const functionName = toolCall.function.name;
                const parameters = JSON.parse(toolCall.function.arguments);
                
                const functionResult = await this.executeFunction(functionName, parameters, batchService);
                
                // Send function result back to AI for natural response
                const followUpMessages = [
                    ...messages,
                    aiResponse,
                    {
                        role: 'function',
                        name: functionName,
                        content: JSON.stringify(functionResult)
                    }
                ];

                const followUpResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: this.modelName,
                    messages: followUpMessages,
                    max_tokens: this.maxTokens,
                    temperature: this.temperature
                }, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                return {
                    success: true,
                    message: followUpResponse.data.choices[0].message.content,
                    functionCalled: functionName,
                    functionResult: functionResult
                };
            }

            return {
                success: true,
                message: aiResponse.content
            };

        } catch (error) {
            console.error('OpenAI API error:', error.response?.data || error.message);
            
            // Fallback to local response on API error
            return this.getFallbackResponse(message);
        }
    }

    async chatStream(message, batchService, onToken) {
        if (this.provider === 'fallback') {
            const fallback = this.getFallbackResponse(message);
            await this.streamText(fallback.message, onToken);
            return fallback;
        }

        if (this.provider === 'gemini') {
            try {
                const model = this.genAI.getGenerativeModel({
                    model: this.modelName,
                    systemInstruction: this.getCropChainContext(),
                    tools: [{ functionDeclarations: this.getGeminiFunctionDeclarations() }],
                    generationConfig: {
                        maxOutputTokens: this.maxTokens,
                        temperature: this.temperature
                    }
                });

                const chat = model.startChat();
                const result = await chat.sendMessageStream(message);
                
                let text = '';
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        text += chunkText;
                        onToken(chunkText);
                    }
                }

                const response = await result.response;
                const functionCalls = response.functionCalls;

                if (functionCalls && functionCalls.length > 0) {
                    const toolCall = functionCalls[0];
                    const functionName = toolCall.name;
                    const parameters = toolCall.args;

                    const functionResult = await this.executeFunction(functionName, parameters, batchService);

                    // Send function result back to model with stream
                    const followUpResult = await chat.sendMessageStream([
                        {
                            functionResponse: {
                                name: functionName,
                                response: functionResult
                            }
                        }
                    ]);

                    let followUpText = '';
                    for await (const chunk of followUpResult.stream) {
                        const chunkText = chunk.text();
                        if (chunkText) {
                            followUpText += chunkText;
                            onToken(chunkText);
                        }
                    }

                    return {
                        success: true,
                        message: followUpText,
                        functionCalled: functionName,
                        functionResult: functionResult
                    };
                }

                return {
                    success: true,
                    message: text
                };
            } catch (error) {
                console.error('Gemini streaming API error:', error.message);
                const fallback = this.getFallbackResponse(message);
                await this.streamText(fallback.message, onToken);
                return fallback;
            }
        }

        // OpenAI Provider
        try {
            const messages = [
                {
                    role: 'system',
                    content: this.getCropChainContext()
                },
                {
                    role: 'user',
                    content: message
                }
            ];

            const initialResponse = await this.streamOpenAICompletion({
                model: this.modelName,
                messages,
                tools: this.getFunctionDefinitions(),
                tool_choice: 'auto',
                max_tokens: this.maxTokens,
                temperature: this.temperature
            }, onToken);

            if (initialResponse.toolCalls.length > 0) {
                const toolCall = initialResponse.toolCalls[0];
                const functionName = toolCall.function.name;
                const parameters = JSON.parse(toolCall.function.arguments || '{}');
                const functionResult = await this.executeFunction(functionName, parameters, batchService);
                const assistantToolCallMessage = {
                    role: 'assistant',
                    content: initialResponse.message || null,
                    tool_calls: initialResponse.toolCalls
                };

                const followUpResponse = await this.streamOpenAICompletion({
                    model: this.modelName,
                    messages: [
                        ...messages,
                        assistantToolCallMessage,
                        {
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(functionResult)
                        }
                    ],
                    max_tokens: this.maxTokens,
                    temperature: this.temperature
                }, onToken);

                return {
                    success: true,
                    message: followUpResponse.message,
                    functionCalled: functionName,
                    functionResult
                };
            }

            return {
                success: true,
                message: initialResponse.message
            };
        } catch (error) {
            console.error('OpenAI streaming API error:', error.response?.data || error.message);
            const fallback = this.getFallbackResponse(message);
            await this.streamText(fallback.message, onToken);
            return fallback;
        }
    }

    async streamOpenAICompletion(payload, onToken) {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            ...payload,
            stream: true
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            let buffer = '';
            let message = '';
            const toolCallsByIndex = new Map();

            response.data.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
                const events = buffer.split('\n\n');
                buffer = events.pop() || '';

                for (const event of events) {
                    const lines = event.split('\n').filter((line) => line.startsWith('data: '));

                    for (const line of lines) {
                        const data = line.replace(/^data: /, '').trim();
                        if (!data) continue;

                        if (data === '[DONE]') {
                            resolve({
                                message,
                                toolCalls: Array.from(toolCallsByIndex.entries())
                                    .sort(([a], [b]) => a - b)
                                    .map(([, toolCall]) => toolCall)
                            });
                            return;
                        }

                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        const content = delta?.content || '';

                        if (content) {
                            message += content;
                            onToken(content);
                        }

                        if (delta?.tool_calls) {
                            for (const partialToolCall of delta.tool_calls) {
                                const index = partialToolCall.index || 0;
                                const existing = toolCallsByIndex.get(index) || {
                                    id: '',
                                    type: 'function',
                                    function: {
                                        name: '',
                                        arguments: ''
                                    }
                                };

                                existing.id += partialToolCall.id || '';
                                existing.type = partialToolCall.type || existing.type;
                                existing.function.name += partialToolCall.function?.name || '';
                                existing.function.arguments += partialToolCall.function?.arguments || '';
                                toolCallsByIndex.set(index, existing);
                            }
                        }
                    }
                }
            });

            response.data.on('end', () => {
                if (buffer.trim()) {
                    try {
                        const data = buffer.replace(/^data: /, '').trim();
                        if (data && data !== '[DONE]') {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                message += content;
                                onToken(content);
                            }
                        }
                    } catch (error) {
                        reject(error);
                        return;
                    }
                }

                resolve({
                    message,
                    toolCalls: Array.from(toolCallsByIndex.entries())
                        .sort(([a], [b]) => a - b)
                        .map(([, toolCall]) => toolCall)
                });
            });

            response.data.on('error', reject);
        });
    }

    async streamText(text, onToken) {
        const words = text.split(/(\s+)/);
        for (const word of words) {
            if (!word) continue;
            onToken(word);
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }

    // Fallback responses when API is unavailable
    getFallbackResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('batch') && (lowerMessage.includes('track') || lowerMessage.includes('find'))) {
            return {
                success: true,
                message: "To track a batch, you can either scan the QR code or search by batch ID (format: CROP-YYYY-XXXX) on the Track Batch page. This will show you the complete supply chain journey."
            };
        }
        
        if (lowerMessage.includes('qr') || lowerMessage.includes('scan')) {
            return {
                success: true,
                message: "QR codes are generated automatically when you create a batch. Consumers can scan these codes to see the complete farm-to-fork journey of their products."
            };
        }
        
        if (lowerMessage.includes('create') || lowerMessage.includes('add')) {
            return {
                success: true,
                message: "To create a new batch, go to the 'Add Batch' page and fill in the farmer details, crop information, and harvest date. The system will generate a unique batch ID and QR code."
            };
        }
        
        if (lowerMessage.includes('blockchain') || lowerMessage.includes('immutable')) {
            return {
                success: true,
                message: "CropChain uses blockchain technology to create immutable records. Once data is recorded, it cannot be changed, ensuring transparency and trust in the supply chain."
            };
        }
        
        return {
            success: true,
            message: "I'm CropAssistant! I can help you with batch tracking, QR codes, supply chain processes, and navigating CropChain. What would you like to know?"
        };
    }
}

module.exports = new AIService();
