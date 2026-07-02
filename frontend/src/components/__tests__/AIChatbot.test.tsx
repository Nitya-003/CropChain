import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockAiChatService, resetMockMessages } = vi.hoisted(() => {
  const msgs: Array<{ id: string; content: string; sender: string; timestamp: Date }> = [];
  return {
    mockAiChatService: {
      addMessage: vi.fn((content: string, sender: string) => {
        const msg = { id: `msg_${Date.now()}_${Math.random()}`, content, sender, timestamp: new Date() };
        msgs.push(msg);
        return msg;
      }),
      getMessages: vi.fn(() => [...msgs]),
      updateMessage: vi.fn((id: string, content: string) => {
        const idx = msgs.findIndex(m => m.id === id);
        if (idx >= 0) msgs[idx] = { ...msgs[idx], content };
        return msgs[idx];
      }),
      sendMessageStream: vi.fn().mockResolvedValue({ success: true, response: 'Test reply', timestamp: new Date().toISOString() }),
      sendMessageStreamWithContext: vi.fn().mockResolvedValue({ success: true, response: 'Test reply', timestamp: new Date().toISOString() }),
      getQuickActions: vi.fn().mockReturnValue([
        { label: 'Track a Batch', message: 'How do I track a batch?', icon: '' },
        { label: 'Help with QR Code', message: 'How do QR codes work?', icon: '' },
        { label: 'Contact Admin', message: 'How can I contact an admin?', icon: '' },
      ]),
      getCurrentPageContext: vi.fn().mockReturnValue({ currentPage: 'home', userRole: 'user' }),
      clearHistory: vi.fn(),
    },
    resetMockMessages: () => { msgs.length = 0; },
  };
});

vi.mock('../../services/aiChatService', () => ({
  aiChatService: mockAiChatService,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  MotionConfig: ({ children }: any) => <>{children}</>,
}));

const AIChatbot = (await import('../AIChatbot')).default;

describe('AIChatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockMessages();
  });

  it('renders the floating action button', () => {
    render(<AIChatbot />);
    const fab = screen.getByLabelText('Open AI assistant');
    expect(fab).toBeInTheDocument();
  });

  it('opens chat window when FAB is clicked', async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText('Open AI assistant'));
    expect(screen.getByText('CropAssistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask about batches/)).toBeInTheDocument();
  });

  it('shows welcome message when chat opens', async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText('Open AI assistant'));
    expect(screen.getByText(/Hi! I'm CropAssistant/)).toBeInTheDocument();
  });

  it('shows quick action buttons when chat opens', async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText('Open AI assistant'));
    expect(screen.getByText('Track a Batch')).toBeInTheDocument();
    expect(screen.getByText('Help with QR Code')).toBeInTheDocument();
    expect(screen.getByText('Contact Admin')).toBeInTheDocument();
  });

  it('has send button disabled when input is empty', async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText('Open AI assistant'));
    const sendBtn = screen.getByLabelText('Send message');
    expect(sendBtn).toBeDisabled();
  });

  it('send button becomes enabled when input has text', async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText('Open AI assistant'));
    const input = screen.getByPlaceholderText(/Ask about batches/);
    await user.type(input, 'Hello');
    const sendBtn = screen.getByLabelText('Send message');
    expect(sendBtn).not.toBeDisabled();
  });

  it('sends message on Enter key press', async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText('Open AI assistant'));
    const input = screen.getByPlaceholderText(/Ask about batches/);
    await user.type(input, 'Track batch 123{Enter}');
    await waitFor(() => {
      expect(mockAiChatService.sendMessageStreamWithContext).toHaveBeenCalled();
    });
  });

  it('sends message on send button click', async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText('Open AI assistant'));
    const input = screen.getByPlaceholderText(/Ask about batches/);
    await user.type(input, 'What is my batch status?');
    await user.click(screen.getByLabelText('Send message'));
    await waitFor(() => {
      expect(mockAiChatService.sendMessageStreamWithContext).toHaveBeenCalled();
    });
  });

  it('toggles minimize state on header click', async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText('Open AI assistant'));
    expect(screen.getByPlaceholderText(/Ask about batches/)).toBeInTheDocument();
    await user.click(screen.getByText('CropAssistant'));
    expect(screen.queryByPlaceholderText(/Ask about batches/)).not.toBeInTheDocument();
  });

  it('invokes quick action on click', async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText('Open AI assistant'));
    await user.click(screen.getByText('Track a Batch'));
    await waitFor(() => {
      expect(mockAiChatService.sendMessageStreamWithContext).toHaveBeenCalledWith(
        'How do I track a batch?',
        expect.any(Object),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });
});
