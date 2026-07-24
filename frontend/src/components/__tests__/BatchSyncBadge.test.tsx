import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import BatchSyncBadge from "../BatchSyncBadge";

describe("BatchSyncBadge", () => {
  it("renders synced state by default", () => {
    render(<BatchSyncBadge />);
    expect(screen.getByText("Synced")).toBeInTheDocument();
  });

  it("renders pending state", () => {
    render(<BatchSyncBadge syncStatus="pending" />);
    expect(screen.getByText("Pending Sync")).toBeInTheDocument();
  });

  it("renders syncing state", () => {
    render(<BatchSyncBadge syncStatus="syncing" />);
    expect(screen.getByText("Syncing...")).toBeInTheDocument();
  });

  it("renders failed state", () => {
    render(<BatchSyncBadge syncStatus="failed" />);
    expect(screen.getByText("Sync Failed")).toBeInTheDocument();
  });

  it("hides label when showLabel is false", () => {
    render(<BatchSyncBadge showLabel={false} />);
    expect(screen.queryByText("Synced")).not.toBeInTheDocument();
  });

  it("renders correct tooltip for synced state", () => {
    render(<BatchSyncBadge syncStatus="synced" />);
    expect(
      screen.getByTitle("Successfully synced to the blockchain"),
    ).toBeInTheDocument();
  });

  it("renders correct tooltip for failed state", () => {
    render(<BatchSyncBadge syncStatus="failed" />);
    expect(
      screen.getByTitle("Failed to sync. Will retry automatically when online"),
    ).toBeInTheDocument();
  });
});
