import stripAnsi from "strip-ansi";
import { createMeasureTextWidth } from "./measure_text_width.js";

export const measureTextWidth = createMeasureTextWidth({
  stripAnsi,
});
