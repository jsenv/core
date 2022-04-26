import { jsenvPluginHtmlInlineContent } from "./jsenv_plugin_html_inline_content.js"
import { jsenvPluginJsInlineContent } from "./jsenv_plugin_js_inline_content.js"
import { jsenvPluginDataUrls } from "./jsenv_plugin_data_urls.js"
import { jsenvPluginInlineQueryParam } from "./jsenv_plugin_inline_query_param.js"

export const jsenvPluginInline = ({
  loadInlineUrls = true,
  allowEscapeForVersioning,
} = {}) => {
  return [
    ...(loadInlineUrls ? [jsenvPluginInlineUrls()] : []),
    jsenvPluginHtmlInlineContent(),
    jsenvPluginJsInlineContent({ allowEscapeForVersioning }),
    jsenvPluginDataUrls(),
    jsenvPluginInlineQueryParam(),
  ]
}

const jsenvPluginInlineUrls = () => {
  return {
    name: "jsenv:inline_urls",
    appliesDuring: "*",
    load: (urlInfo) => {
      if (!urlInfo.isInline) {
        return null
      }
      return {
        contentType: urlInfo.contentType,
        content: urlInfo.content,
      }
    },
  }
}
