import { render, screen } from "@testing-library/react-native";
import { LoadingSpinner } from "../LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders default loading message", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("renders custom message", () => {
    render(<LoadingSpinner message="Fetching batches..." />);
    expect(screen.getByText("Fetching batches...")).toBeTruthy();
  });
});
