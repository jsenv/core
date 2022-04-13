import { jsenvPluginHtmlInlineContent } from "./jsenv_plugin_html_inline_content.js"
import { jsenvPluginJsInlineContent } from "./jsenv_plugin_js_inline_content.js"
import { jsenvPluginDataUrls } from "./jsenv_plugin_data_urls.js"
import { jsenvPluginInlineQueryParam } from "./jsenv_plugin_inline_query_param.js"

export const jsenvPluginInline = ({ allowEscapeForVersioning } = {}) => {
  return [
    jsenvPluginHtmlInlineContent(),
    jsenvPluginJsInlineContent({ allowEscapeForVersioning }),
    jsenvPluginDataUrls(),
    jsenvPluginInlineQueryParam(),
  ]
}
