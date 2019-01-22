// https://github.com/rburns/ansi-to-html/blob/master/src/ansi_to_html.js
// https://github.com/drudru/ansi_up/blob/master/ansi_up.js
import Convert from "ansi-to-html"

export const ansiToHTML = (ansiString) => {
  return new Convert().toHtml(ansiString)
}
