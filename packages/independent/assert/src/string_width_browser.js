// tslint:disable:ordered-imports (keep segmenter first)
import { cleanup } from "./segmenter_firefox.js";
import stringWidth from "string-width";

cleanup();

export const measureStringWidth = stringWidth;
