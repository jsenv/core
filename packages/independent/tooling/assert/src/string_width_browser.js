// tslint:disable:ordered-imports (keep segmenter first)
import { cleanup } from "./segmenter_firefox.js";
import { measureTextWidth } from "@jsenv/terminal-text-size";

cleanup();

export const measureStringWidth = measureTextWidth;
