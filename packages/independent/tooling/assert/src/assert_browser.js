import { createAssert } from "./assert_scratch.js";
import { measureStringWidth } from "./string_width_browser.js";
import { createGetWellKnownValuePath } from "./utils/well_known_value.js";

export const assert = createAssert({
  measureStringWidth,
  getWellKnownValuePath: createGetWellKnownValuePath(window),
});
