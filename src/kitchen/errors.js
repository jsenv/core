import { pathToFileURL } from "node:url";
import { createDetailedMessage, generateContentFrame } from "@jsenv/humanize";
import { stringifyUrlSite } from "@jsenv/urls";

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
    resolveError.name = "RESOLVE_URL_ERROR";
    resolveError.code = code;
    resolveError.reason = reason;
    resolveError.asResponse = error.asResponse;
    return resolveError;
  };
  if (error.message === "NO_RESOLVE") {
    return createFailedToResolveUrlError({
      reason: `no plugin has handled the specifier during "resolveUrl" hook`,
    });
  }
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    error.message = createDetailedMessage(error.message, {
      "reference trace": reference.trace.message,
    });
    return error;
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
    fetchError.name = "FETCH_URL_CONTENT_ERROR";
    fetchError.code = code;
    fetchError.reason = reason;
    fetchError.url = urlInfo.url;
    if (code === "PARSE_ERROR") {
      fetchError.trace = error.trace;
    } else {
      fetchError.trace = urlInfo.firstReference.trace;
    }
    fetchError.asResponse = error.asResponse;
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
  if (error.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
    return error;
  }
  if (error.code === "PARSE_ERROR") {
    const reference = urlInfo.firstReference;
    let trace = reference.trace;
    let line = error.line;
    let column = error.column;
    if (urlInfo.type === "js_module") {
      line = line - 1;
    }
    if (urlInfo.isInline) {
      line = trace.line + line;
      trace = {
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
    } else {
      trace = {
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
    }
    const transformError = new Error(
      createDetailedMessage(
        `parse error on "${urlInfo.type}"
${trace.message}
${error.message}`,
        {
          "first reference": `${reference.trace.url}:${reference.trace.line}:${reference.trace.column}`,
          ...detailsFromFirstReference(reference),
          ...detailsFromPluginController(pluginController),
        },
      ),
    );
    transformError.cause = error;
    transformError.name = "TRANSFORM_URL_CONTENT_ERROR";
    transformError.code = "PARSE_ERROR";
    transformError.stack = error.stack;
    transformError.reason = error.message;
    transformError.trace = trace;
    transformError.asResponse = error.asResponse;
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
    transformError.cause = error;
    transformError.name = "TRANSFORM_URL_CONTENT_ERROR";
    transformError.code = code;
    transformError.reason = reason;
    transformError.stack = error.stack;
    transformError.url = urlInfo.url;
    transformError.trace = trace;
    transformError.asResponse = error.asResponse;
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
  if (error && error instanceof Error) {
    finalizeError.cause = error;
  }
  finalizeError.name = "FINALIZE_URL_CONTENT_ERROR";
  finalizeError.reason = `"finalizeUrlContent" error on "${urlInfo.type}"`;
  finalizeError.asResponse = error.asResponse;
  return finalizeError;
};

const detailsFromFirstReference = (reference) => {
  const referenceInProject = getFirstReferenceInProject(reference);
  if (referenceInProject === reference) {
    return {};
  }
  return {
    "first reference in project": `${referenceInProject.trace.url}:${referenceInProject.trace.line}:${referenceInProject.trace.column}`,
  };
};
const getFirstReferenceInProject = (reference) => {
  const ownerUrlInfo = reference.ownerUrlInfo;
  if (!ownerUrlInfo.url.includes("/node_modules/")) {
    return reference;
  }
  return getFirstReferenceInProject(ownerUrlInfo.firstReference);
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
