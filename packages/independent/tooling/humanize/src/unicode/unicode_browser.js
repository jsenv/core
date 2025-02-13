import { ANSI } from "../ansi/ansi_browser.js";
import { createUnicode } from "./unicode_runtime_agnostic.js";

export const UNICODE = createUnicode({
  supported: true,
  ANSI,
});
