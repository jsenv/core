import { corePluginHtmlInlineScriptsAndStyles } from "./core_plugin_html_scripts_and_styles.js"
import { corePluginDataUrls } from "./core_plugin_data_urls.js"
import { corePluginInlineQueryParam } from "./core_plugin_inline_query_param.js"

export const corePluginInline = ({ skipHtmlInlineLoad } = {}) => {
  return [
    corePluginHtmlInlineScriptsAndStyles({ skipHtmlInlineLoad }),
    corePluginDataUrls(),
    corePluginInlineQueryParam(),
  ]
}
