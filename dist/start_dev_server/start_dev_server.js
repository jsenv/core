import { WebSocketResponse, pickContentType, ServerEvents, jsenvServiceCORS, jsenvAccessControlAllowedHeaders, composeTwoResponses, serveDirectory, jsenvServiceErrorHandler, startServer } from "@jsenv/server";
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js";
import { lookupPackageDirectory, registerDirectoryLifecycle, urlToRelativeUrl, moveUrl, urlIsOrIsInsideOf, ensureWindowsDriveLetter, createDetailedMessage, stringifyUrlSite, generateContentFrame, validateResponseIntegrity, setUrlFilename, getCallerPosition, urlToBasename, urlToExtension, asSpecifierWithoutSearch, asUrlWithoutSearch, injectQueryParamsIntoSpecifier, bufferToEtag, isFileSystemPath, urlToPathname, setUrlBasename, urlToFileSystemPath, writeFileSync, createLogger, URL_META, applyNodeEsmResolution, normalizeUrl, ANSI, RUNTIME_COMPAT, CONTENT_TYPE, readPackageAtOrNull, errorToHTML, DATA_URL, normalizeImportMap, composeTwoImportMaps, resolveImport, JS_QUOTES, readCustomConditionsFromProcessArgs, readEntryStatSync, ensurePathnameTrailingSlash, compareFileUrls, urlToFilename, applyFileSystemMagicResolution, getExtensionsToTry, setUrlExtension, isSpecifierForNodeBuiltin, injectQueryParams, memoizeByFirstArgument, assertAndNormalizeDirectoryUrl, createTaskLog, formatError } from "./jsenv_core_packages.js";
import { readFileSync, existsSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generateSourcemapFileUrl, createMagicSource, composeTwoSourcemaps, generateSourcemapDataUrl, SOURCEMAP } from "@jsenv/sourcemap";
import { parseHtml, injectHtmlNodeAsEarlyAsPossible, createHtmlNode, stringifyHtmlAst, applyBabelPlugins, generateUrlForInlineContent, injectJsenvScript, parseJsWithAcorn, parseCssUrls, getHtmlNodeAttribute, getHtmlNodePosition, getHtmlNodeAttributePosition, setHtmlNodeAttributes, parseSrcSet, getUrlForContentInsideHtml, removeHtmlNodeText, setHtmlNodeText, getHtmlNodeText, analyzeScriptNode, visitHtmlNodes, parseJsUrls, getUrlForContentInsideJs, analyzeLinkNode } from "@jsenv/ast";
import { performance } from "node:perf_hooks";
import { jsenvPluginSupervisor } from "@jsenv/plugin-supervisor";
import { jsenvPluginTranspilation } from "@jsenv/plugin-transpilation";
import { randomUUID } from "node:crypto";
import { bundleJsModules } from "@jsenv/plugin-bundling";
import { createRequire } from "node:module";
import "./jsenv_core_node_modules.js";
import "node:process";
import "node:os";
import "node:tty";
import "node:util";
import "node:path";

// default runtimeCompat corresponds to
// "we can keep <script type="module"> intact":
// so script_type_module + dynamic_import + import_meta
const defaultRuntimeCompat = {
  // android: "8",
  chrome: "64",
  edge: "79",
  firefox: "67",
  ios: "12",
  opera: "51",
  safari: "11.3",
  samsung: "9.2",
};

const createEventEmitter = () => {
  const callbackSet = new Set();
  const on = (callback) => {
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };
  const off = (callback) => {
    callbackSet.delete(callback);
  };
  const emit = (...args) => {
    for (const callback of callbackSet) {
      callback(...args);
    }
  };
  return { on, off, emit };
};

const getDirectoryWatchPatterns = (
  directoryUrl,
  watchedDirectoryUrl,
  { sourceFilesConfig },
) => {
  const directoryUrlRelativeToWatchedDirectory = urlToRelativeUrl(
    directoryUrl,
    watchedDirectoryUrl,
  );
  const watchPatterns = {
    [`${directoryUrlRelativeToWatchedDirectory}**/*`]: true, // by default watch everything inside the source directory
    [`${directoryUrlRelativeToWatchedDirectory}**/.*`]: false, // file starting with a dot -> do not watch
    [`${directoryUrlRelativeToWatchedDirectory}**/.*/`]: false, // directory starting with a dot -> do not watch
    [`${directoryUrlRelativeToWatchedDirectory}**/node_modules/`]: false, // node_modules directory -> do not watch
  };
  for (const key of Object.keys(sourceFilesConfig)) {
    watchPatterns[`${directoryUrlRelativeToWatchedDirectory}${key}`] =
      sourceFilesConfig[key];
  }
  return watchPatterns;
};

const watchSourceFiles = (
  sourceDirectoryUrl,
  callback,
  { sourceFilesConfig = {}, keepProcessAlive, cooldownBetweenFileEvents },
) => {
  // Project should use a dedicated directory (usually "src/")
  // passed to the dev server via "sourceDirectoryUrl" param
  // In that case all files inside the source directory should be watched
  // But some project might want to use their root directory as source directory
  // In that case source directory might contain files matching "node_modules/*" or ".git/*"
  // And jsenv should not consider these as source files and watch them (to not hurt performances)
  const watchPatterns = {};
  let watchedDirectoryUrl = "";
  const addDirectoryToWatch = (directoryUrl) => {
    Object.assign(
      watchPatterns,
      getDirectoryWatchPatterns(directoryUrl, watchedDirectoryUrl, {
        sourceFilesConfig,
      }),
    );
  };
  const watch = () => {
    const stopWatchingSourceFiles = registerDirectoryLifecycle(
      watchedDirectoryUrl,
      {
        watchPatterns,
        cooldownBetweenFileEvents,
        keepProcessAlive,
        recursive: true,
        added: ({ relativeUrl }) => {
          callback({
            url: new URL(relativeUrl, watchedDirectoryUrl).href,
            event: "added",
          });
        },
        updated: ({ relativeUrl }) => {
          callback({
            url: new URL(relativeUrl, watchedDirectoryUrl).href,
            event: "modified",
          });
        },
        removed: ({ relativeUrl }) => {
          callback({
            url: new URL(relativeUrl, watchedDirectoryUrl).href,
            event: "removed",
          });
        },
      },
    );
    stopWatchingSourceFiles.watchPatterns = watchPatterns;
    return stopWatchingSourceFiles;
  };

  npm_workspaces: {
    const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
    let packageContent;
    try {
      packageContent = JSON.parse(
        readFileSync(new URL("package.json", packageDirectoryUrl), "utf8"),
      );
    } catch {
      break npm_workspaces;
    }
    const { workspaces } = packageContent;
    if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) {
      break npm_workspaces;
    }
    watchedDirectoryUrl = packageDirectoryUrl;
    for (const workspace of workspaces) {
      if (workspace.endsWith("*")) {
        const workspaceDirectoryUrl = new URL(
          workspace.slice(0, -1),
          packageDirectoryUrl,
        );
        addDirectoryToWatch(workspaceDirectoryUrl);
      } else {
        const workspaceRelativeUrl = new URL(workspace, packageDirectoryUrl);
        addDirectoryToWatch(workspaceRelativeUrl);
      }
    }
    // we are updating the root directory
    // we must make the patterns relative to source directory relative to the new root directory
    addDirectoryToWatch(sourceDirectoryUrl);
    return watch();
  }

  watchedDirectoryUrl = sourceDirectoryUrl;
  addDirectoryToWatch(sourceDirectoryUrl);
  return watch();
};

const WEB_URL_CONVERTER = {
  asWebUrl: (fileUrl, webServer) => {
    if (urlIsOrIsInsideOf(fileUrl, webServer.rootDirectoryUrl)) {
      return moveUrl({
        url: fileUrl,
        from: webServer.rootDirectoryUrl,
        to: `${webServer.origin}/`,
      });
    }
    const fsRootUrl = ensureWindowsDriveLetter("file:///", fileUrl);
    return `${webServer.origin}/@fs/${fileUrl.slice(fsRootUrl.length)}`;
  },
  asFileUrl: (webUrl, webServer) => {
    const { pathname, search } = new URL(webUrl);
    if (pathname.startsWith("/@fs/")) {
      const fsRootRelativeUrl = pathname.slice("/@fs/".length);
      return `file:///${fsRootRelativeUrl}${search}`;
    }
    return moveUrl({
      url: webUrl,
      from: `${webServer.origin}/`,
      to: webServer.rootDirectoryUrl,
    });
  },
};

const jsenvCoreDirectoryUrl = new URL("../", import.meta.url);

