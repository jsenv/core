import { require } from "../../require.js"

// https://github.com/rburns/ansi-to-html/blob/master/src/ansi_to_html.js
// https://github.com/drudru/ansi_up/blob/master/ansi_up.js

export const ansiToHTML = (ansiString) => {
  const Convert = require("ansi-to-html")
  return new Convert().toHtml(ansiString)
}
