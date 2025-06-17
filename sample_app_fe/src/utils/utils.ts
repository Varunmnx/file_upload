/* eslint-disable @typescript-eslint/no-explicit-any */

export const isPercentage = (
  value: React.CSSProperties["maxWidth"] | React.CSSProperties["maxHeight"],
) => {
  return typeof value === "string" && value.endsWith("%");
};

export const checkPercentage = (percentage: string, viewportSize: number) => {
  const percentageValue = parseFloat(percentage) / 100;
  const pixelValue = Math.round(viewportSize * percentageValue);
  return viewportSize <= pixelValue;
};

export function formatUSD(stripeAmount: number) {
  return stripeAmount / 100;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[a-zA-Z ]{1,20}$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
const alphabetRegex = /^[a-zA-Z ]{1,20}$/;
const urlPattern = /^(http|https):\/\/\S+/;

const imageFormats = [".jpg", ".jpeg", ".png", ".avif", ".webp"];
const documentFormats = [".pdf", ".docx", ".doc", ".odt", ".rtf"];

export const validate = {
  email: (input: string | undefined): boolean =>
    input ? emailRegex.test(input) : false,
  name: (input: string | undefined): boolean =>
    input ? nameRegex.test(input) : false,
  password: (input: string | undefined): boolean =>
    input ? passwordRegex.test(input) : false,
  alphabet: (input: string | undefined): boolean =>
    input ? alphabetRegex.test(input) : false,
  number: (input: number | string | undefined): boolean =>
    !Number.isNaN(input ? +input : NaN),
};

export const limitText = (text: string, maxLength = 59) => {
  if (text?.length > maxLength) {
    return text.slice(0, maxLength);
  }
  return text;
};

type Format = "image" | "document";
type CheckType =
  | Format
  | "webUrl"
  | "notEmptyString"
  | "notEmptyArray"
  | "notEmptyObject";

type Value = string | string[] | object | undefined;

export const isValid = (value: Value, type: CheckType): boolean => {
  switch (type) {
    case "image":
    case "document":
      return (
        !!value &&
        (type === "image" ? imageFormats : documentFormats).some((format) =>
          (value as string).toLowerCase().endsWith(format),
        )
      );
    case "webUrl":
      return typeof value === "string" && urlPattern.test(value);
    case "notEmptyString":
      return value !== undefined && (value as string).trim() !== "";
    case "notEmptyArray":
      return Array.isArray(value) && value?.length > 0;
    case "notEmptyObject":
      return (
        typeof value === "object" &&
        value !== null &&
        Object.keys(value)?.length > 0
      );
    default:
      return false;
  }
};

export function Delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export const isNotEmptyString = (value: string | undefined) =>
  value !== undefined && value.trim() !== "";

export const isNotEmptyArray = (value: string[] | undefined) =>
  value !== undefined && value?.length > 0;

export const isNotEmptyObject = (value: object | undefined) =>
  value !== undefined && Object.keys(value)?.length > 0;

type Primitive = string | number | boolean | null | undefined;

export const converter = {
  toString(input: Primitive | unknown[]): string {
    if (input === null || input === undefined) {
      return "null";
    }
    if (Array.isArray(input)) {
      return `Array[${input?.length}]`; // TypeScript should correctly infer `input` as `unknown[]`
    }
    if (typeof input === "object") {
      return "Object{}"; // Handle objects generically
    }
    return String(input); // Covers string, number, and boolean
  },

  toNumber(input: Primitive): number {
    const num = parseFloat(String(input));
    if (isNaN(num)) {
      console.warn(`toNumber: '${input}' is not a valid number. Returning 0.`);
      return 0;
    }
    return num;
  },

  toBoolean(input: Primitive): boolean {
    if (typeof input === "boolean") return input;

    const falsyValues: Primitive[] = ["false", "0", "", null, undefined];
    return !falsyValues.includes(input);
  },

  toArray<T>(input: T | T[]): T[] {
    if (Array.isArray(input)) return input;
    return [input];
  },

  toObject<T>(input: T): Record<string, unknown> {
    if (typeof input === "object" && input !== null) {
      return input as Record<string, unknown>; // Cast to Record<string, unknown>
    }
    console.warn(`toObject: Input is not an object. Returning empty object.`);
    return {};
  },

  /**
   * Safely access a property in a nested object structure.
   * Example: converter.safeAccess(data, 'user.profile.name', 'Anonymous')
   */
  safeAccess<T>(
    obj: T,
    path: string,
    defaultValue: unknown = undefined,
  ): unknown {
    try {
      return (
        path.split(".").reduce((acc, key) => acc && (acc as any)[key], obj) ??
        defaultValue
      );
    } catch (err) {
      console.warn(
        `safeAccess: Invalid path '${path}'. Returning default value.`,
        err,
      );
      return defaultValue;
    }
  },
};

/**
 * Determines the status of a meeting based on the start and end times.
 * Handles input as Date, string, number, or undefined.
 *
 * @param meetingStart - The start time of the meeting. Can be a Date, a date string, a timestamp (number), or undefined.
 * @param meetingEnd - Optional end time of the meeting. Can be a Date, a date string, a timestamp (number), or undefined.
 *                     Defaults to 1 hour after the start if not provided.
 * @returns A string indicating the meeting status: 'upcoming', 'ongoing', or 'ended'.
 * @throws Error if the meetingStart is not provided or is invalid.
 */
export function determineMeetingStatus(
  meetingStart?: Date | string | number,
  meetingEnd?: Date | string | number,
): "upcoming" | "ongoing" | "ended" {
  const currentTime = new Date();

  // Ensure meetingStart is defined and convert it to a Date object
  if (!meetingStart) {
    throw new Error("Meeting start time is required.");
  }

  const start = convertToDate(meetingStart);
  let end: Date;

  // If meetingEnd is undefined, set it to 1 hour after the meetingStart
  if (meetingEnd) {
    end = convertToDate(meetingEnd);
  } else {
    end = new Date(start.getTime());
    end.setHours(end.getHours() + 1);
  }

  // Determine meeting status
  if (currentTime < start) {
    return "upcoming"; // Meeting is yet to begin
  } else if (currentTime >= start && currentTime <= end) {
    return "ongoing"; // Meeting is currently in session
  } else {
    return "ended"; // Meeting has concluded
  }
}

/**
 * Converts various input formats (Date, string, number) to a Date object.
 *
 * @param input - A Date, string, or number representing a date.
 * @returns A Date object corresponding to the input.
 * @throws Error if the input cannot be converted to a valid date.
 */
export function convertToDate(input: Date | string | number): Date {
  let date: Date;

  if (input instanceof Date) {
    date = input;
  } else if (typeof input === "string" || typeof input === "number") {
    date = new Date(input);
  } else {
    throw new Error("Invalid date input");
  }

  if (isNaN(date.getTime())) {
    throw new Error("Invalid date value");
  }

  return date;
}

export const isHtmlString = (text: string) => {
  const div = document.createElement("div");
  div.innerHTML = text;
  return div.innerHTML !== text;
};
