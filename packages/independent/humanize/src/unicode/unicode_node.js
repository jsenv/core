import isUnicodeSupported from "is-unicode-supported";
import { ANSI } from "../ansi/ansi_node.js";
import { createUnicode } from "./unicode_runtime_agnostic.js";

export const UNICODE = createUnicode({
  supported: process.env.FORCE_UNICODE === "1" || isUnicodeSupported(),
  ANSI,
});
