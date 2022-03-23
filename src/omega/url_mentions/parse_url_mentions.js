import { parseHtmlUrlMentions } from "./html_url_mentions.js"
import { parseCssUrlMentions } from "./css_url_mentions.js"
import { parseJsModuleUrlMentions } from "./js_module_url_mentions.js"

const parsers = {
  html: parseHtmlUrlMentions,
  css: parseCssUrlMentions,
  js_module: parseJsModuleUrlMentions,
}

export const parseUrlMentions = async ({ type, url, content, scenario }) => {
  const parser = parsers[type]
  if (!parser) {
    return null
  }
  const {
    urlMentions = [],
    hotDecline = false,
    hotAcceptSelf = false,
    replaceUrls,
  } = await parser({ url, content, scenario })
  return {
    urlMentions,
    hotDecline,
    hotAcceptSelf,
    replaceUrls,
  }
}
