import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { CurrencyProvider, useCurrency } from "../CurrencyContext";

describe("CurrencyContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("provides default currency as CRYPTO when nothing is stored", () => {
    const { result } = renderHook(() => useCurrency(), {
      wrapper: CurrencyProvider,
    });
    expect(result.current.currency).toBe("CRYPTO");
  });

  it("reads saved currency from localStorage", () => {
    localStorage.setItem("currency", "USD");
    const { result } = renderHook(() => useCurrency(), {
      wrapper: CurrencyProvider,
    });
    expect(result.current.currency).toBe("USD");
  });

  it("reads INR from localStorage", () => {
    localStorage.setItem("currency", "INR");
    const { result } = renderHook(() => useCurrency(), {
      wrapper: CurrencyProvider,
    });
    expect(result.current.currency).toBe("INR");
  });

  it("sets currency to USD", () => {
    const { result } = renderHook(() => useCurrency(), {
      wrapper: CurrencyProvider,
    });

    act(() => {
      result.current.setCurrency("USD");
    });

    expect(result.current.currency).toBe("USD");
  });

  it("sets currency to INR", () => {
    const { result } = renderHook(() => useCurrency(), {
      wrapper: CurrencyProvider,
    });

    act(() => {
      result.current.setCurrency("INR");
    });

    expect(result.current.currency).toBe("INR");
  });

  it("persists currency change to localStorage", () => {
    const { result } = renderHook(() => useCurrency(), {
      wrapper: CurrencyProvider,
    });

    act(() => {
      result.current.setCurrency("USD");
    });

    expect(localStorage.getItem("currency")).toBe("USD");
  });
});
