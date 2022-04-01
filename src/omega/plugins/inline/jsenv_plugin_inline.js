import { jsenvPluginJsAndCssInsideHtml } from "./jsenv_plugin_js_and_css_inside_html.js"
import { jsenvPluginJsonAndCssInsideJs } from "./jsenv_plugin_json_and_css_inside_js.js"
import { jsenvPluginDataUrls } from "./jsenv_plugin_data_urls.js"
import { jsenvPluginInlineQueryParam } from "./jsenv_plugin_inline_query_param.js"

export const jsenvPluginInline = () => {
  return [
    jsenvPluginJsAndCssInsideHtml(),
    jsenvPluginJsonAndCssInsideJs(),
    jsenvPluginDataUrls(),
    jsenvPluginInlineQueryParam(),
  ]
}
