import { escapeChars } from "./escape_chars.js"

export const escapeLineEndings = (string) => {
  return escapeChars(string, {
    "\n": "\\n",
    "\r": "\\r",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
  })
}
