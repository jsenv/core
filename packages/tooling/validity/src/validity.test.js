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

  test("cross-rule validation works correctly - suggestions are validated against all rules", () => {
    // This test demonstrates that the system correctly validates suggestions
    // from one rule against all other rules
    const [validity, applyOn] = createValidity({
      type: "number", // Rule 1: type conversion
      min: 0, // Rule 2: minimum value
      max: 100, // Rule 3: maximum value
      step: 1, // Rule 4: integer step
    });

    const results = {};

    // Case 1: String "150" converts to number 150, but violates max rule
    // Should suggest 100 (the max limit) instead
    applyOn("150");
    results["type conversion violates max - suggests max limit"] =
      structuredClone(validity);

    // Case 2: String "5.5" converts to number 5.5, but violates step rule
    // Should suggest 6 (rounded to nearest valid step) instead
    applyOn("5.5");
    results["type conversion violates step - suggests rounded value"] =
      structuredClone(validity);

    // Case 3: String "-10" converts to number -10, but violates min rule
    // Should suggest 0 (the min limit) instead
    applyOn("-10");
    results["type conversion violates min - suggests min limit"] =
      structuredClone(validity);

    // Case 4: Valid case for comparison
    applyOn("50");
    results["type conversion valid for all rules"] = structuredClone(validity);

    return results;
  });

  test("debug cross-rule validation behavior", () => {
    // Simple case to understand what's happening
    const [validity, applyOn] = createValidity({
      type: "number",
      max: 100,
    });

    const results = {};

    // Case 1: String "50" should convert to 50 and be valid
    applyOn("50");
    results["valid conversion"] = structuredClone(validity);

    // Case 2: String "150" should convert to 150, but 150 > 100
    // In the old system, this would suggest 100
    // In the new system, should it suggest 100 or null?
    applyOn("150");
    results["type conversion exceeds max"] = structuredClone(validity);

    return results;
  });

  test("impossible constraint validation", () => {
    // Test case where no valid suggestion is possible
    const [validity, applyOn] = createValidity({
      type: "number",
      oneOf: [10, 20, 30], // Only these values allowed
      min: 50, // But min is 50, making oneOf values impossible
    });

    const results = {};

    // This should create an impossible situation:
    // - Type conversion suggests a number
    // - But oneOf only allows [10, 20, 30]
    // - But min is 50, so none of [10, 20, 30] are valid
    applyOn("15");
    results["impossible constraint - no valid suggestion"] =
      structuredClone(validity);

    return results;
  });
  test("float type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "float",
    });

    const results = {};

    applyOn(3.14);
    results["valid float"] = structuredClone(validity);

    applyOn("2.5");
    results["string to float conversion"] = structuredClone(validity);

    applyOn("invalid");
    results["invalid string"] = structuredClone(validity);

    return results;
  });

  test("integer type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "integer",
    });

    const results = {};

    applyOn(42);
    results["valid integer"] = structuredClone(validity);

    applyOn(3.14);
    results["float to integer conversion"] = structuredClone(validity);

    applyOn("123");
    results["string to integer conversion"] = structuredClone(validity);

    applyOn("3.7");
    results["string float to integer conversion"] = structuredClone(validity);

    return results;
  });

  test("longitude type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "longitude",
    });

    const results = {};

    applyOn(45.5);
    results["valid longitude"] = structuredClone(validity);

    applyOn(0);
    results["zero longitude"] = structuredClone(validity);

    applyOn(-179.9);
    results["negative longitude"] = structuredClone(validity);

    applyOn(200);
    results["longitude over 180"] = structuredClone(validity);

    applyOn(-200);
    results["longitude under -180"] = structuredClone(validity);

    applyOn("125.5");
    results["string to longitude conversion"] = structuredClone(validity);

    return results;
  });

  test("latitude type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "latitude",
    });

    const results = {};

    applyOn(45.5);
    results["valid latitude"] = structuredClone(validity);

    applyOn(0);
    results["zero latitude"] = structuredClone(validity);

    applyOn(-89.9);
    results["negative latitude"] = structuredClone(validity);

    applyOn(100);
    results["latitude over 90"] = structuredClone(validity);

    applyOn(-100);
    results["latitude under -90"] = structuredClone(validity);

    applyOn("45.5");
    results["string to latitude conversion"] = structuredClone(validity);

    return results;
  });

  test("ratio type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "ratio",
    });

    const results = {};

    applyOn(0.5);
    results["valid ratio"] = structuredClone(validity);

    applyOn(0);
    results["zero ratio"] = structuredClone(validity);

    applyOn(1);
    results["one ratio"] = structuredClone(validity);

    applyOn(1.5);
    results["ratio over 1"] = structuredClone(validity);

    applyOn(-0.5);
    results["negative ratio"] = structuredClone(validity);

    applyOn("0.75");
    results["string to ratio conversion"] = structuredClone(validity);

    return results;
  });
});
