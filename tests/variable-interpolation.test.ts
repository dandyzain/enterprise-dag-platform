import { describe, it, expect } from "vitest";
import {
  interpolateVariables,
  getNestedValue,
  ExecutionContext,
} from "@/lib/dag/variable-interpolator";

describe("Variable Interpolation Engine", () => {
  const context: ExecutionContext = {
    trigger: {
      body: {
        userId: "usr_9918",
        customer: {
          name: "Alice Johnson",
          tier: "enterprise",
          credits: 500,
        },
      },
    },
    steps: {
      step_payment: {
        output: {
          status: "PAID",
          transactionId: "txn_secure_8831",
          amount: 299.99,
        },
      },
    },
    credentials: {
      STRIPE_PRODUCTION_API_KEY: "mock_sec_prod_token_test",
    },
  };

  it("should extract nested properties using dot notation", () => {
    expect(
      getNestedValue(context as Record<string, unknown>, "trigger.body.userId")
    ).toBe("usr_9918");
    expect(
      getNestedValue(
        context as Record<string, unknown>,
        "trigger.body.customer.name"
      )
    ).toBe("Alice Johnson");
    expect(
      getNestedValue(
        context as Record<string, unknown>,
        "steps.step_payment.output.status"
      )
    ).toBe("PAID");
    expect(
      getNestedValue(
        context as Record<string, unknown>,
        "credentials.STRIPE_PRODUCTION_API_KEY"
      )
    ).toBe("mock_sec_prod_token_test");
  });

  it("should return raw typed value when string is exactly an expression", () => {
    const rawNumber = interpolateVariables(
      "{{trigger.body.customer.credits}}",
      context
    );
    expect(rawNumber).toBe(500);

    const rawObj = interpolateVariables(
      "{{trigger.body.customer}}",
      context
    );
    expect(rawObj).toEqual({
      name: "Alice Johnson",
      tier: "enterprise",
      credits: 500,
    });
  });

  it("should interpolate template strings with multiple embedded expressions", () => {
    const template =
      "Bearer {{credentials.STRIPE_PRODUCTION_API_KEY}} for user {{trigger.body.userId}} on txn {{steps.step_payment.output.transactionId}}";
    const interpolated = interpolateVariables(template, context);

    expect(interpolated).toBe(
      "Bearer mock_sec_prod_token_test for user usr_9918 on txn txn_secure_8831"
    );
  });

  it("should recursively interpolate nested objects and arrays", () => {
    const payload = {
      user: "{{trigger.body.customer.name}}",
      details: {
        txn: "{{steps.step_payment.output.transactionId}}",
        meta: ["{{trigger.body.userId}}", "constant_value"],
      },
    };

    const resolved = interpolateVariables(payload, context);
    expect(resolved).toEqual({
      user: "Alice Johnson",
      details: {
        txn: "txn_secure_8831",
        meta: ["usr_9918", "constant_value"],
      },
    });
  });
});
