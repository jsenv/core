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

export const jsenvPluginJsModuleFallbackOnWorkers = ({ dormant }) => {
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

  const createWorkerPlugin = (subtype) => {
    return {
      name: `jsenv:js_module_fallback_on_${subtype}`,
      appliesDuring: "*",
      init: (context) => {
        if (!context.isSupportedOnCurrentClients(`${subtype}_type_module`)) {
          return true;
        }
        return false;
      },
      redirectReference: {
        js_url: dormant
          ? null
          : (reference) => {
              if (reference.expectedType !== "js_module") {
                return null;
              }
              if (reference.expectedSubtype !== subtype) {
                return null;
              }
              return turnIntoJsClassicProxy(reference);
            },
      },
    };
  };

  return [
    createWorkerPlugin("worker"),
    createWorkerPlugin("service_worker"),
    createWorkerPlugin("shared_worker"),
  ];
};
