import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LanguageSwitcher from '../LanguageSwitcher';

const mockChangeLanguage = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    mockChangeLanguage.mockReset();
  });

  it('renders current language name in the toggle button', () => {
    render(<LanguageSwitcher />);
    const englishElements = screen.getAllByText('English');
    expect(englishElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Hindi language option in dropdown', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByText('हिंदी')).toBeInTheDocument();
  });

  it('changes language when Hindi option is clicked', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('हिंदी'));
    expect(mockChangeLanguage).toHaveBeenCalledWith('hi');
  });
});
