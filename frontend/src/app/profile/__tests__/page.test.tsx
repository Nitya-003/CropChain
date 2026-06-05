import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import toast from 'react-hot-toast';

const { mockUpdateProfile, mockUpdateUser, mockUseAuth, mockPush, mockToast } = vi.hoisted(() => ({
  mockUpdateProfile: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockUseAuth: vi.fn(),
  mockPush: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn(async (promise, msgs) => {
      try {
        const res = await promise;
        if (msgs && typeof msgs.success === 'function') {
          msgs.success(res);
        }
        return res;
      } catch (err) {
        if (msgs && typeof msgs.error === 'function') {
          msgs.error(err);
        }
        throw err;
      }
    }),
  }
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/profile',
}));

vi.mock('../../../services/auth.service', () => ({
  authService: {
    updateProfile: mockUpdateProfile,
  },
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('react-hot-toast', () => ({
  default: mockToast,
  toast: mockToast,
}));

// Mock components that are not related to the test details
vi.mock('../../../components/Header', () => ({
  default: () => <div data-testid="header-mock">Header</div>,
}));

vi.mock('../../../components/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="protected-route-mock">{children}</div>,
}));

const ProfilePage = (await import('../page')).default;

describe('ProfilePage', () => {
  const mockUser = {
    id: '123',
    name: 'John Farmer',
    email: 'john@farmer.com',
    role: 'farmer' as const,
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    verification: {
      isVerified: true,
      verifiedAt: '2026-06-01',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      updateUser: mockUpdateUser,
      isLoading: false,
      isAuthenticated: true,
    });
  });

  it('renders user details correctly', () => {
    render(<ProfilePage />);
    expect(screen.getByDisplayValue('John Farmer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@farmer.com')).toBeInTheDocument();
    expect(screen.getByText('farmer')).toBeInTheDocument();
    expect(screen.getByText('0x1234567890abcdef1234567890abcdef12345678')).toBeInTheDocument();
    expect(screen.getByLabelText('Verified')).toBeInTheDocument();
  });

  it('allows entering edit mode and editing fields', async () => {
    render(<ProfilePage />);
    const editBtn = screen.getByRole('button', { name: /Edit Profile/i });
    fireEvent.click(editBtn);

    const nameInput = screen.getByDisplayValue('John Farmer');
    const emailInput = screen.getByDisplayValue('john@farmer.com');

    fireEvent.change(nameInput, { target: { value: 'New Farmer Name' } });
    fireEvent.change(emailInput, { target: { value: 'new@farmer.com' } });

    expect(nameInput).toHaveValue('New Farmer Name');
    expect(emailInput).toHaveValue('new@farmer.com');
  });

  it('calls authService.updateProfile and updateUser on save', async () => {
    mockUpdateProfile.mockResolvedValue({ user: { ...mockUser, name: 'New Farmer Name' } });
    render(<ProfilePage />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }));
    
    // Change name
    const nameInput = screen.getByDisplayValue('John Farmer');
    fireEvent.change(nameInput, { target: { value: 'New Farmer Name' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ name: 'New Farmer Name' });
      expect(mockUpdateUser).toHaveBeenCalledWith({ ...mockUser, name: 'New Farmer Name' });
    });
  });

  it('performs password validations and fails if new passwords do not match', async () => {
    render(<ProfilePage />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }));

    // Fill password change inputs with mismatching new passwords
    const currentPasswordInput = screen.getAllByPlaceholderText('••••••••')[0];
    const newPasswordInput = screen.getAllByPlaceholderText('••••••••')[1];
    const confirmPasswordInput = screen.getAllByPlaceholderText('••••••••')[2];

    fireEvent.change(currentPasswordInput, { target: { value: 'OldPassword123!' } });
    fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentNewPassword123!' } });

    // Save changes
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(toast.error).toHaveBeenCalledWith('New passwords do not match');
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('performs password complexity validation correctly', async () => {
    render(<ProfilePage />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }));

    const currentPasswordInput = screen.getAllByPlaceholderText('••••••••')[0];
    const newPasswordInput = screen.getAllByPlaceholderText('••••••••')[1];
    const confirmPasswordInput = screen.getAllByPlaceholderText('••••••••')[2];

    fireEvent.change(currentPasswordInput, { target: { value: 'OldPassword123!' } });
    // Password lacking special character
    fireEvent.change(newPasswordInput, { target: { value: 'NoSpecial123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'NoSpecial123' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(toast.error).toHaveBeenCalledWith('Password must contain at least one special character');
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });
});
