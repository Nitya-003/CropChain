declare module 'react-hot-toast' {
  export default function toast(message: string, options?: ToastOptions): void;
  export const success: (message: string, options?: ToastOptions) => void;
  export const error: (message: string, options?: ToastOptions) => void;
  export const loading: (message: string, options?: ToastOptions) => void;
  export const dismiss: (id?: string | number) => void;
  export const promise: <T>(promise: Promise<T>, options?: ToastOptions) => Promise<T>;

  interface ToastOptions {
    duration?: number;
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    icon?: string | React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    ariaProps?: Record<string, string>;
    id?: string | number;
  }
}
