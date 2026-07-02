import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

const mockUseAuth = vi.fn();
const mockUseTheme = vi.fn();
const mockToggleTheme = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

vi.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'CRYPTO', setCurrency: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../hooks/useCryptoPrices', () => ({
  useCryptoPrices: () => ({ isFetching: false, dataUpdatedAt: null }),
}));

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseTheme.mockReset();
  mockToggleTheme.mockReset();
  mockPush.mockReset();
  mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: mockToggleTheme });
});

import { NotificationProvider } from '../../context/NotificationContext';

async function renderHeader() {
  const Header = (await import('../Header')).default;
  return render(
    <NotificationProvider>
      <Header />
    </NotificationProvider>
  );
}

describe('Header', () => {
  it('renders the CropChain logo text', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
      isAuthenticated: false,
    });
    await renderHeader();
    expect(screen.getByText('CropChain')).toBeInTheDocument();
  });

  it('renders navigation links', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
      isAuthenticated: false,
    });
    await renderHeader();
    expect(screen.getByText('nav.home')).toBeInTheDocument();
    expect(screen.getByText('nav.trackBatch')).toBeInTheDocument();
    expect(screen.getByText('nav.smartPlanting')).toBeInTheDocument();
  });

  it('renders theme toggle button', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
      isAuthenticated: false,
    });
    await renderHeader();
    const toggleButton = screen.getByLabelText('Toggle theme');
    expect(toggleButton).toBeInTheDocument();
  });

  it('calls toggleTheme when theme button is clicked', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
      isAuthenticated: false,
    });
    await renderHeader();
    fireEvent.click(screen.getByLabelText('Toggle theme'));
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('shows sign in button when not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
      isAuthenticated: false,
    });
    await renderHeader();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('shows user role badge when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: { name: 'Test User', role: 'farmer' },
      logout: vi.fn(),
      isAuthenticated: true,
    });
    await renderHeader();
    expect(screen.getByText('farmer')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows admin links for admin users', async () => {
    mockUseAuth.mockReturnValue({
      user: { name: 'Admin', role: 'admin' },
      logout: vi.fn(),
      isAuthenticated: true,
    });
    await renderHeader();
    const adminLinks = screen.getAllByText('Admin');
    expect(adminLinks.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Verification')).toBeInTheDocument();
  });
});
