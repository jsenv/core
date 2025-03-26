import { measureTextWidth } from "@jsenv/terminal-text-size";
import Graphemer from "graphemer";
import { createAssert } from "./assert_scratch.js";
import { createGetWellKnownValuePath } from "./utils/well_known_value.js";

export const assert = createAssert({
  measureStringWidth: measureTextWidth,
  tokenizeString: (string) => {
    // eslint-disable-next-line new-cap
    const splitter = new Graphemer.default();
    return splitter.splitGraphemes(string);
  },
  getWellKnownValuePath: createGetWellKnownValuePath(global),
  MAX_COLUMNS: process.stdout.columns,
});
