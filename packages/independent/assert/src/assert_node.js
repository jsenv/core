import Graphemer from "graphemer";
import { createAssert } from "./assert_scratch.js";

export const assert = createAssert({
  tokenizeString: (string) => {
    // eslint-disable-next-line new-cap
    const splitter = new Graphemer.default();
    return splitter.splitGraphemes(string);
  },
});
