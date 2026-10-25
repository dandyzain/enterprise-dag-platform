export interface ExecutionContext {
  trigger?: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    [key: string]: unknown;
  };
  steps?: Record<
    string,
    {
      output?: unknown;
      status?: string;
      error?: string;
    }
  >;
  credentials?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Safely extracts a nested property using dot-notation path, e.g. "trigger.body.user.email"
 */
export function getNestedValue(context: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Parses expression strings like {{trigger.body.property}} or {{steps.nodeId.output.property}}
 * If the input is exactly "{{expression}}", it returns the raw typed value (object, boolean, number, etc.)
 * If the input is mixed text, it returns an interpolated string.
 */
export function interpolateVariables(value: unknown, context: ExecutionContext): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const singleMatch = trimmed.match(/^\{\{\s*([a-zA-Z0-9_$.]+)\s*\}\}$/);

    if (singleMatch && singleMatch[1]) {
      const resolved = getNestedValue(context as Record<string, unknown>, singleMatch[1]);
      return resolved !== undefined ? resolved : "";
    }

    // Replace all occurrences in template string
    return value.replace(/\{\{\s*([a-zA-Z0-9_$.]+)\s*\}\}/g, (_, expression) => {
      const resolved = getNestedValue(context as Record<string, unknown>, expression);
      if (resolved === undefined || resolved === null) {
        return "";
      }
      if (typeof resolved === "object") {
        return JSON.stringify(resolved);
      }
      return String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateVariables(item, context));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = interpolateVariables(val, context);
    }
    return result;
  }

  return value;
}