const createResolveUrlError = ({
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

const createFetchUrlContentError = ({
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

const createTransformUrlContentError = ({
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

const createFinalizeUrlContentError = ({
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

const defineNonEnumerableProperties = (object, properties) => {
  for (const key of Object.keys(properties)) {
    Object.defineProperty(object, key, {
      configurable: true,
      writable: true,
      value: properties[key],
    });
  }
};

const assertFetchedContentCompliance = ({ urlInfo, content }) => {
  if (urlInfo.status === 404) {
    return;
  }
  const { expectedContentType } = urlInfo.firstReference;
  if (expectedContentType && urlInfo.contentType !== expectedContentType) {
    throw new Error(
      `content-type must be "${expectedContentType}", got "${urlInfo.contentType} on ${urlInfo.url}`,
    );
  }
  const { expectedType } = urlInfo.firstReference;
  if (expectedType && urlInfo.type !== expectedType) {
    if (urlInfo.type === "entry_build" && urlInfo.context.build) ; else {
      throw new Error(
        `type must be "${expectedType}", got "${urlInfo.type}" on ${urlInfo.url}`,
      );
    }
  }
  const { integrity } = urlInfo.firstReference;
  if (integrity) {
    validateResponseIntegrity({
      url: urlInfo.url,
      type: "basic",
      dataRepresentation: content,
    });
  }
};

const FILE_AND_SERVER_URLS_CONVERTER = {
  asServerUrl: (fileUrl, serverRootDirectoryUrl) => {
    if (urlIsOrIsInsideOf(fileUrl, serverRootDirectoryUrl)) {
      const urlRelativeToServer = urlToRelativeUrl(
        fileUrl,
        serverRootDirectoryUrl,
      );
      return `/${urlRelativeToServer}`;
    }
    const urlRelativeToFilesystemRoot = String(fileUrl).slice(
      "file:///".length,
    );
    return `/@fs/${urlRelativeToFilesystemRoot}`;
  },
  asFileUrl: (urlRelativeToServer, serverRootDirectoryUrl) => {
    if (urlRelativeToServer.startsWith("/@fs/")) {
      const urlRelativeToFilesystemRoot = urlRelativeToServer.slice(
        "/@fs/".length,
      );
      return `file:///${urlRelativeToFilesystemRoot}`;
    }
    if (urlRelativeToServer[0] === "/") {
      return new URL(urlRelativeToServer.slice(1), serverRootDirectoryUrl).href;
    }
    return new URL(urlRelativeToServer, serverRootDirectoryUrl).href;
  },
};

const determineFileUrlForOutDirectory = (urlInfo) => {
  let { url, filenameHint } = urlInfo;
  const { rootDirectoryUrl, outDirectoryUrl } = urlInfo.context;
  if (!outDirectoryUrl) {
    return url;
  }
  if (!url.startsWith("file:")) {
    return url;
  }
  if (!urlIsOrIsInsideOf(url, rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", url);
    url = `${rootDirectoryUrl}@fs/${url.slice(fsRootUrl.length)}`;
  }
  if (filenameHint) {
    url = setUrlFilename(url, filenameHint);
  }
  const outUrl = moveUrl({
    url,
    from: rootDirectoryUrl,
    to: outDirectoryUrl,
  });
  return outUrl;
};

const determineSourcemapFileUrl = (urlInfo) => {
  // sourcemap is a special kind of reference:
  // It's a reference to a content generated dynamically the content itself.
  // when jsenv is done cooking the file
  //   during build it's urlInfo.url to be inside the build
  //   but otherwise it's generatedUrl to be inside .jsenv/ directory
  const generatedUrlObject = new URL(urlInfo.generatedUrl);
  generatedUrlObject.searchParams.delete("js_module_fallback");
  generatedUrlObject.searchParams.delete("as_js_module");
  generatedUrlObject.searchParams.delete("as_js_classic");
  generatedUrlObject.searchParams.delete("as_css_module");
  generatedUrlObject.searchParams.delete("as_json_module");
  generatedUrlObject.searchParams.delete("as_text_module");
  generatedUrlObject.searchParams.delete("dynamic_import");
  generatedUrlObject.searchParams.delete("dynamic_import_id");
  generatedUrlObject.searchParams.delete("cjs_as_js_module");
  const urlForSourcemap = generatedUrlObject.href;
  return generateSourcemapFileUrl(urlForSourcemap);
};

const prependContent = async (
  urlInfoReceivingCode,
  urlInfoToPrepend,
) => {
  // we could also implement:
  // - prepend svg in html
  // - prepend css in html
  // - prepend css in css
  // - maybe more?
  // but no need for now
  if (
    urlInfoReceivingCode.type === "html" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    prependJsClassicInHtml(urlInfoReceivingCode, urlInfoToPrepend);
    return;
  }
  if (
    urlInfoReceivingCode.type === "js_classic" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    prependJsClassicInJsClassic(urlInfoReceivingCode, urlInfoToPrepend);
    return;
  }
  if (
    urlInfoReceivingCode.type === "js_module" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    await prependJsClassicInJsModule(urlInfoReceivingCode, urlInfoToPrepend);
    return;
  }
  throw new Error(
    `cannot prepend content from "${urlInfoToPrepend.type}" into "${urlInfoReceivingCode.type}"`,
  );
};

const prependJsClassicInHtml = (htmlUrlInfo, urlInfoToPrepend) => {
  const htmlAst = parseHtml({
    html: htmlUrlInfo.content,
    url: htmlUrlInfo.url,
  });
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      ...(urlInfoToPrepend.url
        ? { "inlined-from-src": urlInfoToPrepend.url }
        : {}),
      children: urlInfoToPrepend.content,
    }),
    "jsenv:core",
  );
  const content = stringifyHtmlAst(htmlAst);
  htmlUrlInfo.mutateContent({ content });
};

const prependJsClassicInJsClassic = (jsUrlInfo, urlInfoToPrepend) => {
  const magicSource = createMagicSource(jsUrlInfo.content);
  magicSource.prepend(`${urlInfoToPrepend.content}\n\n`);
  const magicResult = magicSource.toContentAndSourcemap();
  const sourcemap = composeTwoSourcemaps(
    jsUrlInfo.sourcemap,
    magicResult.sourcemap,
  );
  jsUrlInfo.mutateContent({
    content: magicResult.content,
    sourcemap,
  });
};

const prependJsClassicInJsModule = async (jsUrlInfo, urlInfoToPrepend) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [
      [
        babelPluginPrependCodeInJsModule,
        { codeToPrepend: urlInfoToPrepend.content },
      ],
    ],
    input: jsUrlInfo.content,
    inputIsJsModule: true,
    inputUrl: jsUrlInfo.originalUrl,
  });
  jsUrlInfo.mutateContent({
    content: code,
    sourcemap: map,
  });
};
const babelPluginPrependCodeInJsModule = (babel) => {
  return {
    name: "prepend-code-in-js-module",
    visitor: {
      Program: (programPath, state) => {
        const { codeToPrepend } = state.opts;
        const astToPrepend = babel.parse(codeToPrepend);
        const bodyNodePaths = programPath.get("body");
        for (const bodyNodePath of bodyNodePaths) {
          if (bodyNodePath.node.type === "ImportDeclaration") {
            continue;
          }
          bodyNodePath.insertBefore(astToPrepend.program.body);
          return;
        }
        bodyNodePaths.unshift(astToPrepend.program.body);
      },
    },
  };
};

let referenceId = 0;

const createDependencies = (ownerUrlInfo) => {
  const { referenceToOthersSet } = ownerUrlInfo;

  const startCollecting = async (callback) => {
    const prevReferenceToOthersSet = new Set(referenceToOthersSet);
    referenceToOthersSet.clear();

    const stopCollecting = () => {
      for (const prevReferenceToOther of prevReferenceToOthersSet) {
        checkForDependencyRemovalEffects(prevReferenceToOther);
      }
      prevReferenceToOthersSet.clear();
    };

    try {
      await callback();
    } finally {
      // finally to ensure reference are updated even in case of error
      stopCollecting();
    }
  };

  const createResolveAndFinalize = (props) => {
    const originalReference = createReference({
      ownerUrlInfo,
      ...props,
    });
    const reference = originalReference.resolve();
    if (reference.urlInfo) {
      return reference;
    }
    const kitchen = ownerUrlInfo.kitchen;
    const urlInfo = kitchen.graph.reuseOrCreateUrlInfo(reference);
    reference.urlInfo = urlInfo;
    addDependency(reference);
    ownerUrlInfo.context.finalizeReference(reference);
    return reference;
  };

  const found = ({ trace, ...rest }) => {
    if (trace === undefined) {
      trace = traceFromUrlSite(
        adjustUrlSite(ownerUrlInfo, {
          url: ownerUrlInfo.url,
          line: rest.specifierLine,
          column: rest.specifierColumn,
        }),
      );
    }
    const reference = createResolveAndFinalize({
      trace,
      ...rest,
    });
    return reference;
  };
  const foundInline = ({
    isOriginalPosition,
    specifierLine,
    specifierColumn,
    content,
    ...rest
  }) => {
    const parentUrl = isOriginalPosition
      ? ownerUrlInfo.url
      : ownerUrlInfo.generatedUrl;
    const parentContent = isOriginalPosition
      ? ownerUrlInfo.originalContent
      : ownerUrlInfo.content;
    const trace = traceFromUrlSite({
      url: parentUrl,
      content: parentContent,
      line: specifierLine,
      column: specifierColumn,
    });
    const reference = createResolveAndFinalize({
      trace,
      isOriginalPosition,
      specifierLine,
      specifierColumn,
      isInline: true,
      content,
      ...rest,
    });
    return reference;
  };
  // side effect file
  const foundSideEffectFile = async ({ sideEffectFileUrl, trace, ...rest }) => {
    if (trace === undefined) {
      const { url, line, column } = getCallerPosition();
      trace = traceFromUrlSite({
        url,
        line,
        column,
      });
    }
    const sideEffectFileReference = ownerUrlInfo.dependencies.inject({
      trace,
      type: "side_effect_file",
      specifier: sideEffectFileUrl,
      ...rest,
    });

    const injectAsBannerCodeBeforeFinalize = (urlInfoReceiver) => {
      const basename = urlToBasename(sideEffectFileUrl);
      const inlineUrl = generateUrlForInlineContent({
        url: urlInfoReceiver.originalUrl || urlInfoReceiver.url,
        basename,
        extension: urlToExtension(sideEffectFileUrl),
      });
      const sideEffectFileReferenceInlined = sideEffectFileReference.inline({
        ownerUrlInfo: urlInfoReceiver,
        trace,
        type: "side_effect_file",
        specifier: inlineUrl,
      });
      urlInfoReceiver.addContentTransformationCallback(async () => {
        await sideEffectFileReferenceInlined.urlInfo.cook();
        await prependContent(
          urlInfoReceiver,
          sideEffectFileReferenceInlined.urlInfo,
        );
      });
    };

    // When possible we inject code inside the file in a common ancestor
    // -> less duplication

    // During dev:
    // during dev cooking files is incremental
    // so HTML/JS is already executed by the browser
    // we can't late inject into entry point
    // During build:
    // files are not executed so it's possible to inject reference
    // when discovering a side effect file
    const visitedMap = new Map();
    let foundOrInjectedOnce = false;
    const visit = (urlInfo) => {
      urlInfo = urlInfo.findParentIfInline() || urlInfo;
      const value = visitedMap.get(urlInfo);
      if (value !== undefined) {
        return value;
      }

      // search if already referenced
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (referenceToOther === sideEffectFileReference) {
          continue;
        }
        if (referenceToOther.url === sideEffectFileUrl) {
          // consider this reference becomes the last reference
          // this ensure this ref is properly detected as inlined by urlInfo.isUsed()
          sideEffectFileReference.next =
            referenceToOther.next || referenceToOther;
          foundOrInjectedOnce = true;
          visitedMap.set(urlInfo, true);
          return true;
        }
        if (
          referenceToOther.original &&
          referenceToOther.original.url === sideEffectFileUrl
        ) {
          // consider this reference becomes the last reference
          // this ensure this ref is properly detected as inlined by urlInfo.isUsed()
          sideEffectFileReference.next =
            referenceToOther.next || referenceToOther;
          foundOrInjectedOnce = true;
          visitedMap.set(urlInfo, true);
          return true;
        }
      }
      // not referenced and we reach an entry point, stop there
      if (urlInfo.isEntryPoint) {
        foundOrInjectedOnce = true;
        visitedMap.set(urlInfo, true);
        injectAsBannerCodeBeforeFinalize(urlInfo);
        return true;
      }
      visitedMap.set(urlInfo, false);
      for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
        const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
        visit(urlInfoReferencingThisOne);
        // during dev the first urlInfo where we inject the side effect file is enough
        // during build we want to inject into every possible entry point
        if (foundOrInjectedOnce && urlInfo.context.dev) {
          break;
        }
      }
      return false;
    };
    visit(ownerUrlInfo);
    if (ownerUrlInfo.context.dev && !foundOrInjectedOnce) {
      injectAsBannerCodeBeforeFinalize(
        ownerUrlInfo.findParentIfInline() || ownerUrlInfo,
      );
    }
  };

  const inject = ({ trace, ...rest }) => {
    if (trace === undefined) {
      const { url, line, column } = getCallerPosition();
      trace = traceFromUrlSite({
        url,
        line,
        column,
      });
    }
    const reference = createResolveAndFinalize({
      trace,
      injected: true,
      ...rest,
    });
    return reference;
  };

  return {
    startCollecting,
    createResolveAndFinalize,
    found,
    foundInline,
    foundSideEffectFile,
    inject,
  };
};

/*
 * - "http_request"
 * - "entry_point"
 * - "link_href"
 * - "style"
 * - "script"
 * - "a_href"
 * - "iframe_src
 * - "img_src"
 * - "img_srcset"
 * - "source_src"
 * - "source_srcset"
 * - "image_href"
 * - "use_href"
 * - "css_@import"
 * - "css_url"
 * - "js_import"
 * - "js_import_script"
 * - "js_url"
 * - "js_inline_content"
 * - "sourcemap_comment"
 * - "webmanifest_icon_src"
 * - "package_json"
 * - "side_effect_file"
 * */
const createReference = ({
  ownerUrlInfo,
  data = {},
  trace,
  type,
  subtype,
  expectedContentType,
  expectedType,
  expectedSubtype,
  filenameHint,
  integrity,
  crossorigin,
  specifier,
  specifierStart,
  specifierEnd,
  specifierLine,
  specifierColumn,
  baseUrl,
  isOriginalPosition,
  isEntryPoint = false,
  isDynamicEntryPoint = false,
  isResourceHint = false,
  // implicit references are not real references
  // they represent an abstract relationship
  isImplicit = false,
  // weak references cannot keep the corresponding url info alive
  // there must be an other reference to keep the url info alive
  // an url referenced solely by weak references is:
  // - not written in build directory
  // - can be removed from graph during dev/build
  // - not cooked until referenced by a strong reference
  isWeak = false,
  hasVersioningEffect = false,
  version = null,
  injected = false,
  isInline = false,
  content,
  contentType,
  fsStat = null,
  debug = false,
  original = null,
  prev = null,
  next = null,
  url = null,
  searchParams = null,
  generatedUrl = null,
  generatedSpecifier = null,
  urlInfo = null,
  escape = null,
  importAttributes,
  isSideEffectImport = false,
  astInfo = {},
  mutation,
}) => {
  if (typeof specifier !== "string") {
    if (specifier instanceof URL) {
      specifier = specifier.href;
    } else {
      throw new TypeError(
        `"specifier" must be a string, got ${specifier} in ${ownerUrlInfo.url}`,
      );
    }
  }

  const reference = {
    id: ++referenceId,
    ownerUrlInfo,
    original,
    prev,
    next,
    data,
    trace,
    url,
    urlInfo,
    searchParams,
    generatedUrl,
    generatedSpecifier,
    type,
    subtype,
    expectedContentType,
    expectedType,
    expectedSubtype,
    filenameHint,
    integrity,
    crossorigin,
    specifier,
    get specifierPathname() {
      return asSpecifierWithoutSearch(reference.specifier);
    },
    specifierStart,
    specifierEnd,
    specifierLine,
    specifierColumn,
    isOriginalPosition,
    baseUrl,
    isEntryPoint,
    isDynamicEntryPoint,
    isResourceHint,
    isImplicit,
    implicitReferenceSet: new Set(),
    isWeak,
    hasVersioningEffect,
    urlInfoEffectSet: new Set(),
    version,
    injected,
    timing: {},
    fsStat,
    debug,
    // for inline resources the reference contains the content
    isInline,
    content,
    contentType,
    escape,
    // used mostly by worker and import assertions
    astInfo,
    importAttributes,
    isSideEffectImport,
    mutation,
  };

  reference.resolve = () => {
    const resolvedReference =
      reference.ownerUrlInfo.context.resolveReference(reference);
    return resolvedReference;
  };

  reference.redirect = (url, props = {}) => {
    const redirectedProps = getRedirectedReferenceProps(reference, url);
    const referenceRedirected = createReference({
      ...redirectedProps,
      ...props,
    });
    reference.next = referenceRedirected;
    return referenceRedirected;
  };

  // "formatReference" can be async BUT this is an exception
  // for most cases it will be sync. We want to favor the sync signature to keep things simpler
  // The only case where it needs to be async is when
  // the specifier is a `data:*` url
  // in this case we'll wait for the promise returned by
  // "formatReference"
  reference.readGeneratedSpecifier = () => {
    if (reference.generatedSpecifier.then) {
      return reference.generatedSpecifier.then((value) => {
        reference.generatedSpecifier = value;
        return value;
      });
    }
    return reference.generatedSpecifier;
  };

  reference.inline = ({
    line,
    column,
    // when urlInfo is given it means reference is moved into an other file
    ownerUrlInfo = reference.ownerUrlInfo,
    ...props
  }) => {
    const content =
      ownerUrlInfo === undefined
        ? isOriginalPosition
          ? reference.ownerUrlInfo.originalContent
          : reference.ownerUrlInfo.content
        : ownerUrlInfo.content;
    const trace = traceFromUrlSite({
      url:
        ownerUrlInfo === undefined
          ? isOriginalPosition
            ? reference.ownerUrlInfo.url
            : reference.ownerUrlInfo.generatedUrl
          : reference.ownerUrlInfo.url,
      content,
      line,
      column,
    });
    const inlineCopy = ownerUrlInfo.dependencies.createResolveAndFinalize({
      isInline: true,
      original: reference.original || reference,
      prev: reference,
      trace,
      injected: reference.injected,
      expectedType: reference.expectedType,
      ...props,
    });
    // the previous reference stays alive so that even after inlining
    // updating the file will invalidate the other file where it was inlined
    reference.next = inlineCopy;
    return inlineCopy;
  };

  reference.addImplicit = (props) => {
    const implicitReference = ownerUrlInfo.dependencies.inject({
      ...props,
      isImplicit: true,
    });
    reference.implicitReferenceSet.add(implicitReference);
    return implicitReference;
  };

  reference.gotInlined = () => {
    return !reference.isInline && reference.next && reference.next.isInline;
  };

  reference.remove = () => removeDependency(reference);

  // Object.preventExtensions(reference) // useful to ensure all properties are declared here
  return reference;
};

const addDependency = (reference) => {
  const { ownerUrlInfo } = reference;
  if (ownerUrlInfo.referenceToOthersSet.has(reference)) {
    return;
  }
  if (!canAddOrRemoveReference(reference)) {
    throw new Error(
      `cannot add reference for content already sent to the browser
--- reference url ---
${reference.url}
--- content url ---
${ownerUrlInfo.url}`,
    );
  }
  ownerUrlInfo.referenceToOthersSet.add(reference);
  if (reference.isImplicit) {
    // an implicit reference is a reference that does not explicitely appear in the file
    // but has an impact on the file
    // -> package.json on import resolution for instance
    // in that case:
    // - file depends on the implicit file (it must autoreload if package.json is modified)
    // - cache validity for the file depends on the implicit file (it must be re-cooked if package.json is modified)
    ownerUrlInfo.implicitUrlSet.add(reference.url);
    if (ownerUrlInfo.isInline) {
      const parentUrlInfo = ownerUrlInfo.graph.getUrlInfo(
        ownerUrlInfo.inlineUrlSite.url,
      );
      parentUrlInfo.implicitUrlSet.add(reference.url);
    }
  }
  const referencedUrlInfo = reference.urlInfo;
  referencedUrlInfo.referenceFromOthersSet.add(reference);
  applyReferenceEffectsOnUrlInfo(reference);
  for (const implicitRef of reference.implicitReferenceSet) {
    addDependency(implicitRef);
  }
};

const removeDependency = (reference) => {
  const { ownerUrlInfo } = reference;
  if (!ownerUrlInfo.referenceToOthersSet.has(reference)) {
    return false;
  }
  if (!canAddOrRemoveReference(reference)) {
    throw new Error(
      `cannot remove reference for content already sent to the browser
--- reference url ---
${reference.url}
--- content url ---
${ownerUrlInfo.url}`,
    );
  }
  for (const implicitRef of reference.implicitReferenceSet) {
    implicitRef.remove();
  }
  ownerUrlInfo.referenceToOthersSet.delete(reference);
  return checkForDependencyRemovalEffects(reference);
};

const canAddOrRemoveReference = (reference) => {
  if (reference.isWeak || reference.isImplicit) {
    // weak and implicit references have no restrictions
    // because they are not actual references with an influence on content
    return true;
  }
  const { ownerUrlInfo } = reference;
  if (ownerUrlInfo.context.build) {
    // during build url content is not executed
    // it's still possible to mutate references safely
    return true;
  }
  if (!ownerUrlInfo.contentFinalized) {
    return true;
  }
  if (ownerUrlInfo.isRoot) {
    // the root urlInfo is abstract, there is no real file behind it
    return true;
  }
  if (reference.type === "http_request") {
    // reference created to http requests are abstract concepts
    return true;
  }
  return false;
};

const checkForDependencyRemovalEffects = (reference) => {
  const { ownerUrlInfo } = reference;
  const { referenceToOthersSet } = ownerUrlInfo;
  if (reference.isImplicit && !reference.isInline) {
    let hasAnOtherImplicitRef = false;
    for (const referenceToOther of referenceToOthersSet) {
      if (
        referenceToOther.isImplicit &&
        referenceToOther.url === reference.url
      ) {
        hasAnOtherImplicitRef = true;
        break;
      }
    }
    if (!hasAnOtherImplicitRef) {
      ownerUrlInfo.implicitUrlSet.delete(reference.url);
    }
  }

  const prevReference = reference.prev;
  const nextReference = reference.next;
  if (prevReference && nextReference) {
    nextReference.prev = prevReference;
    prevReference.next = nextReference;
  } else if (prevReference) {
    prevReference.next = null;
  } else if (nextReference) {
    nextReference.original = null;
    nextReference.prev = null;
  }

  const referencedUrlInfo = reference.urlInfo;
  referencedUrlInfo.referenceFromOthersSet.delete(reference);

  let firstReferenceFromOther;
  let wasInlined;
  for (const referenceFromOther of referencedUrlInfo.referenceFromOthersSet) {
    if (referenceFromOther.urlInfo !== referencedUrlInfo) {
      continue;
    }
    // Here we want to know if the file is referenced by an other file.
    // So we want to ignore reference that are created by other means:
    // - "http_request"
    //   This type of reference is created when client request a file
    //   that we don't know yet
    //   1. reference(s) to this file are not yet discovered
    //   2. there is no reference to this file
    if (referenceFromOther.type === "http_request") {
      continue;
    }
    wasInlined = referenceFromOther.gotInlined();
    if (wasInlined) {
      // the url info was inlined, an other reference is required
      // to consider the non-inlined urlInfo as used
      continue;
    }
    firstReferenceFromOther = referenceFromOther;
    break;
  }
  if (firstReferenceFromOther) {
    // either applying new ref should override old ref
    // or we should first remove effects before adding new ones
    // for now we just set firstReference to null
    if (reference === referencedUrlInfo.firstReference) {
      referencedUrlInfo.firstReference = null;
      applyReferenceEffectsOnUrlInfo(firstReferenceFromOther);
    }
    return false;
  }
  if (wasInlined) {
    return false;
  }
  // referencedUrlInfo.firstReference = null;
  // referencedUrlInfo.lastReference = null;
  referencedUrlInfo.onDereferenced(reference);
  return true;
};

const traceFromUrlSite = (urlSite) => {
  const codeFrame = urlSite.content
    ? generateContentFrame({
        content: urlSite.content,
        line: urlSite.line,
        column: urlSite.column,
      })
    : "";
  return {
    codeFrame,
    message: stringifyUrlSite(urlSite),
    url: urlSite.url,
    line: urlSite.line,
    column: urlSite.column,
  };
};

const adjustUrlSite = (urlInfo, { url, line, column }) => {
  const isOriginal = url === urlInfo.url;
  const adjust = (urlInfo, urlSite) => {
    if (!urlSite.isOriginal) {
      return urlSite;
    }
    const inlineUrlSite = urlInfo.inlineUrlSite;
    if (!inlineUrlSite) {
      return urlSite;
    }
    const parentUrlInfo = urlInfo.graph.getUrlInfo(inlineUrlSite.url);
    line =
      inlineUrlSite.line === undefined
        ? urlSite.line
        : inlineUrlSite.line + urlSite.line;
    // we remove 1 to the line because imagine the following html:
    // <style>body { color: red; }</style>
    // -> content starts same line as <style> (same for <script>)
    if (urlInfo.content[0] === "\n") {
      line = line - 1;
    }
    column =
      inlineUrlSite.column === undefined
        ? urlSite.column
        : inlineUrlSite.column + urlSite.column;
    return adjust(parentUrlInfo, {
      isOriginal: true,
      url: inlineUrlSite.url,
      content: inlineUrlSite.content,
      line,
      column,
    });
  };
  return adjust(urlInfo, {
    isOriginal,
    url,
    content: isOriginal ? urlInfo.originalContent : urlInfo.content,
    line,
    column,
  });
};

const getRedirectedReferenceProps = (reference, url) => {
  const redirectedProps = {
    ...reference,
    specifier: url,
    url,
    original: reference.original || reference,
    prev: reference,
  };
  return redirectedProps;
};

const applyReferenceEffectsOnUrlInfo = (reference) => {
  const referencedUrlInfo = reference.urlInfo;
  referencedUrlInfo.lastReference = reference;
  if (reference.isInline) {
    referencedUrlInfo.isInline = true;
    referencedUrlInfo.inlineUrlSite = {
      url: reference.ownerUrlInfo.url,
      content: reference.isOriginalPosition
        ? reference.ownerUrlInfo.originalContent
        : reference.ownerUrlInfo.content,
      line: reference.specifierLine,
      column: reference.specifierColumn,
    };
  }

  if (
    referencedUrlInfo.firstReference &&
    !referencedUrlInfo.firstReference.isWeak
  ) {
    return;
  }
  referencedUrlInfo.firstReference = reference;
  referencedUrlInfo.originalUrl =
    referencedUrlInfo.originalUrl || (reference.original || reference).url;

  if (reference.isEntryPoint) {
    referencedUrlInfo.isEntryPoint = true;
  }
  if (reference.isDynamicEntryPoint) {
    referencedUrlInfo.isDynamicEntryPoint = true;
  }
  Object.assign(referencedUrlInfo.data, reference.data);
  Object.assign(referencedUrlInfo.timing, reference.timing);
  if (reference.injected) {
    referencedUrlInfo.injected = true;
  }
  if (reference.filenameHint && !referencedUrlInfo.filenameHint) {
    referencedUrlInfo.filenameHint = reference.filenameHint;
  }
  if (reference.dirnameHint && !referencedUrlInfo.dirnameHint) {
    referencedUrlInfo.dirnameHint = reference.dirnameHint;
  }
  if (reference.debug) {
    referencedUrlInfo.debug = true;
  }
  if (reference.expectedType) {
    referencedUrlInfo.typeHint = reference.expectedType;
  }
  if (reference.expectedSubtype) {
    referencedUrlInfo.subtypeHint = reference.expectedSubtype;
  }

  referencedUrlInfo.entryUrlInfo = reference.isEntryPoint
    ? referencedUrlInfo
    : reference.ownerUrlInfo.entryUrlInfo;

  for (const urlInfoEffect of reference.urlInfoEffectSet) {
    urlInfoEffect(referencedUrlInfo);
  }
};

const GRAPH_VISITOR = {};

GRAPH_VISITOR.map = (graph, callback) => {
  const array = [];
  graph.urlInfoMap.forEach((urlInfo) => {
    array.push(callback(urlInfo));
  });
  return array;
};
GRAPH_VISITOR.forEach = (graph, callback) => {
  graph.urlInfoMap.forEach(callback);
};
GRAPH_VISITOR.filter = (graph, callback) => {
  const urlInfos = [];
  graph.urlInfoMap.forEach((urlInfo) => {
    if (callback(urlInfo)) {
      urlInfos.push(urlInfo);
    }
  });
  return urlInfos;
};
GRAPH_VISITOR.find = (graph, callback) => {
  let found = null;
  for (const urlInfo of graph.urlInfoMap.values()) {
    if (callback(urlInfo)) {
      found = urlInfo;
      break;
    }
  }
  return found;
};
GRAPH_VISITOR.findDependent = (urlInfo, visitor) => {
  const graph = urlInfo.graph;
  const seen = new Set();
  seen.add(urlInfo.url);
  let found = null;
  const visit = (dependentUrlInfo) => {
    if (seen.has(dependentUrlInfo.url)) {
      return false;
    }
    seen.add(dependentUrlInfo.url);
    if (visitor(dependentUrlInfo)) {
      found = dependentUrlInfo;
    }
    return true;
  };
  const iterate = (currentUrlInfo) => {
    // When cookin html inline content, html dependencies are not yet updated
    // consequently htmlUrlInfo.dependencies is empty
    // and inlineContentUrlInfo.referenceFromOthersSet is empty as well
    // in that case we resort to isInline + inlineUrlSite to establish the dependency
    if (currentUrlInfo.isInline) {
      const parentUrl = currentUrlInfo.inlineUrlSite.url;
      const parentUrlInfo = graph.getUrlInfo(parentUrl);
      visit(parentUrlInfo);
      if (found) {
        return;
      }
    }
    for (const referenceFromOther of currentUrlInfo.referenceFromOthersSet) {
      const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
      if (visit(urlInfoReferencingThisOne)) {
        if (found) {
          break;
        }
        iterate(urlInfoReferencingThisOne);
      }
    }
  };
  iterate(urlInfo);
  return found;
};
GRAPH_VISITOR.findDependency = (urlInfo, visitor) => {
  const graph = urlInfo.graph;
  const seen = new Set();
  seen.add(urlInfo.url);
  let found = null;
  const visit = (dependencyUrlInfo) => {
    if (seen.has(dependencyUrlInfo.url)) {
      return false;
    }
    seen.add(dependencyUrlInfo.url);
    if (visitor(dependencyUrlInfo)) {
      found = dependencyUrlInfo;
    }
    return true;
  };
  const iterate = (currentUrlInfo) => {
    for (const referenceToOther of currentUrlInfo.referenceToOthersSet) {
      const referencedUrlInfo = graph.getUrlInfo(referenceToOther);
      if (visit(referencedUrlInfo)) {
        if (found) {
          break;
        }
        iterate(referencedUrlInfo);
      }
    }
  };
  iterate(urlInfo);
  return found;
};

// This function will be used in "build.js"
// by passing rootUrlInfo as first arg
// -> this ensure we visit only urls with strong references
// because we start from root and ignore weak ref
// The alternative would be to iterate on urlInfoMap
// and call urlInfo.isUsed() but that would be more expensive
GRAPH_VISITOR.forEachUrlInfoStronglyReferenced = (
  initialUrlInfo,
  callback,
  { directoryUrlInfoSet } = {},
) => {
  const seen = new Set();
  seen.add(initialUrlInfo);
  const iterateOnReferences = (urlInfo) => {
    for (const referenceToOther of urlInfo.referenceToOthersSet) {
      if (referenceToOther.gotInlined()) {
        continue;
      }
      if (referenceToOther.url.startsWith("ignore:")) {
        continue;
      }
      const referencedUrlInfo = referenceToOther.urlInfo;
      if (
        directoryUrlInfoSet &&
        referenceToOther.expectedType === "directory"
      ) {
        directoryUrlInfoSet.add(referencedUrlInfo);
      }
      if (referenceToOther.isWeak) {
        continue;
      }
      if (seen.has(referencedUrlInfo)) {
        continue;
      }
      seen.add(referencedUrlInfo);
      callback(referencedUrlInfo);
      iterateOnReferences(referencedUrlInfo);
    }
  };
  iterateOnReferences(initialUrlInfo);
  seen.clear();
};

const urlSpecifierEncoding = {
  encode: (reference) => {
    const { generatedSpecifier } = reference;
    if (generatedSpecifier.then) {
      return generatedSpecifier.then((value) => {
        reference.generatedSpecifier = value;
        return urlSpecifierEncoding.encode(reference);
      });
    }
    // allow plugin to return a function to bypas default formatting
    // (which is to use JSON.stringify when url is referenced inside js)
    if (typeof generatedSpecifier === "function") {
      return generatedSpecifier();
    }
    const formatter = formatters[reference.type];
    const value = formatter
      ? formatter.encode(generatedSpecifier)
      : generatedSpecifier;
    if (reference.escape) {
      return reference.escape(value);
    }
    return value;
  },
  decode: (reference) => {
    const formatter = formatters[reference.type];
    return formatter
      ? formatter.decode(reference.generatedSpecifier)
      : reference.generatedSpecifier;
  },
};
const formatters = {
  "js_import": { encode: JSON.stringify, decode: JSON.parse },
  "js_url": { encode: JSON.stringify, decode: JSON.parse },
  "css_@import": { encode: JSON.stringify, decode: JSON.stringify },
  // https://github.com/webpack-contrib/css-loader/pull/627/files
  "css_url": {
    encode: (url) => {
      // If url is already wrapped in quotes, remove them
      url = formatters.css_url.decode(url);
      // Should url be wrapped?
      // See https://drafts.csswg.org/css-values-3/#urls
      if (/["'() \t\n]/.test(url)) {
        return `"${url.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
      }
      return url;
    },
    decode: (url) => {
      const firstChar = url[0];
      const lastChar = url[url.length - 1];
      if (firstChar === `"` && lastChar === `"`) {
        return url.slice(1, -1);
      }
      if (firstChar === `'` && lastChar === `'`) {
        return url.slice(1, -1);
      }
      return url;
    },
  },
};

const createUrlGraph = ({
  rootDirectoryUrl,
  kitchen,
  name = "anonymous",
}) => {
  const urlGraph = {};
  const urlInfoCreatedEventEmitter = createEventEmitter();
  const urlInfoDereferencedEventEmitter = createEventEmitter();

  const urlInfoMap = new Map();
  const hasUrlInfo = (key) => {
    if (typeof key === "string") {
      return urlInfoMap.has(key);
    }
    if (typeof key === "object" && key && key.url) {
      return urlInfoMap.has(key.url);
    }
    return null;
  };
  const getUrlInfo = (key) => {
    if (typeof key === "string") {
      return urlInfoMap.get(key);
    }
    if (typeof key === "object" && key && key.url) {
      return urlInfoMap.get(key.url);
    }
    return null;
  };

  const addUrlInfo = (urlInfo) => {
    urlInfo.graph = urlGraph;
    urlInfo.kitchen = kitchen;
    urlInfoMap.set(urlInfo.url, urlInfo);
  };
  const reuseOrCreateUrlInfo = (reference, useGeneratedUrl) => {
    const referencedUrl = useGeneratedUrl
      ? reference.generatedUrl
      : reference.url;
    let referencedUrlInfo = getUrlInfo(referencedUrl);
    if (!referencedUrlInfo) {
      const ownerUrlInfo = reference.ownerUrlInfo;
      const ownerContext = ownerUrlInfo.context;
      const context = Object.create(ownerContext);
      referencedUrlInfo = createUrlInfo(referencedUrl, context);
      addUrlInfo(referencedUrlInfo);
      urlInfoCreatedEventEmitter.emit(referencedUrlInfo);
    }
    if (
      referencedUrlInfo.searchParams.size > 0 &&
      kitchen.context.buildStep !== "shape"
    ) {
      // A resource is represented by a url.
      // Variations of a resource are represented by url search params
      // Each representation of the resource is given a dedicated url info
      // object (one url -> one url info)
      // It's because search params often influence the final content returned for that url
      // When a reference contains url search params it must create 2 url infos:
      // 1. The url info corresponding to the url with search params
      // 2. The url info corresponding to url without search params
      // Because the underlying content without search params is used to generate
      // the content modified according to search params
      // This way when a file like "style.css" is considered as modified
      // references like "style.css?as_css_module" are also affected
      const urlWithoutSearch = asUrlWithoutSearch(reference.url);
      // a reference with a search param creates an implicit reference
      // to the file without search param
      const referenceWithoutSearch = reference.addImplicit({
        specifier: urlWithoutSearch,
        url: urlWithoutSearch,
        searchParams: new URLSearchParams(),
        isWeak: true,
      });
      const urlInfoWithoutSearch = referenceWithoutSearch.urlInfo;
      urlInfoWithoutSearch.searchParamVariantSet.add(referencedUrlInfo);
    }
    return referencedUrlInfo;
  };

  const inferReference = (specifier, parentUrl) => {
    const parentUrlInfo = getUrlInfo(parentUrl);
    if (!parentUrlInfo) {
      return null;
    }
    const seen = [];
    const search = (urlInfo) => {
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (urlSpecifierEncoding.decode(referenceToOther) === specifier) {
          return referenceToOther;
        }
      }
      for (const referenceToOther of parentUrlInfo.referenceToOthersSet) {
        if (seen.includes(referenceToOther.url)) {
          continue;
        }
        seen.push(referenceToOther.url);
        const referencedUrlInfo = referenceToOther.urlInfo;
        if (referencedUrlInfo.isInline) {
          const firstRef = search(referencedUrlInfo);
          if (firstRef) {
            return firstRef;
          }
        }
      }
      return null;
    };
    return search(parentUrlInfo);
  };

  const getEntryPoints = () => {
    const entryPoints = [];
    urlInfoMap.forEach((urlInfo) => {
      if (urlInfo.isEntryPoint && urlInfo.isUsed()) {
        entryPoints.push(urlInfo);
      }
    });
    return entryPoints;
  };

  const rootUrlInfo = createUrlInfo(rootDirectoryUrl, kitchen.context);
  rootUrlInfo.isRoot = true;
  rootUrlInfo.entryUrlInfo = rootUrlInfo;
  addUrlInfo(rootUrlInfo);

  Object.assign(urlGraph, {
    name,
    rootUrlInfo,

    urlInfoMap,
    reuseOrCreateUrlInfo,
    hasUrlInfo,
    getUrlInfo,
    getEntryPoints,

    inferReference,
    urlInfoCreatedEventEmitter,
    urlInfoDereferencedEventEmitter,

    toObject: () => {
      const data = {};
      urlInfoMap.forEach((urlInfo) => {
        data[urlInfo.url] = urlInfo;
      });
      return data;
    },
    toJSON: (rootDirectoryUrl) => {
      const data = {};
      urlInfoMap.forEach((urlInfo) => {
        if (urlInfo.referenceToOthersSet.size) {
          const relativeUrl = urlToRelativeUrl(urlInfo.url, rootDirectoryUrl);
          const referencedUrlSet = new Set();
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            data[relativeUrl] = referencedUrlSet.add(referenceToOther.url);
          }
          data[relativeUrl] = Array.from(referencedUrlSet).map(
            (referencedUrl) =>
              urlToRelativeUrl(referencedUrl, rootDirectoryUrl),
          );
        }
      });
      return data;
    },
  });
  return urlGraph;
};

const createUrlInfo = (url, context) => {
  const urlInfo = {
    isRoot: false,
    graph: null,
    kitchen: null,
    context,
    error: null,
    modifiedTimestamp: 0,
    descendantModifiedTimestamp: 0,
    dereferencedTimestamp: 0,
    originalContentEtag: null,
    contentEtag: null,
    isWatched: false,
    isValid: () => false,
    data: {}, // plugins can put whatever they want here
    referenceToOthersSet: new Set(),
    referenceFromOthersSet: new Set(),
    firstReference: null, // first reference from an other url to this one
    lastReference: null,
    remapReference: null, // used solely during build for rollup
    implicitUrlSet: new Set(),
    searchParamVariantSet: new Set(),

    type: undefined, // "html", "css", "js_classic", "js_module", "importmap", "sourcemap", "json", "webmanifest", ...
    subtype: undefined, // "worker", "service_worker", "shared_worker" for js, otherwise undefined
    typeHint: undefined,
    subtypeHint: undefined,
    contentType: "", // "text/html", "text/css", "text/javascript", "application/json", ...
    url: null,
    originalUrl: undefined,
    isEntryPoint: false,
    isDynamicEntryPoint: false,
    entryUrlInfo: null,
    originalContent: undefined,
    originalContentAst: undefined,
    content: undefined,
    contentAst: undefined,
    contentLength: undefined,
    contentFinalized: false,
    contentSideEffects: [],
    contentInjections: {},

    sourcemap: null,
    sourcemapIsWrong: false,
    sourcemapReference: null,

    generatedUrl: null,
    sourcemapGeneratedUrl: null,
    filenameHint: "",
    dirnameHint: "",
    injected: false,

    isInline: false,
    inlineUrlSite: null,
    jsQuote: null, // maybe move to inlineUrlSite?

    timing: {},
    status: 200,
    headers: {},
    debug: false,
  };
  Object.defineProperty(urlInfo, "url", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: url,
  });
  urlInfo.pathname = new URL(url).pathname;
  urlInfo.searchParams = new URL(url).searchParams;

  Object.defineProperty(urlInfo, "packageDirectoryUrl", {
    enumerable: true,
    configurable: true,
    get: () => context.packageDirectory.find(url),
  });
  Object.defineProperty(urlInfo, "packageJSON", {
    enumerable: true,
    configurable: true,
    get: () => {
      const packageDirectoryUrl = context.packageDirectory.find(url);
      return packageDirectoryUrl
        ? context.packageDirectory.read(packageDirectoryUrl)
        : null;
    },
  });
  Object.defineProperty(urlInfo, "packageName", {
    enumerable: true,
    configurable: true,
    get: () => urlInfo.packageJSON?.name,
  });
  urlInfo.dependencies = createDependencies(urlInfo);
  urlInfo.isUsed = () => {
    if (urlInfo.isRoot) {
      return true;
    }
    for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
      if (referenceFromOther.urlInfo !== urlInfo) {
        continue;
      }
      if (referenceFromOther.ownerUrlInfo.isRoot) {
        return true;
      }
      const ref = referenceFromOther.original || referenceFromOther;
      if (ref.isWeak) {
        // weak reference don't count as using the url
        continue;
      }
      if (ref.gotInlined()) {
        if (ref.ownerUrlInfo.isUsed()) {
          return true;
        }
        // the url info was inlined, an other reference is required
        // to consider the non-inlined urlInfo as used
        continue;
      }
      return ref.ownerUrlInfo.isUsed();
    }
    // nothing uses this url anymore
    // - versioning update inline content
    // - file converted for import assertion or js_classic conversion
    // - urlInfo for a file that is now inlined
    return false;
  };
  urlInfo.findParentIfInline = () => {
    let currentUrlInfo = urlInfo;
    const graph = urlInfo.graph;
    while (currentUrlInfo.isInline) {
      const parentUrlInfo = graph.getUrlInfo(currentUrlInfo.inlineUrlSite.url);
      if (!parentUrlInfo.isInline) {
        return parentUrlInfo;
      }
      currentUrlInfo = parentUrlInfo;
    }
    return null;
  };
  urlInfo.findDependent = (callback) => {
    return GRAPH_VISITOR.findDependent(urlInfo, callback);
  };
  urlInfo.isSearchParamVariantOf = (otherUrlInfo) => {
    if (urlInfo.searchParams.size === 0) {
      return false;
    }
    if (otherUrlInfo.searchParams.size > 0) {
      return false;
    }
    const withoutSearch = asUrlWithoutSearch(urlInfo.url);
    if (withoutSearch === otherUrlInfo.url) {
      return true;
    }
    return false;
  };
  const getNextUrlInfo = (newProps) => {
    const reference = urlInfo.firstReference;
    const nextReference = reference.addImplicit({
      type: reference.type,
      subtype: reference.subtype,
      expectedContentType: reference.expectedContentType,
      expectedType: reference.expectedType,
      expectedSubtype: reference.expectedSubtype,
      integrity: reference.integrity,
      crossorigin: reference.crossorigin,
      specifierStart: reference.specifierStart,
      specifierEnd: reference.specifierEnd,
      specifierLine: reference.specifierLine,
      specifierColumn: reference.specifierColumn,
      baseUrl: reference.baseUrl,
      isOriginalPosition: reference.isOriginalPosition,
      // ok mais cet ref est implicite + weak
      // donc ne devrait pas etre retournée par getEntryPoints()
      isEntryPoint: reference.isEntryPoint,
      isResourceHint: reference.isResourceHint,
      hasVersioningEffect: reference.hasVersioningEffect,
      version: reference.version,
      content: reference.content,
      contentType: reference.contentType,
      fsStat: reference.fsStat,
      debug: reference.debug,
      importAttributes: reference.importAttributes,
      astInfo: reference.astInfo,
      mutation: reference.mutation,
      data: { ...reference.data },
      isWeak: true,
      isInline: reference.isInline,
      original: reference.original || reference,
      prev: reference,
      // urlInfo: null,
      // url: null,
      // generatedUrl: null,
      // generatedSpecifier: null,
      // filename: null,
      ...newProps,
    });
    reference.next = nextReference;
    return nextReference.urlInfo;
  };

  urlInfo.redirect = (props) => {
    return getNextUrlInfo(props);
  };
  urlInfo.getWithoutSearchParam = (searchParam, props) => {
    // The search param can be
    // 1. injected by a plugin during "redirectReference"
    //    - import assertions
    //    - js module fallback to systemjs
    // 2. already inside source files
    //    - turn js module into js classic for convenience ?as_js_classic
    //    - turn js classic to js module for to make it importable
    if (!urlInfo.searchParams.has(searchParam)) {
      return null;
    }
    const reference = urlInfo.firstReference;
    const specifierWithoutSearchParam = injectQueryParamsIntoSpecifier(
      reference.specifier,
      {
        [searchParam]: undefined,
      },
    );
    return urlInfo.redirect({
      specifier: specifierWithoutSearchParam,
      ...props,
    });
  };
  urlInfo.onRemoved = () => {
    urlInfo.kitchen.urlInfoTransformer.resetContent(urlInfo);
    urlInfo.referenceToOthersSet.forEach((referenceToOther) => {
      referenceToOther.remove();
    });
    if (urlInfo.searchParams.size > 0) {
      const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
      const urlInfoWithoutSearch = urlInfo.graph.getUrlInfo(urlWithoutSearch);
      if (urlInfoWithoutSearch) {
        urlInfoWithoutSearch.searchParamVariantSet.delete(urlInfo);
      }
    }
  };
  urlInfo.onModified = ({ modifiedTimestamp = Date.now() } = {}) => {
    const visitedSet = new Set();
    const considerModified = (urlInfo) => {
      if (visitedSet.has(urlInfo)) {
        return;
      }
      visitedSet.add(urlInfo);
      urlInfo.modifiedTimestamp = modifiedTimestamp;
      urlInfo.kitchen.urlInfoTransformer.resetContent(urlInfo);
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        const referencedUrlInfo = referenceToOther.urlInfo;
        if (referencedUrlInfo.isInline) {
          considerModified(referencedUrlInfo);
        }
      }
      for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
        if (referenceFromOther.gotInlined()) {
          const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
          considerModified(urlInfoReferencingThisOne);
        }
      }
      for (const searchParamVariant of urlInfo.searchParamVariantSet) {
        considerModified(searchParamVariant);
      }
    };
    considerModified(urlInfo);
    visitedSet.clear();
  };
  urlInfo.onDereferenced = (lastReferenceFromOther) => {
    urlInfo.dereferencedTimestamp = Date.now();
    urlInfo.graph.urlInfoDereferencedEventEmitter.emit(
      urlInfo,
      lastReferenceFromOther,
    );
  };

  urlInfo.cook = (customContext) => {
    return urlInfo.context.cook(urlInfo, customContext);
  };
  urlInfo.cookDependencies = (options) => {
    return urlInfo.context.cookDependencies(urlInfo, options);
  };
  urlInfo.fetchContent = () => {
    return urlInfo.context.fetchUrlContent(urlInfo);
  };
  urlInfo.transformContent = () => {
    return urlInfo.context.transformUrlContent(urlInfo);
  };
  urlInfo.finalizeContent = () => {
    return urlInfo.context.finalizeUrlContent(urlInfo);
  };
  urlInfo.mutateContent = (transformations) => {
    return urlInfo.kitchen.urlInfoTransformer.applyTransformations(
      urlInfo,
      transformations,
    );
  };

  const contentTransformationCallbackSet = new Set();
  urlInfo.addContentTransformationCallback = (callback) => {
    if (urlInfo.contentFinalized) {
      if (urlInfo.context.dev) {
        throw new Error(
          `cannot add a transform callback on content already sent to the browser.
--- content url ---
${urlInfo.url}`,
        );
      }
      urlInfo.context.addLastTransformationCallback(callback);
    } else {
      contentTransformationCallbackSet.add(callback);
    }
  };
  urlInfo.applyContentTransformationCallbacks = async () => {
    for (const contentTransformationCallback of contentTransformationCallbackSet) {
      await contentTransformationCallback();
    }
    contentTransformationCallbackSet.clear();
  };

  // Object.preventExtensions(urlInfo) // useful to ensure all properties are declared here
  return urlInfo;
};

const injectionSymbol = Symbol.for("jsenv_injection");
const INJECTIONS = {
  global: (value) => {
    return { [injectionSymbol]: "global", value };
  },
  optional: (value) => {
    if (value && value[injectionSymbol] === "optional") {
      return value;
    }
    return { [injectionSymbol]: "optional", value };
  },
};

const isPlaceholderInjection = (value) => {
  return (
    !value || !value[injectionSymbol] || value[injectionSymbol] !== "global"
  );
};

const applyContentInjections = (content, contentInjections, urlInfo) => {
  const keys = Object.keys(contentInjections);
  const globals = {};
  const placeholderReplacements = [];
  for (const key of keys) {
    const contentInjection = contentInjections[key];
    if (contentInjection && contentInjection[injectionSymbol]) {
      const valueBehindSymbol = contentInjection[injectionSymbol];
      if (valueBehindSymbol === "global") {
        globals[key] = contentInjection.value;
      } else if (valueBehindSymbol === "optional") {
        placeholderReplacements.push({
          key,
          isOptional: true,
          value: contentInjection.value,
        });
      } else {
        throw new Error(`unknown injection type "${valueBehindSymbol}"`);
      }
    } else {
      placeholderReplacements.push({
        key,
        value: contentInjection,
      });
    }
  }

  const needGlobalsInjection = Object.keys(globals).length > 0;
  const needPlaceholderReplacements = placeholderReplacements.length > 0;

  if (needGlobalsInjection && needPlaceholderReplacements) {
    const globalInjectionResult = injectGlobals(content, globals, urlInfo);
    const replaceInjectionResult = injectPlaceholderReplacements(
      globalInjectionResult.content,
      placeholderReplacements,
      urlInfo,
    );
    return {
      content: replaceInjectionResult.content,
      sourcemap: composeTwoSourcemaps(
        globalInjectionResult.sourcemap,
        replaceInjectionResult.sourcemap,
      ),
    };
  }
  if (needGlobalsInjection) {
    return injectGlobals(content, globals, urlInfo);
  }
  if (needPlaceholderReplacements) {
    return injectPlaceholderReplacements(
      content,
      placeholderReplacements,
      urlInfo,
    );
  }
  return null;
};

const injectPlaceholderReplacements = (
  content,
  placeholderReplacements,
  urlInfo,
) => {
  const magicSource = createMagicSource(content);
  for (const { key, isOptional, value } of placeholderReplacements) {
    let index = content.indexOf(key);
    if (index === -1) {
      if (!isOptional) {
        urlInfo.context.logger.warn(
          `placeholder "${key}" not found in ${urlInfo.url}.
--- suggestion a ---
Add "${key}" in that file.
--- suggestion b ---
Fix eventual typo in "${key}"?
--- suggestion c ---
Mark injection as optional using INJECTIONS.optional():
import { INJECTIONS } from "@jsenv/core";

return {
  "${key}": INJECTIONS.optional(${JSON.stringify(value)}),
};`,
        );
      }
      continue;
    }

    while (index !== -1) {
      const start = index;
      const end = index + key.length;
      magicSource.replace({
        start,
        end,
        replacement:
          urlInfo.type === "js_classic" ||
          urlInfo.type === "js_module" ||
          urlInfo.type === "html"
            ? JSON.stringify(value, null, "  ")
            : value,
      });
      index = content.indexOf(key, end);
    }
  }
  return magicSource.toContentAndSourcemap();
};

const injectGlobals = (content, globals, urlInfo) => {
  if (urlInfo.type === "html") {
    return globalInjectorOnHtml(content, globals, urlInfo);
  }
  if (urlInfo.type === "js_classic" || urlInfo.type === "js_module") {
    return globalsInjectorOnJs(content, globals, urlInfo);
  }
  throw new Error(`cannot inject globals into "${urlInfo.type}"`);
};
const globalInjectorOnHtml = (content, globals, urlInfo) => {
  // ideally we would inject an importmap but browser support is too low
  // (even worse for worker/service worker)
  // so for now we inject code into entry points
  const htmlAst = parseHtml({
    html: content,
    url: urlInfo.url,
    storeOriginalPositions: false,
  });
  const clientCode = generateClientCodeForGlobals(globals, {
    isWebWorker: false,
  });
  injectJsenvScript(htmlAst, {
    content: clientCode,
    pluginName: "jsenv:inject_globals",
  });
  return {
    content: stringifyHtmlAst(htmlAst),
  };
};
const globalsInjectorOnJs = (content, globals, urlInfo) => {
  const clientCode = generateClientCodeForGlobals(globals, {
    isWebWorker:
      urlInfo.subtype === "worker" ||
      urlInfo.subtype === "service_worker" ||
      urlInfo.subtype === "shared_worker",
  });
  const magicSource = createMagicSource(content);
  magicSource.prepend(clientCode);
  return magicSource.toContentAndSourcemap();
};
const generateClientCodeForGlobals = (globals, { isWebWorker = false }) => {
  const globalName = isWebWorker ? "self" : "window";
  return `Object.assign(${globalName}, ${JSON.stringify(
    globals,
    null,
    "  ",
  )});`;
};

const defineGettersOnPropertiesDerivedFromOriginalContent = (
  urlInfo,
) => {
  const originalContentAstDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "originalContentAst",
  );
  if (originalContentAstDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "originalContentAst", () => {
      return getContentAst(urlInfo.originalContent, urlInfo.type, urlInfo.url);
    });
  }
  const originalContentEtagDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "originalContentEtag",
  );
  if (originalContentEtagDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "originalContentEtag", () => {
      return bufferToEtag(Buffer.from(urlInfo.originalContent));
    });
  }
};

const defineGettersOnPropertiesDerivedFromContent = (urlInfo) => {
  const contentLengthDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "contentLength",
  );
  if (contentLengthDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "contentLength", () => {
      return Buffer.byteLength(urlInfo.content);
    });
  }
  const contentAstDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "contentAst",
  );
  if (contentAstDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "contentAst", () => {
      if (urlInfo.content === urlInfo.originalContent) {
        return urlInfo.originalContentAst;
      }
      const ast = getContentAst(urlInfo.content, urlInfo.type, urlInfo.url);
      return ast;
    });
  }
  const contentEtagDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "contentEtag",
  );
  if (contentEtagDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "contentEtag", () => {
      if (urlInfo.content === urlInfo.originalContent) {
        return urlInfo.originalContentEtag;
      }
      return getContentEtag(urlInfo.content);
    });
  }
};

const defineVolatileGetter = (object, property, getter) => {
  const restore = (value) => {
    Object.defineProperty(object, property, {
      enumerable: true,
      configurable: true,
      writable: true,
      value,
    });
  };

  Object.defineProperty(object, property, {
    enumerable: true,
    configurable: true,
    get: () => {
      const value = getter();
      restore(value);
      return value;
    },
    set: restore,
  });
};

const getContentAst = (content, type, url) => {
  if (type === "js_module") {
    return parseJsWithAcorn({
      js: content,
      url,
      isJsModule: true,
    });
  }
  if (type === "js_classic") {
    return parseJsWithAcorn({
      js: content,
      url,
    });
  }
  return null;
};

const getContentEtag = (content) => {
  return bufferToEtag(Buffer.from(content));
};

const createUrlInfoTransformer = ({
  logger,
  sourcemaps,
  sourcemapsComment,
  sourcemapsSources,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent = true,
  outDirectoryUrl,
  supervisor,
}) => {
  const formatSourcemapSource =
    typeof sourcemapsSources === "function"
      ? (source, urlInfo) => {
          return sourcemapsSources(source, urlInfo);
        }
      : sourcemapsSources === "relative"
        ? (source, urlInfo) => {
            const sourceRelative = urlToRelativeUrl(source, urlInfo.url);
            return sourceRelative || ".";
          }
        : null;

  const normalizeSourcemap = (urlInfo, sourcemap) => {
    let { sources } = sourcemap;
    if (sources) {
      sources = sources.map((source) => {
        if (source && isFileSystemPath(source)) {
          return String(pathToFileURL(source));
        }
        return source;
      });
    }
    const wantSourcesContent =
      // for inline content (<script> insdide html)
      // chrome won't be able to fetch the file as it does not exists
      // so sourcemap must contain sources
      sourcemapsSourcesContent ||
      urlInfo.isInline ||
      (sources &&
        sources.some((source) => !source || !source.startsWith("file:")));
    if (sources && sources.length > 1) {
      sourcemap.sources = sources.map(
        (source) => new URL(source, urlInfo.originalUrl).href,
      );
      if (!wantSourcesContent) {
        sourcemap.sourcesContent = undefined;
      }
      return sourcemap;
    }
    sourcemap.sources = [urlInfo.originalUrl];
    sourcemap.sourcesContent = [urlInfo.originalContent];
    if (!wantSourcesContent) {
      sourcemap.sourcesContent = undefined;
    }
    return sourcemap;
  };

  const resetContent = (urlInfo) => {
    urlInfo.contentFinalized = false;
    urlInfo.originalContent = undefined;
    urlInfo.originalContentAst = undefined;
    urlInfo.originalContentEtag = undefined;
    urlInfo.contentAst = undefined;
    urlInfo.contentEtag = undefined;
    urlInfo.contentLength = undefined;
    urlInfo.content = undefined;
    urlInfo.sourcemap = null;
    urlInfo.sourcemapIsWrong = null;
    urlInfo.sourcemapReference = null;
  };

  const setContentProperties = (
    urlInfo,
    { content, contentAst, contentEtag, contentLength },
  ) => {
    if (content === urlInfo.content) {
      return false;
    }
    urlInfo.contentAst = contentAst;
    urlInfo.contentEtag = contentEtag;
    urlInfo.contentLength = contentLength;
    urlInfo.content = content;
    defineGettersOnPropertiesDerivedFromContent(urlInfo);
    return true;
  };

  const setContent = async (
    urlInfo,
    content,
    {
      contentAst, // most of the time will be undefined
      contentEtag, // in practice it's always undefined
      contentLength,
      originalContent = content,
      originalContentAst, // most of the time will be undefined
      originalContentEtag, // in practice always undefined
      sourcemap,
    } = {},
  ) => {
    urlInfo.originalContentAst = originalContentAst;
    urlInfo.originalContentEtag = originalContentEtag;
    if (originalContent !== urlInfo.originalContent) {
      urlInfo.originalContent = originalContent;
    }
    defineGettersOnPropertiesDerivedFromOriginalContent(urlInfo);

    let may = mayHaveSourcemap(urlInfo);
    let shouldHandle = shouldHandleSourcemap(urlInfo);
    if (may && !shouldHandle) {
      content = SOURCEMAP.removeComment({
        contentType: urlInfo.contentType,
        content,
      });
    }
    setContentProperties(urlInfo, {
      content,
      contentAst,
      contentEtag,
      contentLength,
    });
    urlInfo.sourcemap = sourcemap;
    if (!may || !shouldHandle) {
      return;
    }

    // case #1: already loaded during "load" hook
    // - happens during build
    // - happens for url converted during fetch (js_module_fallback for instance)
    if (urlInfo.sourcemap) {
      urlInfo.sourcemap = normalizeSourcemap(urlInfo, urlInfo.sourcemap);
      return;
    }

    // case #2: check for existing sourcemap for this content
    const sourcemapFound = SOURCEMAP.readComment({
      contentType: urlInfo.contentType,
      content: urlInfo.content,
    });
    if (sourcemapFound) {
      const { type, subtype, line, column, specifier } = sourcemapFound;
      const sourcemapReference = urlInfo.dependencies.found({
        type,
        subtype,
        expectedType: "sourcemap",
        specifier,
        specifierLine: line,
        specifierColumn: column,
      });
      urlInfo.sourcemapReference = sourcemapReference;
      try {
        await sourcemapReference.urlInfo.cook();
        const sourcemapRaw = JSON.parse(sourcemapReference.urlInfo.content);
        const sourcemap = normalizeSourcemap(urlInfo, sourcemapRaw);
        urlInfo.sourcemap = sourcemap;
        return;
      } catch (e) {
        logger.error(`Error while handling existing sourcemap: ${e.message}`);
        return;
      }
    }

    // case #3: will be injected once cooked
  };

  const applyTransformations = (urlInfo, transformations) => {
    if (!transformations) {
      return;
    }
    const {
      type,
      contentType,
      content,
      contentAst, // undefined most of the time
      contentEtag, // in practice always undefined
      contentLength,
      sourcemap,
      sourcemapIsWrong,
      contentInjections,
    } = transformations;
    if (type) {
      urlInfo.type = type;
    }
    if (contentType) {
      urlInfo.contentType = contentType;
    }
    if (Object.hasOwn(transformations, "contentInjections")) {
      if (contentInjections) {
        Object.assign(urlInfo.contentInjections, contentInjections);
      }
      if (content === undefined) {
        return;
      }
    }
    let contentModified;
    if (Object.hasOwn(transformations, "content")) {
      contentModified = setContentProperties(urlInfo, {
        content,
        contentAst,
        contentEtag,
        contentLength,
      });
    }
    if (
      sourcemap &&
      mayHaveSourcemap(urlInfo) &&
      shouldHandleSourcemap(urlInfo)
    ) {
      const sourcemapNormalized = normalizeSourcemap(urlInfo, sourcemap);
      let currentSourcemap = urlInfo.sourcemap;
      const finalSourcemap = composeTwoSourcemaps(
        currentSourcemap,
        sourcemapNormalized,
      );
      const finalSourcemapNormalized = normalizeSourcemap(
        urlInfo,
        finalSourcemap,
      );
      urlInfo.sourcemap = finalSourcemapNormalized;
      // A plugin is allowed to modify url content
      // without returning a sourcemap
      // This is the case for preact and react plugins.
      // They are currently generating wrong source mappings
      // when used.
      // Generating the correct sourcemap in this situation
      // is a nightmare no-one could solve in years so
      // jsenv won't emit a warning and use the following strategy:
      // "no sourcemap is better than wrong sourcemap"
      urlInfo.sourcemapIsWrong = urlInfo.sourcemapIsWrong || sourcemapIsWrong;
    }
    if (contentModified && urlInfo.contentFinalized) {
      applyContentEffects(urlInfo);
    }
  };

  const applyContentEffects = (urlInfo) => {
    applySourcemapOnContent(urlInfo);
    writeInsideOutDirectory(urlInfo);
  };

  const writeInsideOutDirectory = (urlInfo) => {
    // writing result inside ".jsenv" directory (debug purposes)
    if (!outDirectoryUrl) {
      return;
    }
    const { generatedUrl } = urlInfo;
    if (!generatedUrl) {
      return;
    }
    if (!generatedUrl.startsWith("file:")) {
      return;
    }
    if (urlToPathname(generatedUrl).endsWith("/")) {
      // when users explicitely request a directory
      // we can't write the content returned by the server in ".jsenv" at that url
      // because it would try to write a directory
      // ideally we would decide a filename for this
      // for now we just don't write anything
      return;
    }
    if (urlInfo.type === "directory") {
      // no need to write the directory
      return;
    }
    // if (urlInfo.content === undefined) {
    //   // Some error might lead to urlInfo.content to be null
    //   // (error hapenning before urlInfo.content can be set, or 404 for instance)
    //   // in that case we can't write anything
    //   return;
    // }

    let contentIsInlined = urlInfo.isInline;
    if (
      contentIsInlined &&
      supervisor &&
      urlInfo.graph.getUrlInfo(urlInfo.inlineUrlSite.url).type === "html"
    ) {
      contentIsInlined = false;
    }
    if (!contentIsInlined) {
      const generatedUrlObject = new URL(generatedUrl);
      let baseName = urlToBasename(generatedUrlObject);
      for (const [key, value] of generatedUrlObject.searchParams) {
        baseName += `7${encodeFilePathComponent(key)}=${encodeFilePathComponent(value)}`;
      }
      const outFileUrl = setUrlBasename(generatedUrlObject, baseName);
      let outFilePath = urlToFileSystemPath(outFileUrl);
      outFilePath = truncate(outFilePath, 2055); // for windows
      writeFileSync(outFilePath, urlInfo.content, { force: true });
    }
    const { sourcemapGeneratedUrl, sourcemapReference } = urlInfo;
    if (sourcemapGeneratedUrl && sourcemapReference) {
      writeFileSync(
        new URL(sourcemapGeneratedUrl),
        sourcemapReference.urlInfo.content,
      );
    }
  };

  const applySourcemapOnContent = (
    urlInfo,
    formatSource = formatSourcemapSource,
  ) => {
    if (!urlInfo.sourcemap || !shouldHandleSourcemap(urlInfo)) {
      return;
    }

    // during build this function can be called after the file is cooked
    // - to update content and sourcemap after "optimize" hook
    // - to inject versioning into the entry point content
    // in this scenarion we don't want to inject sourcemap reference
    // just update the content

    let sourcemapReference = urlInfo.sourcemapReference;
    if (!sourcemapReference) {
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (referenceToOther.type === "sourcemap_comment") {
          sourcemapReference = referenceToOther;
          break;
        }
      }
      if (!sourcemapReference) {
        sourcemapReference = urlInfo.dependencies.inject({
          trace: {
            message: `sourcemap comment placeholder`,
            url: urlInfo.url,
          },
          type: "sourcemap_comment",
          subtype: urlInfo.contentType === "text/javascript" ? "js" : "css",
          expectedType: "sourcemap",
          specifier: urlInfo.sourcemapGeneratedUrl,
          isInline: sourcemaps === "inline",
        });
      }
      urlInfo.sourcemapReference = sourcemapReference;
    }
    const sourcemapUrlInfo = sourcemapReference.urlInfo;
    // It's possible urlInfo content to be modified after being finalized
    // In that case we'll recompose sourcemaps (and re-append it to file content)
    // Recomposition is done on urlInfo.sourcemap and must be done with absolute urls inside .sources
    // (so we can detect if sources are identical)
    // For this reason we must not mutate urlInfo.sourcemap.sources
    const sourcemapGenerated = {
      ...urlInfo.sourcemap,
      sources: urlInfo.sourcemap.sources.map((source) => {
        const sourceFormatted = formatSource
          ? formatSource(source, urlInfo)
          : source;
        if (sourcemapsSourcesProtocol) {
          if (sourceFormatted.startsWith("file:///")) {
            return `${sourcemapsSourcesProtocol}${sourceFormatted.slice(
              "file:///".length,
            )}`;
          }
        }
        return sourceFormatted;
      }),
    };
    sourcemapUrlInfo.type = "sourcemap";
    sourcemapUrlInfo.contentType = "application/json";
    setContentProperties(sourcemapUrlInfo, {
      content: JSON.stringify(sourcemapGenerated, null, "  "),
    });

    if (!urlInfo.sourcemapIsWrong) {
      if (sourcemaps === "inline") {
        sourcemapReference.generatedSpecifier =
          generateSourcemapDataUrl(sourcemapGenerated);
      }
      if (shouldUpdateSourcemapComment(urlInfo, sourcemaps)) {
        let specifier;
        if (sourcemaps === "file" && sourcemapsComment === "relative") {
          specifier = urlToRelativeUrl(
            sourcemapReference.generatedUrl,
            urlInfo.generatedUrl,
          );
        } else {
          specifier = sourcemapReference.generatedSpecifier;
        }
        setContentProperties(urlInfo, {
          content: SOURCEMAP.writeComment({
            contentType: urlInfo.contentType,
            content: urlInfo.content,
            specifier,
          }),
        });
      }
    }
  };

  const endTransformations = (urlInfo, transformations) => {
    if (transformations) {
      applyTransformations(urlInfo, transformations);
    }
    const { contentInjections } = urlInfo;
    if (contentInjections && Object.keys(contentInjections).length > 0) {
      const injectionTransformations = applyContentInjections(
        urlInfo.content,
        contentInjections,
        urlInfo,
      );
      applyTransformations(urlInfo, injectionTransformations);
    }
    applyContentEffects(urlInfo);
    urlInfo.contentFinalized = true;
  };

  return {
    resetContent,
    setContent,
    applyTransformations,
    applySourcemapOnContent,
    endTransformations,
  };
};

// https://gist.github.com/barbietunnie/7bc6d48a424446c44ff4
const illegalRe = /[/?<>\\:*|"]/g;
// eslint-disable-next-line no-control-regex
const controlRe = /[\x00-\x1f\x80-\x9f]/g;
const reservedRe = /^\.+$/;
const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const encodeFilePathComponent = (input, replacement = "") => {
  const encoded = input
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(windowsReservedRe, replacement);
  return encoded;
};
const truncate = (sanitized, length) => {
  const uint8Array = new TextEncoder().encode(sanitized);
  const truncated = uint8Array.slice(0, length);
  return new TextDecoder().decode(truncated);
};

const shouldUpdateSourcemapComment = (urlInfo, sourcemaps) => {
  if (urlInfo.context.buildStep === "shape") {
    return false;
  }
  if (sourcemaps === "file" || sourcemaps === "inline") {
    return true;
  }
  return false;
};
const mayHaveSourcemap = (urlInfo) => {
  if (urlInfo.url.startsWith("data:")) {
    return false;
  }
  if (!SOURCEMAP.enabledOnContentType(urlInfo.contentType)) {
    return false;
  }
  return true;
};
const shouldHandleSourcemap = (urlInfo) => {
  const { sourcemaps } = urlInfo.context;
  if (
    sourcemaps !== "inline" &&
    sourcemaps !== "file" &&
    sourcemaps !== "programmatic"
  ) {
    return false;
  }
  return true;
};

const inlineContentClientFileUrl = import.meta
  .resolve("../client/inline_content/inline_content.js");

const createKitchen = ({
  name,
  signal,
  logLevel,

  rootDirectoryUrl,
  mainFilePath,
  dev = false,
  build = false,
  runtimeCompat,
  mode,

  ignore,
  ignoreProtocol = "remove",
  supportedProtocols = [
    "file:",
    "data:",
    // eslint-disable-next-line no-script-url
    "javascript:",
    "virtual:",
    "ignore:",
    "http:",
    "https:",
    "chrome:",
    "chrome-extension:",
    "chrome-untrusted:",
    "isolated-app:",
  ],
  includedProtocols = [
    "file:",
    "data:",
    "virtual:",
    "ignore:",
    "http:",
    "https:",
  ],

  // during dev/test clientRuntimeCompat is a single runtime
  // during build clientRuntimeCompat is runtimeCompat
  clientRuntimeCompat = runtimeCompat,
  supervisor,
  sourcemaps = dev ? "inline" : "none", // "programmatic" and "file" also allowed
  sourcemapsComment,
  sourcemapsSources,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  outDirectoryUrl,
  initialContext = {},
  packageDirectory,
  packageDependencies,
}) => {
  const logger = createLogger({ logLevel });

  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
  const packageConditions = [nodeRuntimeEnabled ? "node" : "browser", "import"];
  if (nodeRuntimeEnabled) {
    supportedProtocols.push("node:");
  }

  if (packageDependencies === "auto") {
    packageDependencies =
      build && (nodeRuntimeEnabled || mode === "package")
        ? "ignore"
        : "include";
  }

  const kitchen = {
    context: {
      ...initialContext,
      kitchen: null,
      signal,
      logger,
      rootDirectoryUrl,
      mainFilePath,
      packageDirectory,
      dev,
      build,
      runtimeCompat,
      clientRuntimeCompat,
      inlineContentClientFileUrl,
      isSupportedOnCurrentClients: memoizeIsSupported(clientRuntimeCompat),
      isSupportedOnFutureClients: memoizeIsSupported(runtimeCompat),
      isPlaceholderInjection,
      asServerUrl: (fileUrl) =>
        FILE_AND_SERVER_URLS_CONVERTER.asServerUrl(fileUrl, rootDirectoryUrl),
      asFileUrl: (serverUrl) =>
        FILE_AND_SERVER_URLS_CONVERTER.asFileUrl(serverUrl, rootDirectoryUrl),
      INJECTIONS,
      getPluginMeta: null,
      sourcemaps,
      outDirectoryUrl,
    },
    resolve: (specifier, importer = rootDirectoryUrl) => {
      const { url, packageDirectoryUrl, packageJson } = applyNodeEsmResolution({
        conditions: packageConditions,
        parentUrl: importer,
        specifier,
        lookupPackageScope: packageDirectory.find,
        readPackageJson: packageDirectory.read,
      });
      return { url, packageDirectoryUrl, packageJson };
    },
    graph: null,
    urlInfoTransformer: null,
    pluginController: null,
  };
  const kitchenContext = kitchen.context;
  kitchenContext.kitchen = kitchen;

  let pluginController;
  kitchen.setPluginController = (value) => {
    pluginController = kitchen.pluginController = value;
  };

  const graph = createUrlGraph({
    name,
    rootDirectoryUrl,
    kitchen,
  });
  graph.urlInfoCreatedEventEmitter.on((urlInfoCreated) => {
    pluginController.callHooks("urlInfoCreated", urlInfoCreated, () => {});
  });
  kitchen.graph = graph;

  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    sourcemaps,
    sourcemapsComment,
    sourcemapsSources,
    sourcemapsSourcesProtocol,
    sourcemapsSourcesContent,
    outDirectoryUrl,
    supervisor,
  });
  kitchen.urlInfoTransformer = urlInfoTransformer;

  const isIgnoredByProtocol = (url) => {
    const { protocol } = new URL(url);
    const protocolIsIncluded = includedProtocols.includes(protocol);
    if (protocolIsIncluded) {
      return false;
    }
    return true;
  };
  const isIgnoredBecauseInPackageDependencies = (() => {
    if (packageDependencies === undefined) {
      return FUNCTION_RETURNING_FALSE;
    }
    if (packageDependencies === "include") {
      return FUNCTION_RETURNING_FALSE;
    }
    if (!packageDirectory.url) {
      return FUNCTION_RETURNING_FALSE;
    }
    const rootPackageJSON = packageDirectory.read(packageDirectory.url);
    if (!rootPackageJSON) {
      return FUNCTION_RETURNING_FALSE;
    }
    const { dependencies = {}, optionalDependencies = {} } = rootPackageJSON;
    const dependencyKeys = Object.keys(dependencies);
    const optionalDependencyKeys = Object.keys(optionalDependencies);
    const dependencySet = new Set([
      ...dependencyKeys,
      ...optionalDependencyKeys,
    ]);
    if (dependencySet.size === 0) {
      return FUNCTION_RETURNING_FALSE;
    }

    let getEffect;
    if (packageDependencies === "ignore") {
      getEffect = (dependencyName) => {
        if (!dependencySet.has(dependencyName)) {
          return "include";
        }
        return "ignore";
      };
    } else if (typeof packageDependencies === "object") {
      let defaultEffect = "ignore";
      const dependencyEffectMap = new Map();
      for (const dependencyKey of Object.keys(packageDependencies)) {
        const dependencyEffect = packageDependencies[dependencyKey];
        if (dependencyKey === "*") {
          defaultEffect = dependencyEffect;
        } else {
          dependencyEffectMap.set(dependencyKey, dependencyEffect);
        }
      }
      getEffect = (dependencyName) => {
        if (!dependencySet.has(dependencyName)) {
          return "include";
        }
        const dependencyEffect = packageDependencies[dependencyName];
        if (dependencyEffect) {
          return dependencyEffect;
        }
        return defaultEffect;
      };
    }
    return (url) => {
      if (!url.startsWith("file:")) {
        return false;
      }
      const packageDirectoryUrl = packageDirectory.find(url);
      if (!packageDirectoryUrl) {
        return false;
      }
      const packageJSON = packageDirectory.read(packageDirectoryUrl);
      const name = packageJSON?.name;
      if (!name) {
        return false;
      }
      const effect = getEffect(name);
      if (effect !== "ignore") {
        return false;
      }
      return true;
    };
  })();

  let isIgnoredByParam = () => false;
  if (ignore) {
    const associations = URL_META.resolveAssociations(
      { ignore },
      rootDirectoryUrl,
    );
    const cache = new Map();
    isIgnoredByParam = (url) => {
      const fromCache = cache.get(url);
      if (fromCache) return fromCache;
      const { ignore } = URL_META.applyAssociations({
        url,
        associations,
      });
      cache.set(url, ignore);
      return ignore;
    };
  }
  const isIgnored = (url) => {
    return (
      isIgnoredByProtocol(url) ||
      isIgnoredByParam(url) ||
      isIgnoredBecauseInPackageDependencies(url)
    );
  };
  const resolveReference = (reference) => {
    const setReferenceUrl = (referenceUrl) => {
      // ignored urls are prefixed with "ignore:" so that reference are associated
      // to a dedicated urlInfo that is ignored.
      // this way it's only once a resource is referenced by reference that is not ignored
      // that the resource is cooked
      if (
        reference.specifier[0] === "#" &&
        // For Html, css and "#" refer to a resource in the page, reference must be preserved
        // However for js import specifiers they have a different meaning and we want
        // to resolve them (https://nodejs.org/api/packages.html#imports for instance)
        reference.type !== "js_import"
      ) {
        referenceUrl = `ignore:${referenceUrl}`;
      } else if (
        reference.url && reference.original
          ? isIgnored(reference.original.url)
          : isIgnored(referenceUrl)
      ) {
        if (
          referenceUrl.startsWith("node:") &&
          !reference.specifier.startsWith("node:")
        ) {
          reference.specifier = `node:${reference.specifier}`;
        }
        referenceUrl = `ignore:${referenceUrl}`;
      }

      if (
        referenceUrl.startsWith("ignore:") &&
        !reference.specifier.startsWith("ignore:")
      ) {
        reference.specifier = `ignore:${reference.specifier}`;
      }
      Object.defineProperty(reference, "url", {
        enumerable: true,
        configurable: false,
        writable: false,
        value: referenceUrl,
      });
      reference.searchParams = new URL(referenceUrl).searchParams;
    };

    try {
      resolve: {
        if (reference.url) {
          setReferenceUrl(reference.url);
          break resolve;
        }
        const resolvedUrl = pluginController.callHooksUntil(
          "resolveReference",
          reference,
        );
        if (!resolvedUrl) {
          throw new Error(`NO_RESOLVE`);
        }
        if (resolvedUrl.includes("?debug")) {
          reference.debug = true;
        }
        const normalizedUrl = normalizeUrl(resolvedUrl);
        setReferenceUrl(normalizedUrl);
        if (reference.debug) {
          logger.debug(`url resolved by "${
            pluginController.getLastPluginUsed().name
          }"
${ANSI.color(reference.specifier, ANSI.GREY)} ->
${ANSI.color(reference.url, ANSI.YELLOW)}
`);
        }
      }
      redirect: {
        if (reference.isImplicit && reference.isWeak) {
          // not needed for implicit references that are not rendered anywhere
          // this condition excludes:
          // - side_effect_file references injected in entry points or at the top of files
          break redirect;
        }
        pluginController.callHooks(
          "redirectReference",
          reference,
          (returnValue, plugin, setReference) => {
            const normalizedReturnValue = normalizeUrl(returnValue);
            if (normalizedReturnValue === reference.url) {
              return;
            }
            if (reference.debug) {
              logger.debug(
                `url redirected by "${plugin.name}"
${ANSI.color(reference.url, ANSI.GREY)} ->
${ANSI.color(normalizedReturnValue, ANSI.YELLOW)}
`,
              );
            }
            const referenceRedirected = reference.redirect(
              normalizedReturnValue,
            );
            reference = referenceRedirected;
            setReferenceUrl(normalizedReturnValue);
            setReference(referenceRedirected);
          },
        );
      }
      reference.generatedUrl = reference.url;
      reference.generatedSearchParams = reference.searchParams;
      if (dev) {
        let url = reference.url;
        let { protocol } = new URL(url);
        if (protocol === "ignore:") {
          url = url.slice("ignore:".length);
          protocol = new URL(url, "http://example.com").protocol;
        }
        if (!supportedProtocols.includes(protocol)) {
          const protocolNotSupportedError = new Error(
            `Unsupported protocol "${protocol}" for url "${url}"`,
          );
          protocolNotSupportedError.code = "PROTOCOL_NOT_SUPPORTED";
          throw protocolNotSupportedError;
        }
      }
      return reference;
    } catch (error) {
      throw createResolveUrlError({
        pluginController,
        reference,
        error,
      });
    }
  };
  kitchenContext.resolveReference = resolveReference;

  const finalizeReference = (reference) => {
    const urlInfo = reference.urlInfo;
    urlInfo.generatedUrl = determineFileUrlForOutDirectory(urlInfo);
    urlInfo.sourcemapGeneratedUrl = determineSourcemapFileUrl(urlInfo);

    if (reference.isImplicit && reference.isWeak) {
      // not needed for implicit references that are not rendered anywhere
      // this condition excludes:
      // - side_effect_file references injected in entry points or at the top of files
      return;
    }
    {
      // This hook must touch reference.generatedUrl, NOT reference.url
      // And this is because this hook inject query params used to:
      // - bypass browser cache (?v)
      // - convey information (?hot)
      // But do not represent an other resource, it is considered as
      // the same resource under the hood
      const searchParamTransformationMap = new Map();
      pluginController.callHooks(
        "transformReferenceSearchParams",
        reference,
        (returnValue) => {
          Object.keys(returnValue).forEach((key) => {
            searchParamTransformationMap.set(key, returnValue[key]);
          });
        },
      );
      if (searchParamTransformationMap.size) {
        const generatedSearchParams = new URLSearchParams(
          reference.searchParams,
        );
        searchParamTransformationMap.forEach((value, key) => {
          if (value === undefined) {
            generatedSearchParams.delete(key);
          } else {
            generatedSearchParams.set(key, value);
          }
        });
        const generatedUrlObject = new URL(reference.url);
        const generatedSearch = generatedSearchParams.toString();
        generatedUrlObject.search = generatedSearch;
        reference.generatedUrl = normalizeUrl(generatedUrlObject.href);
        reference.generatedSearchParams = generatedSearchParams;
      }
    }
    {
      const returnValue = pluginController.callHooksUntil(
        "formatReference",
        reference,
      );
      if (reference.url.startsWith("ignore:")) {
        if (ignoreProtocol === "remove") {
          reference.specifier = reference.specifier.slice("ignore:".length);
        }
        reference.generatedSpecifier = reference.specifier;
        reference.generatedSpecifier = urlSpecifierEncoding.encode(reference);
      } else {
        reference.generatedSpecifier = returnValue || reference.generatedUrl;
        reference.generatedSpecifier = urlSpecifierEncoding.encode(reference);
      }
    }
  };
  kitchenContext.finalizeReference = finalizeReference;

  const fetchUrlContent = async (urlInfo) => {
    try {
      const fetchUrlContentReturnValue =
        await pluginController.callAsyncHooksUntil("fetchUrlContent", urlInfo);
      if (!fetchUrlContentReturnValue) {
        logger.warn(
          createDetailedMessage(
            `no plugin has handled url during "fetchUrlContent" hook -> url will be ignored`,
            {
              "url": urlInfo.url,
              "url reference trace": urlInfo.firstReference?.trace.message,
            },
          ),
        );
        return;
      }
      let {
        content,
        contentType,
        originalContent = content,
        data,
        type,
        subtype,
        originalUrl,
        sourcemap,

        status = 200,
        headers = {},
        body,
        isEntryPoint,
        isDynamicEntryPoint,
        filenameHint,
        contentSideEffects,
      } = fetchUrlContentReturnValue;
      if (content === undefined) {
        content = body;
      }
      if (contentType === undefined) {
        contentType = headers["content-type"] || "application/octet-stream";
      }
      if (filenameHint) {
        urlInfo.filenameHint = filenameHint;
      }
      urlInfo.status = status;
      urlInfo.contentType = contentType;
      urlInfo.headers = headers;
      urlInfo.type = type || inferUrlInfoType(urlInfo);
      urlInfo.subtype =
        subtype ||
        urlInfo.firstReference.expectedSubtype ||
        urlInfo.subtypeHint ||
        "";
      // during build urls info are reused and load returns originalUrl/originalContent
      urlInfo.originalUrl = originalUrl
        ? String(originalUrl)
        : urlInfo.originalUrl;
      if (data) {
        Object.assign(urlInfo.data, data);
      }
      if (typeof isEntryPoint === "boolean") {
        urlInfo.isEntryPoint = isEntryPoint;
      }
      if (typeof isDynamicEntryPoint === "boolean") {
        urlInfo.isDynamicEntryPoint = isDynamicEntryPoint;
      }
      if (contentSideEffects) {
        urlInfo.contentSideEffects = contentSideEffects;
      }
      assertFetchedContentCompliance({
        urlInfo,
        content,
      });

      // we wait here to read .contentAst and .originalContentAst
      // so that we don't trigger lazy getters
      // that would try to parse url too soon (before having urlInfo.type being set)
      // also we do not want to trigger the getters that would parse url content
      // too soon
      const contentAstDescriptor = Object.getOwnPropertyDescriptor(
        fetchUrlContentReturnValue,
        "contentAst",
      );
      const originalContentAstDescriptor = Object.getOwnPropertyDescriptor(
        fetchUrlContentReturnValue,
        "originalContentAst",
      );
      await urlInfoTransformer.setContent(urlInfo, content, {
        sourcemap,
        originalContent,
        contentAst: contentAstDescriptor
          ? contentAstDescriptor.get
            ? undefined
            : contentAstDescriptor.value
          : undefined,
        originalContentAst: originalContentAstDescriptor
          ? originalContentAstDescriptor.get
            ? undefined
            : originalContentAstDescriptor.value
          : undefined,
      });
    } catch (error) {
      throw createFetchUrlContentError({
        pluginController,
        urlInfo,
        error,
      });
    }
  };
  kitchenContext.fetchUrlContent = fetchUrlContent;

  const transformUrlContent = async (urlInfo) => {
    try {
      await pluginController.callAsyncHooks(
        "transformUrlContent",
        urlInfo,
        (transformReturnValue) => {
          urlInfoTransformer.applyTransformations(
            urlInfo,
            transformReturnValue,
          );
        },
      );
    } catch (error) {
      const transformError = createTransformUrlContentError({
        pluginController,
        urlInfo,
        error,
      });
      throw transformError;
    }
  };
  kitchenContext.transformUrlContent = transformUrlContent;

  const finalizeUrlContent = async (urlInfo) => {
    try {
      await urlInfo.applyContentTransformationCallbacks();
      const finalizeReturnValue = await pluginController.callAsyncHooksUntil(
        "finalizeUrlContent",
        urlInfo,
      );
      urlInfoTransformer.endTransformations(urlInfo, finalizeReturnValue);
    } catch (error) {
      throw createFinalizeUrlContentError({
        pluginController,
        urlInfo,
        error,
      });
    }
  };
  kitchenContext.finalizeUrlContent = finalizeUrlContent;

  const cookGuard = dev ? debounceCook : memoizeCook;
  const cook = cookGuard(async (urlInfo, contextDuringCook) => {
    if (contextDuringCook) {
      Object.assign(urlInfo.context, contextDuringCook);
    }

    // urlInfo objects are reused, they must be "reset" before cooking them again
    if (urlInfo.error || urlInfo.content !== undefined) {
      urlInfo.error = null;
      urlInfo.type = null;
      urlInfo.subtype = null;
      urlInfo.timing = {};
      urlInfoTransformer.resetContent(urlInfo);
    }

    if (!urlInfo.url.startsWith("ignore:")) {
      try {
        await urlInfo.dependencies.startCollecting(async () => {
          // "fetchUrlContent" hook
          await urlInfo.fetchContent();

          // "transform" hook
          await urlInfo.transformContent();

          // "finalize" hook
          await urlInfo.finalizeContent();
        });
      } catch (e) {
        urlInfo.error = e;
        if (urlInfo.isInline) {
          const parentUrlInfo = urlInfo.findParentIfInline();
          parentUrlInfo.error = e;
        }
        let errorWrapperMessage;
        if (e.code === "PARSE_ERROR") {
          errorWrapperMessage =
            e.name === "TRANSFORM_URL_CONTENT_ERROR"
              ? e.message
              : `parse error on "${urlInfo.type}"
${e.trace?.message}
${e.reason}
--- declared in ---
${urlInfo.firstReference.trace.message}`;
        } else if (e.isJsenvCookingError) {
          errorWrapperMessage = e.message;
        } else {
          errorWrapperMessage = `Error while cooking ${urlInfo.type}
${urlInfo.firstReference.trace.message}`;
        }
        // if we are cooking inline content during dev it's better not to throw
        // because the main url info (html) is still valid and can be returned to the browser
        if (
          urlInfo.isInline &&
          urlInfo.context.dev &&
          // but if we are explicitely requesting inline content file then we throw
          // to properly send 500 to the browser
          urlInfo.context.reference !== urlInfo.url
        ) {
          logger.error(errorWrapperMessage);
          return;
        }
        if (e.isJsenvCookingError) {
          throw e;
        }
        const error = new Error(errorWrapperMessage, { cause: e });
        defineNonEnumerableProperties(error, {
          __INTERNAL_ERROR__: true,
        });
        throw error;
      }
    }

    // "cooked" hook
    pluginController.callHooks("cooked", urlInfo, (cookedReturnValue) => {
      if (typeof cookedReturnValue === "function") {
        const removeCallback = urlInfo.graph.urlInfoDereferencedEventEmitter.on(
          (urlInfoDereferenced, lastReferenceFromOther) => {
            if (urlInfoDereferenced === urlInfo) {
              removeCallback();
              cookedReturnValue(lastReferenceFromOther.urlInfo);
            }
          },
        );
      }
    });
  });
  kitchenContext.cook = cook;

  const lastTransformationCallbacks = [];
  const addLastTransformationCallback = (callback) => {
    lastTransformationCallbacks.push(callback);
  };
  kitchenContext.addLastTransformationCallback = addLastTransformationCallback;

  const cookDependencies = async (
    urlInfo,
    { operation, ignoreDynamicImport } = {},
  ) => {
    const seen = new Set();

    const cookSelfThenDependencies = async (urlInfo) => {
      if (operation) {
        operation.throwIfAborted();
      }
      if (seen.has(urlInfo)) {
        return;
      }
      seen.add(urlInfo);
      await urlInfo.cook();
      await startCookingDependencies(urlInfo);
    };

    const startCookingDependencies = async (urlInfo) => {
      const dependencyPromises = [];
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (referenceToOther.type === "sourcemap_comment") {
          // we don't cook sourcemap reference by sourcemap comments
          // because this is already done in "initTransformations"
          continue;
        }
        if (referenceToOther.isWeak) {
          // we don't cook weak references (resource hints mostly)
          // because they might refer to resource that will be modified during build
          // It also means something else have to reference that url in order to cook it
          // so that the preload is deleted by "resync_resource_hints.js" otherwise
          continue;
        }
        if (referenceToOther.isImplicit) {
          // implicit reference are not auto cooked
          // when needed code is explicitely cooking/fetching the underlying url
          continue;
        }
        if (
          ignoreDynamicImport &&
          referenceToOther.subtype === "import_dynamic"
        ) {
          continue;
        }
        const referencedUrlInfo = referenceToOther.urlInfo;
        const dependencyPromise = cookSelfThenDependencies(referencedUrlInfo);
        dependencyPromises.push(dependencyPromise);
      }
      await Promise.all(dependencyPromises);
    };

    await startCookingDependencies(urlInfo);
    await Promise.all(
      lastTransformationCallbacks.map(async (callback) => {
        await callback();
      }),
    );
    lastTransformationCallbacks.length = 0;
  };
  kitchenContext.cookDependencies = cookDependencies;

  return kitchen;
};

const FUNCTION_RETURNING_FALSE = () => false;

const debounceCook = (cook) => {
  const pendingDishes = new Map();
  return async (urlInfo, context) => {
    const { url, modifiedTimestamp } = urlInfo;
    const pendingDish = pendingDishes.get(url);
    if (pendingDish) {
      if (!modifiedTimestamp) {
        await pendingDish.promise;
        return;
      }
      if (pendingDish.timestamp > modifiedTimestamp) {
        await pendingDish.promise;
        return;
      }
      pendingDishes.delete(url);
    }
    const timestamp = Date.now();
    const promise = cook(urlInfo, context);
    pendingDishes.set(url, {
      timestamp,
      promise,
    });
    try {
      await promise;
    } finally {
      pendingDishes.delete(url);
    }
  };
};

const memoizeCook = (cook) => {
  const urlInfoCache = new Map();
  return async (urlInfo, context) => {
    const fromCache = urlInfoCache.get(urlInfo);
    if (fromCache) {
      await fromCache;
      return;
    }
    let resolveCookPromise;
    const promise = new Promise((resolve) => {
      resolveCookPromise = resolve;
    });
    urlInfoCache.set(urlInfo, promise);
    await cook(urlInfo, context);
    resolveCookPromise();
  };
};

const memoizeIsSupported = (runtimeCompat) => {
  const cache = new Map();
  return (feature, featureCompat) => {
    const fromCache = cache.get(feature);
    if (typeof fromCache === "boolean") {
      return fromCache;
    }
    const supported = RUNTIME_COMPAT.isSupported(
      runtimeCompat,
      feature,
      featureCompat,
    );
    cache.set(feature, supported);
    return supported;
  };
};

const inferUrlInfoType = (urlInfo) => {
  const { type, typeHint } = urlInfo;
  const mediaType = CONTENT_TYPE.asMediaType(urlInfo.contentType);
  const { expectedType } = urlInfo.firstReference;
  if (typeHint === "asset") {
    return "asset";
  }
  if (type === "sourcemap" || typeHint === "sourcemap") {
    return "sourcemap";
  }
  if (mediaType === "text/html") {
    return "html";
  }
  if (mediaType === "text/css") {
    return "css";
  }
  if (mediaType === "text/javascript") {
    if (expectedType === "js_classic") {
      return "js_classic";
    }
    if (typeHint === "js_classic") {
      return "js_classic";
    }
    return "js_module";
  }
  if (mediaType === "application/importmap+json") {
    return "importmap";
  }
  if (mediaType === "application/manifest+json") {
    return "webmanifest";
  }
  if (mediaType === "image/svg+xml") {
    return "svg";
  }
  if (CONTENT_TYPE.isJson(mediaType)) {
    return "json";
  }
  if (CONTENT_TYPE.isTextual(mediaType)) {
    return "text";
  }
  return expectedType || "other";
};

const createPackageDirectory = ({
  sourceDirectoryUrl,
  lookupPackageDirectory: lookupPackageDirectory$1 = lookupPackageDirectory,
}) => {
  const packageDirectory = {
    url: lookupPackageDirectory$1(sourceDirectoryUrl),
    find: (url) => {
      const urlString = typeof url === "string" ? url : url?.href;
      if (!urlString.startsWith("file:")) {
        return null;
      }
      return lookupPackageDirectory$1(url);
    },
    read: readPackageAtOrNull,
  };
  return packageDirectory;
};

const jsenvPluginHtmlSyntaxErrorFallback = () => {
  const htmlSyntaxErrorFileUrl = import.meta
    .resolve("../client/html_syntax_error/html_syntax_error.html");

  return {
    mustStayFirst: true,
    name: "jsenv:html_syntax_error_fallback",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        try {
          parseHtml({
            html: urlInfo.content,
            url: urlInfo.url,
          });
          return null;
        } catch (e) {
          if (e.code !== "PARSE_ERROR") {
            return null;
          }
          const line = e.line;
          const column = e.column;
          const htmlErrorContentFrame = generateContentFrame({
            content: urlInfo.content,
            line,
            column,
          });
          urlInfo.kitchen.context.logger
            .error(`Error while handling ${urlInfo.context.request ? urlInfo.context.request.url : urlInfo.url}:
${e.reasonCode}
${urlInfo.url}:${line}:${column}
${htmlErrorContentFrame}`);
          const html = generateHtmlForSyntaxError(e, {
            htmlUrl: urlInfo.url,
            rootDirectoryUrl: urlInfo.context.rootDirectoryUrl,
            htmlErrorContentFrame,
            htmlSyntaxErrorFileUrl,
          });
          return html;
        }
      },
    },
  };
};

const generateHtmlForSyntaxError = (
  htmlSyntaxError,
  { htmlUrl, rootDirectoryUrl, htmlErrorContentFrame, htmlSyntaxErrorFileUrl },
) => {
  const htmlForSyntaxError = String(
    readFileSync(new URL(htmlSyntaxErrorFileUrl)),
  );
  const htmlRelativeUrl = urlToRelativeUrl(htmlUrl, rootDirectoryUrl);
  const { line, column } = htmlSyntaxError;
  if (htmlUrl.startsWith(jsenvCoreDirectoryUrl.href)) {
    htmlUrl = urlToRelativeUrl(htmlUrl, jsenvCoreDirectoryUrl);
    htmlUrl = `@jsenv/core/${htmlUrl}`;
  }
  const urlWithLineAndColumn = `${htmlUrl}:${line}:${column}`;
  const replacers = {
    fileRelativeUrl: htmlRelativeUrl,
    reasonCode: htmlSyntaxError.reasonCode,
    errorLinkHref: `javascript:window.fetch('/.internal/open_file/${encodeURIComponent(
      urlWithLineAndColumn,
    )}')`,
    errorLinkText: `${htmlRelativeUrl}:${line}:${column}`,
    syntaxErrorHTML: errorToHTML(htmlErrorContentFrame),
  };
  const html = replacePlaceholders(htmlForSyntaxError, replacers);
  return html;
};
const replacePlaceholders = (html, replacers) => {
  return html.replace(/\$\{(\w+)\}/g, (match, name) => {
    const replacer = replacers[name];
    if (replacer === undefined) {
      return match;
    }
    if (typeof replacer === "function") {
      return replacer();
    }
    return replacer;
  });
};

const createPluginStore = async (plugins) => {
  const allDevServerRoutes = [];
  const allDevServerServices = [];
  const pluginArray = [];

  const pluginPromises = [];
  const addPlugin = async (plugin) => {
    if (plugin && typeof plugin.then === "function") {
      pluginPromises.push(plugin);
      const value = await plugin;
      addPlugin(value);
      return;
    }
    if (Array.isArray(plugin)) {
      for (const subplugin of plugin) {
        addPlugin(subplugin);
      }
      return;
    }
    if (plugin === null || typeof plugin !== "object") {
      throw new TypeError(`plugin must be objects, got ${plugin}`);
    }
    if (!plugin.name) {
      plugin.name = "anonymous";
    }
    if (plugin.devServerRoutes) {
      const devServerRoutes = plugin.devServerRoutes;
      for (const devServerRoute of devServerRoutes) {
        allDevServerRoutes.push(devServerRoute);
      }
    }
    if (plugin.devServerServices) {
      const devServerServices = plugin.devServerServices;
      for (const devServerService of devServerServices) {
        allDevServerServices.push(devServerService);
      }
    }
    pluginArray.push(plugin);
  };
  addPlugin(jsenvPluginHtmlSyntaxErrorFallback());
  for (const plugin of plugins) {
    addPlugin(plugin);
  }
  await Promise.all(pluginPromises);

  return {
    pluginArray,
    allDevServerRoutes,
    allDevServerServices,
  };
};

const createPluginController = async (
  pluginStore,
  kitchen,
  { initialPuginsMeta = {} } = {},
) => {
  const pluginsMeta = initialPuginsMeta;
  kitchen.context.getPluginMeta = (id) => {
    const value = pluginsMeta[id];
    return value;
  };

  // precompute a list of hooks per hookName because:
  // 1. [MAJOR REASON] when debugging, there is less iteration (so much better)
  // 2. [MINOR REASON] it should increase perf as there is less work to do
  const hookSetMap = new Map();
  const pluginCandidates = pluginStore.pluginArray;
  const activePluginArray = [];
  const pluginWithEffectCandidateForActivationArray = [];
  for (const pluginCandidate of pluginCandidates) {
    if (!testAppliesDuring(pluginCandidate, kitchen)) {
      pluginCandidate.destroy?.();
      continue;
    }
    const initPluginResult = await initPlugin(pluginCandidate, kitchen);
    if (!initPluginResult) {
      pluginCandidate.destroy?.();
      continue;
    }
    if (pluginCandidate.effect) {
      pluginWithEffectCandidateForActivationArray.push(pluginCandidate);
    } else {
      activePluginArray.push(pluginCandidate);
    }
  }

  const activeEffectSet = new Set();
  for (const pluginWithEffectCandidateForActivation of pluginWithEffectCandidateForActivationArray) {
    const returnValue = pluginWithEffectCandidateForActivation.effect({
      kitchenContext: kitchen.context,
      otherPlugins: activePluginArray,
    });
    if (!returnValue) {
      continue;
    }
    activePluginArray.push(pluginWithEffectCandidateForActivation);
    activeEffectSet.add({
      plugin: pluginWithEffectCandidateForActivation,
      cleanup: typeof returnValue === "function" ? returnValue : () => {},
    });
  }
  activePluginArray.sort((a, b) => {
    return pluginCandidates.indexOf(a) - pluginCandidates.indexOf(b);
  });
  for (const activePlugin of activePluginArray) {
    for (const key of Object.keys(activePlugin)) {
      if (key === "meta") {
        const value = activePlugin[key];
        if (typeof value !== "object" || value === null) {
          console.warn(`plugin.meta must be an object, got ${value}`);
          continue;
        }
        Object.assign(pluginsMeta, value);
        // any extension/modification on plugin.meta
        // won't be taken into account so we freeze object
        // to throw in case it happen
        Object.freeze(value);
        continue;
      }
      if (
        key === "name" ||
        key === "appliesDuring" ||
        key === "init" ||
        key === "serverEvents" ||
        key === "mustStayFirst" ||
        key === "devServerRoutes" ||
        key === "devServerServices" ||
        key === "effect"
      ) {
        continue;
      }
      const isHook = HOOK_NAMES.includes(key);
      if (!isHook) {
        console.warn(
          `Unexpected "${key}" property on "${activePlugin.name}" plugin`,
        );
        continue;
      }
      const hookName = key;
      const hookValue = activePlugin[hookName];
      if (hookValue) {
        let hookSet = hookSetMap.get(hookName);
        if (!hookSet) {
          hookSet = new Set();
          hookSetMap.set(hookName, hookSet);
        }
        const hook = {
          plugin: activePlugin,
          name: hookName,
          value: hookValue,
        };
        // if (position === "start") {
        //   let i = 0;
        //   while (i < group.length) {
        //     const before = group[i];
        //     if (!before.plugin.mustStayFirst) {
        //       break;
        //     }
        //     i++;
        //   }
        //   group.splice(i, 0, hook);
        // } else {
        hookSet.add(hook);
      }
    }
  }

  let lastPluginUsed = null;
  let currentPlugin = null;
  let currentHookName = null;
  const callHook = (hook, info) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    let startTimestamp;
    if (info.timing) {
      startTimestamp = performance.now();
    }
    lastPluginUsed = hook.plugin;
    currentPlugin = hook.plugin;
    currentHookName = hook.name;
    let valueReturned = hookFn(info);
    if (info.timing) {
      info.timing[`${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`] =
        performance.now() - startTimestamp;
    }
    valueReturned = assertAndNormalizeReturnValue(hook, valueReturned, info);
    currentPlugin = null;
    currentHookName = null;
    return valueReturned;
  };
  const callAsyncHook = async (hook, info) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }

    let startTimestamp;
    if (info.timing) {
      startTimestamp = performance.now();
    }
    lastPluginUsed = hook.plugin;
    currentPlugin = hook.plugin;
    currentHookName = hook.name;
    let valueReturned = await hookFn(info);
    if (info.timing) {
      info.timing[`${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`] =
        performance.now() - startTimestamp;
    }
    valueReturned = assertAndNormalizeReturnValue(hook, valueReturned, info);
    currentPlugin = null;
    currentHookName = null;
    return valueReturned;
  };
  const callHooks = (hookName, info, callback) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    const setHookParams = (firstArg = info) => {
      info = firstArg;
    };
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info);
      if (returnValue && callback) {
        callback(returnValue, hook.plugin, setHookParams);
      }
    }
  };
  const callAsyncHooks = async (hookName, info, callback, options) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    for (const hook of hookSet) {
      const returnValue = await callAsyncHook(hook, info);
      if (returnValue && callback) {
        await callback(returnValue, hook.plugin);
      }
    }
  };
  const callHooksUntil = (hookName, info) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return null;
    }
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info);
      if (returnValue) {
        return returnValue;
      }
    }
    return null;
  };
  const callAsyncHooksUntil = async (hookName, info, options) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return null;
    }
    if (hookSet.size === 0) {
      return null;
    }
    const iterator = hookSet.values()[Symbol.iterator]();
    let result;
    const visit = async () => {
      const { done, value: hook } = iterator.next();
      if (done) {
        return;
      }
      const returnValue = await callAsyncHook(hook, info);
      if (returnValue) {
        result = returnValue;
        return;
      }
      await visit();
    };
    await visit();
    return result;
  };

  return {
    activePlugins: activePluginArray,

    callHook,
    callAsyncHook,
    callHooks,
    callHooksUntil,
    callAsyncHooks,
    callAsyncHooksUntil,

    getLastPluginUsed: () => lastPluginUsed,
    getCurrentPlugin: () => currentPlugin,
    getCurrentHookName: () => currentHookName,
  };
};

