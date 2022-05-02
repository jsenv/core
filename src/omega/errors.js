import { createDetailedMessage } from "@jsenv/logger"

export const createResolveError = ({ pluginController, reference, error }) => {
  const createFailedToResolveError = ({
    code = error.code || "RESOLVE_ERROR",
    reason,
    ...details
  }) => {
    const resolveError = new Error(
      createDetailedMessage(`Failed to resolve specifier`, {
        reason,
        ...details,
        "specifier": `"${reference.specifier}"`,
        "specifier trace": reference.trace,
        ...detailsFromPluginController(pluginController),
      }),
    )
    resolveError.name = "RESOLVE_ERROR"
    resolveError.code = code
    resolveError.reason = reason
    return resolveError
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

export const createFetchUrlContentError = ({
  pluginController,
  reference,
  urlInfo,
  error,
}) => {
  const createFailedToFetchUrlContentError = ({
    code = error.code || "FETCH_URL_CONTENT_ERROR",
    reason,
    ...details
  }) => {
    const fetchContentError = new Error(
      createDetailedMessage(`Failed to fetch url content`, {
        reason,
        ...details,
        "url": urlInfo.url,
        "url reference trace": reference.trace,
        ...detailsFromPluginController(pluginController),
      }),
    )
    fetchContentError.name = "FETCH_URL_CONTENT_ERROR"
    fetchContentError.code = code
    fetchContentError.reason = reason
    return fetchContentError
  }

  if (error.code === "EPERM") {
    return createFailedToFetchUrlContentError({
      code: "NOT_ALLOWED",
      reason: `not allowed to read entry on filesystem`,
    })
  }
  if (error.code === "EISDIR") {
    return createFailedToFetchUrlContentError({
      code: "EISDIR",
      reason: `found a directory on filesystem`,
    })
  }
  if (error.code === "ENOENT") {
    return createFailedToFetchUrlContentError({
      code: "NOT_FOUND",
      reason: "no entry on filesystem",
    })
  }
  return createFailedToFetchUrlContentError({
    reason: `An error occured during "fetchUrlContent"`,
    ...detailsFromValueThrown(error),
  })
}

export const createTransformError = ({
  pluginController,
  reference,
  urlInfo,
  error,
}) => {
  const createFailedToTransformError = ({
    code = error.code || "TRANSFORM_ERROR",
    reason,
    ...details
  }) => {
    const transformError = new Error(
      createDetailedMessage(`Failed to transform ${urlInfo.type}`, {
        reason,
        ...details,
        "url": urlInfo.url,
        "url reference trace": reference.trace,
        ...detailsFromPluginController(pluginController),
      }),
    )
    transformError.name = "TRANSFORM_ERROR"
    transformError.code = code
    transformError.reason = reason
    return transformError
  }
  return createFailedToTransformError({
    reason: `An error occured during "transform"`,
    ...detailsFromValueThrown(error),
  })
}

export const createFinalizeError = ({
  pluginController,
  reference,
  urlInfo,
  error,
}) => {
  const finalizeError = new Error(
    createDetailedMessage(`Failed to finalize ${urlInfo.type}`, {
      "reason": `An error occured during "finalize"`,
      ...detailsFromValueThrown(error),
      "url": urlInfo.url,
      "url reference trace": reference.trace,
      ...detailsFromPluginController(pluginController),
    }),
  )
  finalizeError.name = "FINALIZE_ERROR"
  finalizeError.reason = `An error occured during "finalize"`
  return finalizeError
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
