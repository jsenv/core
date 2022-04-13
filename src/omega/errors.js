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

export const createLoadError = ({
  pluginController,
  reference,
  urlInfo,
  error,
}) => {
  const createFailedToLoadError = ({
    code = error.code || "LOAD_ERROR",
    reason,
    ...details
  }) => {
    const loadError = new Error(
      createDetailedMessage(`Failed to load url`, {
        reason,
        ...details,
        "url": urlInfo.url,
        "url reference trace": reference.trace,
        ...detailsFromPluginController(pluginController),
      }),
    )
    loadError.name = "LOAD_ERROR"
    loadError.code = code
    loadError.reason = reason
    return loadError
  }

  if (error.code === "EPERM") {
    return createFailedToLoadError({
      code: "NOT_ALLOWED",
      reason: `not allowed to read entry on filesystem`,
    })
  }
  if (error.code === "EISDIR") {
    return createFailedToLoadError({
      code: "EISDIR",
      reason: `found a directory on filesystem`,
    })
  }
  if (error.code === "ENOENT") {
    return createFailedToLoadError({
      code: "NOT_FOUND",
      reason: "no entry on filesystem",
    })
  }
  return createFailedToLoadError({
    reason: `An error occured during "load"`,
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
