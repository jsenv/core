import { escapeChars } from "./escape_chars.js"

export const escapeStringSpecialChars = (string, quote) => {
  return escapeChars(string, {
    [quote]: `\\${quote}`,
    "\n": "\\n",
    "\r": "\\r",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
  })
}
