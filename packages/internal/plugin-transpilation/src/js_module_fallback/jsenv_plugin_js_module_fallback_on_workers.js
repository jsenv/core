/*
 * when {type: "module"} cannot be used on web workers:
 * - new Worker("worker.js", { type: "module" })
 *   transformed into
 *   new Worker("worker.js?js_module_fallback", { type: " lassic" })
 * - navigator.serviceWorker.register("service_worker.js", { type: "module" })
 *   transformed into
 *   navigator.serviceWorker.register("service_worker.js?js_module_fallback", { type: "classic" })
 * - new SharedWorker("shared_worker.js", { type: "module" })
 *   transformed into
 *   new SharedWorker("shared_worker.js?js_module_fallback", { type: "classic" })
 */

import { injectQueryParams } from "@jsenv/urls";

export const jsenvPluginJsModuleFallbackOnWorkers = () => {
  const turnIntoJsClassicProxy = (reference) => {
    reference.mutation = (magicSource) => {
      const { typePropertyNode } = reference.astInfo;
      magicSource.replace({
        start: typePropertyNode.value.start,
        end: typePropertyNode.value.end,
        replacement: JSON.stringify("classic"),
      });
    };
    return injectQueryParams(reference.url, { js_module_fallback: "" });
  };

  return {
    name: "jsenv:js_module_fallback_on_workers",
    appliesDuring: "*",
    redirectReference: {
      js_url: (reference) => {
        if (reference.expectedType !== "js_module") {
          return null;
        }
        if (reference.expectedSubtype === "worker") {
          if (
            reference.ownerUrlInfo.context.isSupportedOnCurrentClients(
              "worker_type_module",
            )
          ) {
            return null;
          }
          return turnIntoJsClassicProxy(reference);
        }
        if (reference.expectedSubtype === "service_worker") {
          if (
            reference.ownerUrlInfo.context.isSupportedOnCurrentClients(
              "service_worker_type_module",
            )
          ) {
            return null;
          }
          return turnIntoJsClassicProxy(reference);
        }
        if (reference.expectedSubtype === "shared_worker") {
          if (
            reference.ownerUrlInfo.context.isSupportedOnCurrentClients(
              "shared_worker_type_module",
            )
          ) {
            return null;
          }
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
    },
  };
};
