import { createDetailedMessage, generateContentFrame } from "@jsenv/humanize";
import { stringifyUrlSite } from "@jsenv/urls";
import { pathToFileURL } from "node:url";

export const createResolveUrlError = ({
  pluginController,
  reference,
  error,
}) => {
  const createFailedToResolveUrlError = ({
    name = "RESOLVE_URL_ERROR",
    code = error.code || "RESOLVE_URL_ERROR",
    reason,
    ...details
  }) => {
    const resolveError = new Error(
      createDetailedMessage(
        `Failed to resolve url reference
${reference.trace.message}
${reason}`,
        {
          ...detailsFromFirstReference(reference),
          ...details,
          ...detailsFromPluginController(pluginController),
        },
      ),
    );
    defineNonEnumerableProperties(resolveError, {
      isJsenvCookingError: true,
      name,
      code,
      reason,
      asResponse: error.asResponse,
      trace: error.trace || reference.trace,
    });
    return resolveError;
  };
  if (error.message === "NO_RESOLVE") {
    return createFailedToResolveUrlError({
      reason: `no plugin has handled the specifier during "resolveUrl" hook`,
    });
  }
  if (error.code === "MODULE_NOT_FOUND") {
    const bareSpecifierError = createFailedToResolveUrlError({
      reason: `"${reference.specifier}" is a bare specifier but cannot be remapped to a package`,
    });
    return bareSpecifierError;
  }
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    error.message = createDetailedMessage(error.message, {
      "reference trace": reference.trace.message,
      ...detailsFromFirstReference(reference),
    });
    return error;
  }
  if (error.code === "PROTOCOL_NOT_SUPPORTED") {
    const notSupportedError = createFailedToResolveUrlError({
      reason: error.message,
    });
    return notSupportedError;
  }
  return createFailedToResolveUrlError({
    reason: `An error occured during specifier resolution`,
    ...detailsFromValueThrown(error),
  });
};

export const createFetchUrlContentError = ({
  pluginController,
  urlInfo,
  error,
}) => {
  const createFailedToFetchUrlContentError = ({
    code = error.code || "FETCH_URL_CONTENT_ERROR",
    reason,
    parseErrorSourceType,
    ...details
  }) => {
    const reference = urlInfo.firstReference;
    const fetchError = new Error(
      createDetailedMessage(
        `Failed to fetch url content
${reference.trace.message}
${reason}`,
        {
          ...detailsFromFirstReference(reference),
          ...details,
          ...detailsFromPluginController(pluginController),
        },
      ),
    );
    defineNonEnumerableProperties(fetchError, {
      isJsenvCookingError: true,
      name: "FETCH_URL_CONTENT_ERROR",
      code,
      reason,
      parseErrorSourceType,
      url: urlInfo.url,
      trace: code === "PARSE_ERROR" ? error.trace : reference.trace,
      asResponse: error.asResponse,
    });
    return fetchError;
  };
  if (error.code === "EPERM") {
    return createFailedToFetchUrlContentError({
      code: "NOT_ALLOWED",
      reason: `not allowed to read entry on filesystem`,
    });
  }
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    return createFailedToFetchUrlContentError({
      code: "DIRECTORY_REFERENCE_NOT_ALLOWED",
      reason: `found a directory on filesystem`,
    });
  }
  if (error.code === "ENOENT") {
    const urlTried = pathToFileURL(error.path).href;
    // ensure ENOENT is caused by trying to read the urlInfo.url
    // any ENOENT trying to read an other file should display the error.stack
    // because it means some side logic has failed
    if (urlInfo.url.startsWith(urlTried)) {
      return createFailedToFetchUrlContentError({
        code: "NOT_FOUND",
        reason: "no entry on filesystem",
      });
    }
  }
  if (error.code === "PARSE_ERROR") {
    return createFailedToFetchUrlContentError({
      "code": "PARSE_ERROR",
      "reason": error.reasonCode,
      "parseErrorSourceType": error.parseErrorSourceType,
      ...(error.cause ? { "parse error message": error.cause.message } : {}),
      "parse error trace": error.trace?.message,
    });
  }
  return createFailedToFetchUrlContentError({
    reason: `An error occured during "fetchUrlContent"`,
    ...detailsFromValueThrown(error),
  });
};

export const createTransformUrlContentError = ({
  pluginController,
  urlInfo,
  error,
}) => {
  if (error.code === "MODULE_NOT_FOUND") {
    return error;
  }
  if (error.code === "PROTOCOL_NOT_SUPPORTED") {
    return error;
  }
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    return error;
  }
  if (error.code === "PARSE_ERROR") {
    if (error.isJsenvCookingError) {
      return error;
    }
    const trace = getErrorTrace(error, urlInfo.firstReference);
    const reference = urlInfo.firstReference;
    const transformError = new Error(
      createDetailedMessage(
        `parse error on "${urlInfo.type}"
${trace.message}
${error.message}`,
        {
          "first reference": reference.trace.url
            ? `${reference.trace.url}:${reference.trace.line}:${reference.trace.column}`
            : reference.trace.message,
          ...detailsFromFirstReference(reference),
          ...detailsFromPluginController(pluginController),
        },
      ),
    );
    defineNonEnumerableProperties(transformError, {
      isJsenvCookingError: true,
      name: "TRANSFORM_URL_CONTENT_ERROR",
      code: "PARSE_ERROR",
      reason: error.message,
      reasonCode: error.reasonCode,
      parseErrorSourceType: error.parseErrorSourceType,
      stack: transformError.stack,
      trace,
      asResponse: error.asResponse,
    });
    return transformError;
  }
  const createFailedToTransformError = ({
    code = error.code || "TRANSFORM_URL_CONTENT_ERROR",
    reason,
    ...details
  }) => {
    const reference = urlInfo.firstReference;
    let trace = reference.trace;
    const transformError = new Error(
      createDetailedMessage(
        `"transformUrlContent" error on "${urlInfo.type}"
${trace.message}
${reason}`,
        {
          ...detailsFromFirstReference(reference),
          ...details,
          ...detailsFromPluginController(pluginController),
        },
      ),
    );
    defineNonEnumerableProperties(transformError, {
      isJsenvCookingError: true,
      cause: error,
      name: "TRANSFORM_URL_CONTENT_ERROR",
      code,
      reason,
      stack: error.stack,
      url: urlInfo.url,
      trace,
      asResponse: error.asResponse,
    });
    return transformError;
  };
  return createFailedToTransformError({
    reason: `"transformUrlContent" error on "${urlInfo.type}"`,
    ...detailsFromValueThrown(error),
  });
};

