import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// Setup hoisting mocks
const {
  mockGetUnverifiedUsers,
  mockGetVerifiedUsers,
  mockIssueCredential,
  mockRevokeCredential,
  mockUseVerificationSocket,
  mockAuthUser,
} = vi.hoisted(() => ({
  mockGetUnverifiedUsers: vi.fn().mockResolvedValue([]),
  mockGetVerifiedUsers: vi.fn().mockResolvedValue([]),
  mockIssueCredential: vi.fn().mockResolvedValue({ success: true }),
  mockRevokeCredential: vi.fn().mockResolvedValue({ success: true }),
  mockUseVerificationSocket: vi
    .fn()
    .mockReturnValue({ isConnected: false, lastUpdate: null }),
  mockAuthUser: { id: "admin-id", email: "admin@test.com", role: "admin" },
}));

// Mock routing and auth
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({
    user: mockAuthUser,
  }),
}));

vi.mock("../../../components/ProtectedRoute", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../services/verificationService", () => ({
  verificationService: {
    getUnverifiedUsers: () => mockGetUnverifiedUsers(),
    getVerifiedUsers: () => mockGetVerifiedUsers(),
    issueCredential: (...args: any[]) => mockIssueCredential(...args),
    revokeCredential: (...args: any[]) => mockRevokeCredential(...args),
  },
}));

// Mock socket hook and capture the onVerificationUpdate callback
vi.mock("../../../hooks/useVerificationSocket", () => ({
  useVerificationSocket: (options?: any) => {
    if (options?.onVerificationUpdate) {
      (globalThis as any).testSocketCallback = options.onVerificationUpdate;
    }
    return mockUseVerificationSocket();
  },
}));

vi.mock("../../../components/VerificationBadge", () => ({
  default: ({ isVerified }: { isVerified: boolean }) => (
    <span data-testid="verification-badge">
      {isVerified ? "Verified" : "Unverified"}
    </span>
  ),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const VerificationDashboard = (await import("../page")).default;

describe("Verification Dashboard Socket Integration", () => {
  const mockUnverified = [
    {
      _id: "user-1",
      name: "John Farmer",
      email: "john@farmer.com",
      role: "farmer",
      walletAddress: "0xabc1230000000000000000000000000000000001",
      createdAt: "2026-06-01T10:00:00Z",
    },
  ];

  const mockVerified = [
    {
      _id: "user-2",
      name: "Alice Mandi",
      email: "alice@mandi.com",
      role: "mandi_officer",
      walletAddress: "0xabc1230000000000000000000000000000000002",
      createdAt: "2026-06-02T10:00:00Z",
      verification: {
        verifiedAt: "2026-06-03T12:00:00Z",
        verifiedBy: { name: "Admin User", email: "admin@test.com" },
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).testSocketCallback = undefined;
    mockGetUnverifiedUsers.mockResolvedValue(mockUnverified);
    mockGetVerifiedUsers.mockResolvedValue(mockVerified);
    mockUseVerificationSocket.mockReturnValue({
      isConnected: false,
      lastUpdate: null,
    });
  });

  it("renders directories correctly on initial load", async () => {
    render(<VerificationDashboard />);
    expect(screen.getByText("Verification Dashboard")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("John Farmer")).toBeInTheDocument();
      expect(screen.getByText("john@farmer.com")).toBeInTheDocument();
    });
  });

  it("shows connection status based on socket state", async () => {
    mockUseVerificationSocket.mockReturnValue({
      isConnected: true,
      lastUpdate: new Date(),
    });
    render(<VerificationDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Live Connection Active")).toBeInTheDocument();
    });
  });

  it('updates row UI to "In Progress" when processing status is emitted', async () => {
    render(<VerificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText("John Farmer")).toBeInTheDocument();
    });

    // Simulate backend sending in_progress socket event
    const callback = (globalThis as any).testSocketCallback;
    expect(callback).toBeDefined();

    act(() => {
      callback({ userId: "user-1", newState: "in_progress" });
    });

    // Verify UI reflects "In Progress"
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verifying..." })).toBeDisabled();
  });

  it('updates row UI to "Failed" when failed status is emitted', async () => {
    render(<VerificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText("John Farmer")).toBeInTheDocument();
    });

    const callback = (globalThis as any).testSocketCallback;
    act(() => {
      callback({ userId: "user-1", newState: "failed" });
    });

    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("triggers a directory sync when verified socket state is emitted", async () => {
    render(<VerificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText("John Farmer")).toBeInTheDocument();
    });

    // Reset fetch calls count to only count socket triggers
    mockGetUnverifiedUsers.mockClear();
    mockGetVerifiedUsers.mockClear();

    const callback = (globalThis as any).testSocketCallback;
    act(() => {
      callback({ userId: "user-1", newState: "verified" });
    });

    // Should refresh directory list
    await waitFor(() => {
      expect(mockGetUnverifiedUsers).toHaveBeenCalled();
      expect(mockGetVerifiedUsers).toHaveBeenCalled();
    });
  });
});
