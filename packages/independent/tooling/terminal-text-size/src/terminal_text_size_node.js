import { stripVTControlCharacters } from "node:util";
import { createMeasureTextWidth } from "./measure_text_width.js";

export const measureTextWidth = createMeasureTextWidth({
  stripAnsi: stripVTControlCharacters,
});