const HOOK_NAMES = [
  "init",
  "devServerRoutes", // is called only during dev/tests
  "devServerServices", // is called only during dev/tests
  "resolveReference",
  "redirectReference",
  "transformReferenceSearchParams",
  "formatReference",
  "urlInfoCreated",
  "fetchUrlContent",
  "transformUrlContent",
  "finalizeUrlContent",
  "bundle", // is called only during build
  "optimizeBuildUrlContent", // is called only during build
  "cooked",
  "augmentResponse", // is called only during dev/tests
  "destroy",
  "effect",
  "refineBuildUrlContent", // called only during build
  "refineBuild", // called only during build
];

const testAppliesDuring = (plugin, kitchen) => {
  const { appliesDuring } = plugin;
  if (appliesDuring === undefined) {
    // console.debug(`"appliesDuring" is undefined on ${pluginEntry.name}`)
    return true;
  }
  if (appliesDuring === "*") {
    return true;
  }
  if (typeof appliesDuring === "string") {
    if (appliesDuring !== "dev" && appliesDuring !== "build") {
      throw new TypeError(
        `"appliesDuring" must be "dev" or "build", got ${appliesDuring}`,
      );
    }
    if (kitchen.context[appliesDuring]) {
      return true;
    }
    return false;
  }
  if (typeof appliesDuring === "object") {
    for (const key of Object.keys(appliesDuring)) {
      if (!appliesDuring[key] && kitchen.context[key]) {
        return false;
      }
      if (appliesDuring[key] && kitchen.context[key]) {
        return true;
      }
    }
    // throw new Error(`"appliesDuring" is empty`)
    return false;
  }
  throw new TypeError(
    `"appliesDuring" must be an object or a string, got ${appliesDuring}`,
  );
};
const initPlugin = async (plugin, kitchen) => {
  const { init } = plugin;
  if (!init) {
    return true;
  }
  const initReturnValue = await init(kitchen.context, { plugin });
  if (initReturnValue === false) {
    return false;
  }
  if (typeof initReturnValue === "function" && !plugin.destroy) {
    plugin.destroy = initReturnValue;
  }
  return true;
};
const getHookFunction = (
  hook,
  // can be undefined, reference, or urlInfo
  info = {},
) => {
  const hookValue = hook.value;
  if (typeof hookValue === "object") {
    const hookForType = hookValue[info.type] || hookValue["*"];
    if (!hookForType) {
      return null;
    }
    return hookForType;
  }
  return hookValue;
};

