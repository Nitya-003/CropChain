export const COLORS = {
  primary: '#16a34a',
  primaryLight: '#22c55e',
  primaryDark: '#15803d',
  danger: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
};

export const STAGE_FLOW = ['farmer', 'mandi', 'transport', 'retailer'] as const;

export const STAGE_LABELS: Record<string, string> = {
  farmer: 'Farm',
  mandi: 'Mandi Market',
  transport: 'In Transit',
  retailer: 'Retail',
};

export const STAGE_COLORS: Record<string, string> = {
  farmer: '#6366f1',
  mandi: '#d97706',
  transport: '#2563eb',
  retailer: '#9333ea',
};

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3001';
