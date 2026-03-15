import { snapshotTests } from "@jsenv/snapshot";

import { parseCSSColor } from "./css_color.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("hex colors", () => {
    return {
      "#rgb shorthand": parseCSSColor("#f0c"),
      "#rrggbb": parseCSSColor("#ff0000"),
      "#rrggbbaa with transparency": parseCSSColor("#ff000080"),
      "uppercase hex": parseCSSColor("#FF6600"),
    };
  });

  test("rgb / rgba", () => {
    return {
      "rgb()": parseCSSColor("rgb(100, 149, 237)"),
      "rgba() fully opaque": parseCSSColor("rgba(0, 128, 0, 1)"),
      "rgba() semi-transparent": parseCSSColor("rgba(255, 0, 0, 0.5)"),
    };
  });

  test("hsl / hsla", () => {
    return {
      "hsl()": parseCSSColor("hsl(120, 100%, 50%)"),
      "hsla() semi-transparent": parseCSSColor("hsla(240, 100%, 50%, 0.3)"),
    };
  });

  test("named colors", () => {
    return {
      white: parseCSSColor("white"),
      black: parseCSSColor("black"),
      red: parseCSSColor("red"),
      transparent: parseCSSColor("transparent"),
    };
  });

  test("special values", () => {
    return {
      "empty string": parseCSSColor(""),
      "null": parseCSSColor(null),
      "unknown color": parseCSSColor("notacolor"),
      "raw CSS variable without element": parseCSSColor("var(--my-color)"),
      "bare custom property warns and returns null":
        parseCSSColor("--my-color"),
    };
  });

  test("CSS variable resolved via element mock", () => {
    const mockElement = {};
    const originalGetComputedStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({
      getPropertyValue: (prop) => {
        if (prop === "--brand-color") return "#1976d2";
        return "";
      },
    });
    try {
      return {
        "var(--brand-color)": parseCSSColor("var(--brand-color)", mockElement),
        "var(--missing) with fallback": parseCSSColor(
          "var(--missing, #ff6f00)",
          mockElement,
        ),
        "var(--missing) without fallback": parseCSSColor(
          "var(--missing)",
          mockElement,
        ),
      };
    } finally {
      globalThis.getComputedStyle = originalGetComputedStyle;
    }
  });

  test("light-dark() resolved via element mock", () => {
    const mockElement = {};
    const originalGetComputedStyle = globalThis.getComputedStyle;
    const originalWindow = globalThis.window;

    globalThis.getComputedStyle = () => ({
      colorScheme: "light",
      getPropertyValue: () => "",
    });
    globalThis.window = {
      matchMedia: () => ({ matches: false }),
    };
    try {
      return {
        "light-dark() in light scheme": parseCSSColor(
          "light-dark(#ffffff, #000000)",
          mockElement,
        ),
        "light-dark() in dark scheme": (() => {
          globalThis.getComputedStyle = () => ({
            colorScheme: "dark",
            getPropertyValue: () => "",
          });
          return parseCSSColor("light-dark(#ffffff, #000000)", mockElement);
        })(),
      };
    } finally {
      globalThis.getComputedStyle = originalGetComputedStyle;
      globalThis.window = originalWindow;
    }
  });

  test("color(srgb ...) syntax", () => {
    return {
      "semi-transparent blue": parseCSSColor(
        "color(srgb 0.266667 0.462745 1 / 0.4)",
      ),
      "semi-transparent grey": parseCSSColor(
        "color(srgb 0.462745 0.462745 0.462745 / 0.4)",
      ),
      "opaque blue-grey (no alpha)": parseCSSColor(
        "color(srgb 0.743333 0.772745 0.853333)",
      ),
    };
  });
});