const assertAndNormalizeReturnValue = (hook, returnValue, info) => {
  // all hooks are allowed to return null/undefined as a signal of "I don't do anything"
  if (returnValue === null || returnValue === undefined) {
    return returnValue;
  }
  for (const returnValueAssertion of returnValueAssertions) {
    if (!returnValueAssertion.appliesTo.includes(hook.name)) {
      continue;
    }
    const assertionResult = returnValueAssertion.assertion(returnValue, info, {
      hook,
    });
    if (assertionResult !== undefined) {
      // normalization
      returnValue = assertionResult;
      break;
    }
  }
  return returnValue;
};
const returnValueAssertions = [
  {
    name: "url_assertion",
    appliesTo: ["resolveReference", "redirectReference"],
    assertion: (valueReturned, urlInfo, { hook }) => {
      if (valueReturned instanceof URL) {
        return valueReturned.href;
      }
      if (typeof valueReturned === "string") {
        return undefined;
      }
      throw new Error(
        `Unexpected value returned by "${hook.plugin.name}" plugin: it must be a string; got ${valueReturned}`,
      );
    },
  },
  {
    name: "content_assertion",
    appliesTo: [
      "fetchUrlContent",
      "transformUrlContent",
      "finalizeUrlContent",
      "optimizeBuildUrlContent",
    ],
    assertion: (valueReturned, urlInfo, { hook }) => {
      if (typeof valueReturned === "string" || Buffer.isBuffer(valueReturned)) {
        return { content: valueReturned };
      }
      if (typeof valueReturned === "object") {
        const { content, body } = valueReturned;
        if (urlInfo.url.startsWith("ignore:")) {
          return undefined;
        }
        if (typeof content !== "string" && !Buffer.isBuffer(content) && !body) {
          if (Object.hasOwn(valueReturned, "contentInjections")) {
            return undefined;
          }
          throw new Error(
            `Unexpected "content" returned by "${hook.plugin.name}" ${hook.name} hook: it must be a string or a buffer; got ${content}`,
          );
        }
        return undefined;
      }
      throw new Error(
        `Unexpected value returned by "${hook.plugin.name}" ${hook.name} hook: it must be a string, a buffer or an object; got ${valueReturned}`,
      );
    },
  },
];

/*
 * https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/css/src/CSSTransformer.js
 */


const jsenvPluginCssReferenceAnalysis = () => {
  return {
    name: "jsenv:css_reference_analysis",
    appliesDuring: "*",
    transformUrlContent: {
      css: parseAndTransformCssUrls,
    },
  };
};

const parseAndTransformCssUrls = async (urlInfo) => {
  const cssUrls = await parseCssUrls({
    css: urlInfo.content,
    url: urlInfo.originalUrl,
  });
  const actions = [];
  const magicSource = createMagicSource(urlInfo.content);
  for (const cssUrl of cssUrls) {
    const reference = urlInfo.dependencies.found({
      type: cssUrl.type,
      specifier: cssUrl.specifier,
      specifierStart: cssUrl.start,
      specifierEnd: cssUrl.end,
      specifierLine: cssUrl.line,
      specifierColumn: cssUrl.column,
    });
    actions.push(async () => {
      await reference.readGeneratedSpecifier();
      const replacement = reference.generatedSpecifier;
      magicSource.replace({
        start: cssUrl.start,
        end: cssUrl.end,
        replacement,
      });
    });
  }
  if (actions.length > 0) {
    await Promise.all(actions.map((action) => action()));
  }
  return magicSource.toContentAndSourcemap();
};

const jsenvPluginDataUrlsAnalysis = () => {
  const cookDataUrl = async (reference) => {
    const urlInfo = reference.urlInfo;
    await urlInfo.cook();
    if (urlInfo.originalContent === urlInfo.content) {
      return reference.generatedUrl;
    }
    const specifier = DATA_URL.stringify({
      contentType: urlInfo.contentType,
      base64Flag: urlInfo.data.base64Flag,
      data: urlInfo.data.base64Flag
        ? dataToBase64$1(urlInfo.content)
        : String(urlInfo.content),
    });
    return specifier;
  };

  return {
    name: "jsenv:data_urls_analysis",
    appliesDuring: "*",
    resolveReference: (reference) => {
      if (!reference.specifier.startsWith("data:")) {
        return null;
      }
      return reference.specifier;
    },
    formatReference: (reference) => {
      if (!reference.generatedUrl.startsWith("data:")) {
        return null;
      }
      if (reference.type === "sourcemap_comment") {
        return null;
      }
      return cookDataUrl(reference);
    },
    fetchUrlContent: (urlInfo) => {
      if (!urlInfo.url.startsWith("data:")) {
        return null;
      }
      const {
        contentType,
        base64Flag,
        data: urlData,
      } = DATA_URL.parse(urlInfo.url);
      urlInfo.data.base64Flag = base64Flag;
      const content = contentFromUrlData({ contentType, base64Flag, urlData });
      return {
        content,
        contentType,
      };
    },
  };
};

const contentFromUrlData = ({ contentType, base64Flag, urlData }) => {
  if (CONTENT_TYPE.isTextual(contentType)) {
    if (base64Flag) {
      return base64ToString(urlData);
    }
    return urlData;
  }
  if (base64Flag) {
    return base64ToBuffer(urlData);
  }
  return Buffer.from(urlData);
};

const base64ToBuffer = (base64String) => Buffer.from(base64String, "base64");
const base64ToString = (base64String) =>
  Buffer.from(base64String, "base64").toString("utf8");
const dataToBase64$1 = (data) => Buffer.from(data).toString("base64");

const jsenvPluginDirectoryReferenceAnalysis = () => {
  return {
    name: "jsenv:directory_reference_analysis",
    transformUrlContent: {
      directory: async (urlInfo) => {
        if (urlInfo.contentType !== "application/json") {
          return null;
        }
        // const isShapeBuildStep = urlInfo.kitchen.context.buildStep === "shape";
        const originalDirectoryReference = findOriginalDirectoryReference(
          urlInfo.firstReference,
        );
        const directoryRelativeUrl = urlToRelativeUrl(
          urlInfo.url,
          urlInfo.context.rootDirectoryUrl,
        );
        const entryNames = JSON.parse(urlInfo.content);
        const newEntryNames = [];
        for (const entryName of entryNames) {
          const entryReference = urlInfo.dependencies.found({
            type: "filesystem",
            subtype: "directory_entry",
            specifier: entryName,
            trace: {
              message: `"${directoryRelativeUrl}${entryName}" entry in directory referenced by ${originalDirectoryReference.trace.message}`,
            },
          });
          await entryReference.readGeneratedSpecifier();
          const replacement = entryReference.generatedSpecifier;
          newEntryNames.push(replacement);
        }
        return JSON.stringify(newEntryNames);
      },
    },
  };
};

const findOriginalDirectoryReference = (firstReference) => {
  const findNonFileSystemAncestor = (urlInfo) => {
    for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
      if (referenceFromOther.type !== "filesystem") {
        return referenceFromOther;
      }
      return findNonFileSystemAncestor(referenceFromOther.ownerUrlInfo);
    }
    return null;
  };
  if (firstReference.type !== "filesystem") {
    return firstReference;
  }
  return findNonFileSystemAncestor(firstReference.ownerUrlInfo);
};

const jsenvPluginHtmlReferenceAnalysis = ({
  inlineContent,
  inlineConvertedScript,
}) => {
  /*
   * About importmap found in HTML files:
   * - feeds importmap files to jsenv kitchen
   * - use importmap to resolve import (when there is one + fallback to other resolution mecanism)
   * - inline importmap with [src=""]
   *
   * A correct importmap resolution should scope importmap resolution per html file.
   * It would be doable by adding ?html_id to each js file in order to track
   * the html file importing it.
   * Considering it happens only when all the following conditions are met:
   * - 2+ html files are using an importmap
   * - the importmap used is not the same
   * - the importmap contain conflicting mappings
   * - these html files are both executed during the same scenario (dev, test, build)
   * And that it would be ugly to see ?html_id all over the place
   * -> The importmap resolution implemented here takes a shortcut and does the following:
   * - All importmap found are merged into a single one that is applied to every import specifiers
   */

  let globalImportmap = null;
  const importmaps = {};
  let importmapLoadingCount = 0;
  const allImportmapLoadedCallbackSet = new Set();
  const startLoadingImportmap = (htmlUrlInfo) => {
    importmapLoadingCount++;
    return (importmapUrlInfo) => {
      const htmlUrl = htmlUrlInfo.url;
      if (importmapUrlInfo) {
        if (importmapUrlInfo.error) {
          importmaps[htmlUrl] = null;
        } else {
          // importmap was found in this HTML file and is known
          const importmap = JSON.parse(importmapUrlInfo.content);
          importmaps[htmlUrl] = normalizeImportMap(importmap, htmlUrl);
        }
      } else {
        // no importmap in this HTML file
        importmaps[htmlUrl] = null;
      }
      let importmapFinal = null;
      for (const url of Object.keys(importmaps)) {
        const importmap = importmaps[url];
        if (!importmap) {
          continue;
        }
        if (!importmapFinal) {
          importmapFinal = importmap;
          continue;
        }
        importmapFinal = composeTwoImportMaps(importmapFinal, importmap);
      }
      globalImportmap = importmapFinal;

      importmapLoadingCount--;
      if (importmapLoadingCount === 0) {
        for (const allImportmapLoadedCallback of allImportmapLoadedCallbackSet) {
          allImportmapLoadedCallback();
        }
        allImportmapLoadedCallbackSet.clear();
      }
    };
  };

  return {
    name: "jsenv:html_reference_analysis",
    appliesDuring: "*",
    resolveReference: {
      js_import: (reference) => {
        if (!globalImportmap) {
          return null;
        }
        try {
          let fromMapping = false;
          const result = resolveImport({
            specifier: reference.specifier,
            importer: reference.ownerUrlInfo.url,
            importMap: globalImportmap,
            onImportMapping: () => {
              fromMapping = true;
            },
          });
          if (fromMapping) {
            reference.data.fromMapping = true;
            return result;
          }
          return null;
        } catch (e) {
          if (e.message.includes("bare specifier")) {
            // in theory we should throw to be compliant with web behaviour
            // but for now it's simpler to return null
            // and let a chance to other plugins to handle the bare specifier
            // (node esm resolution)
            // and we want importmap to be prio over node esm so we cannot put this plugin after
            return null;
          }
          throw e;
        }
      },
    },
    transformUrlContent: {
      js_module: async () => {
        // wait for importmap if any
        // so that resolveReference can happen with importmap
        if (importmapLoadingCount) {
          await new Promise((resolve) => {
            allImportmapLoadedCallbackSet.add(resolve);
          });
        }
      },
      html: async (urlInfo) => {
        let importmapFound = false;
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const importmapLoaded = startLoadingImportmap(urlInfo);

        try {
          const mutations = [];
          const actions = [];
          const finalizeCallbacks = [];

          const createExternalReference = (
            node,
            attributeName,
            attributeValue,
            { type, subtype, expectedType, ...rest },
          ) => {
            let position;
            if (getHtmlNodeAttribute(node, "jsenv-cooked-by")) {
              // when generated from inline content,
              // line, column is not "src" nor "inlined-from-src" but "original-position"
              position = getHtmlNodePosition(node);
            } else {
              position = getHtmlNodeAttributePosition(node, attributeName);
            }
            const { line, column, originalLine, originalColumn } = position;
            const debug =
              getHtmlNodeAttribute(node, "jsenv-debug") !== undefined;

            const { crossorigin, integrity } = readFetchMetas(node);
            const isResourceHint = [
              "preconnect",
              "dns-prefetch",
              "prefetch",
              "preload",
              "modulepreload",
            ].includes(subtype);
            let attributeLocation =
              node.sourceCodeLocation.attrs[attributeName];
            if (
              !attributeLocation &&
              attributeName === "href" &&
              (node.tagName === "use" || node.tagName === "image")
            ) {
              attributeLocation = node.sourceCodeLocation.attrs["xlink:href"];
            }
            const attributeStart = attributeLocation.startOffset;
            const attributeValueStart = urlInfo.content.indexOf(
              attributeValue,
              attributeStart + `${attributeName}=`.length,
            );
            const attributeValueEnd =
              attributeValueStart + attributeValue.length;
            const reference = urlInfo.dependencies.found({
              type,
              subtype,
              expectedType,
              specifier: attributeValue,
              specifierLine: originalLine === undefined ? line : originalLine,
              specifierColumn:
                originalColumn === undefined ? column : originalColumn,
              specifierStart: attributeValueStart,
              specifierEnd: attributeValueEnd,
              isResourceHint,
              isWeak: isResourceHint,
              crossorigin,
              integrity,
              debug,
              astInfo: { node, attributeName },
              ...rest,
            });
            actions.push(async () => {
              await reference.readGeneratedSpecifier();
              mutations.push(() => {
                setHtmlNodeAttributes(node, {
                  [attributeName]: reference.generatedSpecifier,
                });
              });
            });
            return reference;
          };
          const visitHref = (node, referenceProps) => {
            const href = getHtmlNodeAttribute(node, "href");
            if (href) {
              return createExternalReference(
                node,
                "href",
                href,
                referenceProps,
              );
            }
            return null;
          };
          const visitSrc = (node, referenceProps) => {
            const src = getHtmlNodeAttribute(node, "src");
            if (src) {
              return createExternalReference(node, "src", src, referenceProps);
            }
            return null;
          };
          const visitSrcset = (node, referenceProps) => {
            const srcset = getHtmlNodeAttribute(node, "srcset");
            if (srcset) {
              const srcCandidates = parseSrcSet(srcset);
              return srcCandidates.map((srcCandidate) => {
                return createExternalReference(
                  node,
                  "srcset",
                  srcCandidate.specifier,
                  referenceProps,
                );
              });
            }
            return null;
          };
          const createInlineReference = (
            node,
            inlineContent,
            { type, subtype, expectedType, contentType },
          ) => {
            const hotAccept =
              getHtmlNodeAttribute(node, "hot-accept") !== undefined;
            const { line, column, isOriginal } = getHtmlNodePosition(node, {
              preferOriginal: true,
            });
            const inlineContentUrl = getUrlForContentInsideHtml(
              node,
              urlInfo,
              null,
            );
            const debug =
              getHtmlNodeAttribute(node, "jsenv-debug") !== undefined;
            const inlineReference = urlInfo.dependencies.foundInline({
              type,
              subtype,
              expectedType,
              isOriginalPosition: isOriginal,
              specifierLine: line,
              specifierColumn: column,
              specifier: inlineContentUrl,
              contentType,
              content: inlineContent,
              debug,
              astInfo: { node },
            });

            actions.push(async () => {
              const inlineUrlInfo = inlineReference.urlInfo;
              await inlineUrlInfo.cook();
              const typeAttribute = getHtmlNodeAttribute(node, "type");
              if (expectedType === "js_classic") {
                if (
                  typeAttribute !== undefined &&
                  typeAttribute !== "text/javascript"
                ) {
                  // 1. <script type="jsx"> becomes <script>
                  mutations.push(() => {
                    setHtmlNodeAttributes(node, {
                      "type": undefined,
                      "original-type": typeAttribute,
                    });
                  });
                }
              } else if (expectedType === "js_module") {
                // 2. <script type="module/jsx"> becomes <script type="module">
                if (typeAttribute !== "module") {
                  mutations.push(() => {
                    setHtmlNodeAttributes(node, {
                      "type": "module",
                      "original-type": typeAttribute,
                    });
                  });
                }
              }
              mutations.push(() => {
                if (hotAccept) {
                  removeHtmlNodeText(node);
                  setHtmlNodeAttributes(node, {
                    "jsenv-cooked-by": "jsenv:html_inline_content_analysis",
                  });
                } else {
                  setHtmlNodeText(node, inlineUrlInfo.content, {
                    indentation:
                      inlineUrlInfo.type === "js_classic" ||
                      inlineUrlInfo.type === "js_module"
                        ? // indentation would mess with stack trace and sourcemap
                          false
                        : "auto",
                  });
                  setHtmlNodeAttributes(node, {
                    "jsenv-cooked-by": "jsenv:html_inline_content_analysis",
                  });
                }
              });
            });
            return inlineReference;
          };
          const visitTextContent = (
            node,
            { type, subtype, expectedType, contentType },
          ) => {
            const inlineContent = getHtmlNodeText(node);
            if (!inlineContent) {
              return null;
            }
            return createInlineReference(node, inlineContent, {
              type,
              subtype,
              expectedType,
              contentType,
            });
          };

          visitNonIgnoredHtmlNode(htmlAst, {
            link: (linkNode) => {
              const rel = getHtmlNodeAttribute(linkNode, "rel");
              const type = getHtmlNodeAttribute(linkNode, "type");
              const ref = visitHref(linkNode, {
                type: "link_href",
                subtype: rel,
                // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#including_a_mime_type
                expectedContentType: type,
              });
              if (ref) {
                finalizeCallbacks.push(() => {
                  if (ref.expectedType) {
                    // might be set by other plugins, in that case respect it
                  } else {
                    ref.expectedType = decideLinkExpectedType(ref, urlInfo);
                  }
                });
              }
            },
            style: inlineContent
              ? (styleNode) => {
                  visitTextContent(styleNode, {
                    type: "style",
                    expectedType: "css",
                    contentType: "text/css",
                  });
                }
              : null,
            script: (scriptNode) => {
              const { type, subtype, contentType } =
                analyzeScriptNode(scriptNode);
              if (type === "text") {
                // ignore <script type="whatever">foobar</script>
                // per HTML spec https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-type
                return;
              }
              if (type === "importmap") {
                importmapFound = true;

                const src = getHtmlNodeAttribute(scriptNode, "src");
                if (src) {
                  // Browser would throw on remote importmap
                  // and won't sent a request to the server for it
                  // We must precook the importmap to know its content and inline it into the HTML
                  const importmapReference = createExternalReference(
                    scriptNode,
                    "src",
                    src,
                    {
                      type: "script",
                      subtype: "importmap",
                      expectedType: "importmap",
                    },
                  );
                  const { line, column, isOriginal } = getHtmlNodePosition(
                    scriptNode,
                    {
                      preferOriginal: true,
                    },
                  );
                  const importmapInlineUrl = getUrlForContentInsideHtml(
                    scriptNode,
                    urlInfo,
                    importmapReference,
                  );
                  const importmapReferenceInlined = importmapReference.inline({
                    line,
                    column,
                    isOriginal,
                    specifier: importmapInlineUrl,
                    contentType: "application/importmap+json",
                  });
                  const importmapInlineUrlInfo =
                    importmapReferenceInlined.urlInfo;
                  actions.push(async () => {
                    try {
                      await importmapInlineUrlInfo.cook();
                    } finally {
                      importmapLoaded(importmapInlineUrlInfo);
                    }
                    mutations.push(() => {
                      if (importmapInlineUrlInfo.error) {
                        return;
                      }
                      setHtmlNodeText(
                        scriptNode,
                        importmapInlineUrlInfo.content,
                        {
                          indentation: "auto",
                        },
                      );
                      setHtmlNodeAttributes(scriptNode, {
                        "src": undefined,
                        "jsenv-inlined-by": "jsenv:html_reference_analysis",
                        "inlined-from-src": importmapReference.url,
                      });
                    });
                  });
                } else {
                  const htmlNodeText = getHtmlNodeText(scriptNode);
                  if (htmlNodeText) {
                    const importmapReference = createInlineReference(
                      scriptNode,
                      htmlNodeText,
                      {
                        type: "script",
                        expectedType: "importmap",
                        contentType: "application/importmap+json",
                      },
                    );
                    const inlineImportmapUrlInfo = importmapReference.urlInfo;
                    actions.push(async () => {
                      try {
                        await inlineImportmapUrlInfo.cook();
                      } finally {
                        importmapLoaded(inlineImportmapUrlInfo);
                      }
                      mutations.push(() => {
                        setHtmlNodeText(
                          scriptNode,
                          inlineImportmapUrlInfo.content,
                          {
                            indentation: "auto",
                          },
                        );
                        setHtmlNodeAttributes(scriptNode, {
                          "jsenv-cooked-by": "jsenv:html_reference_analysis",
                        });
                      });
                    });
                  }
                }
                return;
              }
              const externalRef = visitSrc(scriptNode, {
                type: "script",
                subtype: type,
                expectedType: type,
              });
              if (externalRef) {
                return;
              }

              // now visit the content, if any
              if (!inlineContent) {
                return;
              }
              // If the inline script was already handled by an other plugin, ignore it
              // - we want to preserve inline scripts generated by html supervisor during dev
              // - we want to avoid cooking twice a script during build
              if (
                !inlineConvertedScript &&
                getHtmlNodeAttribute(scriptNode, "jsenv-injected-by") ===
                  "jsenv:js_module_fallback"
              ) {
                return;
              }
              visitTextContent(scriptNode, {
                type: "script",
                subtype,
                expectedType: type,
                contentType,
              });
            },
            a: (aNode) => {
              visitHref(aNode, {
                type: "a_href",
              });
            },
            iframe: (iframeNode) => {
              visitSrc(iframeNode, {
                type: "iframe_src",
              });
            },
            img: (imgNode) => {
              visitSrc(imgNode, {
                type: "img_src",
              });
              visitSrcset(imgNode, {
                type: "img_srcset",
              });
            },
            source: (sourceNode) => {
              visitSrc(sourceNode, {
                type: "source_src",
              });
              visitSrcset(sourceNode, {
                type: "source_srcset",
              });
            },
            // svg <image> tag
            image: (imageNode) => {
              visitHref(imageNode, {
                type: "image_href",
              });
            },
            use: (useNode) => {
              visitHref(useNode, {
                type: "use_href",
              });
            },
          });
          if (!importmapFound) {
            importmapLoaded();
          }
          finalizeCallbacks.forEach((finalizeCallback) => {
            finalizeCallback();
          });

          if (actions.length > 0) {
            await Promise.all(actions.map((action) => action()));
            actions.length = 0;
          }
          if (mutations.length === 0) {
            return null;
          }
          mutations.forEach((mutation) => mutation());
          mutations.length = 0;
          const html = stringifyHtmlAst(htmlAst);
          return html;
        } catch (e) {
          importmapLoaded();
          throw e;
        }
      },
    },
  };
};

const visitNonIgnoredHtmlNode = (htmlAst, visitors) => {
  const visitorsInstrumented = {};
  for (const key of Object.keys(visitors)) {
    visitorsInstrumented[key] = (node) => {
      const jsenvIgnoreAttribute = getHtmlNodeAttribute(node, "jsenv-ignore");
      if (jsenvIgnoreAttribute !== undefined) {
        return;
      }
      visitors[key](node);
    };
  }
  visitHtmlNodes(htmlAst, visitorsInstrumented);
};

const crossOriginCompatibleTagNames = ["script", "link", "img", "source"];
const integrityCompatibleTagNames = ["script", "link", "img", "source"];
const readFetchMetas = (node) => {
  const meta = {};
  if (crossOriginCompatibleTagNames.includes(node.nodeName)) {
    const crossorigin = getHtmlNodeAttribute(node, "crossorigin") !== undefined;
    meta.crossorigin = crossorigin;
  }
  if (integrityCompatibleTagNames.includes(node.nodeName)) {
    const integrity = getHtmlNodeAttribute(node, "integrity");
    meta.integrity = integrity;
  }
  return meta;
};

const decideLinkExpectedType = (linkReference, htmlUrlInfo) => {
  const rel = getHtmlNodeAttribute(linkReference.astInfo.node, "rel");
  if (rel === "webmanifest") {
    return "webmanifest";
  }
  if (rel === "modulepreload") {
    return "js_module";
  }
  if (rel === "stylesheet") {
    return "css";
  }
  if (rel === "preload") {
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#what_types_of_content_can_be_preloaded
    const as = getHtmlNodeAttribute(linkReference.astInfo.node, "as");
    if (as === "document") {
      return "html";
    }
    if (as === "style") {
      return "css";
    }
    if (as === "script") {
      for (const referenceToOther of htmlUrlInfo.referenceToOthersSet) {
        if (referenceToOther.url !== linkReference.url) {
          continue;
        }
        if (referenceToOther.type !== "script") {
          continue;
        }
        return referenceToOther.expectedType;
      }
      return undefined;
    }
  }
  return undefined;
};

// const applyWebUrlResolution = (url, baseUrl) => {
//   if (url[0] === "/") {
//     return new URL(url.slice(1), baseUrl).href;
//   }
//   return new URL(url, baseUrl).href;
// };

// the following apis are creating js entry points:
// - new Worker()
// - new SharedWorker()
// - navigator.serviceWorker.register()
const isWebWorkerEntryPointReference = (reference) => {
  if (reference.subtype === "new_url_first_arg") {
    return ["worker", "service_worker", "shared_worker"].includes(
      reference.expectedSubtype,
    );
  }
  return [
    "new_worker_first_arg",
    "new_shared_worker_first_arg",
    "service_worker_register_first_arg",
  ].includes(reference.subtype);
};

const isWebWorkerUrlInfo = (urlInfo) => {
  return (
    urlInfo.subtype === "worker" ||
    urlInfo.subtype === "service_worker" ||
    urlInfo.subtype === "shared_worker"
  );
};

// export const isEntryPoint = (urlInfo, urlGraph) => {
//   if (urlInfo.data.isEntryPoint) {
//     return true
//   }
//   if (isWebWorker(urlInfo)) {
//     // - new Worker("a.js") -> "a.js" is an entry point
//     // - self.importScripts("b.js") -> "b.js" is not an entry point
//     // So the following logic applies to infer if the file is a web worker entry point
//     // "When a non-webworker file references a worker file, the worker file is an entry point"
//     const dependents = Array.from(urlInfo.dependents)
//     return dependents.some((dependentUrl) => {
//       const dependentUrlInfo = urlGraph.getUrlInfo(dependentUrl)
//       return !isWebWorker(dependentUrlInfo)
//     })
//   }
//   return false
// }

const jsenvPluginJsReferenceAnalysis = ({ inlineContent }) => {
  return [
    {
      name: "jsenv:js_reference_analysis",
      appliesDuring: "*",
      transformUrlContent: {
        js_classic: (urlInfo) => {
          return parseAndTransformJsReferences(urlInfo, {
            inlineContent,
            canUseTemplateLiterals:
              urlInfo.context.isSupportedOnCurrentClients("template_literals"),
          });
        },
        js_module: (urlInfo) => {
          return parseAndTransformJsReferences(urlInfo, {
            inlineContent,
            canUseTemplateLiterals:
              urlInfo.context.isSupportedOnCurrentClients("template_literals"),
          });
        },
      },
    },
  ];
};

