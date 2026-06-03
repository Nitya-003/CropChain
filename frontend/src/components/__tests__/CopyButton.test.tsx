import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CopyButton from '../CopyButton';

describe('CopyButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders with copy icon', () => {
    render(<CopyButton value="test-value" />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('copies value to clipboard on click', async () => {
    render(<CopyButton value="copy-this" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy-this');
  });

  it('shows check icon after copying', async () => {
    render(<CopyButton value="test" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    const checkIcon = document.querySelector('.lucide-check');
    expect(checkIcon).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<CopyButton value="test" label="batch ID" />);
    expect(screen.getByLabelText(/copy batch ID/i)).toBeInTheDocument();
  });

  it('is disabled when value is empty', () => {
    render(<CopyButton value="" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<CopyButton value="test" className="custom-class" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('custom-class');
  });
});
