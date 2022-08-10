/*
 * Something to keep in mind:
 * When systemjs format is used by babel, it will generated UID based on
 * the import specifier:
 * https://github.com/babel/babel/blob/97d1967826077f15e766778c0d64711399e9a72a/packages/babel-plugin-transform-modules-systemjs/src/index.ts#L498
 * But at this stage import specifier are absolute file urls
 * So without minification these specifier are long and dependent
 * on where the files are on the filesystem.
 * This is mitigated by minification that will shorten them
 * But ideally babel should not generate this in the first place
 * and prefer to unique identifier based solely on the specifier basename for instance
 */

import { jsenvPluginAsJsClassicConversion } from "./jsenv_plugin_as_js_classic_conversion.js"
import { jsenvPluginAsJsClassicHtml } from "./jsenv_plugin_as_js_classic_html.js"
import { jsenvPluginAsJsClassicWorkers } from "./jsenv_plugin_as_js_classic_workers.js"
import { jsenvPluginAsJsClassicLibrary } from "./jsenv_plugin_as_js_classic_library.js"

export const jsenvPluginAsJsClassic = ({
  jsClassicFallback,
  systemJsInjection,
}) => {
  const systemJsClientFileUrl = new URL(
    "./client/s.js?js_classic",
    import.meta.url,
  ).href

  return [
    jsenvPluginAsJsClassicLibrary({
      systemJsInjection,
      systemJsClientFileUrl,
    }),
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
          }),
        ]
      : []),
  ]
}
