import { require } from "../../require.js"

// https://github.com/rburns/ansi-to-html/blob/master/src/ansi_to_html.js
// https://github.com/drudru/ansi_up/blob/master/ansi_up.js
const Convert = require("ansi-to-html")

export const ansiToHTML = (ansiString) => {
  return new Convert().toHtml(ansiString)
}
