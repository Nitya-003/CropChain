import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LanguageSwitcher from "../LanguageSwitcher";

const mockChangeLanguage = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: "en",
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    mockChangeLanguage.mockReset();
  });

  it("renders current language name in the toggle button", () => {
    render(<LanguageSwitcher />);
    const englishElements = screen.getAllByText("English");
    expect(englishElements.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show the dropdown menu by default", () => {
    render(<LanguageSwitcher />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the dropdown when the toggle button is clicked", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common.selectLanguage" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("हिंदी")).toBeInTheDocument();
  });

  it("closes the dropdown when the toggle button is clicked again", () => {
    render(<LanguageSwitcher />);
    const toggleButton = screen.getByRole("button", {
      name: "common.selectLanguage",
    });
    fireEvent.click(toggleButton);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("changes language when Hindi option is clicked and closes the menu", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common.selectLanguage" }));
    fireEvent.click(screen.getByText("हिंदी"));

    expect(mockChangeLanguage).toHaveBeenCalledWith("hi");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the dropdown when Escape is pressed", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "common.selectLanguage" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the dropdown when clicking outside", () => {
    render(
      <div>
        <LanguageSwitcher />
        <button>Outside</button>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: "common.selectLanguage" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText("Outside"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the dropdown with Enter key", () => {
    render(<LanguageSwitcher />);
    const toggleButton = screen.getByRole("button", {
      name: "common.selectLanguage",
    });
    fireEvent.keyDown(toggleButton, { key: "Enter" });
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});