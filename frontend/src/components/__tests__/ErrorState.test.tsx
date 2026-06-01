import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorState } from '../common/ErrorState';

describe('ErrorState', () => {
  it('renders default title and the provided message', () => {
    render(<ErrorState message="Something broke" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ErrorState title="Custom Error" message="Details here" />);
    expect(screen.getByText('Custom Error')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const handleRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={handleRetry} />);
    const button = screen.getByText('Try Again');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState message="Error" />);
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ErrorState message="Error" className="custom-class" />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('custom-class');
  });
});
