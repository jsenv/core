import { jsenvPluginHtmlInlineScriptsAndStyles } from "./jsenv_plugin_html_scripts_and_styles.js"
import { jsenvPluginDataUrls } from "./jsenv_plugin_data_urls.js"
import { jsenvPluginInlineQueryParam } from "./jsenv_plugin_inline_query_param.js"

// TODO: consider JSON.parse(jsonString)
// and and replaceSync(cssString) as inline urls for js
export const jsenvPluginInline = () => {
  return [
    jsenvPluginHtmlInlineScriptsAndStyles(),
    jsenvPluginDataUrls(),
    jsenvPluginInlineQueryParam(),
  ]
}
