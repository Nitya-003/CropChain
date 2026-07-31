import { render, screen } from "@testing-library/react-native";
import { SyncStatusBadge } from "../SyncStatusBadge";

describe("SyncStatusBadge", () => {
  it("renders nothing when idle with no pending items", () => {
    const { toJSON } = render(
      <SyncStatusBadge status="idle" pendingCount={0} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("shows syncing status", () => {
    render(<SyncStatusBadge status="syncing" pendingCount={3} />);
    expect(screen.getByText("Syncing...")).toBeTruthy();
  });

  it("shows error status", () => {
    render(<SyncStatusBadge status="error" pendingCount={2} />);
    expect(screen.getByText("Sync Error")).toBeTruthy();
  });

  it("shows pending count when idle with queued items", () => {
    render(<SyncStatusBadge status="idle" pendingCount={5} />);
    expect(screen.getByText("5 pending")).toBeTruthy();
  });

  it("shows singular pending text for one item", () => {
    render(<SyncStatusBadge status="idle" pendingCount={1} />);
    expect(screen.getByText("1 pending")).toBeTruthy();
  });
});
