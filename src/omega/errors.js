import { createDetailedMessage } from "@jsenv/log"
import { stringifyUrlSite } from "@jsenv/urls"

export const createResolveUrlError = ({
  pluginController,
  reference,
  error,
}) => {
  const createFailedToResolveUrlError = ({
    code = error.code || "RESOLVE_URL_ERROR",
    reason,
    ...details
  }) => {
    const resolveError = new Error(
      createDetailedMessage(`Failed to resolve url reference`, {
        reason,
        ...details,
        "specifier": `"${reference.specifier}"`,
        "specifier trace": reference.trace.message,
        ...detailsFromPluginController(pluginController),
      }),
    )
    resolveError.name = "RESOLVE_URL_ERROR"
    resolveError.code = code
    resolveError.reason = reason
    return resolveError
  }
  if (error.message === "NO_RESOLVE") {
    return createFailedToResolveUrlError({
      reason: `no plugin has handled the specifier during "resolveUrl" hook`,
    })
  }
  return createFailedToResolveUrlError({
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
    const fetchError = new Error(
      createDetailedMessage(`Failed to fetch url content`, {
        reason,
        ...details,
        "url": urlInfo.url,
        "url reference trace": reference.trace.message,
        ...detailsFromPluginController(pluginController),
      }),
    )
    fetchError.name = "FETCH_URL_CONTENT_ERROR"
    fetchError.code = code
    fetchError.reason = reason
    fetchError.url = reference.trace.url
    fetchError.line = reference.trace.line
    fetchError.column = reference.trace.column
    fetchError.contentFrame = reference.trace.message
    return fetchError
  }

  if (error.code === "EPERM") {
    return createFailedToFetchUrlContentError({
      code: "NOT_ALLOWED",
      reason: `not allowed to read entry on filesystem`,
    })
  }
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    return createFailedToFetchUrlContentError({
      code: "DIRECTORY_REFERENCE_NOT_ALLOWED",
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

export const createTransformUrlContentError = ({
  pluginController,
  reference,
  urlInfo,
  error,
}) => {
  const createFailedToTransformError = ({
    code = error.code || "TRANSFORM_URL_CONTENT_ERROR",
    reason,
    ...details
  }) => {
    const transformError = new Error(
      createDetailedMessage(
        `Failed to transform url content of "${urlInfo.type}"`,
        {
          reason,
          ...details,
          "url": urlInfo.url,
          "url reference trace": reference.trace.message,
          ...detailsFromPluginController(pluginController),
        },
      ),
    )
    transformError.name = "TRANSFORM_URL_CONTENT_ERROR"
    transformError.code = code
    transformError.reason = reason
    transformError.url = reference.trace.url
    transformError.line = reference.trace.line
    transformError.column = reference.trace.column
    transformError.contentFrame = reference.trace.message
    if (code === "PARSE_ERROR") {
      transformError.reason = error.message
      if (urlInfo.isInline) {
        transformError.line = reference.trace.line + error.line - 1
        transformError.column = reference.trace.column + error.column
        transformError.contentFrame = stringifyUrlSite({
          url: urlInfo.inlineUrlSite.url,
          line: transformError.line,
          column: transformError.column,
          content: urlInfo.inlineUrlSite.content,
        })
      } else {
        transformError.line = error.line
        transformError.column = error.column
        transformError.contentFrame = stringifyUrlSite({
          url: urlInfo.url,
          line: transformError.line,
          column: transformError.column,
          content: urlInfo.content,
        })
      }
    }
    return transformError
  }
  return createFailedToTransformError({
    reason: `An error occured during "transformUrlContent"`,
    ...detailsFromValueThrown(error),
  })
}

export const createFinalizeUrlContentError = ({
  pluginController,
  reference,
  urlInfo,
  error,
}) => {
  const finalizeError = new Error(
    createDetailedMessage(`Failed to finalize ${urlInfo.type} url content`, {
      "reason": `An error occured during "finalizeUrlContent"`,
      ...detailsFromValueThrown(error),
      "url": urlInfo.url,
      "url reference trace": reference.trace.message,
      ...detailsFromPluginController(pluginController),
    }),
  )
  finalizeError.name = "FINALIZE_URL_CONTENT_ERROR"
  finalizeError.reason = `An error occured during "finalizeUrlContent"`
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
