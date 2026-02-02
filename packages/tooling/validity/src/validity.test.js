import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "./validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("type validation", () => {
    const [validity, applyOn] = createValidity({ type: "number" });

    const results = {};

    // Valid number
    applyOn(42);
    results["valid number"] = structuredClone(validity);

    // Invalid type with auto-fix
    applyOn("123");
    results["string to number conversion"] = structuredClone(validity);

    // Invalid type without auto-fix
    applyOn("not a number");
    results["invalid string"] = structuredClone(validity);

    // Non-finite number
    applyOn(Infinity);
    results["infinity"] = structuredClone(validity);

    return results;
  });

  test("min/max validation", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      min: 0,
      max: 100,
    });

    const results = {};

    // Valid range
    applyOn(50);
    results["valid range"] = structuredClone(validity);

    // Below minimum
    applyOn(-10);
    results["below minimum"] = structuredClone(validity);

    // Above maximum
    applyOn(150);
    results["above maximum"] = structuredClone(validity);

    // Edge cases
    applyOn(0);
    results["exact minimum"] = structuredClone(validity);

    applyOn(100);
    results["exact maximum"] = structuredClone(validity);

    return results;
  });

  test("step validation", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      step: 0.1,
      min: 0,
    });

    const results = {};

    // Valid step
    applyOn(1.2);
    results["valid step"] = structuredClone(validity);

    // Invalid step - should trigger validation error
    applyOn(1.23);
    results["invalid step"] = structuredClone(validity);

    // Edge case - very close to valid step (within epsilon)
    applyOn(1.1000000001);
    results["epsilon tolerance"] = structuredClone(validity);

    return results;
  });

  test("step validation with integer step", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      step: 1,
    });

    const results = {};

    // Valid integer
    applyOn(5);
    results["valid integer"] = structuredClone(validity);

    // Invalid - not an integer
    applyOn(5.5);
    results["not an integer"] = structuredClone(validity);

    return results;
  });

  test("oneOf validation", () => {
    const [validity, applyOn] = createValidity({
      oneOf: ["red", "green", "blue"],
    });

    const results = {};

    // Valid option
    applyOn("red");
    results["valid option"] = structuredClone(validity);

    // Invalid option
    applyOn("yellow");
    results["invalid option"] = structuredClone(validity);

    return results;
  });

  test("combined validation", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      min: 0,
      max: 10,
      step: 0.5,
    });

    const results = {};

    // Valid value
    applyOn(5.5);
    results["valid combined"] = structuredClone(validity);

    // Multiple violations
    applyOn(-2.3);
    results["multiple violations"] = structuredClone(validity);

    return results;
  });

  test("percentage type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "percentage",
    });

    const results = {};

    // Valid percentage
    applyOn("50%");
    results["valid percentage"] = structuredClone(validity);

    // Invalid percentage - no %
    applyOn("50");
    results["missing percent sign"] = structuredClone(validity);

    // Invalid percentage - out of range
    applyOn("150%");
    results["out of range"] = structuredClone(validity);

    // Number to percentage conversion
    applyOn(75);
    results["number conversion"] = structuredClone(validity);

    return results;
  });

  test("boolean type conversion", () => {
    const [validity, applyOn] = createValidity({
      type: "boolean",
    });

    const results = {};

    // Valid boolean
    applyOn(true);
    results["valid boolean"] = structuredClone(validity);

    // String to boolean conversion
    applyOn("true");
    results["string true conversion"] = structuredClone(validity);

    applyOn("false");
    results["string false conversion"] = structuredClone(validity);

    // Number to boolean conversion
    applyOn(1);
    results["number conversion"] = structuredClone(validity);

    return results;
  });

  test("object type with JSON conversion", () => {
    const [validity, applyOn] = createValidity({
      type: "object",
    });

    const results = {};

    // Valid object
    applyOn({ key: "value" });
    results["valid object"] = structuredClone(validity);

    // JSON string to object conversion
    applyOn('{"key": "value"}');
    results["JSON string conversion"] = structuredClone(validity);

    // Invalid JSON string
    applyOn("{invalid json}");
    results["invalid JSON"] = structuredClone(validity);

    return results;
  });

  test("unknown rule should be ignored", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      unknownRule: "should be ignored",
    });

    const results = {};

    applyOn(42);
    results["unknown rule ignored"] = structuredClone(validity);

    return results;
  });
});
