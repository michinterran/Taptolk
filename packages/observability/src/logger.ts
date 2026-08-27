import { redactSensitiveData } from "./redaction.js";

export interface LogContext {
  requestId?: string;
  service: string;
  traceId?: string;
}

export interface StructuredLogger {
  error(event: string, data?: Record<string, unknown>): void;
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
}

export function createLogger(context: LogContext): StructuredLogger {
  const write = (
    level: "error" | "info" | "warn",
    event: string,
    data: Record<string, unknown> = {},
  ) => {
    const record = redactSensitiveData({
      ...context,
      ...data,
      event,
      level,
      timestamp: new Date().toISOString(),
    });
    const output = JSON.stringify(record);

    if (level === "error") {
      console.error(output);
      return;
    }
    console.log(output);
  };

  return {
    error: (event, data) => write("error", event, data),
    info: (event, data) => write("info", event, data),
    warn: (event, data) => write("warn", event, data),
  };
}
