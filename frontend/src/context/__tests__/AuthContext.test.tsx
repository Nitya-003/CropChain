import { render, screen, waitFor, act } from "@testing-library/react";

const { mockAuthService, mockUser } = vi.hoisted(() => {
  const user = {
    id: "1",
    name: "Test Farmer",
    email: "farmer@test.com",
    role: "farmer" as const,
  };
  const service = {
    login: vi.fn(),
    register: vi.fn(),
    refreshSession: vi.fn().mockRejectedValue(new Error("No session")),
    getNonce: vi.fn().mockResolvedValue("test-nonce-123"),
    walletLogin: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn(),
    getToken: vi.fn(),
  };
  return { mockAuthService: service, mockUser: user };
});

vi.mock("../../services/auth.service", () => ({
  authService: mockAuthService,
}));

const { AuthProvider, useAuth } = await import("../AuthContext");

function TestConsumer() {
  const {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    connectWallet,
    walletLogin,
    isWalletConnected,
  } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading ? "loading" : "idle"}</span>
      <span data-testid="authenticated">{isAuthenticated ? "yes" : "no"}</span>
      <span data-testid="wallet-connected">
        {isWalletConnected ? "yes" : "no"}
      </span>
      <span data-testid="user-role">{user?.role || "none"}</span>
      <button
        data-testid="btn-login"
        onClick={() => login({ email: "farmer@test.com", password: "pass" })}
      >
        Login
      </button>
      <button data-testid="btn-logout" onClick={() => logout()}>
        Logout
      </button>
      <button data-testid="btn-connect-wallet" onClick={() => connectWallet()}>
        Connect Wallet
      </button>
      <button data-testid="btn-wallet-login" onClick={() => walletLogin()}>
        Wallet Login
      </button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthService.refreshSession.mockRejectedValue(new Error("No session"));
    localStorage.clear();
    delete (window as any).ethereum;
  });

  it("starts in loading state and transitions to unauthenticated", async () => {
    renderWithAuth();
    expect(screen.getByTestId("loading")).toHaveTextContent("loading");
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("idle");
    });
    expect(screen.getByTestId("authenticated")).toHaveTextContent("no");
  });

  it("restores session when refreshSession succeeds", async () => {
    mockAuthService.refreshSession.mockResolvedValue({ user: mockUser });
    renderWithAuth();
    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("yes");
    });
    expect(screen.getByTestId("user-role")).toHaveTextContent("farmer");
  });

  it("login sets user and authenticates", async () => {
    mockAuthService.login.mockResolvedValue({ user: mockUser });
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("idle"),
    );
    act(() => {
      screen.getByTestId("btn-login").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("user-role")).toHaveTextContent("farmer");
    });
    expect(screen.getByTestId("authenticated")).toHaveTextContent("yes");
  });

  it("login failure does not authenticate user", async () => {
    mockAuthService.login.mockRejectedValue(new Error("Invalid credentials"));
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("idle"),
    );
    expect(screen.getByTestId("authenticated")).toHaveTextContent("no");
  });

  it("logout clears user and sets unauthenticated", async () => {
    mockAuthService.login.mockResolvedValue({ user: mockUser });
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("idle"),
    );
    act(() => {
      screen.getByTestId("btn-login").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("yes");
    });
    act(() => {
      screen.getByTestId("btn-logout").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("no");
      expect(screen.getByTestId("user-role")).toHaveTextContent("none");
    });
  });

  it("connectWallet without ethereum does not connect wallet", async () => {
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("idle"),
    );
    expect(screen.getByTestId("wallet-connected")).toHaveTextContent("no");
  });

  it("connectWallet with ethereum sets wallet as connected", async () => {
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("idle"),
    );
    expect(screen.getByTestId("wallet-connected")).toHaveTextContent("no");
    (window as any).ethereum = {
      request: vi.fn().mockResolvedValue(["0x123"]),
      selectedAddress: "0x123",
    };
    act(() => {
      screen.getByTestId("btn-connect-wallet").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("wallet-connected")).toHaveTextContent("yes");
    });
  });

  it("walletLogin with ethereum completes full flow", async () => {
    const mockRequest = vi.fn();
    mockRequest.mockResolvedValueOnce("0xsig");
    mockAuthService.walletLogin.mockResolvedValue({
      user: { ...mockUser, walletAddress: "0x123" },
    });
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("idle"),
    );
    (window as any).ethereum = {
      request: mockRequest,
      selectedAddress: "0x123",
    };
    act(() => {
      screen.getByTestId("btn-wallet-login").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("yes");
    });
    expect(mockAuthService.getNonce).toHaveBeenCalledWith("0x123");
  });
});
