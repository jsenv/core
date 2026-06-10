import { snapshotTests } from "@jsenv/snapshot";

import { createValidity } from "../src/validity.js";

await snapshotTests(import.meta.url, ({ test }) => {
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

  test("array type validation", () => {
    const [validity, applyOn] = createValidity({
      type: "array",
    });

    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };

    return {
      "[1, 2, 3]": run([1, 2, 3]),
      "[]": run([]),
      '{ key: "value" }': run({ key: "value" }),
      '"[1,2,3]"': run("[1,2,3]"),
      '"not an array"': run("not an array"),
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

  test("date type validation", () => {
    const [validity, applyOn] = createValidity({ type: "date" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06-15"': run("2024-06-15"),
      '"2024-02-29"': run("2024-02-29"), // valid leap day
      '"2023-02-29"': run("2023-02-29"), // invalid leap day
      '"not-a-date"': run("not-a-date"),
      "timestamp (number)": run(Date.UTC(2024, 5, 15)),
      "invalid type (boolean)": run(true),
    };
  });

  test("date type with min (timestamp)", () => {
    const today = new Date(2024, 5, 15); // 2024-06-15 local
    const [validity, applyOn] = createValidity({
      type: "date",
      min: today.getTime(),
    });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06-15" (today)': run("2024-06-15"),
      '"2024-06-14" (yesterday)': run("2024-06-14"),
      '"2024-06-16" (tomorrow)': run("2024-06-16"),
    };
  });

  test("date type with min and max (string bounds)", () => {
    const [validity, applyOn] = createValidity({
      type: "date",
      min: "2024-01-01",
      max: "2024-12-31",
    });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06-15"': run("2024-06-15"),
      '"2023-12-31"': run("2023-12-31"), // before min
      '"2025-01-01"': run("2025-01-01"), // after max
    };
  });

  test("month type validation", () => {
    const [validity, applyOn] = createValidity({ type: "month" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06"': run("2024-06"),
      '"2024-13"': run("2024-13"), // invalid month
      '"2024-00"': run("2024-00"), // invalid month
      '"not-a-month"': run("not-a-month"),
      "timestamp (number)": run(Date.UTC(2024, 5, 1)),
    };
  });

  test("month type with min (timestamp)", () => {
    const thisMonth = new Date(2024, 5, 1); // June 2024
    const [validity, applyOn] = createValidity({
      type: "month",
      min: thisMonth.getTime(),
    });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06" (this month)': run("2024-06"),
      '"2024-05" (last month)': run("2024-05"),
      '"2024-07" (next month)': run("2024-07"),
    };
  });

  test("datetime type validation", () => {
    const [validity, applyOn] = createValidity({ type: "datetime" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      '"2024-06-15T14:30:00Z"': run("2024-06-15T14:30:00Z"),
      '"2024-06-15"': run("2024-06-15"),
      '"not a datetime"': run("not a datetime"),
      "timestamp (number)": run(Date.UTC(2024, 5, 15, 14, 30)),
      "Date instance": run(new Date(2024, 5, 15, 14, 30)),
    };
  });

  test("datetime type with min and max (timestamps)", () => {
    const minTs = new Date(2024, 5, 15, 9, 0).getTime();
    const maxTs = new Date(2024, 5, 15, 18, 0).getTime();
    const [validity, applyOn] = createValidity({
      type: "datetime",
      min: minTs,
      max: maxTs,
    });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "within range": run(new Date(2024, 5, 15, 12, 0).getTime()),
      "before min": run(new Date(2024, 5, 15, 8, 0).getTime()),
      "after max": run(new Date(2024, 5, 15, 19, 0).getTime()),
    };
  });

  test("hour type validation", () => {
    const [validity, applyOn] = createValidity({ type: "hour" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "12": run(12),
      "-1 (below min)": run(-1),
      "1.5 (not integer)": run(1.5),
      '"3" (string number)': run("3"),
      "true (invalid type)": run(true),
    };
  });

  test("hour type with max", () => {
    const [validity, applyOn] = createValidity({ type: "hour", max: 23 });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "23": run(23),
      "24 (above max)": run(24),
    };
  });

  test("minute type validation", () => {
    const [validity, applyOn] = createValidity({ type: "minute" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "30": run(30),
      "90": run(90),
      "-5 (below min)": run(-5),
      "1.5 (not integer)": run(1.5),
      '"45" (string number)': run("45"),
      "true (invalid type)": run(true),
    };
  });

  test("minute type with max", () => {
    const [validity, applyOn] = createValidity({ type: "minute", max: 59 });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "59": run(59),
      "60 (above max)": run(60),
    };
  });

  test("second type validation", () => {
    const [validity, applyOn] = createValidity({ type: "second" });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "30": run(30),
      "-1 (below min)": run(-1),
      "1.5 (not integer)": run(1.5),
      '"10" (string number)': run("10"),
      "true (invalid type)": run(true),
    };
  });

  test("second type with max and decimal step", () => {
    const [validity, applyOn] = createValidity({
      type: "second",
      max: 59,
      step: 0.5,
    });
    const run = (value) => {
      applyOn(value);
      return structuredClone(validity);
    };
    return {
      "0": run(0),
      "30.5": run(30.5),
      "30.3 (invalid step)": run(30.3),
      "60 (above max)": run(60),
    };
  });
});
