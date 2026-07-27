import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Alert, AlertTitle, AlertDescription } from "../alert";

describe("Alert", () => {
  it('renders Alert with role="alert"', () => {
    render(<Alert>Alert content</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
  });

  it("renders AlertTitle", () => {
    render(
      <Alert>
        <AlertTitle>Warning</AlertTitle>
      </Alert>,
    );
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("renders AlertDescription", () => {
    render(
      <Alert>
        <AlertDescription>Something happened</AlertDescription>
      </Alert>,
    );
    expect(screen.getByText("Something happened")).toBeInTheDocument();
  });

  it("applies destructive variant classes", () => {
    render(<Alert variant="destructive">Destructive</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("destructive");
  });
});
