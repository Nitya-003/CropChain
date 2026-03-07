// Global type declarations for project

declare global {
  interface Window {
    // Add any global window properties here if needed
  }
}

// Add React types
declare global {
  namespace React {
    interface FunctionComponent<P = {}> {
      (props: P): JSX.Element;
      displayName?: string;
    }
    interface Component<P = {}, S = {}> {
      (props: P, context?: any): React.ReactNode;
      displayName?: string;
      context?: React.ContextType<S>;
    }
    type ReactNode = React.ReactElement | string | number | React.ReactFragment | React.ReactPortal | boolean | null | undefined;
    interface ReactElement<P = {}> {
      type: React.ElementType<P>;
      props: P;
      key: React.Key | null;
    }
    interface ReactFragment {
      key: React.Key | null;
    }
    interface ReactPortal {
      key: React.Key | null;
    }
    type ElementType<P = any> = string | React.ComponentType<P> | React.FunctionComponent<P> | React.ExoticComponent<P>;
    type ComponentType<P = any> = React.ComponentClass<P> | React.FunctionComponent<P>;
    type Element = React.ReactElement;
    type Node = React.ReactNode;
    type Key = React.Key;
    type Ref<T> = React.Ref<T>;
    type Context<T> = React.Context<T>;
  }
}

// Add JSX types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
      span: any;
      button: any;
      input: any;
      textarea: any;
      select: any;
      option: any;
      form: any;
      label: any;
      h1: any;
      h2: any;
      h3: any;
      h4: any;
      h5: any;
      h6: any;
      p: any;
      a: any;
      img: any;
      ul: any;
      li: any;
      ol: any;
      table: any;
      thead: any;
      tbody: any;
      tr: any;
      th: any;
      td: any;
      nav: any;
      header: any;
      main: any;
      footer: any;
      section: any;
      article: any;
      aside: any;
      strong: any;
    }
  }
}

// Add missing type declarations for common packages
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

declare module 'react' {
  export const useState: <T>(initial: T) => [T, (value: T) => void];
  export const useEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const useRef: <T>(initial: T) => { current: T };
  export const FormEvent: any;
  export const ChangeEvent: any;
  export const FC: <P = {}> => (props: P) => JSX.Element;
  export const ReactNode: any;
  export const CSSProperties: any;
}

declare module 'react-i18next' {
  export const useTranslation: () => { t: (key: string) => string };
}

declare module 'react-router-dom' {
  export const useNavigate: () => (to: string) => void;
}

declare module 'lucide-react' {
  export const Plus: any;
  export const Upload: any;
  export const MapPin: any;
  export const Calendar: any;
  export const User: any;
  export const Shield: any;
  export const AlertTriangle: any;
}

// Add Node.js types for browser environment
declare const setTimeout: (callback: () => void, delay: number) => number;
declare const clearTimeout: (id: number) => void;

// Add Jest types for test files
declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const beforeEach: (fn: () => void) => void;
declare const afterEach: (fn: () => void) => void;
declare const beforeAll: (fn: () => void) => void;
declare const afterAll: (fn: () => void) => void;
declare const expect: {
  <T>(value: T): {
    toBe: (expected: T) => void;
    toEqual: (expected: T) => void;
    toBeDefined: () => void;
    toBeUndefined: () => void;
    toBeNull: () => void;
    toBeTruthy: () => void;
    toBeFalsy: () => void;
    toContain: (expected: T) => void;
    toHaveBeenCalled: () => void;
    toHaveBeenCalledWith: (...args: any[]) => void;
    toHaveBeenCalledTimes: (num: number) => void;
    toThrow: (expected?: string | RegExp) => void;
    not: {
      toBe: (expected: any) => void;
      toEqual: (expected: any) => void;
      toContain: (expected: any) => void;
      toHaveBeenCalled: () => void;
      toThrow: (expected?: string | RegExp) => void;
    };
  };
};

declare namespace jest {
  interface Mock<T = any> {
    (...args: any[]): any;
    mockImplementation: (fn: (...args: any[]) => any) => Mock<T>;
    mockReturnValue: (value: any) => Mock<T>;
    mockResolvedValue: (value: any) => Mock<T>;
    mockRejectedValue: (error: any) => Mock<T>;
    calls: Array<any[]>;
    mock: {
      calls: Array<any[]>;
    };
  }
  
  function mock<T>(moduleName: string, factory: () => T): void;
  function fn(): Mock;
  function spyOn(object: any, method: string): Mock;
}

// Add global types for tests
declare const global: {
  describe: typeof describe;
  test: typeof test;
  expect: typeof expect;
  beforeEach: typeof beforeEach;
  afterEach: typeof afterEach;
  beforeAll: typeof beforeAll;
  afterAll: typeof afterAll;
  jest: typeof jest;
};

export {};
