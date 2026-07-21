import "@testing-library/jest-dom/vitest";

Element.prototype.scrollIntoView = vi.fn();

Object.defineProperty(window, "localStorage", {
  value: (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
    };
  })(),
  writable: true,
});

// Mock indexedDB for tests
const mockIndexedDB = {
  open: vi.fn().mockImplementation(() => {
    const listeners: Record<string, Function[]> = {};
    const request = {
      result: {
        objectStoreNames: {
          contains: vi.fn().mockReturnValue(true),
        },
        createObjectStore: vi.fn(),
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            getAll: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(undefined),
            put: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      },
      onsuccess: null,
      onerror: null,
      addEventListener: vi.fn().mockImplementation((type, listener) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(listener);
      }),
    };
    Promise.resolve().then(() => {
      const event = { target: request };
      if (request.onsuccess) {
        (request as any).onsuccess(event);
      }
      if (listeners["success"]) {
        listeners["success"].forEach((cb) => cb(event));
      }
    });
    return request;
  }),
};

Object.defineProperty(global, "indexedDB", {
  value: mockIndexedDB,
  writable: true,
});
Object.defineProperty(window, "indexedDB", {
  value: mockIndexedDB,
  writable: true,
});
