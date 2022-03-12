import { parseHtmlUrlMentions } from "./parse/html/html_url_mentions.js"
import { parseCssUrlMentions } from "./parse/css/css_url_mentions.js"
import { parseJsModuleUrlMentions } from "./parse/js_module/js_module_url_mentions.js"

const parsers = {
  html: parseHtmlUrlMentions,
  css: parseCssUrlMentions,
  js_module: parseJsModuleUrlMentions,
}

export const parseUrls = async ({ type, url, content }) => {
  const parser = parsers[type]
  if (!parser) {
    return {
      urlMentions: [],
      hotDecline: false,
      hotAcceptSelf: false,
      hotAcceptDependencies: [],
      replaceUrls: () => null,
    }
  }
  const {
    urlMentions = [],
    hotDecline = false,
    hotAcceptSelf = false,
    hotAcceptDependencies = [],
    replaceUrls,
  } = await parser({ url, content })
  return {
    urlMentions,
    hotDecline,
    hotAcceptSelf,
    hotAcceptDependencies,
    replaceUrls,
  }
}
