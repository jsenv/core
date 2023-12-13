import { ANSI } from "@jsenv/log";

import { createAssert } from "./assert.js";

export const assert = createAssert({
  format: (string, type) => {
    if (type === "line_number_aside") {
      return ANSI.color(string, ANSI.GREY);
    }
    if (type === "column_marker_char") {
      return ANSI.color(string, ANSI.RED);
    }
    return string;
  },
});
