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
  functionResult?: any;
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
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
  getQuickActions(context?: ChatContext): Array<{ label: string; message: string; icon: string }> {
    const baseActions = [
      {
        label: 'Track a Batch',
        message: 'How do I track a batch?',
        icon: '🔍'
      },
      {
        label: 'Help with QR Code',
        message: 'How do QR codes work in CropChain?',
        icon: '📱'
      },
      {
        label: 'Contact Admin',
        message: 'How can I contact an administrator?',
        icon: '👨‍💼'
      }
    ];

    // Add context-specific actions
    if (context?.currentPage === 'add-batch') {
      baseActions.unshift({
        label: 'Batch Creation Help',
        message: 'Help me create a new batch',
        icon: '➕'
      });
    }

    if (context?.currentPage === 'track-batch') {
      baseActions.unshift({
        label: 'Tracking Help',
        message: 'How do I search for a specific batch?',
        icon: '🎯'
      });
    }

    if (context?.batchId) {
      baseActions.unshift({
        label: 'About This Batch',
        message: `Tell me about batch ${context.batchId}`,
        icon: '📦'
      });
    }

    return baseActions;
  }

  // Get current page context from URL
  getCurrentPageContext(): ChatContext {
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