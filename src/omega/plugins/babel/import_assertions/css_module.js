import { escapeTemplateStringSpecialCharacters } from "./template_string_escape.js"

export const convertCssTextToJavascriptModule = ({ content }) => {
  const cssTextEscaped = escapeTemplateStringSpecialCharacters(content)
  return {
    contentType: "application/javascript",
    content: `
const stylesheet = new CSSStyleSheet()

stylesheet.replaceSync(\`${cssTextEscaped}\`)

export default stylesheet`,
  }
}
