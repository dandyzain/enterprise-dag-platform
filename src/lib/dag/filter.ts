export type FilterOperator = "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan" | "exists";

export interface FilterResult {
  matched: boolean;
  fieldValue: unknown;
  operator: string;
  targetValue: unknown;
  explanation: string;
}

/** Evaluates a filter node's (already interpolated) configuration. Shared by the engine and the step tester. */
export function evaluateFilter(config: Record<string, unknown>): FilterResult {
  const fieldValue = config.field;
  const operator = String(config.operator || "equals");
  const targetValue = config.value;

  let matched = false;
  switch (operator) {
    case "equals":
      matched = String(fieldValue) === String(targetValue);
      break;
    case "notEquals":
      matched = String(fieldValue) !== String(targetValue);
      break;
    case "contains":
      matched = String(fieldValue ?? "")
        .toLowerCase()
        .includes(String(targetValue ?? "").toLowerCase());
      break;
    case "greaterThan":
      matched = Number(fieldValue) > Number(targetValue);
      break;
    case "lessThan":
      matched = Number(fieldValue) < Number(targetValue);
      break;
    case "exists":
      matched = fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== "";
      break;
    default:
      matched = Boolean(fieldValue);
  }

  const shown = typeof fieldValue === "object" ? JSON.stringify(fieldValue) : String(fieldValue);
  return {
    matched,
    fieldValue,
    operator,
    targetValue,
    explanation: matched
      ? `Filter condition passed: '${shown}' ${operator} '${String(targetValue)}'`
      : `Filter condition halted: '${shown}' did not satisfy ${operator} '${String(targetValue)}'`,
  };
}
