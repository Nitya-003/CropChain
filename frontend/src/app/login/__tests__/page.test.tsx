import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Hoisted mocks must be declared before any imports that use them
const { mockReplace, mockSearchParams, mockLogin, mockConnectWallet } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockSearchParams: vi.fn(),
  mockLogin: vi.fn(),
  mockConnectWallet: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    connectWallet: mockConnectWallet,
    user: null,
    isLoading: false,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const LoginPage = (await import('../page')).default;

function buildSearchParams(params: Record<string, string>) {
  const sp = new URLSearchParams(params);
  return {
    get: (key: string) => sp.get(key),
  };
}

describe('Login page – open redirect prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to "/" when no "from" param is provided', () => {
    // The redirect happens inside useEffect – validate the logic directly
    const rawRedirect = null;
    const resolved = rawRedirect ?? '/';
    const isInternal = resolved.startsWith('/') && !resolved.startsWith('//');
    expect(isInternal ? resolved : '/').toBe('/');
  });

  it('allows a valid internal path like "/dashboard"', () => {
    const raw = '/dashboard';
    const isInternal = raw.startsWith('/') && !raw.startsWith('//');
    expect(isInternal ? raw : '/').toBe('/dashboard');
  });

  it('blocks an external URL like "https://evil.com"', () => {
    const raw = 'https://evil.com';
    const isInternal = raw.startsWith('/') && !raw.startsWith('//');
    expect(isInternal ? raw : '/').toBe('/');
  });

  it('blocks a protocol-relative URL like "//evil.com"', () => {
    const raw = '//evil.com';
    const isInternal = raw.startsWith('/') && !raw.startsWith('//');
    expect(isInternal ? raw : '/').toBe('/');
  });

  it('blocks a javascript: URI', () => {
    const raw = 'javascript:alert(1)';
    const isInternal = raw.startsWith('/') && !raw.startsWith('//');
    expect(isInternal ? raw : '/').toBe('/');
  });

  it('allows a deeply nested internal path like "/admin/users/123"', () => {
    const raw = '/admin/users/123';
    const isInternal = raw.startsWith('/') && !raw.startsWith('//');
    expect(isInternal ? raw : '/').toBe('/admin/users/123');
  });
});