const parseAndTransformJsReferences = async (
  urlInfo,
  { inlineContent, canUseTemplateLiterals },
) => {
  const magicSource = createMagicSource(urlInfo.content);
  const parallelActions = [];
  const sequentialActions = [];
  const isNodeJs =
    Object.keys(urlInfo.context.runtimeCompat).toString() === "node";

  const onInlineReference = (inlineReferenceInfo) => {
    const inlineUrl = getUrlForContentInsideJs(inlineReferenceInfo, urlInfo);
    let { quote } = inlineReferenceInfo;
    if (quote === "`" && !canUseTemplateLiterals) {
      // if quote is "`" and template literals are not supported
      // we'll use a regular string (single or double quote)
      // when rendering the string
      quote = JS_QUOTES.pickBest(inlineReferenceInfo.content);
    }
    const inlineReference = urlInfo.dependencies.foundInline({
      type: "js_inline_content",
      subtype: inlineReferenceInfo.type, // "new_blob_first_arg", "new_inline_content_first_arg", "json_parse_first_arg"
      isOriginalPosition: urlInfo.content === urlInfo.originalContent,
      specifierLine: inlineReferenceInfo.line,
      specifierColumn: inlineReferenceInfo.column,
      specifier: inlineUrl,
      contentType: inlineReferenceInfo.contentType,
      content: inlineReferenceInfo.content,
    });
    const inlineUrlInfo = inlineReference.urlInfo;
    inlineUrlInfo.jsQuote = quote;
    inlineReference.escape = (value) => {
      return JS_QUOTES.escapeSpecialChars(value.slice(1, -1), { quote });
    };

    sequentialActions.push(async () => {
      await inlineUrlInfo.cook();
      const replacement = JS_QUOTES.escapeSpecialChars(inlineUrlInfo.content, {
        quote,
      });
      magicSource.replace({
        start: inlineReferenceInfo.start,
        end: inlineReferenceInfo.end,
        replacement,
      });
    });
  };
  const onExternalReference = (externalReferenceInfo) => {
    if (
      externalReferenceInfo.subtype === "import_static" ||
      externalReferenceInfo.subtype === "import_dynamic"
    ) {
      urlInfo.data.usesImport = true;
    }
    if (
      isNodeJs &&
      externalReferenceInfo.type === "js_url" &&
      externalReferenceInfo.expectedSubtype === "worker" &&
      externalReferenceInfo.expectedType === "js_classic" &&
      // TODO: it's true also if closest package.json
      // is type: module
      urlToExtension(
        new URL(externalReferenceInfo.specifier, urlInfo.url).href,
      ) === ".mjs"
    ) {
      externalReferenceInfo.expectedType = "js_module";
    }

    let filenameHint;
    if (
      externalReferenceInfo.subtype === "import_dynamic" &&
      isBareSpecifier$1(externalReferenceInfo.specifier)
    ) {
      filenameHint = `${externalReferenceInfo.specifier}.js`;
    }

    let isEntryPoint;
    let isDynamicEntryPoint;
    if (
      isNodeJs &&
      (externalReferenceInfo.type === "js_url" ||
        externalReferenceInfo.subtype === "import_meta_resolve")
    ) {
      isEntryPoint = true;
      isDynamicEntryPoint = true;
    } else if (
      isWebWorkerEntryPointReference({
        subtype: externalReferenceInfo.subtype,
        expectedSubtype: externalReferenceInfo.expectedSubtype,
      })
    ) {
      isEntryPoint = true;
    } else {
      isEntryPoint = false;
    }
    const reference = urlInfo.dependencies.found({
      type: externalReferenceInfo.type,
      subtype: externalReferenceInfo.subtype,
      expectedType: externalReferenceInfo.expectedType,
      expectedSubtype: externalReferenceInfo.expectedSubtype || urlInfo.subtype,
      specifier: externalReferenceInfo.specifier,
      specifierStart: externalReferenceInfo.start,
      specifierEnd: externalReferenceInfo.end,
      specifierLine: externalReferenceInfo.line,
      specifierColumn: externalReferenceInfo.column,
      data: externalReferenceInfo.data,
      baseUrl: {
        "StringLiteral": externalReferenceInfo.baseUrl,
        "window.location": urlInfo.url,
        "window.origin": urlInfo.context.rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
        "context.meta.url": urlInfo.url,
        "document.currentScript.src": urlInfo.url,
      }[externalReferenceInfo.baseUrlType],
      importAttributes: externalReferenceInfo.importAttributes,
      isSideEffectImport: externalReferenceInfo.isSideEffectImport,
      astInfo: externalReferenceInfo.astInfo,
      isEntryPoint,
      isDynamicEntryPoint,
      filenameHint,
    });

    parallelActions.push(async () => {
      await reference.readGeneratedSpecifier();
      const replacement = reference.generatedSpecifier;
      magicSource.replace({
        start: externalReferenceInfo.start,
        end: externalReferenceInfo.end,
        replacement,
      });
      if (reference.mutation) {
        reference.mutation(magicSource, urlInfo);
      }
    });
  };
  const jsReferenceInfos = parseJsUrls({
    js: urlInfo.content,
    url: urlInfo.originalUrl,
    ast: urlInfo.contentAst,
    isJsModule: urlInfo.type === "js_module",
    isWebWorker: isWebWorkerUrlInfo(urlInfo),
    inlineContent,
    isNodeJs,
  });
  for (const jsReferenceInfo of jsReferenceInfos) {
    if (jsReferenceInfo.isInline) {
      onInlineReference(jsReferenceInfo);
    } else {
      onExternalReference(jsReferenceInfo);
    }
  }
  if (parallelActions.length > 0) {
    await Promise.all(parallelActions.map((action) => action()));
  }
  for (const sequentialAction of sequentialActions) {
    await sequentialAction();
  }
  const { content, sourcemap } = magicSource.toContentAndSourcemap();
  return { content, sourcemap };
};

const isBareSpecifier$1 = (specifier) => {
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(specifier);
    return false;
  } catch {
    return true;
  }
};

const jsenvPluginReferenceExpectedTypes = () => {
  const redirectJsReference = (reference) => {
    const urlObject = new URL(reference.url);
    const { searchParams } = urlObject;

    if (searchParams.has("entry_point")) {
      reference.isEntryPoint = true;
    }
    if (searchParams.has("js_classic")) {
      reference.expectedType = "js_classic";
    } else if (searchParams.has("js_module")) {
      reference.expectedType = "js_module";
    }
    // we need to keep these checks here because during versioning:
    // - only reference anlysis plugin is executed
    //   -> plugin about js transpilation don't apply and can't set expectedType: 'js_classic'
    // - query params like ?js_module_fallback are still there
    // - without this check build would throw as reference could expect js module and find js classic
    else if (
      searchParams.has("js_module_fallback") ||
      searchParams.has("as_js_classic")
    ) {
      reference.expectedType = "js_classic";
    } else if (searchParams.has("as_js_module")) {
      reference.expectedType = "js_module";
    }
    // by default, js referenced by new URL is considered as "js_module"
    // in case this is not desired code must use "?js_classic" like
    // new URL('./file.js?js_classic', import.meta.url)
    else if (
      reference.type === "js_url" &&
      reference.expectedType === undefined &&
      CONTENT_TYPE.fromUrlExtension(reference.url) === "text/javascript"
    ) {
      reference.expectedType = "js_module";
    }

    if (searchParams.has("worker")) {
      reference.expectedSubtype = "worker";
    } else if (searchParams.has("service_worker")) {
      reference.expectedSubtype = "service_worker";
    } else if (searchParams.has("shared_worker")) {
      reference.expectedSubtype = "shared_worker";
    }
    return urlObject.href;
  };

  return {
    name: "jsenv:reference_expected_types",
    appliesDuring: "*",
    redirectReference: {
      script: redirectJsReference,
      js_url: redirectJsReference,
      js_import: redirectJsReference,
    },
  };
};

// css: parseAndTransformCssUrls,

const jsenvPluginWebmanifestReferenceAnalysis = () => {
  return {
    name: "jsenv:webmanifest_reference_analysis",
    appliesDuring: "*",
    transformUrlContent: {
      webmanifest: parseAndTransformWebmanifestUrls,
    },
  };
};

const parseAndTransformWebmanifestUrls = async (urlInfo) => {
  const content = urlInfo.content;
  const manifest = JSON.parse(content);
  const actions = [];
  const { icons = [] } = manifest;
  icons.forEach((icon) => {
    const iconReference = urlInfo.dependencies.found({
      type: "webmanifest_icon_src",
      specifier: icon.src,
    });
    actions.push(async () => {
      await iconReference.readGeneratedSpecifier();
      icon.src = iconReference.generatedSpecifier;
    });
  });

  if (actions.length === 0) {
    return null;
  }
  await Promise.all(actions.map((action) => action()));
  return JSON.stringify(manifest, null, "  ");
};

const jsenvPluginReferenceAnalysis = ({
  inlineContent = true,
  inlineConvertedScript = false,
  fetchInlineUrls = true,
}) => {
  return [
    jsenvPluginDirectoryReferenceAnalysis(),
    jsenvPluginHtmlReferenceAnalysis({
      inlineContent,
      inlineConvertedScript,
    }),
    jsenvPluginWebmanifestReferenceAnalysis(),
    jsenvPluginCssReferenceAnalysis(),
    jsenvPluginJsReferenceAnalysis({
      inlineContent,
    }),
    ...(inlineContent ? [jsenvPluginDataUrlsAnalysis()] : []),
    ...(inlineContent && fetchInlineUrls
      ? [jsenvPluginInlineContentFetcher()]
      : []),
    jsenvPluginReferenceExpectedTypes(),
  ];
};

const jsenvPluginInlineContentFetcher = () => {
  return {
    name: "jsenv:inline_content_fetcher",
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo) => {
      if (!urlInfo.isInline) {
        return null;
      }
      const isDirectRequest = urlInfo.context.requestedUrl === urlInfo.url;
      /*
       * We want to find inline content but it's not straightforward
       *
       * For some reason (that would be great to investigate)
       * urlInfo corresponding to inline content has several referenceFromOthersSet
       * so the latest version is the last reference
       * BUT the last reference is the "http_request"
       * so it's more likely the before last reference that contains the latest version
       *
       * BUT there is an exception when using supervisor as the before last reference
       * is the one fetched by the browser that is already cooked
       * we must re-cook from the original content, not from the already cooked content
       * Otherwise references are already resolved and
       * - "/node_modules/package/file.js" instead of "package/file.js"
       * - meaning we would not create the implicit dependency to package.json
       * - resulting in a reload of the browser (as implicit reference to package.json is gone)
       * -> can create infinite loop of reloads
       */
      let lastInlineReference;
      let originalContent = urlInfo.originalContent;
      for (const reference of urlInfo.referenceFromOthersSet) {
        if (!reference.isInline) {
          continue;
        }
        if (urlInfo.originalContent === undefined) {
          originalContent = reference.content;
        }
        lastInlineReference = reference;
        if (isDirectRequest) {
          break;
        }
      }
      const { prev } = lastInlineReference;
      if (prev && !prev.isInline) {
        // got inlined, cook original url
        if (lastInlineReference.content === undefined) {
          const originalUrlInfo = prev.urlInfo;
          await originalUrlInfo.cook();
          originalContent = originalUrlInfo.originalContent;
          lastInlineReference.content = originalUrlInfo.content;
          lastInlineReference.contentType = originalUrlInfo.contentType;
          return {
            originalContent: originalUrlInfo.originalContent,
            content: originalUrlInfo.content,
            contentType: originalUrlInfo.contentType,
          };
        }
      }
      return {
        originalContent,
        content:
          originalContent === undefined
            ? lastInlineReference.content
            : originalContent,
        contentType: lastInlineReference.contentType,
      };
    },
  };
};

/*
 * - should I restore eventual search params lost during node esm resolution
 * - what about symlinks?
 *   It feels like I should apply symlink (when we don't want to preserve them)
 *   once a file:/// url is found, regardless
 *   if that comes from node resolution or anything else (not even magic resolution)
 *   it should likely be an other plugin happening after the others
 */


const createNodeEsmResolver = ({
  packageDirectory,
  runtimeCompat,
  rootDirectoryUrl,
  packageConditions = {},
  packageConditionsConfig,
  preservesSymlink,
}) => {
  const applyNodeEsmResolutionMemo = (params) =>
    applyNodeEsmResolution({
      lookupPackageScope: packageDirectory.find,
      readPackageJson: packageDirectory.read,
      preservesSymlink,
      ...params,
    });
  const buildPackageConditions = createBuildPackageConditions(
    packageConditions,
    {
      packageConditionsConfig,
      rootDirectoryUrl,
      runtimeCompat,
      preservesSymlink,
    },
  );

  return (reference) => {
    if (reference.type === "package_json") {
      return reference.specifier;
    }
    const { ownerUrlInfo } = reference;
    if (reference.specifierPathname[0] === "/") {
      return null; // let it to jsenv_web_resolution
    }
    let parentUrl;
    if (reference.baseUrl) {
      parentUrl = reference.baseUrl;
    } else if (ownerUrlInfo.originalUrl?.startsWith("http")) {
      parentUrl = ownerUrlInfo.originalUrl;
    } else {
      parentUrl = ownerUrlInfo.url;
    }
    if (!parentUrl.startsWith("file:")) {
      return null; // let it to jsenv_web_resolution
    }
    const { specifier } = reference;
    // specifiers like "#something" have a special meaning for Node.js
    // but can also be used in .css and .html files for example and should not be modified
    // by node esm resolution
    const webResolutionFallback =
      ownerUrlInfo.type !== "js_module" ||
      reference.type === "sourcemap_comment";

    const resolveNodeEsmFallbackOnWeb = createResolverWithFallbackOnError(
      applyNodeEsmResolutionMemo,
      ({ specifier, parentUrl }) => {
        const url = new URL(specifier, parentUrl).href;
        return { url };
      },
    );
    const DELEGATE_TO_WEB_RESOLUTION_PLUGIN = {};
    const resolveNodeEsmFallbackNullToDelegateToWebPlugin =
      createResolverWithFallbackOnError(
        applyNodeEsmResolutionMemo,
        () => DELEGATE_TO_WEB_RESOLUTION_PLUGIN,
      );

    const conditions = buildPackageConditions(specifier, parentUrl, {
      webResolutionFallback,
      resolver: webResolutionFallback
        ? resolveNodeEsmFallbackOnWeb
        : applyNodeEsmResolutionMemo,
    });
    const resolver = webResolutionFallback
      ? resolveNodeEsmFallbackNullToDelegateToWebPlugin
      : applyNodeEsmResolutionMemo;

    const result = resolver({
      conditions,
      parentUrl,
      specifier,
      preservesSymlink,
    });
    if (result === DELEGATE_TO_WEB_RESOLUTION_PLUGIN) {
      return null;
    }

    const { url, type, isMain, packageDirectoryUrl } = result;
    // try to give a more meaningful filename after build
    if (isMain && packageDirectoryUrl) {
      const basename = urlToBasename(url);
      if (basename === "main" || basename === "index") {
        const parentBasename = urlToBasename(new URL("../../", url));
        const dirname = urlToBasename(packageDirectoryUrl);
        let filenameHint = "";
        if (parentBasename[0] === "@") {
          filenameHint += `${parentBasename}_`;
        }
        const extension = urlToExtension(url);
        filenameHint += `${dirname}_${basename}${extension}`;
        reference.filenameHint = filenameHint;
      }
    }
    if (ownerUrlInfo.context.build) {
      return url;
    }

    package_relationships: {
      if (!url.startsWith("file:")) {
        // data:, javascript:void(0), etc...
        break package_relationships;
      }

      // packageDirectoryUrl can be already known thanks to node resolution
      // otherwise we look for it
      const closestPackageDirectoryUrl =
        packageDirectoryUrl || packageDirectory.find(url);
      if (!closestPackageDirectoryUrl) {
        // happens for projects without package.json or some files outside of package scope
        // (generated files like sourcemaps or cache files for example)
        break package_relationships;
      }

      {
        const dependsOnPackageJson = Boolean(packageDirectoryUrl);
        if (dependsOnPackageJson) {
          // this reference depends on package.json and node_modules
          // to be resolved. Each file using this specifier
          // must be invalidated when corresponding package.json changes
          addRelationshipWithPackageJson({
            reference,
            packageJsonUrl: `${packageDirectoryUrl}package.json`,
            field: type.startsWith("field:")
              ? `#${type.slice("field:".length)}`
              : "",
          });
        }
      }
      version_relationship: {
        const packageVersion = packageDirectory.read(
          closestPackageDirectoryUrl,
        ).version;
        if (!packageVersion) {
          // package version can be null, see https://github.com/babel/babel/blob/2ce56e832c2dd7a7ed92c89028ba929f874c2f5c/packages/babel-runtime/helpers/esm/package.json#L2
          break version_relationship;
        }
        // We want the versioning effect
        // which would put the file in browser cache for 1 year based on that version
        // only for files we don't control and touch ourselves (node modules)
        // which would never change until their version change
        // (minus the case you update them yourselves in your node modules without updating the package version)
        // (in that case you would have to clear browser cache to use the modified version of the node module files)
        const hasVersioningEffect =
          closestPackageDirectoryUrl !== packageDirectory.url &&
          url.includes("/node_modules/");
        addRelationshipWithPackageJson({
          reference,
          packageJsonUrl: `${closestPackageDirectoryUrl}package.json`,
          field: "version",
          hasVersioningEffect,
        });
        if (hasVersioningEffect) {
          reference.version = packageVersion;
        }
      }
    }

    return url;
  };
};

const createBuildPackageConditions = (
  packageConditions,
  {
    packageConditionsConfig,
    rootDirectoryUrl,
    runtimeCompat,
    preservesSymlink,
  },
) => {
  let resolveConditionsFromSpecifier = () => null;
  let resolveConditionsFromContext = () => [];
  from_specifier: {
    if (!packageConditionsConfig) {
      break from_specifier;
    }
    const keys = Object.keys(packageConditionsConfig);
    if (keys.length === 0) {
      break from_specifier;
    }

    const associationsRaw = {};
    for (const key of keys) {
      const associatedValue = packageConditionsConfig[key];

      if (!isBareSpecifier(key)) {
        const url = new URL(key, rootDirectoryUrl);
        associationsRaw[url] = associatedValue;
        continue;
      }
      try {
        if (key.endsWith("/")) {
          const { packageDirectoryUrl } = applyNodeEsmResolution({
            specifier: key.slice(0, -1), // avoid package path not exported
            parentUrl: rootDirectoryUrl,
            preservesSymlink,
          });
          const url = packageDirectoryUrl;
          associationsRaw[url] = associatedValue;
          continue;
        }
        const { url } = applyNodeEsmResolution({
          specifier: key,
          parentUrl: rootDirectoryUrl,
          preservesSymlink,
        });
        associationsRaw[url] = associatedValue;
      } catch {
        const url = new URL(key, rootDirectoryUrl);
        associationsRaw[url] = associatedValue;
      }
    }
    const associations = URL_META.resolveAssociations(
      {
        conditions: associationsRaw,
      },
      rootDirectoryUrl,
    );
    resolveConditionsFromSpecifier = (specifier, importer, { resolver }) => {
      let associatedValue;
      if (isBareSpecifier(specifier)) {
        const { url } = resolver({
          specifier,
          parentUrl: importer,
        });
        associatedValue = URL_META.applyAssociations({ url, associations });
      } else {
        associatedValue = URL_META.applyAssociations({
          url: importer,
          associations,
        });
      }
      if (!associatedValue) {
        return undefined;
      }
      if (associatedValue.conditions) {
        return associatedValue.conditions;
      }
      return undefined;
    };
  }
  {
    const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
    // https://nodejs.org/api/esm.html#resolver-algorithm-specification
    const devResolver = (specifier, importer, { resolver }) => {
      if (isBareSpecifier(specifier)) {
        const { url } = resolver({
          specifier,
          parentUrl: importer,
        });
        return !url.includes("/node_modules/");
      }
      return !importer.includes("/node_modules/");
    };

    const conditionDefaultResolvers = {
      "dev:*": devResolver,
      "development": devResolver,
      "node": nodeRuntimeEnabled,
      "browser": !nodeRuntimeEnabled,
      "import": true,
    };
    const conditionResolvers = {
      ...conditionDefaultResolvers,
    };

    let wildcardToRemoveSet = new Set();
    const addCustomResolver = (condition, customResolver) => {
      for (const conditionCandidate of Object.keys(conditionDefaultResolvers)) {
        if (conditionCandidate.includes("*")) {
          const conditionRegex = new RegExp(
            `^${conditionCandidate.replace(/\*/g, "(.*)")}$`,
          );
          if (conditionRegex.test(condition)) {
            const existingResolver =
              conditionDefaultResolvers[conditionCandidate];
            wildcardToRemoveSet.add(conditionCandidate);
            conditionResolvers[condition] = combineTwoPackageConditionResolvers(
              existingResolver,
              customResolver,
            );
            return;
          }
        }
      }
      const existingResolver = conditionDefaultResolvers[condition];
      if (existingResolver) {
        conditionResolvers[condition] = combineTwoPackageConditionResolvers(
          existingResolver,
          customResolver,
        );
        return;
      }
      conditionResolvers[condition] = customResolver;
    };
    {
      const processArgConditions = readCustomConditionsFromProcessArgs();
      for (const processArgCondition of processArgConditions) {
        addCustomResolver(processArgCondition, true);
      }
    }
    {
      for (const key of Object.keys(packageConditions)) {
        const value = packageConditions[key];
        let customResolver;
        if (typeof value === "object") {
          const associations = URL_META.resolveAssociations(
            { applies: value },
            (pattern) => {
              if (isBareSpecifier(pattern)) {
                try {
                  if (pattern.endsWith("/")) {
                    // avoid package path not exported
                    const { packageDirectoryUrl } = applyNodeEsmResolution({
                      specifier: pattern.slice(0, -1),
                      parentUrl: rootDirectoryUrl,
                    });
                    return packageDirectoryUrl;
                  }
                  const { url } = applyNodeEsmResolution({
                    specifier: pattern,
                    parentUrl: rootDirectoryUrl,
                  });
                  return url;
                } catch {
                  return new URL(pattern, rootDirectoryUrl);
                }
              }
              return new URL(pattern, rootDirectoryUrl);
            },
          );
          customResolver = (specifier, importer, { resolver }) => {
            if (isBareSpecifier(specifier)) {
              const { url } = resolver({
                specifier,
                parentUrl: importer,
              });
              const { applies } = URL_META.applyAssociations({
                url,
                associations,
              });
              return applies;
            }
            const { applies } = URL_META.applyAssociations({
              url: importer,
              associations,
            });
            return applies;
          };
        } else if (typeof value === "function") {
          customResolver = value;
        } else {
          customResolver = value;
        }
        addCustomResolver(key, customResolver);
      }
    }
    for (const wildcardToRemove of wildcardToRemoveSet) {
      delete conditionResolvers[wildcardToRemove];
    }

    const conditionCandidateArray = Object.keys(conditionResolvers);
    resolveConditionsFromContext = (specifier, importer, params) => {
      const conditions = [];
      for (const conditionCandidate of conditionCandidateArray) {
        const conditionResolver = conditionResolvers[conditionCandidate];
        if (typeof conditionResolver === "function") {
          if (conditionResolver(specifier, importer, params)) {
            conditions.push(conditionCandidate);
          }
        } else if (conditionResolver) {
          conditions.push(conditionCandidate);
        }
      }
      return conditions;
    };
  }

  return (specifier, importer, params) => {
    const conditionsForThisSpecifier = resolveConditionsFromSpecifier(
      specifier,
      importer,
      params,
    );
    if (conditionsForThisSpecifier) {
      return conditionsForThisSpecifier;
    }
    const conditionsFromContext = resolveConditionsFromContext(
      specifier,
      importer,
      params,
    );
    if (conditionsFromContext) {
      return conditionsFromContext;
    }
    return [];
  };
};

const combineTwoPackageConditionResolvers = (first, second) => {
  if (typeof second !== "function") {
    return second;
  }
  return (...args) => {
    const secondResult = second(...args);
    if (secondResult !== undefined) {
      return secondResult;
    }
    if (typeof first === "function") {
      return first(...args);
    }
    return first;
  };
};

const addRelationshipWithPackageJson = ({
  reference,
  packageJsonUrl,
  field,
  hasVersioningEffect = false,
}) => {
  const { ownerUrlInfo } = reference;
  for (const referenceToOther of ownerUrlInfo.referenceToOthersSet) {
    if (
      referenceToOther.type === "package_json" &&
      referenceToOther.subtype === field
    ) {
      return;
    }
  }
  const packageJsonReference = reference.addImplicit({
    type: "package_json",
    subtype: field,
    specifier: packageJsonUrl,
    hasVersioningEffect,
    isWeak: true,
  });
  // we don't cook package.json files, we just maintain their content
  // to be able to check if it has changed later on
  if (packageJsonReference.urlInfo.content === undefined) {
    const packageJsonContentAsBuffer = readFileSync(new URL(packageJsonUrl));
    packageJsonReference.urlInfo.type = "json";
    packageJsonReference.urlInfo.kitchen.urlInfoTransformer.setContent(
      packageJsonReference.urlInfo,
      String(packageJsonContentAsBuffer),
    );
  }
};

const createResolverWithFallbackOnError = (mainResolver, fallbackResolver) => {
  return (params) => {
    try {
      return mainResolver(params);
    } catch {
      return fallbackResolver(params);
    }
  };
};

const isBareSpecifier = (specifier) => {
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(specifier);
    return false;
  } catch {
    return true;
  }
};

const jsenvPluginNodeEsmResolution = ({
  packageDirectory,
  resolutionConfig = {},
  packageConditions,
  packageConditionsConfig = {},
}) => {
  let nodeEsmResolverDefault;
  const resolverMap = new Map();
  let anyTypeResolver;

  const resolverFromObject = (
    { preservesSymlink, ...rest },
    { kitchenContext, urlType },
  ) => {
    const unexpectedKeys = Object.keys(rest);
    if (unexpectedKeys.length) {
      throw new TypeError(
        `${unexpectedKeys.join(
          ",",
        )}: there is no such configuration on "${urlType}"`,
      );
    }
    return createNodeEsmResolver({
      packageDirectory,
      runtimeCompat: kitchenContext.runtimeCompat,
      rootDirectoryUrl: kitchenContext.rootDirectoryUrl,
      packageConditions,
      packageConditionsConfig: {
        ...kitchenContext.packageConditionsConfig,
        ...packageConditionsConfig,
      },
      preservesSymlink,
    });
  };

  return {
    name: "jsenv:node_esm_resolution",
    appliesDuring: "*",
    init: (kitchenContext) => {
      nodeEsmResolverDefault = createNodeEsmResolver({
        packageDirectory,
        runtimeCompat: kitchenContext.runtimeCompat,
        rootDirectoryUrl: kitchenContext.rootDirectoryUrl,
        // preservesSymlink: true,
        packageConditions,
        packageConditionsConfig: {
          ...kitchenContext.packageConditionsConfig,
          ...packageConditionsConfig,
        },
      });
      for (const urlType of Object.keys(resolutionConfig)) {
        let resolver;
        const config = resolutionConfig[urlType];
        if (config === true) {
          resolver = nodeEsmResolverDefault;
        } else if (config === false) {
          resolver = null;
        } else if (typeof config === "object") {
          resolver = resolverFromObject(config, { kitchenContext, urlType });
        } else {
          throw new TypeError(
            `The value "${config}" for ${urlType} in nodeEsmResolution is invalid: it must be true, false or an object.`,
          );
        }

        if (urlType === "*") {
          anyTypeResolver = resolver;
        } else {
          resolverMap.set(urlType, resolver);
        }
      }
      if (!anyTypeResolver) {
        anyTypeResolver = nodeEsmResolverDefault;
      }

      if (!resolverMap.has("js_module")) {
        resolverMap.set("js_module", nodeEsmResolverDefault);
      }
      if (!resolverMap.has("js_classic")) {
        resolverMap.set("js_classic", (reference) => {
          if (reference.subtype === "self_import_scripts_arg") {
            return nodeEsmResolverDefault(reference);
          }
          if (reference.type === "js_import") {
            // happens for ?as_js_module
            return nodeEsmResolverDefault(reference);
          }
          return null;
        });
      }
    },
    resolveReference: (reference) => {
      if (reference.specifier.startsWith("node_esm:")) {
        reference.specifier = reference.specifier.slice("node_esm:".length);
        const result = nodeEsmResolverDefault(reference);
        return result;
      }
      const urlType = urlTypeFromReference(reference);
      const resolver = resolverMap.get(urlType);
      if (resolver !== undefined) {
        if (typeof resolver === "function") {
          return resolver(reference);
        }
        return resolver;
      }
      if (anyTypeResolver) {
        return anyTypeResolver(reference);
      }
      return null;
    },
    // when specifier is prefixed by "file:///@ignore/"
    // we return an empty js module
    fetchUrlContent: (urlInfo) => {
      if (urlInfo.url.startsWith("file:///@ignore/")) {
        return {
          content: "export default {}",
          contentType: "text/javascript",
          type: "js_module",
        };
      }
      return null;
    },
  };
};

const urlTypeFromReference = (reference) => {
  if (reference.type === "sourcemap_comment") {
    return "sourcemap";
  }
  if (reference.injected) {
    return reference.expectedType;
  }
  return reference.ownerUrlInfo.type;
};

const jsenvPluginWebResolution = () => {
  return {
    name: "jsenv:web_resolution",
    appliesDuring: "*",
    resolveReference: (reference) => {
      const { ownerUrlInfo } = reference;
      if (reference.specifierPathname[0] === "/") {
        const resource = reference.specifier;
        if (ownerUrlInfo.originalUrl?.startsWith("http")) {
          return new URL(resource, ownerUrlInfo.originalUrl);
        }
        const url = new URL(resource.slice(1), ownerUrlInfo.entryUrlInfo.url);
        return url;
      }
      // baseUrl happens second argument to new URL() is different from
      // import.meta.url or document.currentScript.src
      const parentUrl =
        reference.baseUrl ||
        (ownerUrlInfo.context.dev
          ? ownerUrlInfo.url
          : ownerUrlInfo.originalUrl || ownerUrlInfo.url);
      const url = new URL(reference.specifier, parentUrl);
      return url;
    },
  };
};

const jsenvPluginVersionSearchParam = () => {
  return {
    name: "jsenv:version_search_param",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      // "v" search param goal is to enable long-term cache
      // for server response headers
      // it is also used by hot to bypass browser cache
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      const version = reference.searchParams.get("v");
      if (version) {
        const urlObject = new URL(reference.url);
        urlObject.searchParams.delete("v");
        reference.version = version;
        return urlObject.href;
      }
      return null;
    },
    transformReferenceSearchParams: (reference) => {
      if (!reference.version) {
        return null;
      }
      if (reference.searchParams.has("v")) {
        return null;
      }
      return {
        v: reference.version,
      };
    },
  };
};

/*
 * NICE TO HAVE:
 * 
 * - when clicking the server root directory from the root directory 
 * we should see "/..." in the url bar
 * instead we ses "@fs/"
 * everything still works but that would be cleaner
 * 
 * - when visiting urls outside server root directory the UI is messed up
 * 
 * Let's say I visit file outside the server root directory that is in 404
 * We must update the enoent message and maybe other things to take into account
 * that url is no longer /something but "@fs/project_root/something" in the browser url bar
 * 
 * - watching directory might result into things that are not properly handled:
 * 1. the existing directory is deleted
 *    -> we should update the whole page to use a new "firstExistingDirectoryUrl"
 * 2. the enoent is impacted
 *    -> we should update the ENOENT message
 * It means the websocket should contain more data and we can't assume firstExistingDirectoryUrl won't change
 *

 */


const htmlFileUrlForDirectory = import.meta
  .resolve("../client/directory_listing/directory_listing.html");

const jsenvPluginDirectoryListing = ({
  spa,
  urlMocks = false,
  autoreload = true,
  directoryContentMagicName,
  packageDirectory,
  rootDirectoryUrl,
  mainFilePath,
  sourceFilesConfig,
}) => {
  return {
    name: "jsenv:directory_listing",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      if (reference.isInline) {
        return null;
      }
      const url = reference.url;
      if (!url.startsWith("file:")) {
        return null;
      }
      let { fsStat } = reference;
      if (!fsStat) {
        fsStat = readEntryStatSync(url, { nullIfNotFound: true });
        reference.fsStat = fsStat;
      }
      const { request, requestedUrl, mainFilePath, rootDirectoryUrl } =
        reference.ownerUrlInfo.context;
      if (!fsStat) {
        if (!request || request.headers["sec-fetch-dest"] !== "document") {
          return null;
        }
        if (url !== requestedUrl) {
          const mainFileUrl = new URL(mainFilePath, rootDirectoryUrl);
          mainFileUrl.search = "";
          mainFileUrl.hash = "";
          const referenceUrl = new URL(url);
          referenceUrl.search = "";
          referenceUrl.hash = "";
          if (mainFileUrl.href !== referenceUrl.href) {
            return null;
          }
        }
        return `${htmlFileUrlForDirectory}?url=${encodeURIComponent(requestedUrl)}&enoent`;
      }
      const isDirectory = fsStat?.isDirectory();
      if (!isDirectory) {
        return null;
      }
      if (reference.type === "filesystem") {
        // TODO: we should redirect to something like /...json
        // and any file name ...json is a special file serving directory content as json
        return null;
      }
      const acceptsHtml = request
        ? pickContentType(request, ["text/html"])
        : false;
      if (!acceptsHtml) {
        return null;
      }
      reference.fsStat = null; // reset fsStat as it's not a directory anymore
      return `${htmlFileUrlForDirectory}?url=${encodeURIComponent(url)}`;
    },
    transformUrlContent: {
      html: (urlInfo) => {
        const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
        if (urlWithoutSearch !== String(htmlFileUrlForDirectory)) {
          return null;
        }
        const urlNotFound = urlInfo.searchParams.get("url");
        if (!urlNotFound) {
          return null;
        }

        urlInfo.headers["cache-control"] = "no-cache";
        const enoent = urlInfo.searchParams.has("enoent");
        if (enoent) {
          urlInfo.status = 404;
        }
        const request = urlInfo.context.request;
        const { rootDirectoryUrl, mainFilePath } = urlInfo.context;
        const directoryListingInjections = generateDirectoryListingInjection(
          urlNotFound,
          {
            spa,
            autoreload,
            request,
            urlMocks,
            directoryContentMagicName,
            rootDirectoryUrl,
            mainFilePath,
            packageDirectory,
            enoent,
          },
        );
        return {
          contentInjections: directoryListingInjections,
        };
      },
    },
    devServerRoutes: [
      {
        endpoint:
          "GET /.internal/directory_content.websocket?directory=:directory",
        description: "Emit events when a directory content changes.",
        declarationSource: import.meta.url,
        fetch: (request) => {
          if (!autoreload) {
            return null;
          }
          return new WebSocketResponse((websocket) => {
            const directoryRelativeUrl = request.params.directory;
            const requestedUrl = FILE_AND_SERVER_URLS_CONVERTER.asFileUrl(
              directoryRelativeUrl,
              rootDirectoryUrl,
            );
            const closestDirectoryUrl = getFirstExistingDirectoryUrl(
              requestedUrl,
              rootDirectoryUrl,
            );
            const sendMessage = (message) => {
              websocket.send(JSON.stringify(message));
            };
            const generateItems = () => {
              const firstExistingDirectoryUrl = getFirstExistingDirectoryUrl(
                requestedUrl,
                rootDirectoryUrl,
              );
              const items = getDirectoryContentItems({
                serverRootDirectoryUrl: rootDirectoryUrl,
                mainFilePath,
                firstExistingDirectoryUrl,
              });
              return items;
            };

            const unwatch = registerDirectoryLifecycle(closestDirectoryUrl, {
              added: ({ relativeUrl }) => {
                sendMessage({
                  type: "change",
                  reason: `${relativeUrl} added`,
                  items: generateItems(),
                });
              },
              updated: ({ relativeUrl }) => {
                sendMessage({
                  type: "change",
                  reason: `${relativeUrl} updated`,
                  items: generateItems(),
                });
              },
              removed: ({ relativeUrl }) => {
                sendMessage({
                  type: "change",
                  reason: `${relativeUrl} removed`,
                  items: generateItems(),
                });
              },
              watchPatterns: getDirectoryWatchPatterns(
                closestDirectoryUrl,
                closestDirectoryUrl,
                {
                  sourceFilesConfig,
                },
              ),
            });
            return () => {
              unwatch();
            };
          });
        },
      },
    ],
  };
};

