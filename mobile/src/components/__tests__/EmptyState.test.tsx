import { render, screen } from "@testing-library/react-native";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState title="No Batches" description="Add a batch to get started." />,
    );
    expect(screen.getByText("No Batches")).toBeTruthy();
    expect(screen.getByText("Add a batch to get started.")).toBeTruthy();
  });

  it("renders with default icon when none provided", () => {
    render(
      <EmptyState title="Empty" description="Nothing here yet." />,
    );
    expect(screen.getByText("Empty")).toBeTruthy();
  });
});
