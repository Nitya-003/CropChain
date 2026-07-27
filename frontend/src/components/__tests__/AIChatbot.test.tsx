import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockAiChatService, resetMockMessages } = vi.hoisted(() => {
  const msgs: Array<{
    id: string;
    content: string;
    sender: string;
    timestamp: Date;
  }> = [];
  return {
    mockAiChatService: {
      addMessage: vi.fn((content: string, sender: string) => {
        const msg = {
          id: `msg_${Date.now()}_${Math.random()}`,
          content,
          sender,
          timestamp: new Date(),
        };
        msgs.push(msg);
        return msg;
      }),
      getMessages: vi.fn(() => [...msgs]),
      updateMessage: vi.fn((id: string, content: string) => {
        const idx = msgs.findIndex((m) => m.id === id);
        if (idx >= 0) msgs[idx] = { ...msgs[idx], content };
        return msgs[idx];
      }),
      sendMessageStream: vi
        .fn()
        .mockResolvedValue({
          success: true,
          response: "Test reply",
          timestamp: new Date().toISOString(),
        }),
      sendMessageStreamWithContext: vi
        .fn()
        .mockResolvedValue({
          success: true,
          response: "Test reply",
          timestamp: new Date().toISOString(),
        }),
      getQuickActions: vi.fn().mockReturnValue([
        {
          label: "Track a Batch",
          labelKey: "chatbot.quickActions.trackBatch",
          message: "How do I track a batch?",
          icon: "",
        },
        {
          label: "Help with QR Code",
          labelKey: "chatbot.quickActions.qrCodeHelp",
          message: "How do QR codes work?",
          icon: "",
        },
        {
          label: "Contact Admin",
          labelKey: "chatbot.quickActions.contactAdmin",
          message: "How can I contact an admin?",
          icon: "",
        },
      ]),
      getCurrentPageContext: vi
        .fn()
        .mockReturnValue({ currentPage: "home", userRole: "user" }),
      clearHistory: vi.fn(),
    },
    resetMockMessages: () => {
      msgs.length = 0;
    },
  };
});

vi.mock("../../services/aiChatService", () => ({
  aiChatService: mockAiChatService,
}));

// Matches the identity-mock convention used across the suite (see Header.test.tsx):
// t() returns the translation key itself so assertions can target stable keys
// instead of locale-specific copy.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (options && Object.keys(options).length > 0) {
        return `${key}:${JSON.stringify(options)}`;
      }
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  MotionConfig: ({ children }: any) => <>{children}</>,
}));

const AIChatbot = (await import("../AIChatbot")).default;

describe("AIChatbot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockMessages();
  });

  it("renders the floating action button", () => {
    render(<AIChatbot />);
    const fab = screen.getByLabelText("chatbot.open");
    expect(fab).toBeInTheDocument();
  });

  it("opens chat window when FAB is clicked", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText("chatbot.open"));
    expect(screen.getByText("chatbot.title")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("chatbot.placeholder"),
    ).toBeInTheDocument();
  });

  it("shows welcome message when chat opens", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText("chatbot.open"));
    expect(screen.getByText("chatbot.welcomeMessage")).toBeInTheDocument();
  });

  it("shows quick action buttons when chat opens", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText("chatbot.open"));
    expect(
      screen.getByText("chatbot.quickActions.trackBatch"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("chatbot.quickActions.qrCodeHelp"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("chatbot.quickActions.contactAdmin"),
    ).toBeInTheDocument();
  });

  it("has send button disabled when input is empty", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText("chatbot.open"));
    const sendBtn = screen.getByLabelText("chatbot.sendMessage");
    expect(sendBtn).toBeDisabled();
  });

  it("send button becomes enabled when input has text", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText("chatbot.open"));
    const input = screen.getByPlaceholderText("chatbot.placeholder");
    await user.type(input, "Hello");
    const sendBtn = screen.getByLabelText("chatbot.sendMessage");
    expect(sendBtn).not.toBeDisabled();
  });

  it("sends message on Enter key press", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText("chatbot.open"));
    const input = screen.getByPlaceholderText("chatbot.placeholder");
    await user.type(input, "Track batch 123{Enter}");
    await waitFor(() => {
      expect(mockAiChatService.sendMessageStreamWithContext).toHaveBeenCalled();
    });
  });

  it("sends message on send button click", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText("chatbot.open"));
    const input = screen.getByPlaceholderText("chatbot.placeholder");
    await user.type(input, "What is my batch status?");
    await user.click(screen.getByLabelText("chatbot.sendMessage"));
    await waitFor(() => {
      expect(mockAiChatService.sendMessageStreamWithContext).toHaveBeenCalled();
    });
  });

  it("toggles minimize state on header click", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText("chatbot.open"));
    expect(
      screen.getByPlaceholderText("chatbot.placeholder"),
    ).toBeInTheDocument();
    await user.click(screen.getByText("chatbot.title"));
    expect(
      screen.queryByPlaceholderText("chatbot.placeholder"),
    ).not.toBeInTheDocument();
  });

  it("invokes quick action on click", async () => {
    const user = userEvent.setup();
    render(<AIChatbot />);
    await user.click(screen.getByLabelText("chatbot.open"));
    await user.click(screen.getByText("chatbot.quickActions.trackBatch"));
    await waitFor(() => {
      expect(
        mockAiChatService.sendMessageStreamWithContext,
      ).toHaveBeenCalledWith(
        "How do I track a batch?",
        expect.any(Object),
        expect.any(Function),
        expect.any(Function),
      );
    });
  });
});
