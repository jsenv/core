import { snapshotTests } from "@jsenv/snapshot";
import { parseCSSBackground } from "./css_background.js";

const mockElement = {};
// Mock parseStyle function for testing
const mockParseStyle = (value, property) => {
  // Simple mock that returns the value as-is for colors
  if (property === "backgroundColor") {
    return value; // In real implementation this would normalize colors
  }
  return value;
};
const run = (string) => {
  return parseCSSBackground(string, {
    parseStyle: mockParseStyle,
    element: mockElement,
  });
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("complex background with all properties", () => {
    return run(
      "rgba(0, 0, 0, 0) url(image.jpg) repeat scroll 0% 0% / auto padding-box border-box",
    );
  });

  test("repeating gradient with multiple color stops and positions", () => {
    return run(
      "rgba(0, 0, 0, 0) repeating-linear-gradient(45deg, rgb(0, 122, 204), rgb(0, 122, 204) 8px, rgb(255, 255, 255) 8px, rgb(255, 255, 255) 16px) repeat scroll 0% 0% / auto padding-box border-box",
    );
  });

  test("simple gradient with named colors", () => {
    return run("linear-gradient(45deg, red, blue)");
  });

  test("url with position and size", () => {
    return run("url(image.jpg) center top / 100px 200px no-repeat");
  });

  test("solid color only", () => {
    return run("#ff0000");
  });

  test("named color only", () => {
    return run("transparent");
  });

  test("gradient with percentage positions", () => {
    return run("linear-gradient(to right, red 0%, blue 50%, green 100%)");
  });

  test("multiple backgrounds", () => {
    return run("url(overlay.png), linear-gradient(45deg, red, blue), #ffffff");
  });

  test("radial gradient with size and position", () => {
    return run(
      "radial-gradient(circle at center, white 0%, black 100%) no-repeat center/cover",
    );
  });

  test("background with color at beginning", () => {
    return run("red url(image.jpg) no-repeat center");
  });
});
