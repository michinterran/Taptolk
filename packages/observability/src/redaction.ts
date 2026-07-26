const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|phone|message|otp|token|activation|secret|password|api.?key/i;

const SENSITIVE_VALUE_PATTERNS = [/(?:\+?82[-\s]?)?0?1[016789](?:[-\s]?[0-9]){7,8}/u] as const;

const REDACTED_VALUE = "[REDACTED]";

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[MAX_DEPTH]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED_VALUE : redactSensitiveData(item, depth + 1),
      ]),
    );
  }

  if (
    typeof value === "string" &&
    SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value))
  ) {
    return REDACTED_VALUE;
  }

  return value;
}
