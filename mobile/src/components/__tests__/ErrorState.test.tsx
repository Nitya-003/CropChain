import { render, screen, fireEvent } from "@testing-library/react-native";
import { ErrorState } from "../ErrorState";

describe("ErrorState", () => {
  it("renders default title and custom message", () => {
    render(<ErrorState message="Network request failed" />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("Network request failed")).toBeTruthy();
  });

  it("renders custom title when provided", () => {
    render(
      <ErrorState title="Sync Failed" message="Unable to sync batches" />,
    );
    expect(screen.getByText("Sync Failed")).toBeTruthy();
  });

  it("does not show retry button when onRetry is omitted", () => {
    render(<ErrorState message="Error occurred" />);
    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("shows retry button when onRetry is provided", () => {
    const onRetry = jest.fn();
    render(
      <ErrorState message="Error occurred" onRetry={onRetry} />,
    );
    expect(screen.getByText("Try Again")).toBeTruthy();
  });

  it("calls onRetry when retry button is pressed", () => {
    const onRetry = jest.fn();
    render(
      <ErrorState message="Error occurred" onRetry={onRetry} />,
    );
    fireEvent.press(screen.getByText("Try Again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
