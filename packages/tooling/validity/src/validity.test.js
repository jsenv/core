import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "./validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("type validation", () => {
    const [validity, applyOn] = createValidity({ type: "number" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "42": run(42),
      '"123"': run("123"),
      '"not a number"': run("not a number"),
      "Infinity": run(Infinity),
    };
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

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "42": run(42),
      "3.14": run(3.14),
      '"123"': run("123"),
      '"3.7"': run("3.7"),
    };
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

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "0.5": run(0.5),
      "0": run(0),
      "1": run(1),
      "1.5": run(1.5),
      "-0.5": run(-0.5),
      '"0.75"': run("0.75"),
    };
  });

  test("email type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "email",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"user@example.com"': run("user@example.com"),
      '"test@domain.org"': run("test@domain.org"),
      '"invalid-email"': run("invalid-email"),
      '"@domain.com"': run("@domain.com"),
      '"user@"': run("user@"),
    };
  });

  test("url type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "url",
    });

    const results = {};

    applyOn("https://example.com");
    results["valid https url"] = structuredClone(validity);

    applyOn("http://domain.org/path");
    results["valid http url with path"] = structuredClone(validity);

    applyOn("ftp://files.example.com");
    results["valid ftp url"] = structuredClone(validity);

    applyOn("not-a-url");
    results["invalid url"] = structuredClone(validity);

    applyOn("://missing-protocol.com");
    results["invalid url - malformed"] = structuredClone(validity);

    return results;
  });

  test("color type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "color",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"#FF0000"': run("#FF0000"),
      '"#f0a"': run("#f0a"),
      '"rgb(255, 128, 0)"': run("rgb(255, 128, 0)"),
      '"rgba(255, 128, 0, 0.5)"': run("rgba(255, 128, 0, 0.5)"),
      '"red"': run("red"),
      '"Blue"': run("Blue"),
      '"#GGGGGG"': run("#GGGGGG"),
      '"rgb(300, 128, 0)"': run("rgb(300, 128, 0)"),
    };
  });

  test("date type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "date",
    });

    const results = {};

    applyOn("2023-12-25");
    results["valid date"] = structuredClone(validity);

    applyOn("2024-02-29");
    results["valid leap year date"] = structuredClone(validity);

    applyOn("2023-02-29");
    results["invalid date - not leap year"] = structuredClone(validity);

    applyOn("12/25/2023");
    results["invalid date format"] = structuredClone(validity);

    applyOn("2023-13-01");
    results["invalid month"] = structuredClone(validity);

    return results;
  });

  test("time type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "time",
    });

    const results = {};

    applyOn("14:30");
    results["valid time HH:MM"] = structuredClone(validity);

    applyOn("09:15:30");
    results["valid time HH:MM:SS"] = structuredClone(validity);

    applyOn("23:59:59");
    results["valid time - end of day"] = structuredClone(validity);

    applyOn("24:00");
    results["invalid time - 24:00"] = structuredClone(validity);

    applyOn("14:60");
    results["invalid minutes"] = structuredClone(validity);

    applyOn("2:30 PM");
    results["invalid format - 12 hour"] = structuredClone(validity);

    return results;
  });
});
