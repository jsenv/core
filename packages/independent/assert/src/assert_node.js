import Graphemer from "graphemer";
import stringWidth from "string-width";
import { createAssert } from "./assert_scratch.js";
import { createGetWellKnownValuePath } from "./utils/well_known_value.js";

export const assert = createAssert({
  measureStringWidth: stringWidth,
  tokenizeString: (string) => {
    // eslint-disable-next-line new-cap
    const splitter = new Graphemer.default();
    return splitter.splitGraphemes(string);
  },
  getWellKnownValuePath: createGetWellKnownValuePath(global),
});
