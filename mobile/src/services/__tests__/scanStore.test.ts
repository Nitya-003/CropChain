import { useScanStore } from "../scanStore";

describe("scanStore", () => {
  beforeEach(() => {
    useScanStore.setState({ lastScanned: null, scanHistory: [] });
  });

  it("starts with null lastScanned and empty history", () => {
    const state = useScanStore.getState();
    expect(state.lastScanned).toBeNull();
    expect(state.scanHistory).toEqual([]);
  });

  it("setLastScanned updates lastScanned and prepends to history", () => {
    useScanStore.getState().setLastScanned("CROP-001");
    const state = useScanStore.getState();
    expect(state.lastScanned).toBe("CROP-001");
    expect(state.scanHistory).toEqual(["CROP-001"]);
  });

  it("keeps history ordered newest-first", () => {
    useScanStore.getState().setLastScanned("CROP-001");
    useScanStore.getState().setLastScanned("CROP-002");
    useScanStore.getState().setLastScanned("CROP-003");
    const state = useScanStore.getState();
    expect(state.scanHistory).toEqual(["CROP-003", "CROP-002", "CROP-001"]);
  });

  it("limits history to 20 items", () => {
    for (let i = 1; i <= 25; i++) {
      useScanStore.getState().setLastScanned(`CROP-${String(i).padStart(3, "0")}`);
    }
    const state = useScanStore.getState();
    expect(state.scanHistory.length).toBe(20);
    expect(state.scanHistory[0]).toBe("CROP-025");
    expect(state.scanHistory[19]).toBe("CROP-006");
  });

  it("clearHistory resets to initial state", () => {
    useScanStore.getState().setLastScanned("CROP-001");
    useScanStore.getState().clearHistory();
    const state = useScanStore.getState();
    expect(state.lastScanned).toBeNull();
    expect(state.scanHistory).toEqual([]);
  });
});
