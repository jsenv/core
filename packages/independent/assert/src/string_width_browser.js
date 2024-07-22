import stringWidth from "string-width";
import { cleanup } from "./segmenter_firefox.js";

cleanup();

export const measureStringWidth = stringWidth;
