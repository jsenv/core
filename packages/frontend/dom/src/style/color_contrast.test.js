import { snapshotTests } from "@jsenv/snapshot";

import { contrastColor } from "./color_contrast.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("contrastColor returns 'white' for dark backgrounds", () => {
    return {
      "#4476ff": contrastColor("#4476ff"),
      "#1875FF": contrastColor("#1875FF"),
      "#105CC8": contrastColor("#105CC8"),
    };
  });
});
