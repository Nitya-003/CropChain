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
                    description: 'Search for a specific crop batch by ID (supports full ID, partial ID, or ID with hashtag)',
                    parameters: {
                        type: 'object',
                        properties: {
                            batchId: {
                                type: 'string',
                                description: 'The batch ID or partial numeric ID to search for (e.g., CROP-2024-0001, BATCH000001, #1042, 1042)'
                            }
                        },
                        required: ['batchId']
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: 'search_batches',
                    description: 'Search for multiple crop batches matching specific filters (like crop type, farmer name, origin location, current stage, or status)',
                    parameters: {
                        type: 'object',
                        properties: {
                            cropType: {
                                type: 'string',
                                description: 'Optional crop type filter (e.g. rice, wheat, corn, tomato)'
                            },
                            farmerName: {
                                type: 'string',
                                description: 'Optional farmer name'
                            },
                            origin: {
                                type: 'string',
                                description: 'Optional origin location'
                            },
                            currentStage: {
                                type: 'string',
                                description: 'Optional current stage: farmer, mandi, transport, retailer'
                            },
                            status: {
                                type: 'string',
                                description: 'Optional status: Active, Flagged, Inactive'
                            }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: 'get_latest_batch',
                    description: 'Retrieve the most recently registered crop batch, optionally filtered by crop type',
                    parameters: {
                        type: 'object',
                        properties: {
                            cropType: {
                                type: 'string',
                                description: 'Optional crop type to filter the latest batch (e.g. rice, wheat, corn, tomato)'
                            }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: 'get_batch_stats',
                    description: 'Get overall dashboard statistics about batches in the system (total batches, total quantity, total farmers, recent activity)',
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
                    description: 'Explain a specific CropChain process or feature (e.g., batch creation, QR scanning, blockchain, lifecycle stages, transit tracking)',
                    parameters: {
                        type: 'object',
                        properties: {
                            topic: {
                                type: 'string',
                                description: 'The topic to explain'
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
                    const batch = await batchService.getBatchByIdOrPartial(parameters.batchId);
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
                                certifications: batch.certifications || 'None',
                                isRecalled: batch.isRecalled,
                                blockchainHash: batch.blockchainHash,
                                updates: (batch.updates || []).map(u => ({
                                    stage: u.stage,
                                    actor: u.actor,
                                    location: u.location,
                                    timestamp: u.timestamp,
                                    notes: u.notes
                                })),
                                lifecycle: batch.lifecycle ? {
                                    currentStage: batch.lifecycle.currentStage,
                                    stageHistory: (batch.lifecycle.stageHistory || []).map(h => ({
                                        stage: h.stage,
                                        timestamp: h.timestamp,
                                        updatedBy: h.updatedBy,
                                        notes: h.notes
                                    }))
                                } : null,
                                iotData: batch.iotData ? {
                                    currentTemperature: batch.iotData.currentTemperature,
                                    currentHumidity: batch.iotData.currentHumidity,
                                    isSpoiled: batch.iotData.isSpoiled
                                } : null
                            }
                        };
                    } else {
                        return {
                            success: false,
                            message: `Batch ${parameters.batchId} not found. Please try another search or check the ID format.`
                        };
                    }

                case 'search_batches':
                    const batches = await batchService.searchBatches(parameters);
                    return {
                        success: true,
                        data: (batches || []).map(b => ({
                            batchId: b.batchId,
                            cropType: b.cropType,
                            farmerName: b.farmerName,
                            origin: b.origin,
                            currentStage: b.currentStage,
                            quantity: b.quantity,
                            createdAt: b.createdAt
                        }))
                    };

                case 'get_latest_batch':
                    const latest = await batchService.getLatestBatch(parameters.cropType);
                    if (latest) {
                        return {
                            success: true,
                            data: {
                                batchId: latest.batchId,
                                cropType: latest.cropType,
                                farmerName: latest.farmerName,
                                origin: latest.origin,
                                currentStage: latest.currentStage,
                                quantity: latest.quantity,
                                harvestDate: latest.harvestDate,
                                certifications: latest.certifications || 'None',
                                isRecalled: latest.isRecalled,
                                blockchainHash: latest.blockchainHash,
                                updates: (latest.updates || []).map(u => ({
                                    stage: u.stage,
                                    actor: u.actor,
                                    location: u.location,
                                    timestamp: u.timestamp,
                                    notes: u.notes
                                })),
                                lifecycle: latest.lifecycle ? {
                                    currentStage: latest.lifecycle.currentStage,
                                    stageHistory: (latest.lifecycle.stageHistory || []).map(h => ({
                                        stage: h.stage,
                                        timestamp: h.timestamp,
                                        updatedBy: h.updatedBy,
                                        notes: h.notes
                                    }))
                                } : null,
                                iotData: latest.iotData ? {
                                    currentTemperature: latest.iotData.currentTemperature,
                                    currentHumidity: latest.iotData.currentHumidity,
                                    isSpoiled: latest.iotData.isSpoiled
                                } : null
                            }
                        };
                    } else {
                        return {
                            success: false,
                            message: `No batches found${parameters.cropType ? ' for crop type ' + parameters.cropType : ''}.`
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
            return await this.getSmartFallbackResponse(message, batchService);
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
                return await this.getSmartFallbackResponse(message, batchService);
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
            return await this.getSmartFallbackResponse(message, batchService);
        }
    }

    async chatStream(message, batchService, onToken) {
        if (this.provider === 'fallback') {
            const fallback = await this.getSmartFallbackResponse(message, batchService);
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
                const fallback = await this.getSmartFallbackResponse(message, batchService);
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
            const fallback = await this.getSmartFallbackResponse(message, batchService);
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

    // Smart Fallback responses that query MongoDB data directly when API key is not present
    async getSmartFallbackResponse(message, batchService) {
        const safeMessage = typeof message === 'string' ? message : '';
        const lowerMessage = safeMessage.toLowerCase();

        // 1. Check for batch ID pattern in user query (e.g. CROP-2024-0001, BATCH000001, #1042)
        const cropMatch = lowerMessage.match(/crop-\d{4}-\d{4}/);
        const batchMatch = lowerMessage.match(/batch\d{6}/);
        const numberMatch = lowerMessage.match(/#(\d+)/) || lowerMessage.match(/batch\s+#?(\d+)/) || lowerMessage.match(/#\s*(\d+)/);

        let batchIdSearch = null;
        if (cropMatch) batchIdSearch = cropMatch[0].toUpperCase();
        else if (batchMatch) batchIdSearch = batchMatch[0].toUpperCase();
        else if (numberMatch) batchIdSearch = numberMatch[1];

        if (batchIdSearch && batchService) {
            try {
                const batch = await batchService.getBatchByIdOrPartial(batchIdSearch);
                if (batch) {
                    // Build a rich, human-readable summary of the crop batch journey
                    const updatesText = (batch.updates || []).map(u => 
                        `- **${u.stage.toUpperCase()}**: Handled by *${u.actor}* at *${u.location}* (${new Date(u.timestamp).toLocaleDateString()}) - *${u.notes || 'No notes'}*`
                    ).join('\n');

                    const lifecycleText = batch.lifecycle && batch.lifecycle.stageHistory && batch.lifecycle.stageHistory.length > 0
                        ? '\n**Lifecycle History:**\n' + batch.lifecycle.stageHistory.map(h =>
                            `- **${h.stage}**: Updated by *${h.updatedBy}* (${new Date(h.timestamp).toLocaleDateString()}) - *${h.notes || 'No notes'}*`
                          ).join('\n')
                        : '';

                    const spoiledWarning = batch.iotData && batch.iotData.isSpoiled 
                        ? '\n⚠️ **Warning: Temperature logs indicate potential spoilage!**' 
                        : '';

                    const recalledWarning = batch.isRecalled 
                        ? '\n🚨 **CRITICAL: This batch has been recalled!**' 
                        : '';

                    return {
                        success: true,
                        message: `Here is the current status and journey for batch **${batch.batchId}** (${batch.cropType}):

- **Farmer/Origin:** ${batch.farmerName} at ${batch.origin}
- **Quantity:** ${batch.quantity} kg
- **Harvest Date:** ${new Date(batch.harvestDate).toLocaleDateString()}
- **Current Stage:** ${batch.currentStage.toUpperCase()}
- **Blockchain Tx Hash:** \`${batch.blockchainHash}\`
${recalledWarning}${spoiledWarning}

**Transit Updates:**
${updatesText}
${lifecycleText}

You can view the full interactive journey map here: [View Interactive Journey](/batch/${batch.batchId}/journey)`
                    };
                }
            } catch (error) {
                console.error('Smart fallback batch query error:', error);
            }
        }

        // 2. Check for "latest" and crop type query
        const cropTypes = ['rice', 'wheat', 'corn', 'tomato'];
        const foundCropType = cropTypes.find(c => lowerMessage.includes(c));

        if (lowerMessage.includes('latest') && foundCropType && batchService) {
            try {
                const batch = await batchService.getLatestBatch(foundCropType);
                if (batch) {
                    const qualityPassed = batch.lifecycle && batch.lifecycle.stageHistory && 
                        batch.lifecycle.stageHistory.some(h => h.stage === 'Quality Checked');
                    const qualityStatusText = qualityPassed 
                        ? '✅ Yes, it has passed its quality checks.' 
                        : '❌ No, it has not passed quality checks yet (or is not at that stage).';
                    
                    return {
                        success: true,
                        message: `The latest shipment of **${foundCropType}** is batch **${batch.batchId}**.
- **Current Stage:** ${batch.currentStage.toUpperCase()}
- **Quality Control Status:** ${qualityStatusText}

You can view the full journey of this batch here: [View Journey](/batch/${batch.batchId}/journey)`
                    };
                } else {
                    return {
                        success: true,
                        message: `No batches found for crop type **${foundCropType}**.`
                    };
                }
            } catch (error) {
                console.error('Smart fallback latest query error:', error);
            }
        }

        // 3. Check for search/find crop batches query
        if ((lowerMessage.includes('search') || lowerMessage.includes('find') || lowerMessage.includes('show')) && foundCropType && batchService) {
            try {
                const batches = await batchService.searchBatches({ cropType: foundCropType });
                if (batches && batches.length > 0) {
                    const listText = batches.map(b => 
                        `- **${b.batchId}**: Harvested by *${b.farmerName}* at *${b.origin}* (${b.quantity} kg) - Stage: *${b.currentStage.toUpperCase()}*`
                    ).join('\n');
                    
                    return {
                        success: true,
                        message: `Here are the matching batches found for **${foundCropType}**:
${listText}

Click on any batch ID to trace its journey.`
                    };
                } else {
                    return {
                        success: true,
                        message: `No batches found for crop type **${foundCropType}**.`
                    };
                }
            } catch (error) {
                console.error('Smart fallback search query error:', error);
            }
        }

        // 4. Check for statistics query
        if (lowerMessage.includes('stat') || lowerMessage.includes('dashboard') || lowerMessage.includes('total') || lowerMessage.includes('system statistics')) {
            try {
                const stats = await batchService.getDashboardStats();
                return {
                    success: true,
                    message: `Here are the current system statistics:
- **Total Registered Batches:** ${stats.stats.totalBatches}
- **Total Unique Farmers:** ${stats.stats.totalFarmers}
- **Total Crop Quantity:** ${stats.stats.totalQuantity} kg
- **Batches Added Last 30 Days:** ${stats.stats.recentBatches}`
                };
            } catch (error) {
                console.error('Smart fallback stats query error:', error);
            }
        }

        // 5. Fallback to existing static responses
        return this.getFallbackResponse(message);
    }

    // Fallback responses when API is unavailable
    // Used by server.js to guarantee QR/feature-aware responses even when the LLM path fails.
    getFallbackResponse(message) {
        const safeMessage = typeof message === 'string' ? message : '';
        const lowerMessage = safeMessage.toLowerCase();

        
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
        
    }

    // Calculate transit statistics for a specific crop type based on recent batches
    calculateTransitStats(batches, cropType) {
        let farmerToMandi = [];
        let mandiToTransport = [];
        let transportToRetailer = [];
        let totalTransit = [];

        batches.forEach(b => {
            const updates = b.updates || [];
            const farmerUpdate = updates.find(u => u.stage === 'farmer');
            const mandiUpdate = updates.find(u => u.stage === 'mandi');
            const transportUpdate = updates.find(u => u.stage === 'transport');
            const retailerUpdate = updates.find(u => u.stage === 'retailer');

            if (farmerUpdate && mandiUpdate) {
                farmerToMandi.push(new Date(mandiUpdate.timestamp) - new Date(farmerUpdate.timestamp));
            }
            if (mandiUpdate && transportUpdate) {
                mandiToTransport.push(new Date(transportUpdate.timestamp) - new Date(mandiUpdate.timestamp));
            }
            if (transportUpdate && retailerUpdate) {
                transportToRetailer.push(new Date(retailerUpdate.timestamp) - new Date(transportUpdate.timestamp));
            }
            if (farmerUpdate && retailerUpdate) {
                totalTransit.push(new Date(retailerUpdate.timestamp) - new Date(farmerUpdate.timestamp));
            }
        });

        const avg = arr => arr.length 
            ? (arr.reduce((a, b) => a + b, 0) / arr.length / (1000 * 60 * 60 * 24)).toFixed(2) + ' days' 
            : 'N/A';

        return {
            cropType,
            sampleSize: batches.length,
            averageFarmerToMandi: avg(farmerToMandi),
            averageMandiToTransport: avg(mandiToTransport),
            averageTransportToRetailer: avg(transportToRetailer),
            averageTotalTransit: avg(totalTransit)
        };
    }

    // Sanitize batch metadata to only expose necessary supply chain information
    sanitizeBatchMetadata(batch) {
        if (!batch) return null;
        
        return {
            batchId: batch.batchId,
            cropType: batch.cropType,
            quantity: batch.quantity,
            origin: batch.origin,
            harvestDate: batch.harvestDate,
            currentStage: batch.currentStage,
            isRecalled: batch.isRecalled || false,
            status: batch.status || 'Active',
            iotData: batch.iotData ? {
                currentTemperature: batch.iotData.currentTemperature,
                currentHumidity: batch.iotData.currentHumidity,
                isSpoiled: batch.iotData.isSpoiled || false
            } : null,
            updates: (batch.updates || []).map(u => ({
                stage: u.stage,
                actor: u.actor,
                location: u.location,
                timestamp: u.timestamp,
                notes: u.notes
            })),
            lifecycle: batch.lifecycle ? {
                currentStage: batch.lifecycle.currentStage,
                stageHistory: (batch.lifecycle.stageHistory || []).map(h => ({
                    stage: h.stage,
                    timestamp: h.timestamp,
                    updatedBy: h.updatedBy,
                    notes: h.notes
                }))
            } : null
        };
    }

    // Context-aware batch and supply chain metadata LLM query method
    async chatWithBatchContext(message, requestContext, batchService, onToken = null, onStatus = null) {
        const lowerMessage = message.toLowerCase();
        
        // 1. Check for batch ID patterns
        const cropMatch = lowerMessage.match(/crop-\d{4}-\d{4}/);
        const batchMatch = lowerMessage.match(/batch\d{6}/);
        const numberMatch = lowerMessage.match(/#(\d+)/) || lowerMessage.match(/batch\s+#?(\d+)/) || lowerMessage.match(/#\s*(\d+)/);

        let batchIdSearch = null;
        if (cropMatch) batchIdSearch = cropMatch[0].toUpperCase();
        else if (batchMatch) batchIdSearch = batchMatch[0].toUpperCase();
        else if (numberMatch) batchIdSearch = numberMatch[1];

        if (!batchIdSearch && requestContext && requestContext.batchId) {
            batchIdSearch = requestContext.batchId;
        }

        let fetchedBatch = null;
        if (batchIdSearch && batchService) {
            onStatus?.('Searching database for batch details...');
            try {
                fetchedBatch = await batchService.getBatchByIdOrPartial(batchIdSearch);
            } catch (error) {
                console.error('Error fetching batch context:', error);
            }
        }

        // 2. Check for crop types to provide transit stats
        const cropTypes = ['rice', 'wheat', 'corn', 'tomato'];
        const foundCropType = cropTypes.find(c => lowerMessage.includes(c));
        let cropTransitStats = null;

        if (foundCropType && batchService) {
            onStatus?.(`Calculating transit statistics for ${foundCropType}...`);
            try {
                const batchesOfCrop = await batchService.searchBatches({ cropType: foundCropType });
                if (batchesOfCrop && batchesOfCrop.length > 0) {
                    cropTransitStats = this.calculateTransitStats(batchesOfCrop, foundCropType);
                }
            } catch (error) {
                console.error('Error fetching crop batches for transit stats:', error);
            }
        }

        // 3. Assemble Prompt Context
        let contextText = '';
        if (fetchedBatch) {
            const sanitized = this.sanitizeBatchMetadata(fetchedBatch);
            contextText += `Specific Batch Details:\n${JSON.stringify(sanitized, null, 2)}\n\n`;
        }
        if (cropTransitStats) {
            contextText += `Transit Statistics for ${foundCropType.toUpperCase()}:\n${JSON.stringify(cropTransitStats, null, 2)}\n\n`;
        }

        if (!fetchedBatch && !cropTransitStats && batchService) {
            onStatus?.('Fetching general supply chain statistics...');
            try {
                const stats = await batchService.getDashboardStats();
                if (stats && stats.stats) {
                    contextText += `General System Statistics:\n${JSON.stringify({
                        totalBatches: stats.stats.totalBatches,
                        totalFarmers: stats.stats.totalFarmers,
                        totalQuantity: stats.stats.totalQuantity,
                        recentBatches: stats.stats.recentBatches
                    }, null, 2)}\n\n`;
                }
            } catch (e) {
                console.error('Error fetching dashboard stats for context:', e);
            }
        }

        // 4. Construct Restricted Prompt
        const systemPrompt = `You are CropAssistant, a strict context-aware AI supply chain assistant.
You have been provided with real-time supply chain metadata from the MongoDB database.

Here is the current database context:
---
${contextText || "No specific crop or batch metadata found in the database for this query."}
---

INSTRUCTIONS & CONSTRAINTS:
1. You must ONLY answer questions based on the provided supply chain metadata context above.
2. If the user asks a question that cannot be answered using the provided metadata, or asks about batches, crops, or topics not present in the context, you must reply: "I'm sorry, but I can only answer questions related to the supply chain batch data provided in this context. I do not have access to that information."
3. Do not assume, extrapolate, or hallucinate any details that are not explicitly present in the metadata.
4. Keep your responses precise, helpful, and professional.
5. If the context contains warnings (e.g. spoilage or recall), highlight them clearly using alert emojis.`;

        onStatus?.('Generating response...');

        // 5. Execute API/Fallback LLM Request
        if (this.provider === 'fallback') {
            const fallback = await this.getSmartFallbackResponse(message, batchService);
            const mentionsCrop = cropTypes.some(c => lowerMessage.includes(c));
            const mentionsBatch = lowerMessage.includes('batch') || lowerMessage.includes('#');
            const mentionsStats = lowerMessage.includes('stat') || lowerMessage.includes('dashboard') || lowerMessage.includes('total') || lowerMessage.includes('system statistics');
            
            let finalMessage = fallback.message;
            if (!mentionsCrop && !mentionsBatch && !mentionsStats) {
                finalMessage = "I'm sorry, but I can only answer questions related to the supply chain batch data provided in this context. I do not have access to that information.";
            }

            if (onToken) {
                await this.streamText(finalMessage, onToken);
            }
            return { success: true, message: finalMessage };
        }

        if (this.provider === 'gemini') {
            try {
                const model = this.genAI.getGenerativeModel({
                    model: this.modelName,
                    systemInstruction: systemPrompt,
                    generationConfig: {
                        maxOutputTokens: this.maxTokens,
                        temperature: this.temperature
                    }
                });

                if (onToken) {
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
                    return { success: true, message: text };
                } else {
                    const chat = model.startChat();
                    const result = await chat.sendMessage(message);
                    return { success: true, message: result.response.text() };
                }
            } catch (error) {
                console.error('Gemini context query error:', error.message);
                const fallback = await this.getSmartFallbackResponse(message, batchService);
                if (onToken) await this.streamText(fallback.message, onToken);
                return { success: true, message: fallback.message };
            }
        }

        // OpenAI Provider
        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ];

            if (onToken) {
                const result = await this.streamOpenAICompletion({
                    model: this.modelName,
                    messages,
                    max_tokens: this.maxTokens,
                    temperature: this.temperature
                }, onToken);
                return { success: true, message: result.message };
            } else {
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: this.modelName,
                    messages,
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
                    message: response.data.choices[0].message.content
                };
            }
        } catch (error) {
            console.error('OpenAI context query error:', error.response?.data || error.message);
            const fallback = await this.getSmartFallbackResponse(message, batchService);
            if (onToken) await this.streamText(fallback.message, onToken);
            return { success: true, message: fallback.message };
        }
    }
}

module.exports = new AIService();