export const createFinalizeUrlContentError = ({
  pluginController,
  urlInfo,
  error,
}) => {
  const reference = urlInfo.firstReference;
  const finalizeError = new Error(
    createDetailedMessage(
      `"finalizeUrlContent" error on "${urlInfo.type}"
${reference.trace.message}`,
      {
        ...detailsFromFirstReference(reference),
        ...detailsFromValueThrown(error),
        ...detailsFromPluginController(pluginController),
      },
    ),
  );
  defineNonEnumerableProperties(finalizeError, {
    isJsenvCookingError: true,
    ...(error && error instanceof Error ? { cause: error } : {}),
    name: "FINALIZE_URL_CONTENT_ERROR",
    reason: `"finalizeUrlContent" error on "${urlInfo.type}"`,
    asResponse: error.asResponse,
  });
  return finalizeError;
};

const getErrorTrace = (error, reference) => {
  const urlInfo = reference.urlInfo;
  let trace = reference.trace;
  let line = error.line;
  let column = error.column;
  if (urlInfo.isInline) {
    line = trace.line + line;
    line = line - 1;
    return {
      ...trace,
      line,
      column,
      codeFrame: generateContentFrame({
        line,
        column,
        content: urlInfo.inlineUrlSite.content,
      }),
      message: stringifyUrlSite({
        url: urlInfo.inlineUrlSite.url,
        line,
        column,
        content: urlInfo.inlineUrlSite.content,
      }),
    };
  }
  return {
    url: urlInfo.url,
    line,
    column: error.column,
    codeFrame: generateContentFrame({
      line,
      column: error.column,
      content: urlInfo.content,
    }),
    message: stringifyUrlSite({
      url: urlInfo.url,
      line,
      column: error.column,
      content: urlInfo.content,
    }),
  };
};

const detailsFromFirstReference = (reference) => {
  const referenceInProject = getFirstReferenceInProject(reference);
  if (
    referenceInProject === reference ||
    referenceInProject.type === "http_request"
  ) {
    return {};
  }
  if (referenceInProject.type === "entry_point") {
    return {
      "first reference": referenceInProject.trace.message,
    };
  }
  return {
    "first reference in project": `${referenceInProject.trace.url}:${referenceInProject.trace.line}:${referenceInProject.trace.column}`,
  };
};
const getFirstReferenceInProject = (reference) => {
  const ownerUrlInfo = reference.ownerUrlInfo;
  if (ownerUrlInfo.isRoot) {
    return reference;
  }
  if (
    !ownerUrlInfo.url.includes("/node_modules/") &&
    ownerUrlInfo.packageDirectoryUrl ===
      ownerUrlInfo.context.packageDirectory.url
  ) {
    return reference;
  }
  const { firstReference } = ownerUrlInfo;
  return getFirstReferenceInProject(firstReference);
};

const detailsFromPluginController = (pluginController) => {
  const currentPlugin = pluginController.getCurrentPlugin();
  if (!currentPlugin) {
    return null;
  }
  return { "plugin name": `"${currentPlugin.name}"` };
};

const detailsFromValueThrown = (valueThrownByPlugin) => {
  if (valueThrownByPlugin && valueThrownByPlugin instanceof Error) {
    // if (
    //   valueThrownByPlugin.message.includes("Maximum call stack size exceeded")
    // ) {
    //   return {
    //     "error message": valueThrownByPlugin.message,
    //     "error stack": valueThrownByPlugin.stack,
    //   };
    // }
    if (
      valueThrownByPlugin.code === "PARSE_ERROR" ||
      valueThrownByPlugin.code === "MODULE_NOT_FOUND" ||
      valueThrownByPlugin.name === "RESOLVE_URL_ERROR" ||
      valueThrownByPlugin.name === "FETCH_URL_CONTENT_ERROR" ||
      valueThrownByPlugin.name === "TRANSFORM_URL_CONTENT_ERROR" ||
      valueThrownByPlugin.name === "FINALIZE_URL_CONTENT_ERROR"
    ) {
      return {
        "error message": valueThrownByPlugin.message,
      };
    }
    return {
      "error stack": valueThrownByPlugin.stack,
    };
  }
  if (valueThrownByPlugin === undefined) {
    return {
      error: "undefined",
    };
  }
  return {
    error: JSON.stringify(valueThrownByPlugin),
  };
};

export const defineNonEnumerableProperties = (object, properties) => {
  for (const key of Object.keys(properties)) {
    Object.defineProperty(object, key, {
      configurable: true,
      writable: true,
      value: properties[key],
    });
  }
};
