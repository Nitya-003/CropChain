import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { CurrencyProvider } from '../context/CurrencyContext';
import { ToastProvider } from '../context/ToastContext';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

interface AllProvidersProps {
  children: React.ReactNode;
  initialEntries?: string[];
}

export function AllProviders({ children, initialEntries = ['/'] }: AllProvidersProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ThemeProvider>
          <AuthProvider>
            <CurrencyProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </CurrencyProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { initialEntries?: string[] }
) {
  const { initialEntries, ...renderOptions } = options || {};
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialEntries={initialEntries}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';
