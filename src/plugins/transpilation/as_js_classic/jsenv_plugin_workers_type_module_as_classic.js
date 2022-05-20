import { injectQueryParamsIntoSpecifier } from "@jsenv/utils/urls/url_utils.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { parseJsUrls } from "@jsenv/core/packages/utils/js_ast/parse_js_urls.js"

export const jsenvPluginWorkersTypeModuleAsClassic = ({
  generateJsClassicFilename,
}) => {
  const transformJsWorkerTypes = async (urlInfo, context) => {
    const workersToTranspile = getWorkersToTranspile(urlInfo, context)
    if (
      !workersToTranspile.worker &&
      !workersToTranspile.serviceWorker &&
      !workersToTranspile.sharedServiceWorker
    ) {
      return null
    }
    const jsUrls = parseJsUrls({
      js: urlInfo.content,
      url: (urlInfo.data && urlInfo.data.rawUrl) || urlInfo.url,
      isJsModule: urlInfo.type === "js_module",
    })
    const magicSource = createMagicSource(urlInfo.content)
    jsUrls.forEach((jsUrl) => {
      if (
        jsUrl.type !== "new_worker_first_arg" &&
        jsUrl.type !== "new_shared_worker_first_arg" &&
        jsUrl.type !== "service_worker_register_first_arg"
      ) {
        return
      }
      if (jsUrl.expectedType !== "js_module") {
        return
      }
      const reference = context.referenceUtils.findByGeneratedSpecifier(
        JSON.stringify(jsUrl.specifier),
      )
      const [newReference] = context.referenceUtils.update(reference, {
        expectedType: "js_classic",
        specifier: injectQueryParamsIntoSpecifier(reference.specifier, {
          as_js_classic: "",
        }),
        filename: generateJsClassicFilename(reference.url),
      })
      magicSource.replace({
        start: jsUrl.start,
        end: jsUrl.end,
        replacement: newReference.generatedSpecifier,
      })
      magicSource.replace({
        start: jsUrl.typeArgNode.value.start,
        end: jsUrl.typeArgNode.value.end,
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

const getWorkersToTranspile = (urlInfo, context) => {
  let worker = false
  let serviceWorker = false
  let sharedWorker = false
  for (const reference of urlInfo.references) {
    if (reference.expectedType !== "js_module") {
      continue
    }
    if (
      reference.expectedSubtype === "worker" &&
      !context.isSupportedOnCurrentClients("worker_type_module")
    ) {
      worker = true
    }
    if (
      reference.expectedSubtype === "service_worker" &&
      !context.isSupportedOnCurrentClients("service_worker_type_module")
    ) {
      serviceWorker = true
    }
    if (
      reference.expectedSubtype === "shared_worker" &&
      !context.isSupportedOnCurrentClients("shared_worker_type_module")
    ) {
      sharedWorker = true
    }
  }
  return { worker, serviceWorker, sharedWorker }
}
