import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import useAsideWidth from "./useAsideWidth"; // Adjust the import path as needed

describe("useAsideWidth", () => {
  // Store the original innerWidth
  let originalInnerWidth: number;

  beforeEach(() => {
    // Save the original innerWidth before each test
    originalInnerWidth = window.innerWidth;
    // Mock the resize event
    vi.spyOn(window, "addEventListener");
    vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    // Restore the original innerWidth after each test
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    vi.restoreAllMocks();
  });

  it("should return 400px for large screens", () => {
    // Mock window.innerWidth for large screens
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1200,
    });

    // Render the hook
    const { result } = renderHook(() => useAsideWidth());

    // Check if the width is 400px
    expect(result.current).toBe(400);
  });

  it("should return 350px for medium screens", () => {
    // Mock window.innerWidth for medium screens
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1000,
    });

    // Render the hook
    const { result } = renderHook(() => useAsideWidth());

    // Check if the width is 350px
    expect(result.current).toBe(350);
  });

  it("should return 300px for small screens", () => {
    // Mock window.innerWidth for small screens
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 800,
    });

    // Render the hook
    const { result } = renderHook(() => useAsideWidth());

    // Check if the width is 300px
    expect(result.current).toBe(300);
  });

  it("should return 0px for extra small screens", () => {
    // Mock window.innerWidth for extra small screens
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 700,
    });

    // Render the hook
    const { result } = renderHook(() => useAsideWidth());

    // Check if the width is 0px
    expect(result.current).toBe(0);
  });

  it("should update width when window is resized", () => {
    // Start with a large screen
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1200,
    });

    // Render the hook
    const { result } = renderHook(() => useAsideWidth());
    expect(result.current).toBe(400);

    // Simulate a resize event to a medium screen
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1000,
      });

      // Manually trigger the resize event handler
      window.dispatchEvent(new Event("resize"));
    });

    // Check if the width has updated to 350px
    expect(result.current).toBe(350);
  });

  it("should add event listener on mount and remove on unmount", () => {
    // Render the hook
    const { unmount } = renderHook(() => useAsideWidth());

    // Check if event listener was added
    expect(window.addEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );

    // Unmount the hook
    unmount();

    // Check if event listener was removed
    expect(window.removeEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
  });
});
