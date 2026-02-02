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

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "50": run(50),
      "-10": run(-10),
      "150": run(150),
      "0": run(0),
      "100": run(100),
    };
  });

  test("step validation", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      step: 0.1,
      min: 0,
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      1.2: run(1.2),
      1.23: run(1.23),
      1.1000000001: run(1.1000000001),
    };
  });

  test("step validation with integer step", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      step: 1,
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      5: run(5),
      5.5: run(5.5),
    };
  });

  test("oneOf validation", () => {
    const [validity, applyOn] = createValidity({
      oneOf: ["red", "green", "blue"],
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"red"': run("red"),
      '"yellow"': run("yellow"),
    };
  });

  test("combined validation", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      min: 0,
      max: 10,
      step: 0.5,
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "5.5": run(5.5),
      "-2.3": run(-2.3),
    };
  });

  test("percentage type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "percentage",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"50%"': run("50%"),
      '"50"': run("50"),
      '"150%"': run("150%"),
      "75": run(75),
    };
  });

  test("boolean type conversion", () => {
    const [validity, applyOn] = createValidity({
      type: "boolean",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "true": run(true),
      '"true"': run("true"),
      '"false"': run("false"),
      "1": run(1),
    };
  });

  test("object type with JSON conversion", () => {
    const [validity, applyOn] = createValidity({
      type: "object",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '{ key: "value" }': run({ key: "value" }),
      '"{\"key\": \"value\"}"': run('{"key": "value"}'),
      '"{invalid json}"': run("{invalid json}"),
    };
  });

  test("unknown rule should be ignored", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      unknownRule: "should be ignored",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      42: run(42),
    };
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

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"150"': run("150"),
      '"5.5"': run("5.5"),
      '"-10"': run("-10"),
      '"50"': run("50"),
    };
  });

  test("debug cross-rule validation behavior", () => {
    // Simple case to understand what's happening
    const [validity, applyOn] = createValidity({
      type: "number",
      max: 100,
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"50"': run("50"),
      '"150"': run("150"),
    };
  });

  test("impossible constraint validation", () => {
    // Test case where no valid suggestion is possible
    const [validity, applyOn] = createValidity({
      type: "number",
      oneOf: [10, 20, 30], // Only these values allowed
      min: 50, // But min is 50, making oneOf values impossible
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"15"': run("15"),
    };
  });
  test("float type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "float",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "3.14": run(3.14),
      '"2.5"': run("2.5"),
      '"invalid"': run("invalid"),
    };
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

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "45.5": run(45.5),
      "0": run(0),
      "-179.9": run(-179.9),
      "200": run(200),
      "-200": run(-200),
      '"125.5"': run("125.5"),
    };
  });

  test("latitude type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "latitude",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "45.5": run(45.5),
      "0": run(0),
      "-89.9": run(-89.9),
      "100": run(100),
      "-100": run(-100),
      '"45.5"': run("45.5"),
    };
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

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"https://example.com"': run("https://example.com"),
      '"http://domain.org/path"': run("http://domain.org/path"),
      '"ftp://files.example.com"': run("ftp://files.example.com"),
      '"not-a-url"': run("not-a-url"),
      '"://missing-protocol.com"': run("://missing-protocol.com"),
    };
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

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"2023-12-25"': run("2023-12-25"),
      '"2024-02-29"': run("2024-02-29"),
      '"2023-02-29"': run("2023-02-29"),
      '"12/25/2023"': run("12/25/2023"),
      '"2023-13-01"': run("2023-13-01"),
    };
  });

  test("time type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "time",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"14:30"': run("14:30"),
      '"09:15:30"': run("09:15:30"),
      '"23:59:59"': run("23:59:59"),
      '"24:00"': run("24:00"),
      '"14:60"': run("14:60"),
      '"2:30 PM"': run("2:30 PM"),
    };
  });

  test("step validation with string inputs (simple number type)", () => {
    const [validity, applyOn] = createValidity({
      type: "number",
      step: 0.1,
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      '"3.000001"': run("3.000001"), // String should be stepped to 3.0
      '"3.05"': run("3.05"), // String should be stepped to 3.1
      '"2.67"': run("2.67"), // String should be stepped to 2.7
    };
  });

  test("step validation with string inputs (longitude type)", () => {
    const [validity, applyOn] = createValidity({
      type: "longitude",
      step: 0.1,
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "3.000001": run("3.000001"), // String should be stepped to 3.0
      "2.67": run("2.67"), // String should be stepped to 2.7
      "-179.95": run("-179.95"), // String should be stepped to -179.9
      "3.05": run("3.05"), // String should be stepped to 3.1
    };
  });

  test("an other step validation", () => {
    const [validity, applyOn] = createValidity({
      type: "longitude",
      step: 0.000001,
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      48.8666669999999: run("48.86666699999998"),
    };
  });
});