const generateDirectoryListingInjection = (
  urlNotFound,
  {
    spa,
    rootDirectoryUrl,
    mainFilePath,
    packageDirectory,
    request,
    urlMocks,
    directoryContentMagicName,
    autoreload,
    enoent,
  },
) => {
  let serverRootDirectoryUrl = rootDirectoryUrl;
  const firstExistingDirectoryUrl = getFirstExistingDirectoryUrl(
    urlNotFound,
    serverRootDirectoryUrl,
  );
  const directoryContentItems = getDirectoryContentItems({
    serverRootDirectoryUrl,
    mainFilePath,
    firstExistingDirectoryUrl,
  });
  package_workspaces: {
    if (!packageDirectory.url) {
      break package_workspaces;
    }
    if (String(packageDirectory.url) === String(serverRootDirectoryUrl)) {
      break package_workspaces;
    }
    rootDirectoryUrl = packageDirectory.url;
    // if (String(firstExistingDirectoryUrl) === String(serverRootDirectoryUrl)) {
    //   let packageContent;
    //   try {
    //     packageContent = JSON.parse(
    //       readFileSync(new URL("package.json", packageDirectoryUrl), "utf8"),
    //     );
    //   } catch {
    //     break package_workspaces;
    //   }
    //   const { workspaces } = packageContent;
    //   if (Array.isArray(workspaces)) {
    //     for (const workspace of workspaces) {
    //       const workspaceUrlObject = new URL(workspace, packageDirectoryUrl);
    //       const workspaceUrl = workspaceUrlObject.href;
    //       if (workspaceUrl.endsWith("*")) {
    //         const directoryUrl = ensurePathnameTrailingSlash(
    //           workspaceUrl.slice(0, -1),
    //         );
    //         fileUrls.push(new URL(directoryUrl));
    //       } else {
    //         fileUrls.push(ensurePathnameTrailingSlash(workspaceUrlObject));
    //       }
    //     }
    //   }
    // }
  }
  const directoryUrlRelativeToServer =
    FILE_AND_SERVER_URLS_CONVERTER.asServerUrl(
      firstExistingDirectoryUrl,
      serverRootDirectoryUrl,
    );
  const websocketScheme = request.protocol === "https" ? "wss" : "ws";
  const { host } = new URL(request.url);
  const websocketUrl = `${websocketScheme}://${host}/.internal/directory_content.websocket?directory=${encodeURIComponent(directoryUrlRelativeToServer)}`;

  const generateBreadcrumb = () => {
    const breadcrumb = [];
    const lastItemUrl = firstExistingDirectoryUrl;
    const lastItemRelativeUrl = urlToRelativeUrl(lastItemUrl, rootDirectoryUrl);
    const rootDirectoryUrlName = urlToFilename(rootDirectoryUrl);
    let parts;
    if (lastItemRelativeUrl) {
      parts = `${rootDirectoryUrlName}/${lastItemRelativeUrl}`.split("/");
    } else {
      parts = [rootDirectoryUrlName];
    }
    let i = 0;
    while (i < parts.length) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;
      if (isLastPart && part === "") {
        // ignore trailing slash
        break;
      }
      let navItemRelativeUrl = `${parts.slice(1, i + 1).join("/")}`;
      let navItemUrl =
        navItemRelativeUrl === ""
          ? rootDirectoryUrl
          : new URL(navItemRelativeUrl, rootDirectoryUrl).href;
      if (!isLastPart) {
        navItemUrl = ensurePathnameTrailingSlash(navItemUrl);
      }
      let urlRelativeToServer = FILE_AND_SERVER_URLS_CONVERTER.asServerUrl(
        navItemUrl,
        serverRootDirectoryUrl,
      );
      let urlRelativeToDocument = urlToRelativeUrl(navItemUrl, urlNotFound);
      const isServerRootDirectory = navItemUrl === serverRootDirectoryUrl;
      if (isServerRootDirectory) {
        urlRelativeToServer = `/${directoryContentMagicName}`;
        urlRelativeToDocument = `/${directoryContentMagicName}`;
      }
      const name = part;
      const isCurrent = navItemUrl === String(firstExistingDirectoryUrl);
      breadcrumb.push({
        url: navItemUrl,
        urlRelativeToServer,
        urlRelativeToDocument,
        isServerRootDirectory,
        isCurrent,
        name,
      });
      i++;
    }
    return breadcrumb;
  };
  const breadcrumb = generateBreadcrumb();

  let enoentDetails = null;
  if (enoent) {
    const buildEnoentPathInfo = (urlBase, closestExistingUrl) => {
      let filePathExisting;
      let filePathNotFound;
      const existingIndex = String(closestExistingUrl).length;
      filePathExisting = urlToRelativeUrl(
        closestExistingUrl,
        serverRootDirectoryUrl,
      );
      filePathNotFound = urlBase.slice(existingIndex);
      return [filePathExisting, filePathNotFound];
    };
    const fileRelativeUrl = urlToRelativeUrl(
      urlNotFound,
      serverRootDirectoryUrl,
    );
    enoentDetails = {
      fileUrl: urlNotFound,
      fileRelativeUrl,
    };

    const [filePathExisting, filePathNotFound] = buildEnoentPathInfo(
      urlNotFound,
      firstExistingDirectoryUrl,
    );
    Object.assign(enoentDetails, {
      filePathExisting: `/${filePathExisting}`,
      filePathNotFound,
    });
  }

  return {
    __DIRECTORY_LISTING__: {
      spa,
      enoentDetails,
      breadcrumb,
      urlMocks,
      directoryContentMagicName,
      directoryUrl: firstExistingDirectoryUrl,
      serverRootDirectoryUrl,
      rootDirectoryUrl,
      mainFilePath,
      directoryContentItems,
      websocketUrl,
      autoreload,
    },
  };
};
const getFirstExistingDirectoryUrl = (urlBase, serverRootDirectoryUrl) => {
  let directoryUrlCandidate = new URL("./", urlBase);
  while (!existsSync(directoryUrlCandidate)) {
    directoryUrlCandidate = new URL("../", directoryUrlCandidate);
    if (!urlIsOrIsInsideOf(directoryUrlCandidate, serverRootDirectoryUrl)) {
      directoryUrlCandidate = new URL(serverRootDirectoryUrl);
      break;
    }
  }
  return directoryUrlCandidate;
};
const getDirectoryContentItems = ({
  serverRootDirectoryUrl,
  mainFilePath,
  firstExistingDirectoryUrl,
}) => {
  const directoryContentArray = readdirSync(new URL(firstExistingDirectoryUrl));
  const fileUrls = [];
  for (const filename of directoryContentArray) {
    const fileUrlObject = new URL(filename, firstExistingDirectoryUrl);
    if (lstatSync(fileUrlObject).isDirectory()) {
      fileUrls.push(ensurePathnameTrailingSlash(fileUrlObject));
    } else {
      fileUrls.push(fileUrlObject);
    }
  }
  fileUrls.sort(compareFileUrls);

  const items = [];
  for (const fileUrl of fileUrls) {
    const urlRelativeToCurrentDirectory = urlToRelativeUrl(
      fileUrl,
      firstExistingDirectoryUrl,
    );
    const urlRelativeToServer = FILE_AND_SERVER_URLS_CONVERTER.asServerUrl(
      fileUrl,
      serverRootDirectoryUrl,
    );
    const url = String(fileUrl);
    const mainFileUrl = new URL(mainFilePath, serverRootDirectoryUrl).href;
    const isMainFile = url === mainFileUrl;

    items.push({
      url,
      urlRelativeToCurrentDirectory,
      urlRelativeToServer,
      isMainFile,
    });
  }
  return items;
};

const jsenvPluginFsRedirection = ({
  spa,
  directoryContentMagicName,
  magicExtensions = ["inherit", ".js"],
  magicDirectoryIndex = true,
  preserveSymlinks = false,
}) => {
  return {
    name: "jsenv:fs_redirection",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.url === "file:///") {
        return `ignore:file:///`;
      }
      if (reference.url === "file://") {
        return `ignore:file://`;
      }
      // ignore all new URL second arg
      if (reference.subtype === "new_url_second_arg") {
        if (reference.original) {
          return `ignore:${reference.original.specifier}`;
        }
        return `ignore:${reference.specifier}`;
      }
      // http, https, data, about, ...
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      if (reference.original && !reference.original.url.startsWith("file:")) {
        return null;
      }
      if (reference.isInline) {
        return null;
      }

      if (
        reference.specifierPathname.endsWith(`/${directoryContentMagicName}`)
      ) {
        const { rootDirectoryUrl } = reference.ownerUrlInfo.context;
        const directoryUrl = new URL(
          reference.specifierPathname
            .replace(`/${directoryContentMagicName}`, "/")
            .slice(1),
          rootDirectoryUrl,
        ).href;
        return directoryUrl;
      }
      // ignore "./" on new URL("./")
      // if (
      //   reference.subtype === "new_url_first_arg" &&
      //   reference.specifier === "./"
      // ) {
      //   return `ignore:${reference.url}`;
      // }
      const urlObject = new URL(reference.url);
      let fsStat = readEntryStatSync(urlObject, { nullIfNotFound: true });
      reference.fsStat = fsStat;
      const { search, hash } = urlObject;
      urlObject.search = "";
      urlObject.hash = "";
      applyFsStatEffectsOnUrlObject(urlObject, fsStat);
      const shouldApplyFilesystemMagicResolution =
        reference.type === "js_import";
      if (shouldApplyFilesystemMagicResolution) {
        const filesystemResolution = applyFileSystemMagicResolution(
          urlObject.href,
          {
            fileStat: fsStat,
            magicDirectoryIndex,
            magicExtensions: getExtensionsToTry(
              magicExtensions,
              reference.ownerUrlInfo.url,
            ),
          },
        );
        if (filesystemResolution.stat) {
          fsStat = filesystemResolution.stat;
          reference.fsStat = fsStat;
          urlObject.href = filesystemResolution.url;
          applyFsStatEffectsOnUrlObject(urlObject, fsStat);
        }
      }
      if (spa) {
        // for SPA we want to serve the root HTML file most of the time
        if (!fsStat) {
          if (urlToExtension(urlObject)) {
            // url has an extension, we assume it's a file request -> let 404 happen
            return null;
          }
          const { requestedUrl, rootDirectoryUrl, mainFilePath } =
            reference.ownerUrlInfo.context;
          const closestHtmlRootFile = getClosestHtmlRootFile(
            requestedUrl,
            rootDirectoryUrl,
          );
          if (closestHtmlRootFile) {
            return closestHtmlRootFile;
          }
          return new URL(mainFilePath, rootDirectoryUrl);
        }
        if (fsStat.isDirectory()) {
          // When requesting a directory, check if we have an HTML entry file for that directory
          const directoryEntryFileUrl = getDirectoryEntryFileUrl(urlObject);
          if (directoryEntryFileUrl) {
            reference.fsStat = readEntryStatSync(directoryEntryFileUrl);
            return directoryEntryFileUrl;
          }
        }
      }
      if (!fsStat) {
        return null;
      }
      const urlBeforeSymlinkResolution = urlObject.href;
      if (preserveSymlinks) {
        return `${urlBeforeSymlinkResolution}${search}${hash}`;
      }
      const urlAfterSymlinkResolution = resolveSymlink(
        urlBeforeSymlinkResolution,
      );
      if (urlAfterSymlinkResolution !== urlBeforeSymlinkResolution) {
        reference.leadsToASymlink = true;
        // reference.baseUrl = urlBeforeSymlinkResolution;
      }
      const resolvedUrl = `${urlAfterSymlinkResolution}${search}${hash}`;
      return resolvedUrl;
    },
  };
};

const applyFsStatEffectsOnUrlObject = (urlObject, fsStat) => {
  if (!fsStat) {
    return;
  }
  const { pathname } = urlObject;
  const pathnameUsesTrailingSlash = pathname.endsWith("/");
  // force trailing slash on directories
  if (fsStat.isDirectory()) {
    if (!pathnameUsesTrailingSlash) {
      urlObject.pathname = `${pathname}/`;
    }
  } else if (pathnameUsesTrailingSlash) {
    // otherwise remove trailing slash if any
    // a warning here? (because it's strange to reference a file with a trailing slash)
    urlObject.pathname = pathname.slice(0, -1);
  }
};

const resolveSymlink = (fileUrl) => {
  const urlObject = new URL(fileUrl);
  const realpath = realpathSync(urlObject);
  const realUrlObject = pathToFileURL(realpath);
  if (urlObject.pathname.endsWith("/")) {
    realUrlObject.pathname += `/`;
  }
  return realUrlObject.href;
};

const getDirectoryEntryFileUrl = (directoryUrl) => {
  const indexHtmlFileUrl = new URL(`index.html`, directoryUrl);
  if (existsSync(indexHtmlFileUrl)) {
    return indexHtmlFileUrl.href;
  }
  const filename = urlToFilename(directoryUrl);
  const htmlFileUrlCandidate = new URL(`${filename}.html`, directoryUrl);
  if (existsSync(htmlFileUrlCandidate)) {
    return htmlFileUrlCandidate.href;
  }
  return null;
};
const getClosestHtmlRootFile = (requestedUrl, serverRootDirectoryUrl) => {
  let directoryUrl = new URL("./", requestedUrl);
  while (true) {
    const directoryEntryFileUrl = getDirectoryEntryFileUrl(directoryUrl);
    if (directoryEntryFileUrl) {
      return directoryEntryFileUrl;
    }
    if (!urlIsOrIsInsideOf(directoryUrl, serverRootDirectoryUrl)) {
      return null;
    }
    directoryUrl = new URL("../", directoryUrl);
  }
};

const directoryContentMagicName = "...";

const jsenvPluginProtocolFile = ({
  spa = true,
  magicExtensions,
  magicDirectoryIndex,
  preserveSymlinks,
  directoryListing,
  rootDirectoryUrl,
  mainFilePath,
  packageDirectory,
  sourceFilesConfig,
}) => {
  return [
    jsenvPluginFsRedirection({
      spa,
      directoryContentMagicName,
      magicExtensions,
      magicDirectoryIndex,
      preserveSymlinks,
    }),
    {
      name: "jsenv:fs_resolution",
      appliesDuring: "*",
      resolveReference: {
        filesystem: (reference) => {
          const ownerUrlInfo = reference.ownerUrlInfo;
          const baseUrl =
            ownerUrlInfo.type === "directory"
              ? ensurePathnameTrailingSlash(ownerUrlInfo.url)
              : ownerUrlInfo.url;
          return new URL(reference.specifier, baseUrl).href;
        },
      },
    },
    {
      name: "jsenv:@fs",
      // during build it's fine to use "file://"" urls
      // but during dev it's a browser running the code
      // so absolute file urls needs to be relativized
      appliesDuring: "dev",
      resolveReference: (reference) => {
        if (reference.specifier.startsWith("/@fs/")) {
          return FILE_AND_SERVER_URLS_CONVERTER.asFileUrl(reference.specifier);
        }
        return null;
      },
      formatReference: (reference) => {
        const { generatedUrl } = reference;
        if (!generatedUrl.startsWith("file:")) {
          return null;
        }
        if (reference.original) {
          const originalSpecifierPathname =
            reference.original.specifierPathname;
          if (
            originalSpecifierPathname.endsWith(`/${directoryContentMagicName}`)
          ) {
            return originalSpecifierPathname;
          }
        }
        const { rootDirectoryUrl } = reference.ownerUrlInfo.context;
        return FILE_AND_SERVER_URLS_CONVERTER.asServerUrl(
          generatedUrl,
          rootDirectoryUrl,
        );
      },
    },
    ...(directoryListing
      ? [
          jsenvPluginDirectoryListing({
            spa,
            ...directoryListing,
            directoryContentMagicName,
            rootDirectoryUrl,
            mainFilePath,
            packageDirectory,
            sourceFilesConfig,
          }),
        ]
      : []),
    {
      name: "jsenv:directory_as_json",
      appliesDuring: "*",
      fetchUrlContent: (urlInfo) => {
        if (!urlInfo.url.startsWith("file:")) {
          return null;
        }
        const { firstReference } = urlInfo;
        if (!firstReference) {
          console.warn("No firstReference for", urlInfo.url);
          return null;
        }
        let { fsStat } = firstReference;
        if (!fsStat) {
          fsStat = readEntryStatSync(urlInfo.url, { nullIfNotFound: true });
        }
        if (!fsStat) {
          return null;
        }
        const isDirectory = fsStat.isDirectory();
        if (!isDirectory) {
          return null;
        }
        const directoryContentArray = readdirSync(new URL(urlInfo.url));
        const content = JSON.stringify(directoryContentArray, null, "  ");
        return {
          type: "directory",
          contentType: "application/json",
          content,
        };
      },
    },
    {
      name: "jsenv:file_url_fetching",
      appliesDuring: "*",
      fetchUrlContent: (urlInfo) => {
        if (!urlInfo.url.startsWith("file:")) {
          return null;
        }
        const { firstReference } = urlInfo;
        if (!firstReference) {
          return null;
        }
        let { fsStat } = firstReference;
        if (!fsStat) {
          fsStat = readEntryStatSync(urlInfo.url, { nullIfNotFound: true });
        }
        const serveFile = (url) => {
          const contentType = CONTENT_TYPE.fromUrlExtension(url);
          const fileBuffer = readFileSync(new URL(url));
          const content = CONTENT_TYPE.isTextual(contentType)
            ? String(fileBuffer)
            : fileBuffer;
          return {
            content,
            contentType,
            contentLength: fileBuffer.length,
          };
        };

        return serveFile(urlInfo.url);
      },
    },
  ];
};

const jsenvPluginProtocolHttp = ({ include }) => {
  const prependIgnore = (reference) => {
    if (reference.original) {
      return `ignore:${reference.original.specifier}`;
    }
    return `ignore:${reference.specifier}`;
  };

  if (include === false) {
    return {
      name: "jsenv:protocol_http",
      appliesDuring: "*",
      redirectReference: (reference) => {
        if (!reference.url.startsWith("http")) {
          return null;
        }
        return prependIgnore(reference);
      },
    };
  }
  const shouldInclude =
    include === true
      ? () => true
      : URL_META.createFilter(include, "http://jsenv.com");

  return {
    name: "jsenv:protocol_http",
    appliesDuring: "build",
    // resolveReference: (reference) => {
    //   if (reference.original && reference.original.url.startsWith("http")) {
    //     return new URL(reference.specifier, reference.original.url);
    //   }
    //   return null;
    // },
    init: (context) => {
      const outDirectoryUrl = context.outDirectoryUrl;
      if (!outDirectoryUrl) {
        throw new Error(`need outDirectoryUrl to write http files`);
      }
    },
    redirectReference: (reference) => {
      if (!reference.url.startsWith("http")) {
        return null;
      }
      if (!shouldInclude(reference.url)) {
        return prependIgnore(reference);
      }
      const outDirectoryUrl = reference.ownerUrlInfo.context.outDirectoryUrl;
      const urlObject = new URL(reference.url);
      const { host, pathname, search } = urlObject;
      let fileUrl = String(outDirectoryUrl);
      if (reference.url.startsWith("http:")) {
        fileUrl += "@http/";
      } else {
        fileUrl += "@https/";
      }
      fileUrl += asValidFilename(host);
      if (pathname) {
        fileUrl += "/";
        fileUrl += asValidFilename(pathname);
      }
      if (search) {
        fileUrl += search;
      }
      return fileUrl;
    },
    fetchUrlContent: async (urlInfo) => {
      const originalUrl = urlInfo.originalUrl;
      if (!originalUrl.startsWith("http")) {
        return null;
      }
      const response = await fetch(originalUrl);
      const responseStatus = response.status;
      if (responseStatus < 200 || responseStatus > 299) {
        throw new Error(`unexpected response status ${responseStatus}`);
      }
      const responseHeaders = response.headers;
      const responseContentType = responseHeaders.get("content-type");
      const contentType = responseContentType || "application/octet-stream";
      const isTextual = CONTENT_TYPE.isTextual(contentType);
      let content;
      if (isTextual) {
        content = await response.text();
      } else {
        content = Buffer.from(await response.arrayBuffer());
      }
      // When fetching content from http it's possible to request something like
      // "https://esm.sh/preact@10.23.1
      // and receive content-type "application/javascript"
      // if we do nothing, after build there will be a "preact@10.23.1" file without ".js" extension
      // and the build server will serve this as "application/octet-stream".
      // We want to build files to be compatible with any server and keep build server logic simple.
      // -> We auto-append the extension corresponding to the content-type
      let filenameHint;
      const extension = urlToExtension(originalUrl);
      if (extension === "") {
        const wellKnownExtensionForThisContentType =
          CONTENT_TYPE.toUrlExtension(contentType);
        if (wellKnownExtensionForThisContentType) {
          const urlWithExtension = setUrlExtension(
            originalUrl,
            wellKnownExtensionForThisContentType,
          );
          filenameHint = urlToFilename(urlWithExtension);
        }
      }

      return {
        content,
        contentType,
        contentLength: responseHeaders.get("content-length") || undefined,
        filenameHint,
      };
    },
  };
};

// see https://github.com/parshap/node-sanitize-filename/blob/master/index.js
const asValidFilename = (string) => {
  string = string.trim().toLowerCase();
  if (string === ".") return "_";
  if (string === "..") return "__";
  string = string.replace(/[ ,]/g, "_").replace(/["/?<>\\:*|]/g, "");
  return string;
};

const jsenvPluginDirectoryReferenceEffect = (
  directoryReferenceEffect = "error",
  { rootDirectoryUrl },
) => {
  let getDirectoryReferenceEffect;
  if (typeof directoryReferenceEffect === "string") {
    getDirectoryReferenceEffect = () => directoryReferenceEffect;
  } else if (typeof directoryReferenceEffect === "function") {
    getDirectoryReferenceEffect = directoryReferenceEffect;
  } else if (typeof directoryReferenceEffect === "object") {
    const associations = URL_META.resolveAssociations(
      { effect: directoryReferenceEffect },
      rootDirectoryUrl,
    );
    getDirectoryReferenceEffect = (reference) => {
      const { url } = reference;
      const meta = URL_META.applyAssociations({ url, associations });
      return meta.effect || "error";
    };
  }

  return {
    name: "jsenv:directory_reference_effect",
    appliesDuring: "*",
    redirectReference: (reference) => {
      // http, https, data, about, ...
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      if (reference.isInline) {
        return null;
      }
      if (reference.ownerUrlInfo.type === "directory") {
        reference.dirnameHint = reference.ownerUrlInfo.filenameHint;
      }
      const { pathname } = new URL(reference.url);
      if (pathname[pathname.length - 1] !== "/") {
        return null;
      }
      reference.expectedType = "directory";
      if (reference.ownerUrlInfo.type === "directory") {
        reference.dirnameHint = reference.ownerUrlInfo.filenameHint;
      }
      if (reference.type === "filesystem") {
        reference.filenameHint = `${
          reference.ownerUrlInfo.filenameHint
        }${urlToFilename(reference.url)}/`;
      } else if (reference.specifierPathname.endsWith("./")) ; else {
        reference.filenameHint = `${urlToFilename(reference.url)}/`;
      }
      let actionForDirectory;
      if (reference.type === "a_href") {
        actionForDirectory = "copy";
      } else if (reference.type === "filesystem") {
        actionForDirectory = "copy";
      } else if (reference.type === "http_request") {
        actionForDirectory = "preserve";
      } else {
        actionForDirectory = getDirectoryReferenceEffect(reference);
      }
      reference.actionForDirectory = actionForDirectory;
      if (actionForDirectory !== "copy") {
        reference.isWeak = true;
      }
      if (actionForDirectory === "error") {
        const error = new Error("Reference leads to a directory");
        defineNonEnumerableProperties(error, {
          isJsenvCookingError: true,
          code: "DIRECTORY_REFERENCE_NOT_ALLOWED",
        });
        throw error;
      }
      if (actionForDirectory === "preserve") {
        return reference.ownerUrlInfo.context.dev
          ? null
          : `ignore:${reference.specifier}`;
      }
      return null;
    },
  };
};

const jsenvPluginInjections = (rawAssociations) => {
  const getDefaultInjections = (urlInfo) => {
    if (urlInfo.context.dev && urlInfo.type === "html") {
      const relativeUrl = urlToRelativeUrl(
        urlInfo.url,
        urlInfo.context.rootDirectoryUrl,
      );
      return {
        HTML_ROOT_PATHNAME: INJECTIONS.global(`/${relativeUrl}`),
      };
    }
    return null;
  };
  let getInjections = null;

  return {
    name: "jsenv:injections",
    appliesDuring: "*",
    init: (context) => {
      if (rawAssociations && Object.keys(rawAssociations).length > 0) {
        const resolvedAssociations = URL_META.resolveAssociations(
          { injectionsGetter: rawAssociations },
          context.rootDirectoryUrl,
        );
        getInjections = (urlInfo) => {
          const { injectionsGetter } = URL_META.applyAssociations({
            url: asUrlWithoutSearch(urlInfo.url),
            associations: resolvedAssociations,
          });
          if (!injectionsGetter) {
            return null;
          }
          if (typeof injectionsGetter !== "function") {
            throw new TypeError("injectionsGetter must be a function");
          }
          return injectionsGetter(urlInfo);
        };
      }
    },
    transformUrlContent: async (urlInfo) => {
      const defaultInjections = getDefaultInjections(urlInfo);
      if (!getInjections) {
        return {
          contentInjections: defaultInjections,
        };
      }
      const injectionsResult = getInjections(urlInfo);
      if (!injectionsResult) {
        return {
          contentInjections: defaultInjections,
        };
      }
      const injections = await injectionsResult;
      return {
        contentInjections: {
          ...defaultInjections,
          ...injections,
        },
      };
    },
  };
};

const jsenvPluginInliningAsDataUrl = () => {
  return {
    name: "jsenv:inlining_as_data_url",
    appliesDuring: "*",
    // if the referenced url is a worker we could use
    // https://www.oreilly.com/library/view/web-workers/9781449322120/ch04.html
    // but maybe we should rather use ?object_url
    // or people could do this:
    // import workerText from './worker.js?text'
    // const blob = new Blob(workerText, { type: 'text/javascript' })
    // window.URL.createObjectURL(blob)
    // in any case the recommended way is to use an url
    // to benefit from shared worker and reuse worker between tabs
    formatReference: (reference) => {
      if (!reference.searchParams.has("inline")) {
        return null;
      }
      if (reference.isInline) {
        // happens when inlining file content into js
        // (for instance import "style.css" with { type: "css" } )
        // In that case the code generated look as follow
        // new InlineContent(/* content of style.css */, { type: "text/css", inlinedFromUrl: "style.css" }).
        // and during code analysis an inline reference is generated
        // with the url "style.css?inline"
        return null;
      }
      // when search param is injected, it will be removed later
      // by "getWithoutSearchParam". We don't want to redirect again
      // (would create infinite recursion)
      if (reference.prev && reference.prev.searchParams.has("inline")) {
        return null;
      }
      if (reference.type === "sourcemap_comment") {
        return null;
      }
      // <link rel="stylesheet"> and <script> can be inlined in the html
      if (
        reference.type === "link_href" &&
        reference.subtype === "stylesheet"
      ) {
        return null;
      }
      if (
        reference.original &&
        reference.original.type === "link_href" &&
        reference.original.subtype === "stylesheet"
      ) {
        return null;
      }
      if (reference.type === "script") {
        return null;
      }
      const specifierWithBase64Param = injectQueryParamsIntoSpecifier(
        reference.specifier,
        { as_base_64: "" },
      );
      const referenceInlined = reference.inline({
        line: reference.line,
        column: reference.column,
        isOriginal: reference.isOriginal,
        specifier: specifierWithBase64Param,
      });
      const urlInfoInlined = referenceInlined.urlInfo;
      return (async () => {
        await urlInfoInlined.cook();
        const base64Url = DATA_URL.stringify({
          contentType: urlInfoInlined.contentType,
          base64Flag: true,
          data: urlInfoInlined.data.base64Flag
            ? urlInfoInlined.content
            : dataToBase64(urlInfoInlined.content),
        });
        return base64Url;
      })();
    },
    fetchUrlContent: async (urlInfo) => {
      const withoutBase64ParamUrlInfo =
        urlInfo.getWithoutSearchParam("as_base_64");
      if (!withoutBase64ParamUrlInfo) {
        return null;
      }
      await withoutBase64ParamUrlInfo.cook();
      const contentAsBase64 = Buffer.from(
        withoutBase64ParamUrlInfo.content,
      ).toString("base64");
      urlInfo.data.base64Flag = true;
      return {
        originalContent: withoutBase64ParamUrlInfo.originalContent,
        content: contentAsBase64,
        contentType: withoutBase64ParamUrlInfo.contentType,
      };
    },
  };
};

const dataToBase64 = (data) => Buffer.from(data).toString("base64");

const jsenvPluginInliningIntoHtml = () => {
  return {
    name: "jsenv:inlining_into_html",
    appliesDuring: "*",
    transformUrlContent: {
      html: async (urlInfo) => {
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const mutations = [];
        const actions = [];

        const onLinkRelStyleSheet = (linkNode, { href }) => {
          let linkReference = null;
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            if (
              referenceToOther.generatedSpecifier === href &&
              referenceToOther.type === "link_href" &&
              referenceToOther.subtype === "stylesheet"
            ) {
              linkReference = referenceToOther;
              break;
            }
          }
          if (!linkReference.searchParams.has("inline")) {
            return;
          }
          const { line, column, isOriginal } = getHtmlNodePosition(linkNode, {
            preferOriginal: true,
          });
          const linkInlineUrl = getUrlForContentInsideHtml(
            linkNode,
            urlInfo,
            linkReference,
          );
          const linkReferenceInlined = linkReference.inline({
            line,
            column,
            isOriginal,
            specifier: linkInlineUrl,
            type: "style",
            expectedType: linkReference.expectedType,
          });
          const linkUrlInfoInlined = linkReferenceInlined.urlInfo;

          actions.push(async () => {
            await linkUrlInfoInlined.cook();
            mutations.push(() => {
              setHtmlNodeAttributes(linkNode, {
                "inlined-from-href": linkReference.url,
                "href": undefined,
                "rel": undefined,
                "type": undefined,
                "as": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
                "jsenv-inlined-by": "jsenv:inlining_into_html",
              });
              linkNode.nodeName = "style";
              linkNode.tagName = "style";
              setHtmlNodeText(linkNode, linkUrlInfoInlined.content, {
                indentation: "auto",
              });
            });
          });
        };
        const onScriptWithSrc = (scriptNode, { type, src }) => {
          let scriptReference;
          for (const dependencyReference of urlInfo.referenceToOthersSet) {
            if (
              dependencyReference.generatedSpecifier === src &&
              dependencyReference.type === "script"
            ) {
              scriptReference = dependencyReference;
              break;
            }
          }
          if (!scriptReference.searchParams.has("inline")) {
            return;
          }
          const { line, column, isOriginal } = getHtmlNodePosition(scriptNode, {
            preferOriginal: true,
          });
          const scriptInlineUrl = getUrlForContentInsideHtml(
            scriptNode,
            urlInfo,
            scriptReference,
          );
          const scriptReferenceInlined = scriptReference.inline({
            line,
            column,
            isOriginal,
            specifier: scriptInlineUrl,
            type,
            subtype: scriptReference.subtype,
            expectedType: scriptReference.expectedType,
          });
          const scriptUrlInfoInlined = scriptReferenceInlined.urlInfo;
          actions.push(async () => {
            await scriptUrlInfoInlined.cook();
            mutations.push(() => {
              setHtmlNodeAttributes(scriptNode, {
                "inlined-from-src": src,
                "src": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
                "jsenv-inlined-by": "jsenv:inlining_into_html",
              });
              setHtmlNodeText(scriptNode, scriptUrlInfoInlined.content, {
                indentation: "auto",
              });
            });
          });
        };

        visitHtmlNodes(htmlAst, {
          link: (linkNode) => {
            const rel = getHtmlNodeAttribute(linkNode, "rel");
            if (rel !== "stylesheet") {
              return;
            }
            const href = getHtmlNodeAttribute(linkNode, "href");
            if (!href) {
              return;
            }
            onLinkRelStyleSheet(linkNode, { href });
          },
          script: (scriptNode) => {
            const { type } = analyzeScriptNode(scriptNode);
            const scriptNodeText = getHtmlNodeText(scriptNode);
            if (scriptNodeText) {
              return;
            }
            const src = getHtmlNodeAttribute(scriptNode, "src");
            if (!src) {
              return;
            }
            onScriptWithSrc(scriptNode, { type, src });
          },
        });
        if (actions.length > 0) {
          await Promise.all(actions.map((action) => action()));
        }
        mutations.forEach((mutation) => mutation());
        const htmlModified = stringifyHtmlAst(htmlAst);
        return htmlModified;
      },
    },
  };
};

const jsenvPluginInlining = () => {
  return [jsenvPluginInliningAsDataUrl(), jsenvPluginInliningIntoHtml()];
};

/*
 * Some code uses globals specific to Node.js in code meant to run in browsers...
 * This plugin will replace some node globals to things compatible with web:
 * - process.env.NODE_ENV
 * - __filename
 * - __dirname
 * - global
 */


const jsenvPluginCommonJsGlobals = () => {
  const transformCommonJsGlobals = async (urlInfo) => {
    if (
      !urlInfo.content.includes("process.env.NODE_ENV") &&
      !urlInfo.content.includes("__filename") &&
      !urlInfo.content.includes("__dirname")
    ) {
      return null;
    }
    const isJsModule = urlInfo.type === "js_module";
    const replaceMap = {
      "process.env.NODE_ENV": `("${
        urlInfo.context.dev ? "development" : "production"
      }")`,
      "global": "globalThis",
      "__filename": isJsModule
        ? `import.meta.url.slice('file:///'.length)`
        : `document.currentScript.src`,
      "__dirname": isJsModule
        ? `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
        : `new URL('./', document.currentScript.src).href`,
    };
    const { metadata } = await applyBabelPlugins({
      babelPlugins: [
        [
          babelPluginMetadataExpressionPaths,
          {
            replaceMap,
            allowConflictingReplacements: true,
          },
        ],
      ],
      input: urlInfo.content,
      inputIsJsModule: urlInfo.type === "js_module",
      inputUrl: urlInfo.originalUrl,
      outputUrl: urlInfo.generatedUrl,
    });
    const { expressionPaths } = metadata;
    const keys = Object.keys(expressionPaths);
    if (keys.length === 0) {
      return null;
    }
    const magicSource = createMagicSource(urlInfo.content);
    keys.forEach((key) => {
      expressionPaths[key].forEach((path) => {
        magicSource.replace({
          start: path.node.start,
          end: path.node.end,
          replacement: replaceMap[key],
        });
      });
    });
    return magicSource.toContentAndSourcemap();
  };

  return {
    name: "jsenv:commonjs_globals",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformCommonJsGlobals,
      js_module: transformCommonJsGlobals,
    },
  };
};

// heavily inspired from https://github.com/jviide/babel-plugin-transform-replace-expressions
// last known commit: 57b608e0eeb8807db53d1c68292621dfafb5599c
const babelPluginMetadataExpressionPaths = (
  babel,
  { replaceMap = {}, allowConflictingReplacements = false },
) => {
  const { traverse, parse, types } = babel;
  const replacementMap = new Map();
  const valueExpressionSet = new Set();

  return {
    name: "metadata-replace",

    pre: (state) => {
      // https://github.com/babel/babel/blob/d50e78d45b608f6e0f6cc33aeb22f5db5027b153/packages/babel-traverse/src/path/replacement.js#L93
      const parseExpression = (value) => {
        const expressionNode = parse(value, state.opts).program.body[0]
          .expression;
        traverse.removeProperties(expressionNode);
        return expressionNode;
      };
      Object.keys(replaceMap).forEach((key) => {
        const keyExpressionNode = parseExpression(key);
        const candidateArray = replacementMap.get(keyExpressionNode.type) || [];
        const value = replaceMap[key];
        const valueExpressionNode = parseExpression(value);
        const equivalentKeyExpressionIndex = candidateArray.findIndex(
          (candidate) =>
            types.isNodesEquivalent(
              candidate.keyExpressionNode,
              keyExpressionNode,
            ),
        );
        if (
          !allowConflictingReplacements &&
          equivalentKeyExpressionIndex > -1
        ) {
          throw new Error(
            `Expressions ${candidateArray[equivalentKeyExpressionIndex].key} and ${key} conflict`,
          );
        }
        const newCandidate = {
          key,
          value,
          keyExpressionNode,
          valueExpressionNode,
        };
        if (equivalentKeyExpressionIndex > -1) {
          candidateArray[equivalentKeyExpressionIndex] = newCandidate;
        } else {
          candidateArray.push(newCandidate);
        }
        replacementMap.set(keyExpressionNode.type, candidateArray);
      });
      replacementMap.forEach((candidateArray) => {
        candidateArray.forEach((candidate) => {
          valueExpressionSet.add(candidate.valueExpressionNode);
        });
      });
    },
    visitor: {
      Program: (programPath, state) => {
        const expressionPaths = {};
        programPath.traverse({
          Expression(path) {
            if (valueExpressionSet.has(path.node)) {
              path.skip();
              return;
            }
            const candidateArray = replacementMap.get(path.node.type);
            if (!candidateArray) {
              return;
            }
            const candidateFound = candidateArray.find((candidate) => {
              return types.isNodesEquivalent(
                candidate.keyExpressionNode,
                path.node,
              );
            });
            if (candidateFound) {
              try {
                types.validate(
                  path.parent,
                  path.key,
                  candidateFound.valueExpressionNode,
                );
              } catch (err) {
                if (err instanceof TypeError) {
                  path.skip();
                  return;
                }
                throw err;
              }
              const paths = expressionPaths[candidateFound.key];
              if (paths) {
                expressionPaths[candidateFound.key] = [...paths, path];
              } else {
                expressionPaths[candidateFound.key] = [path];
              }
              return;
            }
          },
        });
        state.file.metadata.expressionPaths = expressionPaths;
      },
    },
  };
};

/*
 * Source code can contain the following
 * - import.meta.dev
 * - import.meta.build
 * They are either:
 * - replaced by true: When scenario matches (import.meta.dev and it's the dev server)
 * - left as is to be evaluated to undefined (import.meta.build but it's the dev server)
 * - replaced by undefined (import.meta.dev but it's build; the goal is to ensure it's tree-shaked)
 *
 * TODO: ideally during dev we would keep import.meta.dev and ensure we set it to true rather than replacing it with true?
 */


const jsenvPluginImportMetaScenarios = () => {
  return {
    name: "jsenv:import_meta_scenario",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo) => {
        if (
          !urlInfo.content.includes("import.meta.dev") &&
          !urlInfo.content.includes("import.meta.test") &&
          !urlInfo.content.includes("import.meta.build")
        ) {
          return null;
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaScenarios],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        const { dev = [], build = [] } = metadata.importMetaScenarios;
        const replacements = [];
        const replace = (path, value) => {
          replacements.push({ path, value });
        };
        if (urlInfo.context.build) {
          // during build ensure replacement for tree-shaking
          dev.forEach((path) => {
            replace(path, "undefined");
          });
          build.forEach((path) => {
            replace(path, "true");
          });
        } else {
          // during dev we can let "import.meta.build" untouched
          // it will be evaluated to undefined.
          // Moreover it can be surprising to see some "undefined"
          // when source file contains "import.meta.build"
          dev.forEach((path) => {
            replace(path, "true");
          });
        }
        const magicSource = createMagicSource(urlInfo.content);
        replacements.forEach(({ path, value }) => {
          magicSource.replace({
            start: path.node.start,
            end: path.node.end,
            replacement: value,
          });
        });
        return magicSource.toContentAndSourcemap();
      },
    },
  };
};

const babelPluginMetadataImportMetaScenarios = () => {
  return {
    name: "metadata-import-meta-scenarios",
    visitor: {
      Program(programPath, state) {
        const importMetas = {};
        programPath.traverse({
          MemberExpression(path) {
            const { node } = path;
            const { object } = node;
            if (object.type !== "MetaProperty") {
              return;
            }
            const { property: objectProperty } = object;
            if (objectProperty.name !== "meta") {
              return;
            }
            const { property } = node;
            const { name } = property;
            const importMetaPaths = importMetas[name];
            if (importMetaPaths) {
              importMetaPaths.push(path);
            } else {
              importMetas[name] = [path];
            }
          },
        });
        state.file.metadata.importMetaScenarios = {
          dev: importMetas.dev,
          build: importMetas.build,
        };
      },
    },
  };
};

/*
 * Source code can contain the following
 * - __DEV__
 * - __BUILD__
 * That will be replaced with true/false
 */


const jsenvPluginGlobalScenarios = () => {
  const transformIfNeeded = (urlInfo) => {
    return {
      contentInjections: {
        __DEV__: INJECTIONS.optional(urlInfo.context.dev),
        __BUILD__: INJECTIONS.optional(urlInfo.context.build),
      },
    };
  };

  return {
    name: "jsenv:global_scenario",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformIfNeeded,
      js_module: transformIfNeeded,
      html: transformIfNeeded,
    },
  };
};

const jsenvPluginNodeRuntime = ({ runtimeCompat }) => {
  const nodeFound = Object.keys(runtimeCompat).includes("node");
  if (!nodeFound) {
    return [];
  }

  // what do we need to do?
  return {
    name: "jsenv:node_runtime",
    appliesDuring: "*",
  };
};

/**
 * Inline CSS would force to write the following boilerplate all the time:
 * ```js
 * const css = `body { color: red; }`;
 * const stylesheet = new CSSStyleSheet();
 * stylesheet.replaceSync(css);
 * document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
 * if (import.meta.hot) {
 *   import.meta.hot.dispose(() => {
 *       document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
 *           (s) => s !== stylesheet,
 *       );
 *   });
 * }
 * ```
 *
 * It would be nice to have a plugin that does this automatically with the following syntax
 *
 * ```js
 * const css = `body { color: red; }`;
 * import.meta.css = css;
 * ```
 *
 */


const jsenvPluginImportMetaCss = () => {
  const importMetaCssClientFileUrl = import.meta
    .resolve("../client/import_meta_css/import_meta_css.js");
  const importMetaCssBuildFileUrl = import.meta
    .resolve("../client/import_meta_css/import_meta_css_build.js");

  return {
    name: "jsenv:import_meta_css",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo) => {
        if (!urlInfo.content.includes("import.meta.css")) {
          return null;
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataUsesImportMetaCss],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        const { usesImportMetaCss } = metadata;
        if (!usesImportMetaCss) {
          return null;
        }
        return injectImportMetaCss(
          urlInfo,
          urlInfo.context.build
            ? importMetaCssBuildFileUrl
            : importMetaCssClientFileUrl,
        );
      },
    },
  };
};

const babelPluginMetadataUsesImportMetaCss = () => {
  return {
    name: "metadata-uses-import-meta-css",
    visitor: {
      Program(programPath, state) {
        let usesImportMetaCss = false;
        programPath.traverse({
          MemberExpression(path) {
            const { node } = path;
            const { object } = node;
            if (object.type !== "MetaProperty") {
              return;
            }
            const { property: objectProperty } = object;
            if (objectProperty.name !== "meta") {
              return;
            }
            const { property } = node;
            const { name } = property;
            if (name === "css") {
              usesImportMetaCss = true;
              path.stop();
            }
          },
        });
        state.file.metadata.usesImportMetaCss = usesImportMetaCss;
      },
    },
  };
};

const injectImportMetaCss = (urlInfo, importMetaCssClientFileUrl) => {
  const importMetaCssClientFileReference = urlInfo.dependencies.inject({
    parentUrl: urlInfo.url,
    type: "js_import",
    expectedType: "js_module",
    specifier: importMetaCssClientFileUrl,
  });
  let content = urlInfo.content;
  let prelude = `import { installImportMetaCss } from ${importMetaCssClientFileReference.generatedSpecifier};

const remove = installImportMetaCss(import.meta);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    remove();
  });
}

