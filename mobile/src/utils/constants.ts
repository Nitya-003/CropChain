// `__DEV__` (React Native) and `process` (Node) aren't always ambient-typed
// depending on the project's @types setup. Reading them via `globalThis`
// avoids "Cannot find name" TS errors without adding new ambient
// declarations that could conflict with whatever types are already configured.
const env: Record<string, string | undefined> =
  (globalThis as any).process?.env ?? {};
const isDev: boolean = (globalThis as any).__DEV__ === true;

// `localhost` only works when the app and the backend share the same network
// stack (a simulator/emulator or a web preview). On a physical device,
// `localhost` refers to the phone itself, not the developer's computer, so
// EXPO_PUBLIC_API_URL (and EXPO_PUBLIC_SOCKET_URL) must be set to the
// computer's LAN IP address (e.g. http://192.168.1.5:3001) for API calls,
// login, batches, notifications, and sync to work.
const DEFAULT_DEV_HOST = "http://localhost:3001";

if (isDev && !env.EXPO_PUBLIC_API_URL) {
  console.warn(
    "[CropChain] EXPO_PUBLIC_API_URL is not set. Falling back to " +
      `${DEFAULT_DEV_HOST}/api, which only works in a simulator/emulator or ` +
      "web preview. On a physical device, set EXPO_PUBLIC_API_URL to your computer's " +
      "LAN IP address (e.g. http://192.168.1.5:3001/api) in your .env file, or API " +
      "calls will fail.",
  );
}

export const COLORS = {
  primary: "#16a34a",
  primaryLight: "#22c55e",
  primaryDark: "#15803d",
  danger: "#dc2626",
  warning: "#d97706",
  info: "#2563eb",
};

export const STAGE_FLOW = ["farmer", "mandi", "transport", "retailer"] as const;

export const STAGE_LABELS: Record<string, string> = {
  farmer: "Farm",
  mandi: "Mandi Market",
  transport: "In Transit",
  retailer: "Retail",
};

export const STAGE_COLORS: Record<string, string> = {
  farmer: "#6366f1",
  mandi: "#d97706",
  transport: "#2563eb",
  retailer: "#9333ea",
};

export const API_URL = env.EXPO_PUBLIC_API_URL || `${DEFAULT_DEV_HOST}/api`;
export const SOCKET_URL = env.EXPO_PUBLIC_SOCKET_URL || DEFAULT_DEV_HOST;
