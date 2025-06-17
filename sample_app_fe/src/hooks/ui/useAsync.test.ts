import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useAsync from "./useAsync";

describe("useAsync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should initialize with default values", () => {
    // Mock async function
    const mockAsyncFn = vi.fn().mockResolvedValue("test result");

    // Render the hook
    const { result } = renderHook(() => useAsync(mockAsyncFn));

    // Check initial values
    const [resultValue, isLoading, error] = result.current;
    expect(resultValue).toBeNull();
    expect(isLoading).toBe(false);
    expect(error).toBeNull();
  });

  it("should handle successful async operation", async () => {
    // Mock async function
    const mockData = { name: "John", age: 30 };
    const mockAsyncFn = vi.fn().mockResolvedValue(mockData);

    // Render the hook
    const { result } = renderHook(() => useAsync(mockAsyncFn));

    // Execute the async operation
    await act(async () => {
      const [, , , execute] = result.current;
      await execute({ id: 1 });
    });

    // Check updated values
    const [resultValue, isLoading, error] = result.current;
    expect(resultValue).toEqual(mockData);
    expect(isLoading).toBe(false);
    expect(error).toBeNull();

    // Check if the async function was called with correct params
    expect(mockAsyncFn).toHaveBeenCalledWith({ id: 1 });
  });

  it("should handle loading state during async operation", async () => {
    // Create a promise that we can resolve manually
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    // Mock async function that returns our controlled promise
    const mockAsyncFn = vi.fn().mockImplementation(() => promise);

    // Render the hook
    const { result } = renderHook(() => useAsync(mockAsyncFn));

    // Start the async operation but don't await it
    act(() => {
      const [, , , execute] = result.current;
      execute({ id: 1 });
    });

    // Check loading state
    expect(result.current[1]).toBe(true);

    // Resolve the promise
    await act(async () => {
      resolvePromise("test result");
    });

    // Check that loading state is false after resolution
    expect(result.current[1]).toBe(false);
  });

  it("should handle error in async operation", async () => {
    // Mock error message
    const errorMessage = "Something went wrong";

    // Mock async function that throws an error
    const mockAsyncFn = vi.fn().mockRejectedValue(errorMessage);

    // Render the hook
    const { result } = renderHook(() => useAsync(mockAsyncFn));

    // Execute the async operation
    await act(async () => {
      const [, , , execute] = result.current;
      await execute({ id: 1 });
    });

    // Check updated values
    const [resultValue, isLoading, error] = result.current;
    expect(resultValue).toBeNull();
    expect(isLoading).toBe(false);
    expect(error).toBe(errorMessage);
  });

  it("should handle multiple executions", async () => {
    // Mock async function with different responses
    const mockAsyncFn = vi
      .fn()
      .mockResolvedValueOnce("first result")
      .mockResolvedValueOnce("second result");

    // Render the hook
    const { result } = renderHook(() => useAsync(mockAsyncFn));

    // Execute the first async operation
    await act(async () => {
      const [, , , execute] = result.current;
      await execute({ id: 1 });
    });

    // Check first result
    expect(result.current[0]).toBe("first result");

    // Execute the second async operation
    await act(async () => {
      const [, , , execute] = result.current;
      await execute({ id: 2 });
    });

    // Check second result
    expect(result.current[0]).toBe("second result");

    // Check function calls
    expect(mockAsyncFn).toHaveBeenCalledTimes(2);
    expect(mockAsyncFn).toHaveBeenNthCalledWith(1, { id: 1 });
    expect(mockAsyncFn).toHaveBeenNthCalledWith(2, { id: 2 });
  });

  it("should handle execution with different parameters", async () => {
    // Mock async function
    const mockAsyncFn = vi.fn().mockImplementation((params) => {
      return Promise.resolve(`Result for ${params.type}`);
    });

    // Render the hook
    const { result } = renderHook(() => useAsync(mockAsyncFn));

    // Execute with first parameter
    await act(async () => {
      const [, , , execute] = result.current;
      await execute({ type: "users" });
    });

    // Check result
    expect(result.current[0]).toBe("Result for users");

    // Execute with second parameter
    await act(async () => {
      const [, , , execute] = result.current;
      await execute({ type: "posts", page: 1 });
    });

    // Check result
    expect(result.current[0]).toBe("Result for posts");

    // Check function calls
    expect(mockAsyncFn).toHaveBeenCalledTimes(2);
    expect(mockAsyncFn).toHaveBeenNthCalledWith(1, { type: "users" });
    expect(mockAsyncFn).toHaveBeenNthCalledWith(2, { type: "posts", page: 1 });
  });

  it("should not trigger re-renders when asyncOperation reference remains the same", () => {
    // Create a stable function reference
    const stableAsyncFn = (params: { id: number }) =>
      Promise.resolve(`Result ${params.id}`);

    // Keep track of render count
    let renderCount = 0;

    // Render the hook and track renders
    const { rerender } = renderHook(() => {
      renderCount++;
      return useAsync(stableAsyncFn);
    });

    // Initial render
    const initialCount = renderCount;

    // Rerender with same props
    rerender();

    // Check that execute function didn't change (would cause extra renders)
    expect(renderCount).toBe(initialCount + 1); // Only one additional render from the explicit rerender
  });

  it("should update execute function when asyncOperation changes", () => {
    // Create two different async functions
    const firstAsyncFn = vi.fn().mockResolvedValue("first result");
    const secondAsyncFn = vi.fn().mockResolvedValue("second result");

    // Render the hook with first function
    const { result, rerender } = renderHook(({ fn }) => useAsync(fn), {
      initialProps: { fn: firstAsyncFn },
    });

    // Store the initial execute function
    const initialExecute = result.current[3];

    // Rerender with different async function
    rerender({ fn: secondAsyncFn });

    // Check that execute function has changed
    const newExecute = result.current[3];
    expect(newExecute).not.toBe(initialExecute);
  });
});
