import { createAssert } from "./assert_scratch.js";
import { measureStringWidth } from "./string_width_browser.js";

export const assert = createAssert({
  measureStringWidth,
});
