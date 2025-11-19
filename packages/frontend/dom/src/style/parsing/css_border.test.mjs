import { snapshotTests } from "@jsenv/snapshot";
import { parseCSSBorder, stringifyCSSBorder } from "./css_border.js";

const run = (string) => {
  return parseCSSBorder(string);
};

const roundTrip = (string) => {
  const parsed = parseCSSBorder(string);
  return {
    parsed,
    stringified: stringifyCSSBorder(parsed),
  };
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic borders", () => {
    return {
      solid_red: run("2px solid red"),
      rgb_color: run("20px solid rgb(255, 107, 53)"),
      rgba_color: run("3px solid rgba(255, 0, 0, 0.5)"),
      hex_color: run("1px solid #ff0000"),
      named_color: run("4px solid blue"),
      transparent: run("2px solid transparent"),
    };
  });

  test("border styles", () => {
    return {
      dashed: run("3px dashed green"),
      dotted: run("2px dotted #0000ff"),
      double: run("6px double black"),
      groove: run("4px groove gray"),
      ridge: run("4px ridge #888888"),
      inset: run("3px inset darkgray"),
      outset: run("3px outset lightgray"),
    };
  });

  test("missing parts", () => {
    return {
      no_color: run("3px solid"),
      no_style: run("2px red"),
      no_width: run("solid blue"),
      only_width: run("5px"),
      only_style: run("solid"),
      only_color: run("red"),
    };
  });

  test("special cases", () => {
    return {
      none: run("none"),
      initial: run("initial"),
      empty: run(""),
      zero_width: run("0px solid red"),
      large_width: run("100px solid purple"),
      fractional: run("0.5px solid green"),
      negative_width: run("-2px solid red"),
    };
  });

  test("different units and formats", () => {
    return {
      em_unit: run("1.5em solid red"),
      rem_unit: run("2rem dashed blue"),
      hsl_color: run("2px solid hsl(120, 100%, 50%)"),
      hsla_color: run("3px solid hsla(240, 100%, 50%, 0.7)"),
      mixed_case: run("2px SOLID red"),
      extra_whitespace: run("  3px   solid    blue  "),
    };
  });

  test("different order", () => {
    return {
      color_first: run("red 2px solid"),
      style_first: run("dashed 3px green"),
    };
  });

  test("round trip", () => {
    return {
      basic: roundTrip("2px solid red"),
      complex_color: roundTrip("5px dashed rgba(255, 128, 0, 0.8)"),
      transparent: roundTrip("3px solid transparent"),
      none: roundTrip("none"),
      zero_width: roundTrip("0px solid blue"),
    };
  });

  test("error cases", () => {
    return {
      invalid_value: run("invalid border value"),
      invalid_style: run("2px invalidstyle red"),
      invalid_color: run("2px solid invalidcolor"),
    };
  });
});
