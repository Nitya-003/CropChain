const axios = require('axios');

class AIService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = process.env.AI_MODEL || 'gpt-4o-mini';
        this.maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 500;
        this.temperature = parseFloat(process.env.AI_TEMPERATURE) || 0.7;
        
        if (!this.apiKey) {
            console.warn('OpenAI API key not found. AI chatbot will use fallback responses.');
        }
    }

    // CropChain knowledge base for grounding the AI
    getCropChainContext() {
        return `You are CropAssistant, an AI helper for CropChain - a blockchain-based crop tracking system.

CROPCHAIN OVERVIEW:
- Farm-to-fork supply chain tracking using blockchain technology
- Tracks crops from farmer → mandi → transport → retailer
- Each batch has a unique ID (format: CROP-YYYY-XXX) and QR code
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
                name: 'search_batch',
                description: 'Search for a specific crop batch by ID',
                parameters: {
                    type: 'object',
                    properties: {
                        batchId: {
                            type: 'string',
                            description: 'The batch ID to search for (format: CROP-YYYY-XXX)'
                        }
                    },
                    required: ['batchId']
                }
            },
            {
                name: 'get_batch_stats',
                description: 'Get overall statistics about batches in the system',
                parameters: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
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
        ];
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
                            message: `Batch ${parameters.batchId} not found. Please check the batch ID format (CROP-YYYY-XXX).`
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
        // Fallback responses if no API key
        if (!this.apiKey) {
            return this.getFallbackResponse(message);
        }

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
                model: this.model,
                messages: messages,
                functions: this.getFunctionDefinitions(),
                function_call: 'auto',
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
            if (aiResponse.function_call) {
                const functionName = aiResponse.function_call.name;
                const parameters = JSON.parse(aiResponse.function_call.arguments);
                
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
                    model: this.model,
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

    // Fallback responses when OpenAI is unavailable
    getFallbackResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('batch') && (lowerMessage.includes('track') || lowerMessage.includes('find'))) {
            return {
                success: true,
                message: "To track a batch, you can either scan the QR code or search by batch ID (format: CROP-YYYY-XXX) on the Track Batch page. This will show you the complete supply chain journey."
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