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
  test("test 1", () => {
    return run(
      "rgba(0, 0, 0, 0) url(image.jpg) repeat scroll 0% 0% / auto padding-box border-box",
    );
  });

  test("test 2", () => {
    return run(
      "rgba(0, 0, 0, 0) repeating-linear-gradient(45deg, rgb(0, 122, 204), rgb(0, 122, 204) 8px, rgb(255, 255, 255) 8px, rgb(255, 255, 255) 16px) repeat scroll 0% 0% / auto padding-box border-box",
    );
  });

  test("test 3", () => {
    return run("linear-gradient(45deg, red, blue)");
  });

  test("test 4", () => {
    return run("url(image.jpg) center top / 100px 200px no-repeat");
  });
});
