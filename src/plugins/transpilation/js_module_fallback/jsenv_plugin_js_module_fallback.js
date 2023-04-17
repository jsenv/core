import { urlToFilename } from "@jsenv/urls"
import { jsenvPluginJsModuleConversion } from "./jsenv_plugin_js_module_conversion.js"
import { jsenvPluginJsModuleFallbackInsideHtml } from "./jsenv_plugin_js_module_fallback_inside_html.js"
import { jsenvPluginJsModuleFallbackOnWorkers } from "./jsenv_plugin_js_module_fallback_on_workers.js"
import { jsenvPluginAsJsClassicLibrary } from "./jsenv_plugin_as_js_classic_library.js"

export const jsenvPluginJsModuleFallback = ({
  jsClassicLibrary,
  jsModuleFallbackOnJsClassic,
  systemJsInjection,
}) => {
  const systemJsClientFileUrl = new URL("./client/s.js", import.meta.url).href

  const generateJsClassicFilename = (url) => {
    const filename = urlToFilename(url)
    let [basename, extension] = splitFileExtension(filename)
    const { searchParams } = new URL(url)
    if (
      searchParams.has("as_json_module") ||
      searchParams.has("as_css_module") ||
      searchParams.has("as_text_module")
    ) {
      extension = ".js"
    }
    return `${basename}.nomodule${extension}`
  }

  const splitFileExtension = (filename) => {
    const dotLastIndex = filename.lastIndexOf(".")
    if (dotLastIndex === -1) {
      return [filename, ""]
    }
    return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)]
  }

  return [
    ...(jsClassicLibrary
      ? [
          jsenvPluginAsJsClassicLibrary({
            systemJsInjection,
            systemJsClientFileUrl,
            generateJsClassicFilename,
          }),
        ]
      : []),
    ...(jsModuleFallbackOnJsClassic
      ? [
          jsenvPluginJsModuleFallbackInsideHtml({
            systemJsInjection,
            systemJsClientFileUrl,
          }),
          jsenvPluginJsModuleFallbackOnWorkers(),
          jsenvPluginJsModuleConversion({
            systemJsInjection,
            systemJsClientFileUrl,
            generateJsClassicFilename,
          }),
        ]
      : []),
  ]
}
