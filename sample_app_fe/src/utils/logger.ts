import { Config } from "../config";

export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR,
}

const isProduction = Config.MODE === "production";

const logLevel = isProduction ? LogLevel.ERROR : LogLevel.DEBUG;

const log = (level: LogLevel, ...args: unknown[]): void => {
  if (level >= logLevel) {
    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}] [${LogLevel[level]}]`;

    console[level === LogLevel.ERROR ? "error" : "log"](logPrefix, ...args);
  }
};

export const logger = {
  debug: (...args: unknown[]) => log(LogLevel.DEBUG, ...args),
  info: (...args: unknown[]) => log(LogLevel.INFO, ...args),
  warn: (...args: unknown[]) => log(LogLevel.WARN, ...args),
  error: (...args: unknown[]) => log(LogLevel.ERROR, ...args),
};
