import { create } from 'zustand';

interface ScanState {
  lastScanned: string | null;
  scanHistory: string[];
  setLastScanned: (id: string) => void;
  clearHistory: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  lastScanned: null,
  scanHistory: [],
  setLastScanned: (id) =>
    set((state) => ({
      lastScanned: id,
      scanHistory: [id, ...state.scanHistory].slice(0, 20),
    })),
  clearHistory: () => set({ scanHistory: [], lastScanned: null }),
}));