`;
  return {
    content: `${prelude.replace(/\n/g, "")}${content}`,
  };
};

// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

const babelPluginMetadataImportMetaHot = () => {
  return {
    name: "metadata-import-meta-hot",
    visitor: {
      Program(programPath, state) {
        Object.assign(
          state.file.metadata,
          collectImportMetaHotProperties(programPath),
        );
      },
    },
  };
};
const collectImportMetaHotProperties = (programPath) => {
  const importMetaHotPaths = [];
  let hotDecline = false;
  let hotAcceptSelf = false;
  let hotAcceptDependencies = [];
  programPath.traverse({
    MemberExpression(path) {
      const { node } = path;
      const { object } = node;
      if (object.type !== "MetaProperty") {
        return;
      }
      const { property: objectProperty } = object;
      if (objectProperty.name !== "meta") {
        return;
      }
      const { property } = node;
      const { name } = property;
      if (name === "hot") {
        importMetaHotPaths.push(path);
      }
    },
    CallExpression(path) {
      if (isImportMetaHotMethodCall(path, "accept")) {
        const callNode = path.node;
        const args = callNode.arguments;
        if (args.length === 0) {
          hotAcceptSelf = true;
          return;
        }
        const firstArg = args[0];
        if (firstArg.type === "StringLiteral") {
          hotAcceptDependencies = [
            {
              specifierPath: path.get("arguments")[0],
            },
          ];
          return;
        }
        if (firstArg.type === "ArrayExpression") {
          const firstArgPath = path.get("arguments")[0];
          hotAcceptDependencies = firstArg.elements.map((arrayNode, index) => {
            if (arrayNode.type !== "StringLiteral") {
              throw new Error(
                `all array elements must be strings in "import.meta.hot.accept(array)"`,
              );
            }
            return {
              specifierPath: firstArgPath.get(String(index)),
            };
          });
          return;
        }
        // accept first arg can be "anything" such as
        // `const cb = () => {}; import.meta.accept(cb)`
        hotAcceptSelf = true;
      }
      if (isImportMetaHotMethodCall(path, "decline")) {
        hotDecline = true;
      }
    },
  });
  return {
    importMetaHotPaths,
    hotDecline,
    hotAcceptSelf,
    hotAcceptDependencies,
  };
};
const isImportMetaHotMethodCall = (path, methodName) => {
  const { property, object } = path.node.callee;
  return (
    property &&
    property.name === methodName &&
    object &&
    object.property &&
    object.property.name === "hot" &&
    object.object.type === "MetaProperty"
  );
};

// Some "smart" default applied to decide what should hot reload / fullreload:
// By default:
//   - hot reload on <img src="./image.png" />
//   - fullreload on <script src="./file.js" />
// Can be controlled by [hot-decline] and [hot-accept]:
//   - fullreload on <img src="./image.png" hot-decline />
//   - hot reload on <script src="./file.js" hot-accept />
const collectHotDataFromHtmlAst = (htmlAst) => {
  const hotReferences = [];

  const onSpecifier = ({ specifier, node, attributeName, hotAccepted }) => {
    if (
      // explicitely enabled with [hot-accept] attribute
      hotAccepted === true ||
      htmlNodeCanHotReload(node)
    ) {
      hotReferences.push({
        type: `${node.nodeName}_${attributeName}`,
        specifier,
      });
    }
  };

  const visitUrlSpecifierAttribute = ({ node, attributeName, hotAccepted }) => {
    const value = getHtmlNodeAttribute(node, attributeName);
    if (value) {
      onSpecifier({
        specifier: value,
        node,
        attributeName,
        hotAccepted,
      });
    }
  };

  const onNode = (node, { hotAccepted }) => {
    // explicitely disabled with [hot-decline] attribute
    if (hotAccepted === false) {
      return;
    }
    if (nodeNamesWithHref.includes(node.nodeName)) {
      visitUrlSpecifierAttribute({
        node,
        attributeName: "href",
        hotAccepted,
      });
      visitUrlSpecifierAttribute({
        node,
        attributeName: "inlined-from-href",
        hotAccepted,
      });
    }
    if (nodeNamesWithSrc.includes(node.nodeName)) {
      visitUrlSpecifierAttribute({
        node,
        attributeName: "src",
        hotAccepted,
      });
      visitUrlSpecifierAttribute({
        node,
        attributeName: "inlined-from-src",
        hotAccepted,
      });
    }
    if (nodeNamesWithSrcset.includes(node.nodeName)) {
      const srcset = getHtmlNodeAttribute(node, "srcset");
      if (srcset) {
        const srcCandidates = parseSrcSet(srcset);
        srcCandidates.forEach((srcCandidate) => {
          onSpecifier({
            node,
            specifier: srcCandidate.specifier,
            attributeName: "srcset",
            hotAccepted,
          });
        });
      }
    }
  };

  const iterate = (node, context) => {
    context = {
      ...context,
      ...getNodeContext(node),
    };
    onNode(node, context);
    const { childNodes } = node;
    if (childNodes) {
      let i = 0;
      while (i < childNodes.length) {
        const childNode = childNodes[i++];
        iterate(childNode, context);
      }
    }
  };
  iterate(htmlAst, {});

  return hotReferences;
};

const nodeNamesWithHref = ["link", "a", "image", "use"];
const nodeNamesWithSrc = ["script", "iframe", "img"];
const nodeNamesWithSrcset = ["img", "source"];

const getNodeContext = (node) => {
  const context = {};
  const hotAccept = getHtmlNodeAttribute(node, "hot-accept");
  if (hotAccept !== undefined) {
    context.hotAccepted = true;
  }
  const hotDecline = getHtmlNodeAttribute(node, "hot-decline");
  if (hotDecline !== undefined) {
    context.hotAccepted = false;
  }
  return context;
};

const htmlNodeCanHotReload = (node) => {
  if (node.nodeName === "link") {
    const { isStylesheet, isResourceHint, rel } = analyzeLinkNode(node);
    if (isStylesheet) {
      // stylesheets can be hot replaced by default
      return true;
    }
    if (isResourceHint) {
      return false;
    }
    return rel === "icon";
  }
  return [
    // "script", // script cannot hot reload
    "a",
    // Iframe will have their own event source client
    // and can hot reload independently
    // But if the iframe communicates with the parent iframe
    // then we canot know for sure if the communication is broken
    // ideally, if the iframe full-reload the page must full-reload too
    // if the iframe hot-reload we don't know but we could assume there is nothing to do
    // if there is [hot-accept] on the iframe
    "iframe",
    "img",
    "source",
    "image",
    "use",
  ].includes(node.nodeName);
};

const jsenvPluginImportMetaHot = () => {
  const importMetaHotClientFileUrl = import.meta
    .resolve("../client/import_meta_hot/import_meta_hot.js");

  return {
    name: "jsenv:import_meta_hot",
    appliesDuring: "*",
    transformUrlContent: {
      html: (htmlUrlInfo) => {
        // during build we don't really care to parse html hot dependencies
        if (htmlUrlInfo.context.build) {
          return;
        }
        const htmlAst = parseHtml({
          html: htmlUrlInfo.content,
          url: htmlUrlInfo.url,
        });
        const hotReferences = collectHotDataFromHtmlAst(htmlAst);
        htmlUrlInfo.data.hotDecline = false;
        htmlUrlInfo.data.hotAcceptSelf = false;
        htmlUrlInfo.data.hotAcceptDependencies = hotReferences.map(
          ({ type, specifier }) => {
            let existingReference = null;
            for (const referenceToOther of htmlUrlInfo.referenceToOthersSet) {
              if (
                referenceToOther.type === type &&
                referenceToOther.specifier === specifier
              ) {
                existingReference = referenceToOther;
                break;
              }
            }
            if (existingReference) {
              return existingReference.url;
            }
            const reference = htmlUrlInfo.dependencies.found({
              type,
              specifier,
            });
            return reference.url;
          },
        );
      },
      css: (cssUrlInfo) => {
        cssUrlInfo.data.hotDecline = false;
        cssUrlInfo.data.hotAcceptSelf = false;
        cssUrlInfo.data.hotAcceptDependencies = [];
      },
      js_module: async (urlInfo) => {
        if (!urlInfo.content.includes("import.meta.hot")) {
          return null;
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaHot],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        const {
          importMetaHotPaths,
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies,
        } = metadata;
        urlInfo.data.hotDecline = hotDecline;
        urlInfo.data.hotAcceptSelf = hotAcceptSelf;
        urlInfo.data.hotAcceptDependencies = hotAcceptDependencies;
        if (importMetaHotPaths.length === 0) {
          return null;
        }
        if (urlInfo.context.build) {
          return removeImportMetaHots(urlInfo, importMetaHotPaths);
        }
        return injectImportMetaHot(urlInfo, importMetaHotClientFileUrl);
      },
    },
  };
};

const removeImportMetaHots = (urlInfo, importMetaHotPaths) => {
  const magicSource = createMagicSource(urlInfo.content);
  importMetaHotPaths.forEach((path) => {
    magicSource.replace({
      start: path.node.start,
      end: path.node.end,
      replacement: "undefined",
    });
  });
  return magicSource.toContentAndSourcemap();
};

// For some reason using magic source here produce
// better sourcemap than doing the equivalent with babel
// I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
// which is likely not well supported by babel
const injectImportMetaHot = (urlInfo, importMetaHotClientFileUrl) => {
  const importMetaHotClientFileReference = urlInfo.dependencies.inject({
    parentUrl: urlInfo.url,
    type: "js_import",
    expectedType: "js_module",
    specifier: importMetaHotClientFileUrl,
  });
  let content = urlInfo.content;
  let prelude = `import { createImportMetaHot } from ${importMetaHotClientFileReference.generatedSpecifier};
