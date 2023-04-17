import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"

export const jsenvPluginReferenceExpectedTypes = () => {
  const redirectJsUrls = (reference) => {
    const urlObject = new URL(reference.url)
    const { searchParams } = urlObject

    if (searchParams.has("entry_point")) {
      reference.isEntryPoint = true
    }
    if (searchParams.has("js_classic")) {
      reference.expectedType = "js_classic"
    } else if (
      searchParams.has("js_module_fallback") ||
      searchParams.has("as_js_classic_library")
    ) {
      reference.expectedType = "js_classic"
    } else if (searchParams.has("as_js_module")) {
      reference.expectedType = "js_module"
    } else if (searchParams.has("js_module")) {
      reference.expectedType = "js_module"
    } else if (
      reference.type === "js_url" &&
      reference.expectedType === undefined &&
      CONTENT_TYPE.fromUrlExtension(reference.url) === "text/javascript"
    ) {
      // by default, js referenced by new URL is considered as "js_module"
      // in case this is not desired code must use "?js_classic" like
      // new URL('./file.js?js_classic', import.meta.url)
      reference.expectedType = "js_module"
    }

    if (searchParams.has("worker")) {
      reference.expectedSubtype = "worker"
    } else if (searchParams.has("service_worker")) {
      reference.expectedSubtype = "service_worker"
    } else if (searchParams.has("shared_worker")) {
      reference.expectedSubtype = "shared_worker"
    }
    return urlObject.href
  }

  return {
    name: "jsenv:reference_expected_types",
    appliesDuring: "*",
    redirectUrl: {
      script: redirectJsUrls,
      js_url: redirectJsUrls,
      js_import: redirectJsUrls,
    },
  }
}
