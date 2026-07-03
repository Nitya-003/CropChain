interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
}

interface ChatResponse {
  success: boolean;
  response: string;
  timestamp: string;
  functionCalled?: string;
  functionResult?: unknown;
  error?: string;
}

interface ChatContext {
  currentPage?: string;
  batchId?: string;
  userRole?: string;
}

class AIChatService {
  private baseUrl: string;
  private messages: ChatMessage[] = [];

  constructor() {
    this.baseUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:3001';
  }

  // Send message to AI backend
  async sendMessage(message: string, context?: ChatContext): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          context
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const data: ChatResponse = await response.json();
      return data;

    } catch (error) {
      console.error('AI Chat Service Error:', error);
      
      // Return fallback response
      return {
        success: false,
        response: "I'm sorry, I'm having trouble connecting right now. Please try again or contact support if the issue persists.",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendMessageStream(
    message: string,
    context: ChatContext | undefined,
    onToken: (token: string) => void
  ): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          context
        })
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to stream AI response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResponse: ChatResponse | null = null;

      const readEvents = (chunk: string) => {
        buffer += chunk;
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        events.forEach((eventText) => {
          const eventName = eventText.match(/^event: (.+)$/m)?.[1];
          const dataText = eventText.match(/^data: (.+)$/m)?.[1];
          if (!eventName || !dataText) return;

          const data = JSON.parse(dataText);

          if (eventName === 'token') {
            onToken(data.token || '');
          }

          if (eventName === 'done') {
            finalResponse = {
              success: true,
              response: data.response || '',
              timestamp: data.timestamp,
              functionCalled: data.functionCalled,
              functionResult: data.functionResult
            };
          }

          if (eventName === 'error') {
            throw new Error(data.error || 'AI stream failed');
          }
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        readEvents(decoder.decode(value, { stream: true }));
      }

      readEvents(decoder.decode());

      if (finalResponse) {
        return finalResponse;
      }

      throw new Error('AI stream ended before sending a final response');
    } catch (error) {
      console.error('AI Chat Stream Error:', error);

      return {
        success: false,
        response: "I'm sorry, I'm having trouble connecting right now. Please try again or contact support if the issue persists.",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get chat history
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  // Add message to history
  addMessage(content: string, sender: 'user' | 'assistant'): ChatMessage {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      sender,
      timestamp: new Date()
    };

    this.messages.push(message);
    return message;
  }

  updateMessage(id: string, content: string): ChatMessage | undefined {
    const message = this.messages.find(msg => msg.id === id);
    if (message) {
      message.content = content;
    }

    return message;
  }

  // Add typing indicator
  addTypingIndicator(): ChatMessage {
    const typingMessage: ChatMessage = {
      id: 'typing_indicator',
      content: 'CropAssistant is thinking...',
      sender: 'assistant',
      timestamp: new Date(),
      isTyping: true
    };

    this.messages.push(typingMessage);
    return typingMessage;
  }

  // Remove typing indicator
  removeTypingIndicator(): void {
    this.messages = this.messages.filter(msg => msg.id !== 'typing_indicator');
  }

  // Clear chat history
  clearHistory(): void {
    this.messages = [];
  }

  // Get suggested quick actions based on context
  // `labelKey` maps to an i18n translation key (see chatbot.quickActions in locales),
  // while `label` remains as an English fallback for callers that don't translate.
  // `message` is the literal query sent to the AI backend and is intentionally kept
  // in English, since full AI response translation is a future stretch goal.
  getQuickActions(context?: ChatContext): Array<{
    label: string;
    labelKey: string;
    labelParams?: Record<string, string>;
    message: string;
    icon: string;
  }> {
    const baseActions: Array<{
      label: string;
      labelKey: string;
      labelParams?: Record<string, string>;
      message: string;
      icon: string;
    }> = [
      {
        label: 'Track a Batch',
        labelKey: 'chatbot.quickActions.trackBatch',
        message: 'How do I track a batch?',
        icon: ''
      },
      {
        label: 'Help with QR Code',
        labelKey: 'chatbot.quickActions.qrCodeHelp',
        message: 'How do QR codes work in CropChain?',
        icon: ''
      },
      {
        label: 'Contact Admin',
        labelKey: 'chatbot.quickActions.contactAdmin',
        message: 'How can I contact an administrator?',
        icon: ''
      }
    ];

    // Add context-specific actions
    if (context?.currentPage === 'add-batch') {
      baseActions.unshift({
        label: 'Batch Creation Help',
        labelKey: 'chatbot.quickActions.batchCreationHelp',
        message: 'Help me create a new batch',
        icon: ''
      });
    }

    if (context?.currentPage === 'track-batch') {
      baseActions.unshift({
        label: 'Tracking Help',
        labelKey: 'chatbot.quickActions.trackingHelp',
        message: 'How do I search for a specific batch?',
        icon: ''
      });
    }

    if (context?.batchId) {
      baseActions.unshift({
        label: `About This Batch: ${context.batchId}`,
        labelKey: 'chatbot.quickActions.aboutThisBatch',
        labelParams: { batchId: context.batchId },
        message: `Tell me about batch ${context.batchId}`,
        icon: ''
      });
    }

    return baseActions;
  }

  // Get current page context from URL
  getCurrentPageContext(): ChatContext {
    if (typeof window === 'undefined') {
      return { currentPage: 'home', userRole: 'user' };
    }
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    
    let currentPage = 'home';
    if (path.includes('/add-batch')) currentPage = 'add-batch';
    else if (path.includes('/track-batch')) currentPage = 'track-batch';
    else if (path.includes('/update-batch')) currentPage = 'update-batch';
    else if (path.includes('/admin')) currentPage = 'admin';

    return {
      currentPage,
      batchId: searchParams.get('batchId') || undefined,
      userRole: 'user' // Could be enhanced with actual user role detection
    };
  }
}

export const aiChatService = new AIChatService();
export type { ChatMessage, ChatResponse, ChatContext };
