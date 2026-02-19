import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, Leaf, User, Bot, Minimize2, Maximize2 } from 'lucide-react';
import { aiChatService, ChatMessage } from '../services/aiChatService';

const AIChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage = aiChatService.addMessage(
        "Hi! I'm CropAssistant 🌱 I can help you with batch tracking, QR codes, supply chain processes, and navigating CropChain. What would you like to know?",
        'assistant'
      );
      setMessages([welcomeMessage]);
    }
  }, []); // Only run once on mount

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Add user message
    const userMsg = aiChatService.addMessage(userMessage, 'user');
    setMessages(prev => [...prev, userMsg]);

    // Add typing indicator
    setIsLoading(true);
    const typingMsg = aiChatService.addTypingIndicator();
    setMessages(prev => [...prev, typingMsg]);

    try {
      // Get current context
      const context = aiChatService.getCurrentPageContext();
      
      // Send to AI service
      const response = await aiChatService.sendMessage(userMessage, context);
      
      // Remove typing indicator
      aiChatService.removeTypingIndicator();
      
      // Add AI response
      aiChatService.addMessage(response.response, 'assistant');
      setMessages(aiChatService.getMessages());

    } catch (error) {
      console.error('Chat error:', error);
      
      // Remove typing indicator and add error message
      aiChatService.removeTypingIndicator();
      aiChatService.addMessage(
        "I'm sorry, I encountered an error. Please try again or contact support if the issue persists.",
        'assistant'
      );
      setMessages(aiChatService.getMessages());
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (message: string) => {
    setInputMessage(message);
    setTimeout(() => handleSendMessage(), 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = aiChatService.getQuickActions(aiChatService.getCurrentPageContext());

  // Animation variants
  const fabVariants = {
    closed: { scale: 1, rotate: 0 },
    open: { scale: 1.1, rotate: 45 },
    hover: { scale: 1.15 }
  };

  const chatWindowVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8, 
      y: 50,
      transition: { duration: 0.2 }
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { 
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    }
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.8 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: "spring",
        stiffness: 500,
        damping: 30
      }
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.div 
        className="fixed bottom-6 right-6 z-50"
        whileHover="hover"
        whileTap={{ scale: 0.95 }}
      >
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          variants={fabVariants}
          animate={isOpen ? "open" : "closed"}
          className={`
            relative group transition-all duration-300 ease-out
            ${isOpen 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
            }
            text-white rounded-full p-4 shadow-2xl hover:shadow-green-500/25
            focus:outline-none focus:ring-4 focus:ring-green-500/30
          `}
          aria-label={isOpen ? 'Close chat' : 'Open AI assistant'}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 45, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <X className="h-6 w-6" />
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial={{ rotate: 45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -45, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageCircle className="h-6 w-6" />
                <motion.div 
                  className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)]"
            variants={chatWindowVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <motion.div 
              className={`
                bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl 
                border border-white/20 dark:border-gray-700/30 flex flex-col overflow-hidden
                ${isMinimized ? 'h-16' : 'h-[32rem] max-h-[calc(100vh-8rem)]'}
              `}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              
              {/* Header */}
              <motion.div 
                className="bg-gradient-to-r from-green-500 to-green-600 p-4 text-white cursor-pointer"
                onClick={() => setIsMinimized(!isMinimized)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <motion.div 
                      className="relative"
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    >
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <Leaf className="h-5 w-5" />
                      </div>
                      <motion.div 
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-lg">CropAssistant</h3>
                      <p className="text-green-100 text-sm">AI-powered crop tracking helper</p>
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                  </motion.button>
                </div>
              </motion.div>

              <AnimatePresence>
                {!isMinimized && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col flex-1"
                  >
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-green-200 dark:scrollbar-thumb-gray-600">
                      <AnimatePresence>
                        {messages.map((message, index) => (
                          <motion.div
                            key={message.id}
                            variants={messageVariants}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: index * 0.1 }}
                            className={`flex items-start space-x-3 ${
                              message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                            }`}
                          >
                            {/* Avatar */}
                            <motion.div 
                              className={`
                                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                                ${message.sender === 'user' 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-green-500 text-white'
                                }
                              `}
                              whileHover={{ scale: 1.1 }}
                            >
                              {message.sender === 'user' ? (
                                <User className="h-4 w-4" />
                              ) : (
                                <Bot className="h-4 w-4" />
                              )}
                            </motion.div>

                            {/* Message Bubble */}
                            <motion.div 
                              className={`
                                max-w-[80%] rounded-2xl px-4 py-3 shadow-sm
                                ${message.sender === 'user'
                                  ? 'bg-blue-500 text-white ml-auto'
                                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700'
                                }
                              `}
                              whileHover={{ scale: 1.02 }}
                              layout
                            >
                              {message.isTyping ? (
                                <div className="flex items-center space-x-1">
                                  <div className="flex space-x-1">
                                    {[0, 1, 2].map((i) => (
                                      <motion.div
                                        key={i}
                                        className="w-2 h-2 bg-green-500 rounded-full"
                                        animate={{ y: [0, -8, 0] }}
                                        transition={{
                                          duration: 0.6,
                                          repeat: Infinity,
                                          delay: i * 0.1
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                                    {message.content}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {message.content}
                                </p>
                              )}
                              
                              {/* Timestamp */}
                              <div className={`
                                text-xs mt-2 opacity-70
                                ${message.sender === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}
                              `}>
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </motion.div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Actions */}
                    {messages.length <= 2 && (
                      <motion.div 
                        className="px-4 py-2 border-t border-gray-200 dark:border-gray-700"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                      >
                        <div className="flex flex-wrap gap-2">
                          {quickActions.slice(0, 3).map((action, index) => (
                            <motion.button
                              key={index}
                              onClick={() => handleQuickAction(action.message)}
                              className="text-xs px-3 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors border border-green-200 dark:border-green-700"
                              disabled={isLoading}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.7 + index * 0.1 }}
                            >
                              <span className="mr-1">{action.icon}</span>
                              {action.label}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Input Area */}
                    <motion.div 
                      className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 relative">
                          <input
                            ref={inputRef}
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask about batches, QR codes, or supply chain..."
                            className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            disabled={isLoading}
                            maxLength={1000}
                          />
                          <motion.div 
                            className="absolute right-3 top-1/2 transform -translate-y-1/2"
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                          >
                            <Sparkles className="h-4 w-4 text-green-500" />
                          </motion.div>
                        </div>
                        
                        <motion.button
                          onClick={handleSendMessage}
                          disabled={!inputMessage.trim() || isLoading}
                          className="p-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed"
                          aria-label="Send message"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Send className="h-4 w-4" />
                        </motion.button>
                      </div>
                      
                      {/* Character count */}
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
                        {inputMessage.length}/1000
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatbot;