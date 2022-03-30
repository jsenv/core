import { jsenvPluginHtmlInlineScriptsAndStyles } from "./jsenv_plugin_html_scripts_and_styles.js"
import { jsenvPluginDataUrls } from "./jsenv_plugin_data_urls.js"
import { jsenvPluginInlineQueryParam } from "./jsenv_plugin_inline_query_param.js"

export const jsenvPluginInline = ({ skipHtmlInlineLoad } = {}) => {
  return [
    jsenvPluginHtmlInlineScriptsAndStyles({ skipHtmlInlineLoad }),
    jsenvPluginDataUrls(),
    jsenvPluginInlineQueryParam(),
  ]
}
