import { escapeTemplateStringSpecialCharacters } from "./template_string_escape.js"

export const convertCssTextToJavascriptModule = async ({ content }) => {
  const cssTextEscaped = escapeTemplateStringSpecialCharacters(content)
  return {
    content: `
const stylesheet = new CSSStyleSheet()

stylesheet.replaceSync(\`${cssTextEscaped}\`)

export default stylesheet`,
  }
}
