import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ToggleSwitch from "../ToggleSwitch";

describe("ToggleSwitch", () => {
  it("renders with checked state", () => {
    render(<ToggleSwitch checked={true} onChange={vi.fn()} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("renders with unchecked state", () => {
    render(<ToggleSwitch checked={false} onChange={vi.fn()} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("calls onChange when toggled", () => {
    const handleChange = vi.fn();
    render(<ToggleSwitch checked={false} onChange={handleChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("renders custom labels", () => {
    render(
      <ToggleSwitch
        checked={true}
        onChange={vi.fn()}
        onLabel="Enabled"
        offLabel="Disabled"
      />,
    );
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("renders off label when unchecked", () => {
    render(
      <ToggleSwitch
        checked={false}
        onChange={vi.fn()}
        onLabel="Active"
        offLabel="Inactive"
      />,
    );
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("uses default labels when not provided", () => {
    render(<ToggleSwitch checked={true} onChange={vi.fn()} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
