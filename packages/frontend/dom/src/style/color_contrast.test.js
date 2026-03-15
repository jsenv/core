import { snapshotTests } from "@jsenv/snapshot";

import { contrastColor } from "./color_contrast.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("contrastColor returns 'white' for dark backgrounds", () => {
    return {
      "#4476ff": contrastColor("#4476ff"),
    };
  });
});
