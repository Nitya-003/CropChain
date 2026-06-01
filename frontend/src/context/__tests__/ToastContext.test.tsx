import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToastProvider, useToast, useToastContext } from '../ToastContext';

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no toasts', () => {
    const { result } = renderHook(() => useToastContext(), {
      wrapper: ToastProvider,
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('adds a success toast', () => {
    const { result } = renderHook(() => useToastContext(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.success('Operation successful');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('Operation successful');
    expect(result.current.toasts[0].title).toBe('Success');
  });

  it('adds an error toast', () => {
    const { result } = renderHook(() => useToastContext(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.error('Something went wrong');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toasts[0].message).toBe('Something went wrong');
    expect(result.current.toasts[0].title).toBe('Error');
  });

  it('adds an info toast', () => {
    const { result } = renderHook(() => useToastContext(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.info('Informational message');
    });

    expect(result.current.toasts[0].type).toBe('info');
    expect(result.current.toasts[0].message).toBe('Informational message');
    expect(result.current.toasts[0].title).toBe('Info');
  });

  it('adds a warning toast', () => {
    const { result } = renderHook(() => useToastContext(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.warning('Warning message');
    });

    expect(result.current.toasts[0].type).toBe('warning');
    expect(result.current.toasts[0].message).toBe('Warning message');
    expect(result.current.toasts[0].title).toBe('Warning');
  });

  it('removes a toast by id', () => {
    const { result } = renderHook(() => useToastContext(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.success('Test toast');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-dismisses toasts after 5 seconds', () => {
    const { result } = renderHook(() => useToastContext(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.success('Auto-dismiss test');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('addToast with custom type, title, and message', () => {
    const { result } = renderHook(() => useToastContext(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.addToast('info', 'Custom Title', 'Custom message');
    });

    expect(result.current.toasts[0].type).toBe('info');
    expect(result.current.toasts[0].title).toBe('Custom Title');
    expect(result.current.toasts[0].message).toBe('Custom message');
  });

  it('useToast provides convenience methods', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    expect(result.current.success).toBeDefined();
    expect(result.current.error).toBeDefined();
    expect(result.current.info).toBeDefined();
    expect(result.current.warning).toBeDefined();
  });
});
