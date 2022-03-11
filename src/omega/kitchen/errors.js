import { fileURLToPath } from "node:url"
import { createDetailedMessage } from "@jsenv/logger"

import { stringifyUrlSite } from "@jsenv/core/src/utils/url_trace.js"

export const createResolveError = ({
  pluginController,
  specifierTrace,
  specifier,
  error,
}) => {
  const createFailedToResolveError = ({ code, reason, ...details }) => {
    const loadError = new Error(
      createDetailedMessage(`Failed to resolve specifier`, {
        reason,
        ...details,
        specifier: `"${specifier}"`,
        ...detailsFromUrlTrace(specifierTrace),
        ...detailsFromPluginController(pluginController),
      }),
    )
    loadError.name = "RESOLVE_ERROR"
    loadError.code = code
    loadError.reason = reason
    loadError.cause = error
    return loadError
  }
  if (error.message === "NO_RESOLVE") {
    return createFailedToResolveError({
      reason: `no plugin has handled the specifier during "resolve" hook`,
    })
  }
  return createFailedToResolveError({
    reason: `An error occured during specifier resolution`,
    ...detailsFromValueThrown(error),
  })
}

export const createLoadError = ({ pluginController, urlTrace, url, error }) => {
  const createFailedToLoadError = ({ code, reason, ...details }) => {
    const loadError = new Error(
      createDetailedMessage(`Failed to load url`, {
        reason,
        ...details,
        url,
        ...detailsFromUrlTrace(urlTrace),
        ...detailsFromPluginController(pluginController),
      }),
    )
    loadError.name = "LOAD_ERROR"
    loadError.code = code
    loadError.reason = reason
    loadError.cause = error
    return loadError
  }

  if (error.message === "NO_LOAD") {
    return createFailedToLoadError({
      code: "NOT_FOUND",
      reason: `no plugin has handled the url during "load" hook`,
    })
  }
  if (error.path === fileURLToPath(url)) {
    if (error.code === "EPERM") {
      return createFailedToLoadError({
        code: "NOT_ALLOWED",
        reason: `not allowed to read entry on filesystem`,
      })
    }
    if (error.code === "EISDIR") {
      return createFailedToLoadError({
        code: "NOT_ALLOWED",
        reason: `found a directory on filesystem`,
      })
    }
    if (error.code === "ENOENT") {
      return createFailedToLoadError({
        code: "NOT_FOUND",
        reason: "no entry on filesystem",
      })
    }
  }
  return createFailedToLoadError({
    reason: `An error occured during "load"`,
    ...detailsFromValueThrown(error),
  })
}

export const createTransformError = ({
  pluginController,
  urlTrace,
  url,
  type,
  error,
}) => {
  const createFailedToTransformError = ({ code, reason, ...details }) => {
    const loadError = new Error(
      createDetailedMessage(`Failed to transform ${type}`, {
        reason,
        ...details,
        url,
        ...detailsFromUrlTrace(urlTrace),
        ...detailsFromPluginController(pluginController),
      }),
    )
    loadError.name = "TRANSFORM_ERROR"
    loadError.code = code
    loadError.reason = reason
    loadError.cause = error
    return loadError
  }
  return createFailedToTransformError({
    reason: `An error occured during "transform"`,
    ...detailsFromValueThrown(error),
  })
}

const detailsFromUrlTrace = (urlTrace) => {
  if (!urlTrace) {
    return null
  }
  if (urlTrace.type === "url_site") {
    urlTrace = {
      type: "url_site_string",
      value: stringifyUrlSite(urlTrace.value),
    }
  }
  if (urlTrace.type === "url_site_string") {
    if (urlTrace.value.includes(">")) {
      return { "referenced at": urlTrace.value }
    }
    return { "referenced in": urlTrace.value }
  }
  return { "referenced by": urlTrace.value }
}

const detailsFromPluginController = (pluginController) => {
  const currentPlugin = pluginController.getCurrentPlugin()
  if (!currentPlugin) {
    return null
  }
  return { "plugin name": `"${currentPlugin.name}"` }
}

const detailsFromValueThrown = (valueThrownByPlugin) => {
  if (valueThrownByPlugin && valueThrownByPlugin instanceof Error) {
    return {
      "error stack": valueThrownByPlugin.stack,
    }
  }
  if (valueThrownByPlugin === undefined) {
    return {
      error: "undefined",
    }
  }
  return {
    error: JSON.stringify(valueThrownByPlugin),
  }
}
