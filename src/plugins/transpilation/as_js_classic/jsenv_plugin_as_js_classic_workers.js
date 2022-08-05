/*
 * when {type: "module"} cannot be used on web workers:
 * - new Worker("worker.js", { type: "module" })
 *   transformed into
 *   new Worker("worker.js?as_js_classic", { type: " lassic" })
 * - navigator.serviceWorker.register("service_worker.js", { type: "module" })
 *   transformed into
 *   navigator.serviceWorker.register("service_worker.js?as_js_classic", { type: "classic" })
 * - new SharedWorker("shared_worker.js", { type: "module" })
 *   transformed into
 *   new SharedWorker("shared_worker.js?as_js_classic", { type: "classic" })
 */

import { injectQueryParams } from "@jsenv/urls"

export const jsenvPluginAsJsClassicWorkers = ({
  generateJsClassicFilename,
}) => {
  const updateReference = (reference) => {
    reference.filename = generateJsClassicFilename(reference.url)
    reference.mutation = (magicSource) => {
      magicSource.replace({
        start: reference.typePropertyNode.value.start,
        end: reference.typePropertyNode.value.end,
        replacement: JSON.stringify("classic"),
      })
    }
    reference.expectedType = "js_classic"
    return injectQueryParams(reference.url, {
      as_js_classic: "",
    })
  }

  return {
    name: "jsenv:as_js_classic_workers",
    appliesDuring: "*",
    redirectUrl: {
      js_url_specifier: (reference, context) => {
        if (reference.expectedType !== "js_module") {
          return null
        }
        if (reference.expectedSubtype === "worker") {
          if (context.isSupportedOnCurrentClients("worker_type_module")) {
            return null
          }
          return updateReference(reference)
        }
        if (reference.expectedSubtype === "service_worker") {
          if (
            context.isSupportedOnCurrentClients("service_worker_type_module")
          ) {
            return null
          }
          return updateReference(reference)
        }
        if (reference.expectedSubtype === "shared_worker") {
          if (
            context.isSupportedOnCurrentClients("shared_worker_type_module")
          ) {
            return null
          }
          return updateReference(reference)
        }
        return null
      },
    },
  }
}
