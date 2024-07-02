import Graphemer from "graphemer";
import { createAssert } from "./assert_scratch.js";
import stringWidth from "string-width";

export const assert = createAssert({
  measureStringWidth: stringWidth,
  tokenizeString: (string) => {
    // eslint-disable-next-line new-cap
    const splitter = new Graphemer.default();
    return splitter.splitGraphemes(string);
  },
});
