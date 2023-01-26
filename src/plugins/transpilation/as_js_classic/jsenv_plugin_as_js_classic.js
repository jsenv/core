import { urlToFilename } from "@jsenv/urls"
import { jsenvPluginAsJsClassicConversion } from "./jsenv_plugin_as_js_classic_conversion.js"
import { jsenvPluginAsJsClassicHtml } from "./jsenv_plugin_as_js_classic_html.js"
import { jsenvPluginAsJsClassicWorkers } from "./jsenv_plugin_as_js_classic_workers.js"
import { jsenvPluginAsJsClassicLibrary } from "./jsenv_plugin_as_js_classic_library.js"

export const jsenvPluginAsJsClassic = ({
  jsClassicLibrary,
  jsClassicFallback,
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
    ...(jsClassicFallback
      ? [
          jsenvPluginAsJsClassicHtml({
            systemJsInjection,
            systemJsClientFileUrl,
          }),
          jsenvPluginAsJsClassicWorkers(),
          jsenvPluginAsJsClassicConversion({
            systemJsInjection,
            systemJsClientFileUrl,
            generateJsClassicFilename,
          }),
        ]
      : []),
  ]
}