import.meta.hot = createImportMetaHot(import.meta.url);
`;
  return {
    content: `${prelude.replace(/\n/g, "")}${content}`,
  };
};

const jsenvPluginAutoreloadClient = () => {
  const autoreloadClientFileUrl = import.meta.resolve("../client/autoreload/autoreload.js");

  return {
    name: "jsenv:autoreload_client",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (htmlUrlInfo) => {
        const htmlAst = parseHtml({
          html: htmlUrlInfo.content,
          url: htmlUrlInfo.url,
        });
        const autoreloadClientReference = htmlUrlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: autoreloadClientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: autoreloadClientReference.generatedSpecifier,
          initCall: {
            callee: "initAutoreload",
            params: {
              mainFilePath: `/${htmlUrlInfo.kitchen.context.mainFilePath}`,
            },
          },
          pluginName: "jsenv:autoreload_client",
        });
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified,
        };
      },
    },
  };
};

const jsenvPluginAutoreloadServer = ({
  clientFileChangeEventEmitter,
  clientFileDereferencedEventEmitter,
}) => {
  return {
    name: "jsenv:autoreload_server",
    appliesDuring: "dev",
    serverEvents: {
      reload: (serverEventInfo) => {
        const formatUrlForClient = (url) => {
          if (urlIsOrIsInsideOf(url, serverEventInfo.rootDirectoryUrl)) {
            return urlToRelativeUrl(url, serverEventInfo.rootDirectoryUrl);
          }
          if (url.startsWith("file:")) {
            return `/@fs/${url.slice("file:///".length)}`;
          }
          return url;
        };
        const update = (firstUrlInfo) => {
          const boundaries = new Set();
          const instructions = [];
          const propagateUpdate = (firstUrlInfo) => {
            const iterate = (urlInfo, chain) => {
              if (urlInfo.data.hotAcceptSelf) {
                boundaries.add(urlInfo);
                instructions.push({
                  type: urlInfo.type,
                  boundary: formatUrlForClient(urlInfo.url),
                  acceptedBy: formatUrlForClient(urlInfo.url),
                });
                return {
                  accepted: true,
                  reason:
                    urlInfo === firstUrlInfo
                      ? `file accepts hot reload`
                      : `a dependent file accepts hot reload`,
                };
              }
              if (
                urlInfo.data.hotDecline ||
                urlInfo.lastReference?.type === "http_request"
              ) {
                return {
                  declined: true,
                  reason: `file declines hot reload`,
                  declinedBy: formatUrlForClient(urlInfo.url),
                };
              }
              let instructionCountBefore = instructions.length;
              for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
                if (
                  referenceFromOther.isImplicit &&
                  referenceFromOther.isWeak
                ) {
                  if (!referenceFromOther.original) {
                    continue;
                  }
                  if (referenceFromOther.original.isWeak) {
                    continue;
                  }
                }
                const urlInfoReferencingThisOne =
                  referenceFromOther.ownerUrlInfo;
                if (urlInfoReferencingThisOne.data.hotDecline) {
                  return {
                    declined: true,
                    reason: `a dependent file declines hot reload`,
                    declinedBy: formatUrlForClient(
                      urlInfoReferencingThisOne.url,
                    ),
                  };
                }
                const { hotAcceptDependencies = [] } =
                  urlInfoReferencingThisOne.data;
                if (hotAcceptDependencies.includes(urlInfo.url)) {
                  boundaries.add(urlInfoReferencingThisOne);
                  instructions.push({
                    type: urlInfoReferencingThisOne.type,
                    boundary: formatUrlForClient(urlInfoReferencingThisOne.url),
                    acceptedBy: formatUrlForClient(urlInfo.url),
                  });
                  continue;
                }
                if (chain.includes(urlInfoReferencingThisOne.url)) {
                  return {
                    declined: true,
                    reason: "dead end",
                    declinedBy: formatUrlForClient(
                      urlInfoReferencingThisOne.url,
                    ),
                  };
                }
                const dependentPropagationResult = iterateMemoized(
                  urlInfoReferencingThisOne,
                  [...chain, urlInfoReferencingThisOne.url],
                );
                if (dependentPropagationResult.accepted) {
                  continue;
                }
                if (
                  // declined explicitely by an other file, it must decline the whole update
                  dependentPropagationResult.declinedBy
                ) {
                  return dependentPropagationResult;
                }
                // declined by absence of boundary, we can keep searching
              }
              if (instructionCountBefore === instructions.length) {
                return {
                  declined: true,
                  reason: `there is no file accepting hot reload while propagating update`,
                };
              }
              return {
                accepted: true,
                reason: `${instructions.length} dependent file(s) accepts hot reload`,
              };
            };

            const map = new Map();
            const iterateMemoized = (urlInfo, chain) => {
              const resultFromCache = map.get(urlInfo.url);
              if (resultFromCache) {
                return resultFromCache;
              }
              const result = iterate(urlInfo, chain);
              map.set(urlInfo.url, result);
              return result;
            };
            map.clear();
            return iterateMemoized(firstUrlInfo, []);
          };

          let propagationResult = propagateUpdate(firstUrlInfo);
          const seen = new Set();
          const invalidateImporters = (urlInfo) => {
            // to indicate this urlInfo should be modified
            for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
              const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
              const { hotDecline, hotAcceptDependencies = [] } =
                urlInfoReferencingThisOne.data;
              if (hotDecline) {
                propagationResult = {
                  declined: true,
                  reason: `file declines hot reload`,
                  declinedBy: formatUrlForClient(urlInfoReferencingThisOne.url),
                };
                return;
              }
              if (hotAcceptDependencies.includes(urlInfo.url)) {
                continue;
              }
              if (seen.has(urlInfoReferencingThisOne)) {
                continue;
              }
              seen.add(urlInfoReferencingThisOne);
              // see https://github.com/vitejs/vite/blob/ab5bb40942c7023046fa6f6d0b49cabc105b6073/packages/vite/src/node/server/moduleGraph.ts#L205C5-L207C6
              if (boundaries.has(urlInfoReferencingThisOne)) {
                return;
              }
              urlInfoReferencingThisOne.descendantModifiedTimestamp =
                Date.now();
              invalidateImporters(urlInfoReferencingThisOne);
            }
          };
          invalidateImporters(firstUrlInfo);
          boundaries.clear();
          seen.clear();
          return {
            ...propagationResult,
            instructions,
          };
        };

        // We are delaying the moment we tell client how to reload because:
        //
        // 1. clientFileDereferencedEventEmitter can emit multiple times in a row
        // It happens when previous references are removed by stopCollecting (in "references.js")
        // In that case we could regroup the calls but we prefer to rely on debouncing to also cover
        // code that would remove many url in a row by other means (like reference.remove())
        //
        // 2. clientFileChangeEventEmitter can emit a lot of times in a short period (git checkout for instance)
        // In that case it's better to cooldown thanks to debouncing
        //
        // And we want to gather all the actions to take in response to these events because
        // we want to favor full-reload when needed and resort to partial reload afterwards
        // it's also important to ensure the client will fetch the server in the same order
        const delayedActionSet = new Set();
        let timeout;
        const delayAction = (action) => {
          delayedActionSet.add(action);
          clearTimeout(timeout);
          timeout = setTimeout(handleDelayedActions);
        };

        const handleDelayedActions = () => {
          const actionSet = new Set(delayedActionSet);
          delayedActionSet.clear();
          let reloadMessage = null;
          for (const action of actionSet) {
            if (action.type === "change") {
              const { changedUrlInfo, event } = action;
              if (!changedUrlInfo.isUsed()) {
                continue;
              }
              const hotUpdate = update(changedUrlInfo);
              const relativeUrl = formatUrlForClient(changedUrlInfo.url);
              if (hotUpdate.declined) {
                reloadMessage = {
                  cause: `${relativeUrl} ${event}`,
                  type: "full",
                  typeReason: hotUpdate.reason,
                  declinedBy: hotUpdate.declinedBy,
                };
                break;
              }
              const instructions = hotUpdate.instructions;
              if (reloadMessage) {
                reloadMessage.hotInstructions.push(...instructions);
              } else {
                reloadMessage = {
                  cause: `${relativeUrl} ${event}`,
                  type: "hot",
                  typeReason: hotUpdate.reason,
                  hotInstructions: instructions,
                };
              }
              continue;
            }

            if (action.type === "prune") {
              const { prunedUrlInfo, lastReferenceFromOther } = action;
              if (lastReferenceFromOther.type === "sourcemap_comment") {
                // Can happen when starting dev server with sourcemaps: "file"
                // In that case, as sourcemaps are injected, the reference
                // are lost and sourcemap is considered as pruned
                continue;
              }
              if (lastReferenceFromOther.type === "http_request") {
                // no need to tell client to reload when a http request is pruned
                // happens when reloading the current html page for instance
                continue;
              }
              if (
                lastReferenceFromOther.injected &&
                lastReferenceFromOther.isWeak &&
                lastReferenceFromOther.isImplicit
              ) {
                continue;
              }
              const { ownerUrlInfo } = lastReferenceFromOther;
              if (!ownerUrlInfo.isUsed()) {
                continue;
              }
              const ownerHotUpdate = update(ownerUrlInfo);
              const cause = `${formatUrlForClient(
                prunedUrlInfo.url,
              )} is no longer referenced`;
              // now check if we can hot update the parent resource
              // then if we can hot update all dependencies
              if (ownerHotUpdate.declined) {
                reloadMessage = {
                  cause,
                  type: "full",
                  typeReason: ownerHotUpdate.reason,
                  declinedBy: ownerHotUpdate.declinedBy,
                };
                break;
              }
              // parent can hot update
              // but pruned url info declines
              if (prunedUrlInfo.data.hotDecline) {
                reloadMessage = {
                  cause,
                  type: "full",
                  typeReason: `a pruned file declines hot reload`,
                  declinedBy: formatUrlForClient(prunedUrlInfo.url),
                };
                break;
              }
              const pruneInstruction = {
                type: "prune",
                boundary: formatUrlForClient(prunedUrlInfo.url),
                acceptedBy: formatUrlForClient(
                  lastReferenceFromOther.ownerUrlInfo.url,
                ),
              };
              if (reloadMessage) {
                reloadMessage.hotInstructions.push(pruneInstruction);
              } else {
                reloadMessage = {
                  cause,
                  type: "hot",
                  typeReason: ownerHotUpdate.reason,
                  hotInstructions: [pruneInstruction],
                };
              }
            }
          }
          if (reloadMessage) {
            serverEventInfo.sendServerEvent(reloadMessage);
          }
        };

        clientFileChangeEventEmitter.on(({ url, event }) => {
          const changedUrlInfo = serverEventInfo.kitchen.graph.getUrlInfo(url);
          if (!changedUrlInfo) {
            return;
          }
          delayAction({
            type: "change",
            changedUrlInfo,
            event,
          });
          // for (const searchParamVariant of changedUrlInfo.searchParamVariantSet) {
          //   delayAction({
          //     type: "change",
          //     changedUrlInfo: searchParamVariant,
          //     event,
          //   });
          // }
        });
        clientFileDereferencedEventEmitter.on(
          (prunedUrlInfo, lastReferenceFromOther) => {
            delayAction({
              type: "prune",
              prunedUrlInfo,
              lastReferenceFromOther,
            });
          },
        );
      },
    },
    devServerRoutes: [
      {
        endpoint: "GET /.internal/graph.json",
        description:
          "Return a url graph of the project as a JSON file. This is useful to debug the project graph.",
        availableMediaTypes: ["application/json"],
        declarationSource: import.meta.url,
        fetch: (request, { kitchen }) => {
          const graphJson = JSON.stringify(
            kitchen.graph.toJSON(kitchen.context.rootDirectoryUrl),
          );
          return {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(graphJson),
            },
            body: graphJson,
          };
        },
      },
    ],
  };
};

/*
 * When client wants to hot reload, it wants to be sure it can reach the server
 * and bypass any cache. This is done thanks to "hot" search param
 * being injected by the client: file.js?hot=Date.now()
 * When it happens server must:
 * 1. Consider it's a regular request to "file.js" and not a variation
 * of it (not like file.js?as_js_classic that creates a separate urlInfo)
 * -> This is done by redirectReference deleting the search param.
 *
 * 2. Inject ?hot= into all urls referenced by this one
 * -> This is done by transformReferenceSearchParams
 */

const jsenvPluginHotSearchParam = () => {
  return {
    name: "jsenv:hot_search_param",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      if (!reference.searchParams.has("hot")) {
        return null;
      }
      const urlObject = new URL(reference.url);
      // "hot" search param goal is to invalide url in browser cache:
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      urlObject.searchParams.delete("hot");
      return urlObject.href;
    },
    transformReferenceSearchParams: (reference) => {
      if (reference.isImplicit) {
        return null;
      }
      if (reference.original && reference.original.searchParams.has("hot")) {
        return {
          hot: reference.original.searchParams.get("hot"),
        };
      }
      const request = reference.ownerUrlInfo.context.request;
      const parentHotParam = request ? request.searchParams.get("hot") : null;
      if (!parentHotParam) {
        return null;
      }
      // At this stage the parent is using ?hot and we are going to decide if
      // we propagate the search param to child.
      const referencedUrlInfo = reference.urlInfo;
      const {
        modifiedTimestamp,
        descendantModifiedTimestamp,
        dereferencedTimestamp,
      } = referencedUrlInfo;
      if (
        !modifiedTimestamp &&
        !descendantModifiedTimestamp &&
        !dereferencedTimestamp
      ) {
        return null;
      }
      // The goal is to send an url that will bypass client (the browser) cache
      // more precisely the runtime cache of js modules, but also any http cache
      // that could prevent re-execution of js code
      // In order to achieve this, this plugin inject ?hot=timestamp
      // - The browser will likely not have it in cache
      //   and refetch latest version from server + re-execute it
      // - If the browser have it in cache, he will not get it from server
      // We use the latest timestamp to ensure it's fresh
      // The dereferencedTimestamp is needed because when a js module is re-referenced
      // browser must re-execute it, even if the code is not modified
      const latestTimestamp = Math.max(
        modifiedTimestamp,
        descendantModifiedTimestamp,
        dereferencedTimestamp,
      );
      return {
        hot: latestTimestamp,
      };
    },
  };
};

const jsenvPluginAutoreload = ({
  clientFileChangeEventEmitter,
  clientFileDereferencedEventEmitter,
}) => {
  return [
    jsenvPluginHotSearchParam(),
    jsenvPluginAutoreloadClient(),
    jsenvPluginAutoreloadServer({
      clientFileChangeEventEmitter,
      clientFileDereferencedEventEmitter,
    }),
  ];
};

const jsenvPluginCacheControl = ({
  versionedUrls = true,
  maxAge = SECONDS_IN_30_DAYS,
}) => {
  return {
    name: "jsenv:cache_control",
    appliesDuring: "dev",
    augmentResponse: ({ reference }) => {
      if (
        versionedUrls &&
        reference.generatedSearchParams.has("v") &&
        !reference.generatedSearchParams.has("hot")
      ) {
        return {
          headers: {
            "cache-control": `private,max-age=${maxAge},immutable`,
          },
        };
      }
      return null;
    },
  };
};

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30;

const jsenvPluginRibbon = ({
  rootDirectoryUrl,
  htmlInclude = "/**/*.html",
}) => {
  const ribbonClientFileUrl = import.meta.resolve("../client/ribbon/ribbon.js");
  const associations = URL_META.resolveAssociations(
    {
      ribbon: {
        [htmlInclude]: true,
      },
    },
    rootDirectoryUrl,
  );
  return {
    name: "jsenv:ribbon",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        const jsenvToolbarHtmlClientFileUrl = urlInfo.context.getPluginMeta(
          "jsenvToolbarHtmlClientFileUrl",
        );
        if (
          jsenvToolbarHtmlClientFileUrl &&
          // startsWith to ignore search params
          urlInfo.url.startsWith(jsenvToolbarHtmlClientFileUrl)
        ) {
          return null;
        }
        const { ribbon } = URL_META.applyAssociations({
          url: asUrlWithoutSearch(urlInfo.url),
          associations,
        });
        if (!ribbon) {
          return null;
        }
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const ribbonClientFileReference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: ribbonClientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: ribbonClientFileReference.generatedSpecifier,
          initCall: {
            callee: "injectRibbon",
            params: {
              text: urlInfo.context.dev ? "DEV" : "BUILD",
            },
          },
          pluginName: "jsenv:ribbon",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};

/**
 * HTML page server by jsenv dev server will listen for drop events
 * and redirect the browser to the dropped file location.
 *
 * Works only for VSCode right now (because it sets "resourceurls" dataTransfer type).
 *
 */


const jsenvPluginDropToOpen = () => {
  const clientFileUrl = import.meta.resolve("../client/drop_to_open/drop_to_open.js");
  return {
    name: "jsenv:drop_to_open",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const clientFileReference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: clientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: clientFileReference.generatedSpecifier,
          initCall: {
            callee: "initDropToOpen",
            params: {
              rootDirectoryUrl: urlInfo.context.rootDirectoryUrl,
            },
          },
          pluginName: "jsenv:drop_to_open",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};

const jsenvPluginCleanHTML = () => {
  return {
    name: "jsenv:cleanup_html_during_dev",
    appliesDuring: "dev",
    finalizeUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const htmlClean = stringifyHtmlAst(htmlAst, {
          cleanupPositionAttributes: true,
        });
        return htmlClean;
      },
    },
  };
};

/**
 * https://docs.google.com/document/d/1rfKPnxsNuXhnF7AiQZhu9kIwdiMS5hnAI05HBwFuBSM/edit?tab=t.0#heading=h.7nki9mck5t64
 * https://chromium.googlesource.com/devtools/devtools-frontend/+/main/docs/ecosystem/automatic_workspace_folders.md
 * https://github.com/ChromeDevTools/vite-plugin-devtools-json
 */


const jsenvPluginChromeDevtoolsJson = () => {
  const getOrCreateUUID = (kitchen) => {
    const { outDirectoryUrl } = kitchen.context;
    const uuidFileUrl = new URL("./uuid.json", outDirectoryUrl);
    if (existsSync(uuidFileUrl)) {
      const { uuid } = JSON.parse(readFileSync(uuidFileUrl, "utf8"));
      return uuid;
    }
    const uuid = randomUUID();
    writeFileSync(uuidFileUrl, JSON.stringify({ uuid }), { });
    return uuid;
  };

  return {
    name: "jsenv_plugin_chrome_devtools_json",
    appliesDuring: "dev",
    devServerRoutes: [
      {
        endpoint: "GET /.well-known/appspecific/com.chrome.devtools.json",
        declarationSource: import.meta.url,
        fetch: (request, { kitchen }) => {
          const { rootDirectoryUrl } = kitchen.context;
          return Response.json({
            workspace: {
              root: urlToFileSystemPath(rootDirectoryUrl),
              uuid: getOrCreateUUID(kitchen),
            },
          });
        },
      },
    ],
  };
};

const jsenvPluginAutoreloadOnServerRestart = () => {
  const autoreloadOnRestartClientFileUrl = import.meta
    .resolve("@jsenv/server/src/services/autoreload_on_server_restart/client/autoreload_on_server_restart.js");

  return {
    name: "jsenv:autoreload_on_server_restart",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        // we should not do this for inspector and 4xx.html
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const autoreloadOnRestartClientFileReference =
          urlInfo.dependencies.inject({
            type: "script",
            subtype: "js_classic",
            expectedType: "js_classic",
            specifier: autoreloadOnRestartClientFileUrl,
          });
        injectJsenvScript(htmlAst, {
          "src": autoreloadOnRestartClientFileReference.generatedSpecifier,
          "pluginName": "jsenv:autoreload_on_server_restart",
          "data-ws-endpoint": "/.internal/events.websocket",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};

/**
 * Lorsqu'on bundle un package ayant pas le field sideEffects
 * alors on fini potentiellement par dire
 * sideEffect: false
 * sur le package racine alors qu'on en sait rien
 * on pourrait mettre un package.json dans dist dans ce cas
 * qui ne déclare pas le field side effect afin
 * d'override le package.json du project qui lui dit qu'il ny en a pas
 *
 * On part du principe pour le moment que c'est la respo du package racine de déclarer cela
 *
 */


const jsenvPluginPackageSideEffects = ({ packageDirectory }) => {
  if (!packageDirectory.url) {
    return [];
  }
  const packageJson = packageDirectory.read(packageDirectory.url);
  if (!packageJson) {
    return [];
  }
  const { sideEffects } = packageJson;
  if (sideEffects !== false && !Array.isArray(sideEffects)) {
    return [];
  }

  const packageSideEffectsCacheMap = new Map();
  const readSideEffectInfoFromClosestPackage = (urlInfo) => {
    const closestPackageDirectoryUrl = urlInfo.packageDirectoryUrl;
    const closestPackageJSON = urlInfo.packageJSON;
    if (!closestPackageJSON) {
      return undefined;
    }
    const fromCache = packageSideEffectsCacheMap.get(
      closestPackageDirectoryUrl,
    );
    if (fromCache) {
      return fromCache.value;
    }
    try {
      return storePackageSideEffect(
        closestPackageDirectoryUrl,
        closestPackageJSON,
      );
    } catch {
      return storePackageSideEffect(closestPackageDirectoryUrl, null);
    }
  };
  const storePackageSideEffect = (packageDirectoryUrl, packageJSON) => {
    if (!packageJSON) {
      packageSideEffectsCacheMap.set(packageDirectoryUrl, { value: undefined });
      return undefined;
    }
    const value = packageJSON.sideEffects;
    if (Array.isArray(value)) {
      const noSideEffect = {
        has: false,
        reason: "not listed in package.json side effects",
        packageDirectoryUrl,
      };
      const hasSideEffect = {
        has: true,
        reason: "listed in package.json side effects",
        packageDirectoryUrl,
      };
      const sideEffectPatterns = {};
      for (const v of value) {
        sideEffectPatterns[v] = v;
      }
      const associations = URL_META.resolveAssociations(
        { sideEffects: sideEffectPatterns },
        packageDirectoryUrl,
      );
      const getSideEffectInfo = (urlInfo) => {
        const meta = URL_META.applyAssociations({
          url: urlInfo.url,
          associations,
        });
        const sideEffectKey = meta.sideEffects;
        if (sideEffectKey) {
          return {
            ...hasSideEffect,
            reason: `"${sideEffectKey}" listed in package.json side effects`,
          };
        }
        return noSideEffect;
      };
      packageSideEffectsCacheMap.set(packageDirectoryUrl, {
        value: getSideEffectInfo,
      });
      return getSideEffectInfo;
    }
    if (value === false) {
      const noSideEffect = {
        has: false,
        reason: "package.json side effects is false",
        packageDirectoryUrl,
      };
      packageSideEffectsCacheMap.set(packageDirectoryUrl, {
        value: noSideEffect,
      });
      return noSideEffect;
    }
    const hasSideEffect = {
      has: true,
      reason: "package.json side effects is true",
      packageDirectoryUrl,
    };
    packageSideEffectsCacheMap.set(packageDirectoryUrl, {
      value: hasSideEffect,
    });
    return hasSideEffect;
  };
  const getSideEffectInfoFromClosestPackage = (urlInfo) => {
    const sideEffectInfoFromClosestPackage =
      readSideEffectInfoFromClosestPackage(urlInfo);
    if (sideEffectInfoFromClosestPackage === undefined) {
      return null;
    }
    if (typeof sideEffectInfoFromClosestPackage === "function") {
      return sideEffectInfoFromClosestPackage(urlInfo);
    }
    return sideEffectInfoFromClosestPackage;
  };

  return {
    name: "jsenv:package_side_effects",
    appliesDuring: "build",
    urlInfoCreated: (urlInfo) => {
      const url = urlInfo.url;
      if (isSpecifierForNodeBuiltin(url)) {
        urlInfo.contentSideEffects.push({
          sideEffect: "no",
          reason: "node builtin module",
        });
        return;
      }
      if (url.startsWith("file:")) {
        const sideEffectFromClosestPackage =
          getSideEffectInfoFromClosestPackage(urlInfo);
        if (sideEffectFromClosestPackage) {
          // if (sideEffectFromClosestPackage.has) {
          //    console.log(`have side effect: ${url}`);
          // } else {
          //  console.log(`no side effect: ${url}`);
          // }
          urlInfo.contentSideEffects.push(sideEffectFromClosestPackage);
        }
        return;
      }
    },
    refineBuildUrlContent: (
      buildUrlInfo,
      { buildUrl, registerBuildSideEffectFile },
    ) => {
      for (const sideEffect of buildUrlInfo.contentSideEffects) {
        if (sideEffect.has) {
          registerBuildSideEffectFile(buildUrl);
          return;
        }
      }
    },
  };
};

const PACKAGE_BUNDLE_QUERY_PARAM = "package_bundle";
const PACKAGE_NO_BUNDLE_QUERY_PARAM = "package_no_bundle";
const DYNAMIC_IMPORT_QUERY_PARAM = "dynamic_import";

const jsenvPluginWorkspaceBundle = ({ packageDirectory }) => {
  return {
    name: "jsenv:workspace_bundle",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      if (reference.searchParams.has(PACKAGE_BUNDLE_QUERY_PARAM)) {
        return null;
      }
      if (reference.searchParams.has(PACKAGE_NO_BUNDLE_QUERY_PARAM)) {
        return null;
      }
      if (
        reference.ownerUrlInfo.searchParams.has(PACKAGE_NO_BUNDLE_QUERY_PARAM)
      ) {
        // we're cooking the bundle, without this check we would have infinite recursion to try to bundle
        // we want to propagate the ?package_no_bundle
        const noBundleUrl = injectQueryParams(reference.url, {
          v: undefined,
          [PACKAGE_NO_BUNDLE_QUERY_PARAM]: "",
        });
        // console.log(
        //   `redirecting ${reference.url} to ${noBundleUrl} to cook the bundle`,
        // );
        return noBundleUrl;
      }
      const packageDirectoryUrl = packageDirectory.find(reference.url);
      if (!packageDirectoryUrl) {
        return null;
      }
      if (packageDirectoryUrl === packageDirectory.url) {
        // root package, we don't want to bundle
        return null;
      }
      // we make sure we target the bundle version of the package
      // otherwise we might execute some parts of the package code multiple times.
      // so we need to redirect the potential reference to non entry point to the package main entry point
      const packageJSON = packageDirectory.read(packageDirectoryUrl);
      const rootReference = reference.ownerUrlInfo.dependencies.inject({
        type: "js_import",
        specifier: `${packageJSON.name}?${PACKAGE_BUNDLE_QUERY_PARAM}`,
      });
      // console.log(
      //   `redirecting ${reference.url} to ${rootReference.url} to target the package bundle version of the package`,
      // );
      const packageMainUrl = rootReference.url;
      return packageMainUrl;
    },
    fetchUrlContent: async (urlInfo) => {
      if (!urlInfo.searchParams.has(PACKAGE_BUNDLE_QUERY_PARAM)) {
        return null;
      }
      const noBundleSpecifier = injectQueryParamsIntoSpecifier(
        urlInfo.firstReference.specifier,
        {
          [PACKAGE_BUNDLE_QUERY_PARAM]: undefined,
          [PACKAGE_NO_BUNDLE_QUERY_PARAM]: "",
        },
      );
      const noBundleUrlInfo = urlInfo.redirect({
        specifier: noBundleSpecifier,
      });
      if (!noBundleUrlInfo) {
        return null;
      }
      await noBundleUrlInfo.cook();
      await noBundleUrlInfo.cookDependencies({
        // we ignore dynamic import to cook lazyly (as browser request the server)
        // these dynamic imports must inherit "?package_bundle"
        // This is done inside rollup for convenience
        ignoreDynamicImport: true,
      });
      const bundleUrlInfos = await bundleJsModules([noBundleUrlInfo], {
        chunks: false,
        buildDirectoryUrl: new URL("../src/plugins/workspace_bundle/", import.meta.url),
        preserveDynamicImports: true,
        augmentDynamicImportUrlSearchParams: () => {
          return {
            [DYNAMIC_IMPORT_QUERY_PARAM]: "",
            [PACKAGE_BUNDLE_QUERY_PARAM]: "",
          };
        },
      });
      const bundledUrlInfo = bundleUrlInfos[noBundleUrlInfo.url];
      if (urlInfo.context.dev) {
        for (const sourceUrl of bundledUrlInfo.sourceUrls) {
          urlInfo.dependencies.inject({
            isImplicit: true,
            type: "js_url",
            specifier: sourceUrl,
          });
        }
      }
      return {
        content: bundledUrlInfo.content,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: urlInfo.originalUrl,
        originalContent: bundledUrlInfo.originalContent,
        sourcemap: bundledUrlInfo.sourcemap,
        data: bundledUrlInfo.data,
      };
    },
    // transformReferenceSearchParams: () => {
    //   return {
    //     [PACKAGE_BUNDLE_QUERY_PARAM]: undefined,
    //   };
    // },
  };
};

// tslint:disable:ordered-imports


const getCorePlugins = ({
  rootDirectoryUrl,
  mainFilePath,
  runtimeCompat,
  packageDirectory,
  sourceFilesConfig,

  referenceAnalysis = {},
  nodeEsmResolution = {},
  packageConditions,
  packageConditionsConfig,
  magicExtensions,
  magicDirectoryIndex,
  directoryListing = true,
  directoryReferenceEffect,
  supervisor,
  injections,
  transpilation = true,
  inlining = true,
  http = false,
  spa,
  packageBundle,

  clientAutoreload,
  clientAutoreloadOnServerRestart,
  cacheControl,
  scenarioPlaceholders = true,
  ribbon = true,
  dropToOpen = true,
  packageSideEffects = false,
} = {}) => {
  if (cacheControl === true) {
    cacheControl = {};
  }
  if (supervisor === true) {
    supervisor = {};
  }
  if (ribbon === true) {
    ribbon = {};
  }
  if (http === true) {
    http = { include: true };
  }
  if (http === false) {
    http = { include: false };
  }
  if (directoryListing === true) {
    directoryListing = {};
  }

  return [
    ...(packageBundle
      ? [jsenvPluginWorkspaceBundle({ packageDirectory })]
      : []),
    jsenvPluginReferenceAnalysis(referenceAnalysis),
    jsenvPluginInjections(injections),
    jsenvPluginTranspilation(transpilation),
    // "jsenvPluginInlining" must be very soon because all other plugins will react differently once they see the file is inlined
    ...(inlining ? [jsenvPluginInlining()] : []),

    /* When resolving references the following applies by default:
       - http urls are resolved by jsenvPluginHttpUrls
       - reference.type === "filesystem" -> resolved by jsenv_plugin_file_urls.js
       - reference inside a js module -> resolved by node esm
       - All the rest uses web standard url resolution
     */
    jsenvPluginProtocolHttp(http),
    jsenvPluginProtocolFile({
      spa,
      magicExtensions,
      magicDirectoryIndex,
      directoryListing,
      rootDirectoryUrl,
      mainFilePath,
      packageDirectory,
      sourceFilesConfig,
    }),
    {
      name: "jsenv:resolve_root_as_main",
      appliesDuring: "*",
      resolveReference: (reference) => {
        const { ownerUrlInfo } = reference;
        if (reference.specifierPathname === "/") {
          const { mainFilePath, rootDirectoryUrl } = ownerUrlInfo.context;
          const url = new URL(mainFilePath, rootDirectoryUrl);
          return url;
        }
        return null;
      },
    },
    ...(nodeEsmResolution
      ? [
          jsenvPluginNodeEsmResolution({
            packageDirectory,
            resolutionConfig: nodeEsmResolution,
            packageConditions,
            packageConditionsConfig,
          }),
        ]
      : []),
    jsenvPluginWebResolution(),
    jsenvPluginDirectoryReferenceEffect(directoryReferenceEffect, {
      rootDirectoryUrl,
    }),
    jsenvPluginVersionSearchParam(),

    // "jsenvPluginSupervisor" MUST be after "jsenvPluginInlining" as it needs inline script to be cooked
    ...(supervisor ? [jsenvPluginSupervisor(supervisor)] : []),
    ...(clientAutoreloadOnServerRestart
      ? [jsenvPluginAutoreloadOnServerRestart()]
      : []),

    jsenvPluginImportMetaCss(),
    jsenvPluginCommonJsGlobals(),
    jsenvPluginImportMetaScenarios(),
    ...(scenarioPlaceholders ? [jsenvPluginGlobalScenarios()] : []),
    jsenvPluginNodeRuntime({ runtimeCompat }),

    jsenvPluginImportMetaHot(),
    ...(clientAutoreload && clientAutoreload.enabled
      ? [jsenvPluginAutoreload(clientAutoreload)]
      : []),
    ...(cacheControl ? [jsenvPluginCacheControl(cacheControl)] : []),
    ...(ribbon ? [jsenvPluginRibbon({ rootDirectoryUrl, ...ribbon })] : []),
    ...(dropToOpen ? [jsenvPluginDropToOpen()] : []),
    jsenvPluginCleanHTML(),
    jsenvPluginChromeDevtoolsJson(),
    ...(packageSideEffects
      ? [jsenvPluginPackageSideEffects({ packageDirectory })]
      : []),
  ];
};

/*
 * This plugin is very special because it is here
 * to provide "serverEvents" used by other plugins
 */


const serverEventsClientFileUrl = new URL(
  "../client/server_events/server_events_client.js",
  import.meta.url,
).href;

const jsenvPluginServerEvents = ({ clientAutoreload }) => {
  let serverEvents = new ServerEvents({
    actionOnClientLimitReached: "kick-oldest",
  });
  const { clientServerEventsConfig } = clientAutoreload;
  const { logs = true } = clientServerEventsConfig;

  return {
    name: "jsenv:server_events",
    appliesDuring: "dev",
    effect: ({ kitchenContext, otherPlugins }) => {
      const allServerEvents = {};
      for (const otherPlugin of otherPlugins) {
        const { serverEvents } = otherPlugin;
        if (!serverEvents) {
          continue;
        }
        for (const serverEventName of Object.keys(serverEvents)) {
          // we could throw on serverEvent name conflict
          // we could throw if serverEvents[serverEventName] is not a function
          allServerEvents[serverEventName] = serverEvents[serverEventName];
        }
      }
      const serverEventNames = Object.keys(allServerEvents);
      if (serverEventNames.length === 0) {
        return false;
      }

      const onabort = () => {
        serverEvents.close();
      };
      kitchenContext.signal.addEventListener("abort", onabort);
      for (const serverEventName of Object.keys(allServerEvents)) {
        const serverEventInfo = {
          ...kitchenContext,
          // serverEventsDispatcher variable is safe, we can disable esling warning
          // eslint-disable-next-line no-loop-func
          sendServerEvent: (data) => {
            if (!serverEvents) {
              // this can happen if a plugin wants to send a server event but
              // server is closing or the plugin got destroyed but still wants to do things
              // if plugin code is correctly written it is never supposed to happen
              // because it means a plugin is still trying to do stuff after being destroyed
              return;
            }
            serverEvents.sendEventToAllClients({
              type: serverEventName,
              data,
            });
          },
        };
        const serverEventInit = allServerEvents[serverEventName];
        serverEventInit(serverEventInfo);
      }
      return () => {
        kitchenContext.signal.removeEventListener("abort", onabort);
        serverEvents.close();
        serverEvents = undefined;
      };
    },
    transformUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        injectJsenvScript(htmlAst, {
          src: serverEventsClientFileUrl,
          initCall: {
            callee: "window.__server_events__.setup",
            params: {
              logs,
            },
          },
          pluginName: "jsenv:server_events",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
    devServerRoutes: [
      {
        endpoint: "GET /.internal/events.websocket",
        description: `Jsenv dev server emit server events on this endpoint. When a file is saved the "reload" event is sent here.`,
        fetch: serverEvents.fetch,
        declarationSource: import.meta.url,
      },
    ],
  };
};

const requireFromJsenv = createRequire(import.meta.url);

const parseUserAgentHeader = memoizeByFirstArgument((userAgent) => {
  if (userAgent.includes("node-fetch/")) {
    // it's not really node and conceptually we can't assume the node version
    // but good enough for now
    return {
      runtimeName: "node",
      runtimeVersion: process.version.slice(1),
    };
  }
  const UA = requireFromJsenv("@financial-times/polyfill-useragent-normaliser");
  const { ua } = new UA(userAgent);
  const { family, major, minor, patch } = ua;
  return {
    runtimeName: family.toLowerCase(),
    runtimeVersion:
      family === "Other" ? "unknown" : `${major}.${minor}${patch}`,
  };
});

const EXECUTED_BY_TEST_PLAN = process.argv.includes("--jsenv-test");

/**
 * Starts the development server.
 *
 * @param {Object} [params={}] - Configuration params for the dev server.
 * @param {number} [params.port=3456] - Port number the server should listen on.
 * @param {string} [params.hostname="localhost"] - Hostname to bind the server to.
 * @param {boolean} [params.https=false] - Whether to use HTTPS.
 *
 * @returns {Promise<Object>} A promise that resolves to the server instance.
 * @throws {Error} Will throw an error if the server fails to start or is called with unexpected params.
 *
 * @example
 * // Start a basic dev server
 * const server = await startDevServer();
 * console.log(`Server started at ${server.origin}`);
 *
 * @example
 * // Start a server with custom params
 * const server = await startDevServer({
 *   port: 8080,
 * });
 */
const startDevServer = async ({
  sourceDirectoryUrl,
  sourceMainFilePath = "./index.html",
  ignore,
  port = 3456,
  hostname,
  acceptAnyIp,
  https,
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  logLevel = EXECUTED_BY_TEST_PLAN ? "warn" : "info",
  serverLogLevel = "warn",
  serverRouterLogLevel = "warn",
  services = [],

  signal = new AbortController().signal,
  handleSIGINT = true,
  keepProcessAlive = true,
  onStop = () => {},

  sourceFilesConfig = {},
  clientAutoreload = true,
  clientAutoreloadOnServerRestart = true,

  // runtimeCompat is the runtimeCompat for the build
  // when specified, dev server use it to warn in case
  // code would be supported during dev but not after build
  runtimeCompat = defaultRuntimeCompat,
  plugins = [],
  referenceAnalysis = {},
  nodeEsmResolution,
  packageConditions,
  packageConditionsConfig,
  supervisor = true,
  magicExtensions,
  magicDirectoryIndex,
  directoryListing,
  injections,
  transpilation,
  cacheControl = true,
  ribbon = true,
  dropToOpen = true,
  // toolbar = false,
  onKitchenCreated = () => {},
  spa,
  packageBundle,

  sourcemaps = "inline",
  sourcemapsSourcesContent,
  outDirectoryUrl,
  ...rest
}) => {
  // params type checking
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(
      sourceDirectoryUrl,
      "sourceDirectoryUrl",
    );
    if (!existsSync(new URL(sourceDirectoryUrl))) {
      throw new Error(`ENOENT on sourceDirectoryUrl at ${sourceDirectoryUrl}`);
    }
    if (typeof sourceMainFilePath !== "string") {
      throw new TypeError(
        `sourceMainFilePath must be a string, got ${sourceMainFilePath}`,
      );
    }
    sourceMainFilePath = urlToRelativeUrl(
      new URL(sourceMainFilePath, sourceDirectoryUrl),
      sourceDirectoryUrl,
    );
    if (outDirectoryUrl === undefined) {
      if (
        process.env.CAPTURING_SIDE_EFFECTS ||
        (false)
      ) {
        outDirectoryUrl = new URL("../.jsenv/", sourceDirectoryUrl);
      } else {
        const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
        if (packageDirectoryUrl) {
          outDirectoryUrl = `${packageDirectoryUrl}.jsenv/`;
        }
      }
    } else if (outDirectoryUrl !== null && outDirectoryUrl !== false) {
      outDirectoryUrl = assertAndNormalizeDirectoryUrl(
        outDirectoryUrl,
        "outDirectoryUrl",
      );
    }
  }

  // params normalization
  {
    if (clientAutoreload === true) {
      clientAutoreload = {};
    }
    if (clientAutoreload === false) {
      clientAutoreload = { enabled: false };
    }
  }

  const logger = createLogger({ logLevel });
  const startDevServerTask = createTaskLog("start dev server", {
    disabled: !logger.levels.info,
  });

  const serverStopCallbackSet = new Set();
  const serverStopAbortController = new AbortController();
  serverStopCallbackSet.add(() => {
    serverStopAbortController.abort();
  });
  const serverStopAbortSignal = serverStopAbortController.signal;
  const kitchenCache = new Map();

  const finalServices = [];
  // x-server-inspect service
  {
    finalServices.push({
      name: "jsenv:server_header",
      routes: [
        {
          endpoint: "GET /.internal/server.json",
          description: "Get information about jsenv dev server",
          availableMediaTypes: ["application/json"],
          declarationSource: import.meta.url,
          fetch: () =>
            Response.json({
              server: "jsenv_dev_server/1",
              sourceDirectoryUrl,
            }),
        },
      ],
      injectResponseProperties: () => {
        return {
          headers: {
            server: "jsenv_dev_server/1",
          },
        };
      },
    });
  }
  // cors service
  {
    finalServices.push(
      jsenvServiceCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: [
          ...jsenvAccessControlAllowedHeaders,
          "x-jsenv-execution-id",
        ],
        accessControlAllowCredentials: true,
        timingAllowOrigin: true,
      }),
    );
  }
  // custom services
  {
    finalServices.push(...services);
  }
  // file_service
  {
    const clientFileChangeEventEmitter = createEventEmitter();
    const clientFileDereferencedEventEmitter = createEventEmitter();
    clientAutoreload = {
      enabled: true,
      clientServerEventsConfig: {},
      clientFileChangeEventEmitter,
      clientFileDereferencedEventEmitter,
      ...clientAutoreload,
    };
    const stopWatchingSourceFiles = watchSourceFiles(
      sourceDirectoryUrl,
      (fileInfo) => {
        clientFileChangeEventEmitter.emit(fileInfo);
      },
      {
        sourceFilesConfig,
        keepProcessAlive: false,
        cooldownBetweenFileEvents: clientAutoreload.cooldownBetweenFileEvents,
      },
    );
    serverStopCallbackSet.add(stopWatchingSourceFiles);

    const packageDirectory = createPackageDirectory({
      sourceDirectoryUrl,
    });

    const devServerPluginStore = await createPluginStore([
      jsenvPluginServerEvents({ clientAutoreload }),
      ...plugins,
      ...getCorePlugins({
        packageDirectory,
        rootDirectoryUrl: sourceDirectoryUrl,
        mainFilePath: sourceMainFilePath,
        runtimeCompat,
        sourceFilesConfig,

        referenceAnalysis,
        nodeEsmResolution,
        packageConditions,
        packageConditionsConfig,
        magicExtensions,
        magicDirectoryIndex,
        directoryListing,
        supervisor,
        injections,
        transpilation,
        spa,
        packageBundle,

        clientAutoreload,
        clientAutoreloadOnServerRestart,
        cacheControl,
        ribbon,
        dropToOpen,
      }),
    ]);
    const getOrCreateKitchen = async (request) => {
      const { runtimeName, runtimeVersion } = parseUserAgentHeader(
        request.headers["user-agent"] || "",
      );
      const runtimeId = `${runtimeName}@${runtimeVersion}`;
      const existing = kitchenCache.get(runtimeId);
      if (existing) {
        return existing;
      }
      const watchAssociations = URL_META.resolveAssociations(
        { watch: stopWatchingSourceFiles.watchPatterns },
        sourceDirectoryUrl,
      );
      let kitchen;
      clientFileChangeEventEmitter.on(({ url, event }) => {
        const urlInfo = kitchen.graph.getUrlInfo(url);
        if (urlInfo) {
          if (event === "removed") {
            urlInfo.onRemoved();
          } else {
            urlInfo.onModified();
          }
        }
      });
      const clientRuntimeCompat = { [runtimeName]: runtimeVersion };

      kitchen = createKitchen({
        name: runtimeId,
        signal: serverStopAbortSignal,
        logLevel,
        rootDirectoryUrl: sourceDirectoryUrl,
        mainFilePath: sourceMainFilePath,
        ignore,
        dev: true,
        runtimeCompat,
        clientRuntimeCompat,
        supervisor,
        sourcemaps,
        sourcemapsSourcesContent,
        outDirectoryUrl: outDirectoryUrl
          ? new URL(`${runtimeName}@${runtimeVersion}/`, outDirectoryUrl)
          : undefined,
        packageDirectory,
      });
      kitchen.graph.urlInfoCreatedEventEmitter.on((urlInfoCreated) => {
        const { watch } = URL_META.applyAssociations({
          url: urlInfoCreated.url,
          associations: watchAssociations,
        });
        urlInfoCreated.isWatched = watch;
        // when an url depends on many others, we check all these (like package.json)
        urlInfoCreated.isValid = () => {
          const seenSet = new Set();
          const checkValidity = (urlInfo) => {
            if (seenSet.has(urlInfo)) {
              return true;
            }
            seenSet.add(urlInfo);
            if (!urlInfo.url.startsWith("file:")) {
              return false;
            }
            if (urlInfo.content === undefined) {
              // urlInfo content is undefined when:
              // - url info content never fetched
              // - it is considered as modified because undelying file is watched and got saved
              // - it is considered as modified because underlying file content
              //   was compared using etag and it has changed
              return false;
            }
            if (!urlInfo.isWatched) {
              // file is not watched, check the filesystem
              let fileContentAsBuffer;
              try {
                fileContentAsBuffer = readFileSync(new URL(urlInfo.url));
              } catch (e) {
                if (e.code === "ENOENT") {
                  urlInfo.onModified();
                  return false;
                }
                return false;
              }
              const fileContentEtag = bufferToEtag(fileContentAsBuffer);
              if (fileContentEtag !== urlInfo.originalContentEtag) {
                urlInfo.onModified();
                // restore content to be able to compare it again later
                urlInfo.kitchen.urlInfoTransformer.setContent(
                  urlInfo,
                  String(fileContentAsBuffer),
                  {
                    contentEtag: fileContentEtag,
                  },
                );
                return false;
              }
            }
            for (const implicitUrl of urlInfo.implicitUrlSet) {
              const implicitUrlInfo = urlInfo.graph.getUrlInfo(implicitUrl);
              if (!implicitUrlInfo) {
                continue;
              }
              if (implicitUrlInfo.content === undefined) {
                // happens when we explicitely load an url with a search param
                // - it creates an implicit url info to the url without params
                // - we never explicitely request the url without search param so it has no content
                // in that case the underlying urlInfo cannot be invalidate by the implicit
                // we use modifiedTimestamp to detect if the url was loaded once
                // or is just here to be used later
                if (implicitUrlInfo.modifiedTimestamp) {
                  return false;
                }
                continue;
              }
              if (!checkValidity(implicitUrlInfo)) {
                return false;
              }
            }
            return true;
          };
          const valid = checkValidity(urlInfoCreated);
          return valid;
        };
      });
      kitchen.graph.urlInfoDereferencedEventEmitter.on(
        (urlInfoDereferenced, lastReferenceFromOther) => {
          clientFileDereferencedEventEmitter.emit(
            urlInfoDereferenced,
            lastReferenceFromOther,
          );
        },
      );
      const devServerPluginController = await createPluginController(
        devServerPluginStore,
        kitchen,
      );
      kitchen.setPluginController(devServerPluginController);

      serverStopCallbackSet.add(() => {
        devServerPluginController.callHooks("destroy", kitchen.context);
      });
      kitchenCache.set(runtimeId, kitchen);
      onKitchenCreated(kitchen);
      return kitchen;
    };

    finalServices.push({
      name: "jsenv:dev_server_routes",
      augmentRouteFetchSecondArg: async (request) => {
        const kitchen = await getOrCreateKitchen(request);
        return { kitchen };
      },
      routes: [
        ...devServerPluginStore.allDevServerRoutes,
        {
          endpoint: "GET *",
          description: "Serve project files.",
          declarationSource: import.meta.url,
          fetch: async (request, { kitchen }) => {
            const { rootDirectoryUrl, mainFilePath } = kitchen.context;
            let requestResource = request.resource;
            let requestedUrl;
            if (requestResource.startsWith("/@fs/")) {
              const fsRootRelativeUrl = requestResource.slice("/@fs/".length);
              requestedUrl = `file:///${fsRootRelativeUrl}`;
            } else {
              const requestedUrlObject = new URL(
                requestResource === "/"
                  ? mainFilePath
                  : requestResource.slice(1),
                rootDirectoryUrl,
              );
              requestedUrlObject.searchParams.delete("hot");
              requestedUrl = requestedUrlObject.href;
            }
            const { referer } = request.headers;
            const parentUrl = referer
              ? WEB_URL_CONVERTER.asFileUrl(referer, {
                  origin: request.origin,
                  rootDirectoryUrl: sourceDirectoryUrl,
                })
              : sourceDirectoryUrl;
            let reference = kitchen.graph.inferReference(
              request.resource,
              parentUrl,
            );
            if (reference) {
              reference.urlInfo.context.request = request;
              reference.urlInfo.context.requestedUrl = requestedUrl;
            } else {
              const rootUrlInfo = kitchen.graph.rootUrlInfo;
              rootUrlInfo.context.request = request;
              rootUrlInfo.context.requestedUrl = requestedUrl;
              reference = rootUrlInfo.dependencies.createResolveAndFinalize({
                trace: { message: parentUrl },
                type: "http_request",
                specifier: request.resource,
              });
              reference.urlInfo.context.requestedUrl = requestedUrl;
              rootUrlInfo.context.request = null;
              rootUrlInfo.context.requestedUrl = null;
            }
            const urlInfo = reference.urlInfo;
            const ifNoneMatch = request.headers["if-none-match"];
            const urlInfoTargetedByCache =
              urlInfo.findParentIfInline() || urlInfo;

            try {
              if (!urlInfo.error && ifNoneMatch) {
                const [clientOriginalContentEtag, clientContentEtag] =
                  ifNoneMatch.split("_");
                if (
                  urlInfoTargetedByCache.originalContentEtag ===
                    clientOriginalContentEtag &&
                  urlInfoTargetedByCache.contentEtag === clientContentEtag &&
                  urlInfoTargetedByCache.isValid()
                ) {
                  const headers = {
                    "cache-control": `private,max-age=0,must-revalidate`,
                  };
                  Object.keys(urlInfo.headers).forEach((key) => {
                    if (key !== "content-length") {
                      headers[key] = urlInfo.headers[key];
                    }
                  });
                  return {
                    status: 304,
                    headers,
                  };
                }
              }
              await urlInfo.cook({ request, reference });
              let { response } = urlInfo;
              if (response) {
                return response;
              }
              response = {
                url: reference.url,
                status: 200,
                headers: {
                  // when we send eTag to the client the next request to the server
                  // will send etag in request headers.
                  // If they match jsenv bypass cooking and returns 304
                  // This must not happen when a plugin uses "no-store" or "no-cache" as it means
                  // plugin logic wants to happens for every request to this url
                  ...(cacheIsDisabledInResponseHeader(urlInfoTargetedByCache)
                    ? {
                        "cache-control": "no-store", // for inline file we force no-store when parent is no-store
                      }
                    : {
                        "cache-control": `private,max-age=0,must-revalidate`,
                        // it's safe to use "_" separator because etag is encoded with base64 (see https://stackoverflow.com/a/13195197)
                        "eTag": `${urlInfoTargetedByCache.originalContentEtag}_${urlInfoTargetedByCache.contentEtag}`,
                      }),
                  ...urlInfo.headers,
                  "content-type": urlInfo.contentType,
                  "content-length": urlInfo.contentLength,
                },
                body: urlInfo.content,
                timing: urlInfo.timing, // TODO: use something else
              };
              const augmentResponseInfo = {
                ...kitchen.context,
                reference,
                urlInfo,
              };
              kitchen.pluginController.callHooks(
                "augmentResponse",
                augmentResponseInfo,
                (returnValue) => {
                  response = composeTwoResponses(response, returnValue);
                },
              );
              return response;
            } catch (error) {
              const originalError = error ? error.cause || error : error;
              if (originalError.asResponse) {
                return originalError.asResponse();
              }
              const code = originalError.code;
              if (code === "PARSE_ERROR") {
                // when possible let browser re-throw the syntax error
                // it's not possible to do that when url info content is not available
                // (happens for js_module_fallback for instance)
                if (urlInfo.content !== undefined) {
                  kitchen.context.logger
                    .error(`Error while handling ${request.url}:
  ${originalError.reasonCode || originalError.code}
  ${error.trace?.message}`);
                  return {
                    url: reference.url,
                    status: 200,
                    // reason becomes the http response statusText, it must not contain invalid chars
                    // https://github.com/nodejs/node/blob/0c27ca4bc9782d658afeaebcec85ec7b28f1cc35/lib/_http_common.js#L221
                    statusText: error.reason,
                    statusMessage: originalError.message,
                    headers: {
                      "content-type": urlInfo.contentType,
                      "content-length": urlInfo.contentLength,
                      "cache-control": "no-store",
                    },
                    body: urlInfo.content,
                  };
                }
                return {
                  url: reference.url,
                  status: 500,
                  statusText: error.reason,
                  statusMessage: originalError.message,
                  headers: {
                    "cache-control": "no-store",
                  },
                  body: urlInfo.content,
                };
              }
              if (code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
                return serveDirectory(reference.url, {
                  headers: {
                    accept: "text/html",
                  },
                  canReadDirectory: true,
                  rootDirectoryUrl: sourceDirectoryUrl,
                });
              }
              if (code === "NOT_ALLOWED") {
                return {
                  url: reference.url,
                  status: 403,
                  statusText: originalError.reason,
                };
              }
              if (code === "NOT_FOUND") {
                return {
                  url: reference.url,
                  status: 404,
                  statusText: originalError.reason,
                  statusMessage: originalError.message,
                };
              }
              return {
                url: reference.url,
                status: 500,
                statusText: error.reason,
                statusMessage: formatError(error),
                headers: {
                  "cache-control": "no-store",
                },
              };
            }
          },
        },
      ],
    });
    finalServices.push(...devServerPluginStore.allDevServerServices);
  }
  // jsenv error handler service
  {
    finalServices.push({
      name: "jsenv:omega_error_handler",
      handleError: (error) => {
        const getResponseForError = () => {
          if (error && error.asResponse) {
            return error.asResponse();
          }
          if (error && error.statusText === "Unexpected directory operation") {
            return {
              status: 403,
            };
          }
          return convertFileSystemErrorToResponseProperties(error);
        };
        const response = getResponseForError();
        if (!response) {
          return null;
        }
        const body = JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: response.body,
        });
        return {
          status: response.status,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
          },
          body,
        };
      },
    });
  }
  // default error handler
  {
    finalServices.push(
      jsenvServiceErrorHandler({
        sendErrorDetails: true,
      }),
    );
  }

  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: handleSIGINT,
    stopOnInternalError: false,
    keepProcessAlive,
    logLevel: serverLogLevel,
    routerLogLevel: serverRouterLogLevel,
    startLog: false,

    https,
    http2,
    acceptAnyIp,
    hostname,
    port,
    requestWaitingMs: 60_000,
    services: finalServices,
  });
  server.stoppedPromise.then((reason) => {
    onStop();
    for (const serverStopCallback of serverStopCallbackSet) {
      serverStopCallback(reason);
    }
    serverStopCallbackSet.clear();
  });
  startDevServerTask.done();
  if (hostname) {
    delete server.origins.localip;
    delete server.origins.externalip;
  }
  logger.info(``);
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`);
  });
  logger.info(``);
  return {
    origin: server.origin,
    sourceDirectoryUrl,
    stop: () => {
      server.stop();
    },
    kitchenCache,
  };
};

const cacheIsDisabledInResponseHeader = (urlInfo) => {
  return (
    urlInfo.headers["cache-control"] === "no-store" ||
    urlInfo.headers["cache-control"] === "no-cache"
  );
};

export { startDevServer };
