export class GlobalErrorHandler {
  constructor(
    public message: string,
    public errorCode: number,
  ) {}

  /**
   * Static factory method to create an instance from a generic Error object.
   * @param error - The error object, which may include a message and optional details like a stack.
   */
  public static of(error: Error): GlobalErrorHandler {
    const errorCode = error.stack ? 500 : 400; // Default error codes: 500 for server-side, 400 for client-side.
    return new GlobalErrorHandler(
      error.message || "Unknown error occurred",
      errorCode,
    );
  }

  /**
   * Static factory method to create an instance from an HTTP error response.
   * @param response - The error response containing a message and code.
   */
  public static fromResponse(response: {
    message: string;
    code?: number;
  }): GlobalErrorHandler {
    return new GlobalErrorHandler(
      response.message ?? "Unknown error occurred",
      response.code ?? 400,
    );
  }

  /**
   * Converts the instance into a plain object for logging or serialization.
   */
  public toJSON(): { message: string; errorCode: number } {
    return {
      message: this.message,
      errorCode: this.errorCode,
    };
  }
}

// Usage as a type
export type GlobalErrorHandlerType = InstanceType<typeof GlobalErrorHandler>;
