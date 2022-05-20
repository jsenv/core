import { injectQueryParamsIntoSpecifier } from "@jsenv/utils/urls/url_utils.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { parseJsUrls } from "@jsenv/utils/js_ast/parse_js_urls.js"

export const jsenvPluginWorkersTypeModuleAsClassic = ({
  generateJsClassicFilename,
}) => {
  const transformJsWorkerTypes = async (urlInfo, context) => {
    const toUpdate = []
    let workerTypeModuleIsSupported
    let serviceWorkerTypeModuleIsSupported
    let sharedWorkerTypeModuleIsSupported
    const jsUrls = parseJsUrls({
      js: urlInfo.content,
      url: (urlInfo.data && urlInfo.data.rawUrl) || urlInfo.url,
      isJsModule: urlInfo.type === "js_module",
    })
    jsUrls.forEach((jsUrlMention) => {
      if (jsUrlMention.expectedType !== "js_module") {
        return
      }
      if (jsUrlMention.expectedSubtype === "worker") {
        if (workerTypeModuleIsSupported === undefined) {
          workerTypeModuleIsSupported =
            context.isSupportedOnCurrentClients("worker_type_module")
        }
        if (workerTypeModuleIsSupported) {
          return
        }
        toUpdate.push(jsUrlMention)
        return
      }
      if (jsUrlMention.expectedSubtype === "service_worker") {
        if (serviceWorkerTypeModuleIsSupported === undefined) {
          serviceWorkerTypeModuleIsSupported =
            context.isSupportedOnCurrentClients("service_worker_type_module")
        }
        if (serviceWorkerTypeModuleIsSupported) {
          return
        }
        toUpdate.push(jsUrlMention)
        return
      }
      if (jsUrlMention.expectedSubtype === "shared_worker") {
        if (sharedWorkerTypeModuleIsSupported === undefined) {
          sharedWorkerTypeModuleIsSupported =
            context.isSupportedOnCurrentClients("shared_worker_type_module")
        }
        if (sharedWorkerTypeModuleIsSupported) {
          return
        }
        toUpdate.push(jsUrlMention)
        return
      }
    })
    if (toUpdate.length === 0) {
      return null
    }
    const magicSource = createMagicSource(urlInfo.content)
    toUpdate.forEach((jsUrlMention) => {
      const reference = context.referenceUtils.findByGeneratedSpecifier(
        JSON.stringify(jsUrlMention.specifier),
      )
      const [newReference] = context.referenceUtils.update(reference, {
        expectedType: "js_classic",
        specifier: injectQueryParamsIntoSpecifier(reference.specifier, {
          as_js_classic: "",
        }),
        filename: generateJsClassicFilename(reference.url),
      })
      magicSource.replace({
        start: jsUrlMention.start,
        end: jsUrlMention.end,
        replacement: newReference.generatedSpecifier,
      })
      magicSource.replace({
        start: jsUrlMention.typePropertyNode.value.start,
        end: jsUrlMention.typePropertyNode.value.end,
        replacement: JSON.stringify("classic"),
      })
    })
    return magicSource.toContentAndSourcemap()
  }

  return {
    name: "jsenv:workers_type_module_as_classic",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: transformJsWorkerTypes,
      js_classic: transformJsWorkerTypes,
    },
  }
}
