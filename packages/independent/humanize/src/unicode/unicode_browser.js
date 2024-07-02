import { createUnicode } from "./unicode_runtime_agnostic.js";
import { ANSI } from "../ansi/ansi_browser.js";

export const UNICODE = createUnicode({
  supported: true,
  ANSI,
});
