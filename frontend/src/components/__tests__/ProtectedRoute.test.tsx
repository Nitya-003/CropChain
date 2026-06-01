import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUseAuth = vi.fn();
const mockRouterReplace = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  usePathname: () => '/dashboard',
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockRouterReplace.mockReset();
  });

  it('shows loading spinner when isLoading is true', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
    });

    const ProtectedRoute = (await import('../ProtectedRoute')).default;
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders nothing when not authenticated (renders null before redirect effect)', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });

    const ProtectedRoute = (await import('../ProtectedRoute')).default;
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated with no role restrictions', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test', email: 'test@test.com', role: 'farmer' },
      isLoading: false,
      isAuthenticated: true,
    });

    const ProtectedRoute = (await import('../ProtectedRoute')).default;
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when user has allowed role', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin' },
      isLoading: false,
      isAuthenticated: true,
    });

    const ProtectedRoute = (await import('../ProtectedRoute')).default;
    render(
      <ProtectedRoute allowedRoles={['admin']}>
        <div>Admin Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('renders nothing when user does not have allowed role', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Farmer', email: 'farmer@test.com', role: 'farmer' },
      isLoading: false,
      isAuthenticated: true,
    });

    const ProtectedRoute = (await import('../ProtectedRoute')).default;
    render(
      <ProtectedRoute allowedRoles={['admin']}>
        <div>Admin Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });
});
