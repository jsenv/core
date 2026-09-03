import { WebSocketResponse, pickContentType, ServerEvents, serverPluginErrorHandler, fetchDirectory, composeTwoResponses, serverPluginCORS, jsenvAccessControlAllowedHeaders, startServer } from "@jsenv/server";
import { existsSync, readFileSync, realpathSync, readdirSync, lstatSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { urlToRelativeUrl, registerFileLifecycle, lookupPackageDirectory, readPackageAtOrNull, generateContentFrame, errorToHTML, DATA_URL, CONTENT_TYPE, normalizeImportMap, composeTwoImportMaps, resolveImport, JS_QUOTES, urlToExtension, urlToBasename, applyNodeEsmResolution, URL_META, readCustomConditionsFromProcessArgs, urlIsOrIsInsideOf, collectFiles, registerDirectoryLifecycle, readEntryStatSync, applyFileSystemMagicResolution, getExtensionsToTry, urlToFilename, asUrlWithoutSearch, ensurePathnameTrailingSlash, compareFileUrls, setUrlExtension, createDetailedMessage, stringifyUrlSite, injectQueryParamsIntoSpecifier, isSpecifierForNodeBuiltin, injectQueryParams, urlToFileSystemPath, writeFileSync, moveUrl, ensureWindowsDriveLetter, validateResponseIntegrity, setUrlFilename, getCallerPosition, asSpecifierWithoutSearch, bufferToEtag, isFileSystemPath, urlToPathname, setUrlBasename, createLogger, normalizeUrl, ANSI, RUNTIME_COMPAT, formatError, assertAndNormalizeDirectoryUrl, browserDefaultRuntimeCompat, inferRuntimeCompatFromClosestPackage, createTaskLog } from "./jsenv_core_packages.js";
import { createPluginsController } from "@jsenv/server/src/plugins_controller.js";
import { parseHtml, injectJsenvScript, stringifyHtmlAst, parseCssUrls, getHtmlNodeAttribute, getHtmlNodePosition, getHtmlNodeAttributePosition, setHtmlNodeAttributes, parseSrcSet, getUrlForContentInsideHtml, removeHtmlNodeText, setHtmlNodeText, getHtmlNodeText, analyzeScriptNode, visitHtmlNodes, parseJsUrls, getUrlForContentInsideJs, renderCssTemplateLiteral, applyBabelPlugins, visitJsAst, getImportMetaPropertyName, visitJsAstUntil, analyzeLinkNode, injectHtmlNodeAsEarlyAsPossible, createHtmlNode, generateUrlForInlineContent, parseJsWithAcorn } from "@jsenv/ast";
import { jsenvPluginSupervisor } from "@jsenv/plugin-supervisor";
import { jsenvPluginTranspilation } from "@jsenv/plugin-transpilation";
import { createMagicSource, composeTwoSourcemaps, generateSourcemapFileUrl, generateSourcemapDataUrl, SOURCEMAP } from "@jsenv/sourcemap";
import { bundleJsModules } from "@jsenv/plugin-bundling";
import { randomUUID } from "node:crypto";
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/plugins/filesystem/filesystem_error_to_response.js";
import "./jsenv_core_node_modules.js";
import "node:process";
import "node:os";
import "node:tty";
import "node:util";
import "node:path";

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

/*
 * Compares what a package.json declares with what is actually inside
 * node_modules, so the dev server can tell a dependency apart when it is
 * missing (never installed) or outdated (installed at an other version).
 *
 * Only the dependencies declared by a package are looked at, never the
 * transitive ones: a declared dependency is what pulls the rest, so it is
 * enough to know whether an install is needed or over.
 *
 * Only exact declared versions ("1.2.3") are compared: a range ("^1.2.3"), a
 * file/workspace protocol or a tag cannot be checked without resolving what npm
 * would pick, which is way beyond what is needed here.
 *
 * A status carries a severity so that every consumer (server log, browser
 * overlay, reload on install) reads the same decision: a missing package or an
 * outdated runtime dependency is a "warning", the page is not running what the
 * project asks for. An outdated devDependency is only "info": the installed
 * version runs, what may differ is tooling, and that is worth a line in the
 * console, not a dialog nor a reload once installed.
 */


const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
];

const packageNameFromSpecifier = (specifier) => {
  const parts = specifier.split("/");
  if (specifier[0] === "@") {
    return parts.slice(0, 2).join("/");
  }
  return parts[0];
};

/*
 * declaringDirectoryUrl is the package directory the importer belongs to, which
 * is not always the project one: a file inside node_modules resolves its bare
 * specifiers against the dependencies of the package containing it.
 */
const readDependencyStatus = (
  packageDirectory,
  packageName,
  declaringDirectoryUrl = packageDirectory.url,
) => {
  const packageJSON = readPackageJSON(packageDirectory, declaringDirectoryUrl);
  if (!packageJSON) {
    return null;
  }
  const declaration = readDeclaration(packageJSON, packageName);
  if (!declaration) {
    return null;
  }
  return createStatus(packageDirectory, {
    packageName,
    declaredVersion: declaration.version,
    declaredIn: declaration.field,
    declaringDirectoryUrl,
    declaredBy: packageJSON.name,
  });
};

const readDependencyStatuses = (packageDirectory) => {
  const packageJSON = readPackageJSON(packageDirectory, packageDirectory.url);
  if (!packageJSON) {
    return [];
  }
  const statuses = [];
  const packageNameSet = new Set();
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = packageJSON[field];
    if (!dependencies) {
      continue;
    }
    for (const packageName of Object.keys(dependencies)) {
      if (packageNameSet.has(packageName)) {
        continue;
      }
      packageNameSet.add(packageName);
      statuses.push(
        createStatus(packageDirectory, {
          packageName,
          declaredVersion: dependencies[packageName],
          declaredIn: field,
          declaringDirectoryUrl: packageDirectory.url,
          declaredBy: packageJSON.name,
        }),
      );
    }
  }
  return statuses;
};

const createStatus = (
  packageDirectory,
  {
    packageName,
    declaredVersion,
    declaredIn,
    declaringDirectoryUrl,
    declaredBy,
  },
) => {
  const status = {
    packageName,
    declaredVersion,
    declaredIn,
    declaredBy,
    installedVersion: null,
    // the file telling this dependency apart; it is what an install rewrites and
    // what the dev server looks at to know the dependency became the declared one
    watchedPath: null,
    state: "missing",
    severity: "warning",
  };
  const installedDirectoryUrl = findInstalledDirectoryUrl(
    declaringDirectoryUrl,
    packageName,
  );
  status.watchedPath = watchedPathFromDirectoryUrl(
    packageDirectory,
    // not installed yet: name the place where it is expected to appear
    installedDirectoryUrl ||
      `${declaringDirectoryUrl}node_modules/${packageName}/`,
  );
  if (!installedDirectoryUrl) {
    return status;
  }
  const installedPackageJSON = readPackageJSON(
    packageDirectory,
    installedDirectoryUrl,
  );
  status.installedVersion = installedPackageJSON
    ? installedPackageJSON.version
    : null;
  if (
    !isExactVersion(declaredVersion) ||
    status.installedVersion === declaredVersion
  ) {
    status.state = "installed";
    status.severity = null;
    return status;
  }
  status.state = "outdated";
  status.severity = declaredIn === "devDependencies" ? "info" : "warning";
  return status;
};

const watchedPathFromDirectoryUrl = (packageDirectory, directoryUrl) => {
  const packageJsonUrl = `${directoryUrl}package.json`;
  if (!packageDirectory.url) {
    return packageJsonUrl;
  }
  return urlToRelativeUrl(packageJsonUrl, packageDirectory.url);
};

const findInstalledDirectoryUrl = (declaringDirectoryUrl, packageName) => {
  let directoryUrl = declaringDirectoryUrl;
  while (directoryUrl) {
    const candidateUrl = `${directoryUrl}node_modules/${packageName}/`;
    if (existsSync(new URL(`${candidateUrl}package.json`))) {
      return candidateUrl;
    }
    const parentUrl = new URL("../", directoryUrl).href;
    if (parentUrl === directoryUrl) {
      return null;
    }
    directoryUrl = parentUrl;
  }
  return null;
};

const readDeclaration = (packageJSON, packageName) => {
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = packageJSON[field];
    if (dependencies && dependencies[packageName]) {
      return { field, version: dependencies[packageName] };
    }
  }
  return null;
};

// an install in progress can be caught halfway, with a package.json not written yet
const readPackageJSON = (packageDirectory, directoryUrl) => {
  if (!directoryUrl) {
    return null;
  }
  try {
    return packageDirectory.read(directoryUrl);
  } catch {
    return null;
  }
};

const isExactVersion = (declaredVersion) => {
  return /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(declaredVersion);
};

/*
 * Detects when "npm install" makes a missing or outdated dependency match what
 * the project package.json declares, so the browser can be reloaded at that
 * moment.
 *
 * node_modules is deliberately not watched: it is far too big, and an install
 * rewrites, dedupes and moves package directories around, so a watcher placed
 * on one of them is unreliable. Instead the few packages known to be missing or
 * outdated are polled, which costs a couple of readFileSync and stops as soon as
 * they are all installed. The project package.json is watched though: it is a
 * single file, and editing it is what puts a dependency out of date in the first
 * place.
 */


const POLL_INTERVAL = 500;

const watchDependencies = (
  packageDirectory,
  { onProblem, onInstalled, onChange, pollInterval = POLL_INTERVAL },
) => {
  let problemMap = new Map();
  // every path given to the browser is relative to the package directory, the
  // one holding the package.json being watched
  const packageJsonPath = "package.json";
  const watcher = {
    getProblems: () => Array.from(problemMap.values()),
    // what the browser needs to display the watching in progress
    getWatchInfo: () => ({ packageJsonPath, pollInterval }),
    stop: () => {},
  };
  if (!packageDirectory.url) {
    return watcher;
  }
  let timer = null;

  const check = () => {
    const nextProblemMap = new Map();
    for (const status of readDependencyStatuses(packageDirectory)) {
      if (status.state === "missing" || status.state === "outdated") {
        nextProblemMap.set(status.packageName, status);
      }
    }
    for (const [packageName, status] of nextProblemMap) {
      const previousStatus = problemMap.get(packageName);
      if (
        !previousStatus ||
        previousStatus.state !== status.state ||
        previousStatus.declaredVersion !== status.declaredVersion
      ) {
        onProblem(status);
      }
    }
    for (const [packageName, previousStatus] of problemMap) {
      if (!nextProblemMap.has(packageName)) {
        onInstalled(previousStatus);
      }
    }
    const changed =
      nextProblemMap.size !== problemMap.size ||
      Array.from(nextProblemMap.keys()).some((packageName) => {
        const previousStatus = problemMap.get(packageName);
        const status = nextProblemMap.get(packageName);
        return (
          !previousStatus ||
          previousStatus.state !== status.state ||
          previousStatus.declaredVersion !== status.declaredVersion ||
          previousStatus.installedVersion !== status.installedVersion
        );
      });
    problemMap = nextProblemMap;
    if (changed) {
      onChange(watcher.getProblems());
    }
    if (problemMap.size === 0) {
      stopPolling();
    } else {
      startPolling();
    }
  };

  const startPolling = () => {
    if (timer) {
      return;
    }
    timer = setInterval(check, pollInterval);
    timer.unref();
  };
  const stopPolling = () => {
    if (!timer) {
      return;
    }
    clearInterval(timer);
    timer = null;
  };

  const unwatchPackageJson = registerFileLifecycle(
    new URL("package.json", packageDirectory.url),
    {
      added: check,
      updated: check,
      keepProcessAlive: false,
    },
  );
  check();

  watcher.stop = () => {
    stopPolling();
    unwatchPackageJson();
  };
  return watcher;
};

const jsenvCoreDirectoryUrl = new URL("../", import.meta.url);

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

const createJsenvPluginStore = async (plugins) => {
  const allServerRoutes = [];
  const allServerPlugins = [];
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
    const { serverRoutes } = plugin;
    if (serverRoutes) {
      for (const serverRoute of serverRoutes) {
        allServerRoutes.push(serverRoute);
      }
    }
    const { serverPlugins } = plugin;
    if (serverPlugins) {
      const serverPlugins = plugin.serverPlugins;
      for (const serverPlugin of serverPlugins) {
        allServerPlugins.push(serverPlugin);
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
    allServerRoutes,
    allServerPlugins,
  };
};

const createJsenvPluginsController = async (
  pluginStore,
  kitchen,
  { meta } = {},
) => {
  kitchen.context.getPluginMeta = (id) => pluginsController.getPluginMeta(id);
  const pluginsController = await createPluginsController({
    plugins: pluginStore.pluginArray,
    pluginDescription: JSENV_PLUGIN_DESCRIPTION,
    filterPlugin: (plugin) => testAppliesDuring(plugin, kitchen),
    getInitPluginArgs: (plugin) => [kitchen.context, { plugin }],
    getEffectArgs: ({ otherPlugins }) => [
      { kitchenContext: kitchen.context, otherPlugins },
    ],
    meta,
  });
  return pluginsController;
};

const hook = { type: "hook" };
const nonHook = {};

const assertUrlReturnValue = (valueReturned, urlInfo, { hook }) => {
  if (valueReturned instanceof URL) {
    return valueReturned.href;
  }
  if (typeof valueReturned === "string") {
    return valueReturned;
  }
  throw new Error(
    `Unexpected value returned by hook "${hook.plugin.name}.${hook.name}()": it must be a string; got ${valueReturned}`,
  );
};
const assertContentReturnValue = (valueReturned, urlInfo, { hook }) => {
  if (typeof valueReturned === "string" || Buffer.isBuffer(valueReturned)) {
    return { content: valueReturned };
  }
  if (typeof valueReturned === "object") {
    const { content, body } = valueReturned;
    if (urlInfo.url.startsWith("ignore:")) {
      return valueReturned;
    }
    if (typeof content !== "string" && !Buffer.isBuffer(content) && !body) {
      if (Object.hasOwn(valueReturned, "contentInjections")) {
        return valueReturned;
      }
      throw new Error(
        `Unexpected "content" returned by hook "${hook.plugin.name}.${hook.name}()": it must be a string or a buffer; got ${content}`,
      );
    }
    return valueReturned;
  }
  throw new Error(
    `Unexpected value returned by hook "${hook.plugin.name}.${hook.name}()": it must be a string, a buffer or an object; got ${valueReturned}`,
  );
};

const JSENV_PLUGIN_DESCRIPTION = {
  name: "jsenv plugin",
  properties: {
    // non-hook properties (silently skipped)
    appliesDuring: nonHook,
    serverEvents: nonHook,
    mustStayFirst: nonHook,
    serverRoutes: nonHook,
    serverPlugins: nonHook,
    // hooks
    init: hook,
    resolveReference: {
      type: "hook",
      assertAndNormalize: assertUrlReturnValue,
    },
    redirectReference: {
      type: "hook",
      assertAndNormalize: assertUrlReturnValue,
    },
    transformReferenceSearchParams: hook,
    formatReference: hook,
    urlInfoCreated: hook,
    fetchUrlContent: {
      type: "hook",
      assertAndNormalize: assertContentReturnValue,
    },
    transformUrlContent: {
      type: "hook",
      assertAndNormalize: assertContentReturnValue,
    },
    finalizeUrlContent: {
      type: "hook",
      assertAndNormalize: assertContentReturnValue,
    },
    bundle: hook,
    optimizeBuildUrlContent: {
      type: "hook",
      assertAndNormalize: assertContentReturnValue,
    },
    cooked: hook,
    augmentResponse: hook,
    destroy: hook,
    effect: hook,
    refineBuildUrlContent: hook,
    refineBuild: hook,
    // serverRoutes and serverPlugins are nonHook above
  },
};

const testAppliesDuring = (plugin, kitchen) => {
  const { appliesDuring } = plugin;
  if (appliesDuring === undefined) {
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
    return false;
  }
  throw new TypeError(
    `"appliesDuring" must be an object or a string, got ${appliesDuring}`,
  );
};

const runtimeBySecChUa = new Map();
const runtimeByUserAgent = new Map();

const getRuntimeFromRequest = (request) => {
  const secChUa = request.headers["sec-ch-ua"];
  if (secChUa) {
    const cached = runtimeBySecChUa.get(secChUa);
    if (cached) {
      return cached;
    }
    const result = parseSecChUaHeader(secChUa);
    if (result) {
      runtimeBySecChUa.set(secChUa, result);
      return result;
    }
  }
  const userAgent = request.headers["user-agent"] || "";
  const cached = runtimeByUserAgent.get(userAgent);
  if (cached) {
    return cached;
  }
  const result = parseUserAgentHeader(userAgent);
  runtimeByUserAgent.set(userAgent, result);
  return result;
};

const parseSecChUaHeader = (secChUa) => {
  // sec-ch-ua format: "Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"
  const brands = [];
  const regex = /"([^"]+)";v="([^"]+)"/g;
  let match;
  while ((match = regex.exec(secChUa)) !== null) {
    const name = match[1];
    const version = match[2];
    // skip "Not X;Brand" noise entries
    if (!name.includes("Not") && !name.includes("Brand")) {
      brands.push({ name, version });
    }
  }
  if (brands.length === 0) {
    return null;
  }
  // Prefer the non-Chromium brand (e.g. "Google Chrome", "Microsoft Edge")
  // Fall back to "Chromium" if no specific brand found
  let brand = brands.find((b) => b.name !== "Chromium");
  if (!brand) {
    brand = brands[0];
  }
  const runtimeName = brandNameToRuntimeName(brand.name);
  const runtimeVersion = `${brand.version}.0.0`;
  return { runtimeName, runtimeVersion };
};
const brandNameToRuntimeName = (brandName) => {
  const lower = brandName.toLowerCase();
  if (lower === "google chrome") {
    return "chrome";
  }
  if (lower === "headlesschrome") {
    return "chrome";
  }
  if (lower === "microsoft edge") {
    return "edge";
  }
  if (lower === "opera") {
    return "opera";
  }
  if (lower === "samsung internet") {
    return "samsung";
  }
  if (lower === "chromium") {
    return "chrome";
  }
  // other Chromium-based browsers share Chrome's compatibility
  return "chrome";
};

const parseUserAgentHeader = (userAgent) => {
  if (userAgent.includes("node-fetch/")) {
    // it's not really node and conceptually we can't assume the node version
    // but good enough for now
    return {
      runtimeName: "node",
      runtimeVersion: process.version.slice(1),
    };
  }
  // iOS Safari must be checked before Safari (UA contains both)
  if (userAgent.includes("Mobile") && userAgent.includes("Safari")) {
    const iosSafariMatch = userAgent.match(/\bOS (\d+)[._](\d+)(?:[._](\d+))?/);
    if (iosSafariMatch) {
      const major = iosSafariMatch[1];
      const minor = iosSafariMatch[2] || "0";
      const patch = iosSafariMatch[3] || "0";
      return {
        runtimeName: "ios_safari",
        runtimeVersion: `${major}.${minor}.${patch}`,
      };
    }
  }
  if (!userAgent.includes("Chrome") && userAgent.includes("Safari")) {
    const safariMatch = userAgent.match(/\bVersion\/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (safariMatch) {
      const major = safariMatch[1];
      const minor = safariMatch[2] || "0";
      const patch = safariMatch[3] || "0";
      return {
        runtimeName: "safari",
        runtimeVersion: `${major}.${minor}.${patch}`,
      };
    }
  }
  const firefoxMatch = userAgent.match(/\bFirefox\/(\d+)\.(\d+)\b/);
  if (firefoxMatch) {
    const major = firefoxMatch[1];
    const minor = firefoxMatch[2] || "0";
    return { runtimeName: "firefox", runtimeVersion: `${major}.${minor}.0` };
  }
  // generic Chromium-based fallback (should normally be handled by sec-ch-ua)
  const chromeMatch = userAgent.match(
    /(?:HeadlessChrome|Chrome)\/(\d+)\.(\d+)\b/,
  );
  if (chromeMatch) {
    const major = chromeMatch[1];
    const minor = chromeMatch[2] || "0";
    return { runtimeName: "chrome", runtimeVersion: `${major}.${minor}.0` };
  }
  return { runtimeName: "unknown", runtimeVersion: "unknown" };
};

/*
 * Client monitoring plugin (dev only)
 * -----------------------------------
 * Lets you watch one client from another — e.g. read a phone's console logs and
 * activity from the desktop. A "client" here is a browser/navigator context that
 * cooked one of our pages and reports back; we can only see clients that execute
 * our injected script, not arbitrary HTTP clients of the dev server.
 *
 * The MAIN client — the machine the dev server runs on, browsing via
 * localhost — is listed but not watched: it reports presence only (heartbeat,
 * tabs), no console logs and no activity. Its devtools are already at hand,
 * and the person reading the dashboard is that client. Watching is for the
 * clients that reach the server over the network (a phone on the LAN address,
 * acceptAnyIp: true), and every client record carries the ip it reports from —
 * that ip is what tells the two kinds apart. See isLocalClient in
 * client_reporter.js (the client side of the same rule).
 *
 * Transport reuses what the dev server already has instead of opening a second
 * websocket:
 * - server → clients uses the jsenv "server events" channel (the same websocket
 *   the autoreload feature rides on). This plugin declares these server events:
 *     - "clients_list"    the whole registry (the dashboard renders it)
 *     - "client_log"      a single log line (a monitor appends it)
 *     - "client_activity" a single qualified activity (a monitor appends it)
 *     - "client_here"     a networked client just appeared/resumed (every page
 *                         can toast it); never sent for the main client, which
 *                         is the person reading the toast
 *     - "client_command"  pilot one client (navigate/reload its tab) from the
 *                         dashboard; the matching reporter runs it
 *   Server events are broadcast, so consumers filter what they care about.
 * - clients → server uses plain HTTP POSTs. /.internal/clients/report carries the
 *   tab (id, url, title, visibility), recent qualified activities (click, request,
 *   navigation, …) and buffered console logs; a periodic heartbeat keeps it fresh.
 *   /.internal/clients/command lets the dashboard pilot a client. No extra socket.
 *
 * A client aggregates its open tabs and a short activity history. It is "online"
 * when any report arrived within INACTIVITY_MS — there is no dedicated
 * connection to track.
 *
 * The monitoring script is injected into EVERY cooked page, including our own
 * dashboard and monitor pages — so opening one of those counts as a connected
 * client, and any open page gets toasted when another networked client appears.
 *
 * Pages:
 * - /.internal/clients     → dashboard listing every client seen
 * - /.internal/client?id=… → live console-log monitor for one client
 *
 * Both pages are served THROUGH the graph (via redirectReference to a real HTML
 * file) rather than as a raw route response, so they get cooked like any app
 * page — which is what injects window.__server_events__ into them. They consume
 * the server events directly, no bespoke socket. See the "dev-server" skill next
 * to @jsenv/core for how internal pages get script injection.
 */


// Normalize the dev server's { runtimeName, runtimeVersion } to the { name,
// version } shape the pages use for both browser and OS.
const runtimeFromRequest = (request) => {
  const { runtimeName, runtimeVersion } = getRuntimeFromRequest(request);
  return { name: runtimeName, version: runtimeVersion };
};

const clientReporterFileUrl = new URL(
  "../js/client_reporter.js",
  import.meta.url,
).href;
const clientsPageFileUrl = new URL(
  "../html/clients_page.html",
  import.meta.url,
).href;
const clientMonitorPageFileUrl = new URL(
  "../html/client_monitor_page.html",
  import.meta.url,
).href;

// Keep at most this many log entries per client, and drop entries older than
// LOG_TTL_MS — the buffer only exists so a monitor opened a bit late can still
// show recent history; it is not a persistent store.
const LOG_MAX_PER_CLIENT = 1000;
const LOG_TTL_MS = 60 * 60 * 1000; // 1h
// Recent qualified activities kept per client (click, mousemove, request, …),
// so a page can show "what the client was last doing" and a short history.
const ACTIVITY_MAX_PER_CLIENT = 50;
// A client silent (no report at all) for longer than this, then reporting
// again, is treated as "resumed" and defines "online".
const INACTIVITY_MS = 60 * 1000;
// A tab not heard from for this long is considered closed and dropped.
const TAB_TTL_MS = 2 * 60 * 1000;
// What a browser sends is not to be trusted with the server's memory: a log
// line is cut at the source too (see client_reporter.js), and cut again here so
// a hand-made POST cannot park megabytes in the buffer — which the
// server-events history would then keep a second time.
// A little above the client's own cut, so the "… (N more characters)" it adds
// survives this one — the reader needs to know something was left out.
const LOG_TEXT_MAX = 10_064;
// Clients seen since the server started, at most. One per browser profile in
// practice, but every private window and every cleared storage adds one that
// never comes back, each carrying its own buffer — so the oldest ones that are
// no longer online are let go.
const CLIENT_MAX = 50;

// The dev server already parses browser + version from a request (sec-ch-ua or
// user-agent) via getRuntimeFromRequest; it does not cover the OS, so this fills
// that gap from the user-agent string.
const osFromUserAgent = (userAgent) => {
  const iosMatch = userAgent.match(/iPhone OS (\d+)[._](\d+)/);
  if (iosMatch) {
    return { name: "iOS", version: `${iosMatch[1]}.${iosMatch[2]}` };
  }
  if (/iPad/.test(userAgent)) {
    const ipadMatch = userAgent.match(/OS (\d+)[._](\d+)/);
    return {
      name: "iPadOS",
      version: ipadMatch ? `${ipadMatch[1]}.${ipadMatch[2]}` : "",
    };
  }
  const androidMatch = userAgent.match(/Android (\d+(?:\.\d+)*)/);
  if (androidMatch) {
    return { name: "Android", version: androidMatch[1] };
  }
  if (/Windows NT/.test(userAgent)) {
    const winMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
    const version =
      winMatch && winMatch[1] === "10.0" ? "10/11" : winMatch?.[1];
    return { name: "Windows", version: version || "" };
  }
  const macMatch = userAgent.match(/Mac OS X (\d+)[._](\d+)(?:[._](\d+))?/);
  if (macMatch) {
    const patch = macMatch[3] ? `.${macMatch[3]}` : "";
    return { name: "macOS", version: `${macMatch[1]}.${macMatch[2]}${patch}` };
  }
  if (/CrOS/.test(userAgent)) {
    return { name: "ChromeOS", version: "" };
  }
  if (/Linux/.test(userAgent)) {
    return { name: "Linux", version: "" };
  }
  return { name: "unknown", version: "" };
};

// A browser driven by a program rather than by someone looking at it: a test
// run, a screenshot script. Chromium says so in its user-agent ("HeadlessChrome"
// / "Headless"), the others do not — so the reporter also sends
// navigator.webdriver, which every automated browser sets, and either one is
// enough to classify the client (see the headless flag on the record).
const isHeadlessUserAgent = (userAgent) => /Headless/i.test(userAgent);

// The machine the dev server runs on, talking to itself: the main client. A
// phone (or any other device) reaching the server over the network reports
// with the machine's LAN address instead — which is why the ip is kept on
// every client record: it is what tells the main client from the others.
const isLocalIp = (ip) =>
  ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";

const jsenvPluginClientMonitoring = () => {
  // id -> client record
  const clients = new Map();

  // Assigned when the server-event channel is set up; broadcast helpers.
  let sendClientsList = () => {};
  let sendClientLog = () => {};
  let sendClientActivity = () => {};
  let sendClientHere = () => {};
  // Pilot a client from the desktop: a targeted command (navigate/reload) the
  // matching reporter runs. Broadcast like the rest; the reporter filters by id.
  let sendClientCommand = () => {};

  const now = () => Date.now();
  // "online" = we heard from the client (any report) recently.
  const isOnline = (client) => now() - client.lastSeen < INACTIVITY_MS;

  const getOrCreateClient = (id, request) => {
    const userAgent = request.headers["user-agent"] || "";
    let client = clients.get(id);
    if (!client) {
      client = {
        id,
        userAgent,
        runtime: runtimeFromRequest(request),
        os: osFromUserAgent(userAgent),
        // Automated browser (test run, script) rather than someone browsing;
        // set from the user-agent here, and again from navigator.webdriver when
        // a report brings it (the only signal for headless firefox/webkit).
        headless: isHeadlessUserAgent(userAgent),
        // The address the reports come from; request.ipForwarded when a proxy
        // sits in between, so the client's own address is kept, not the proxy's.
        ip: request.ipForwarded || request.ip,
        firstSeen: now(),
        lastSeen: now(),
        everSeen: false,
        logs: [],
        activities: [],
        // most recent qualified activity { type, detail, ts, tabId } or null
        lastActivity: null,
        // tabId -> { id, url, title, visible, lastSeen }
        tabs: new Map(),
      };
      clients.set(id, client);
    } else {
      if (userAgent && userAgent !== client.userAgent) {
        client.userAgent = userAgent;
        client.runtime = runtimeFromRequest(request);
        client.os = osFromUserAgent(userAgent);
        client.headless = client.headless || isHeadlessUserAgent(userAgent);
      }
      // A device changes address (wifi drop, DHCP): the record follows it.
      const ip = request.ipForwarded || request.ip;
      if (ip && ip !== client.ip) {
        client.ip = ip;
      }
    }
    return client;
  };

  // The oldest silent ones first: a client still reporting is one someone is
  // looking at, whatever its age.
  const pruneClients = () => {
    if (clients.size <= CLIENT_MAX) {
      return;
    }
    const droppable = [...clients.values()]
      .filter((client) => !isOnline(client))
      .sort((a, b) => a.lastSeen - b.lastSeen);
    for (const client of droppable) {
      if (clients.size <= CLIENT_MAX) {
        return;
      }
      clients.delete(client.id);
    }
  };

  const pruneLogs = (client) => {
    const cutoff = now() - LOG_TTL_MS;
    while (client.logs.length && client.logs[0].ts < cutoff) {
      client.logs.shift();
    }
    while (client.logs.length > LOG_MAX_PER_CLIENT) {
      client.logs.shift();
    }
  };

  const updateTab = (client, tab) => {
    if (!tab || typeof tab.id !== "string") {
      return;
    }
    if (tab.closing) {
      client.tabs.delete(tab.id);
      return;
    }
    client.tabs.set(tab.id, {
      id: tab.id,
      url: typeof tab.url === "string" ? tab.url : "",
      title: typeof tab.title === "string" ? tab.title : "",
      visible: Boolean(tab.visible),
      lastSeen: now(),
    });
  };

  const pruneTabs = (client) => {
    const cutoff = now() - TAB_TTL_MS;
    for (const [id, tab] of client.tabs) {
      if (tab.lastSeen < cutoff) {
        client.tabs.delete(id);
      }
    }
  };

  // The tab to show as "current": a visible one wins, otherwise the most
  // recently seen. No Math.max — a single scan keeping the best.
  const activeTabOf = (client) => {
    let best = null;
    for (const tab of client.tabs.values()) {
      if (!best) {
        best = tab;
        continue;
      }
      if (tab.visible && !best.visible) {
        best = tab;
        continue;
      }
      if (tab.visible === best.visible && tab.lastSeen > best.lastSeen) {
        best = tab;
      }
    }
    return best;
  };

  const recordActivity = (client, rawActivity) => {
    const activity = {
      type:
        typeof rawActivity.type === "string" ? rawActivity.type : "activity",
      detail: typeof rawActivity.detail === "string" ? rawActivity.detail : "",
      ts: rawActivity.ts || now(),
      tabId: typeof rawActivity.tabId === "string" ? rawActivity.tabId : "",
    };
    client.activities.push(activity);
    while (client.activities.length > ACTIVITY_MAX_PER_CLIENT) {
      client.activities.shift();
    }
    client.lastActivity = activity;
    return activity;
  };

  const serializeTab = (tab) => ({
    id: tab.id,
    url: tab.url,
    title: tab.title,
    visible: tab.visible,
    lastSeen: tab.lastSeen,
  });

  // Summary sent in the (broadcast) list — kept lean: the active tab and a tab
  // count rather than every tab, the last activity rather than the whole
  // history. Pages fetch the full record for their dialogs.
  const serializeClient = (client) => {
    const activeTab = activeTabOf(client);
    return {
      id: client.id,
      userAgent: client.userAgent,
      // parsed { name, version } so pages can show a friendly browser/OS
      runtime: client.runtime,
      os: client.os,
      headless: client.headless,
      ip: client.ip,
      // The main client — the machine the dev server runs on, talking to
      // itself over localhost.
      local: isLocalIp(client.ip),
      firstSeen: client.firstSeen,
      lastSeen: client.lastSeen,
      online: isOnline(client),
      logCount: client.logs.length,
      tabCount: client.tabs.size,
      activeTab: activeTab ? serializeTab(activeTab) : null,
      lastActivity: client.lastActivity,
    };
  };

  const snapshot = () => [...clients.values()].map(serializeClient);

  // A single client's full record: the summary plus everything a dialog needs
  // (all tabs, recent activities, buffered logs). Client-scoped rather than
  // named after logs because the shape is meant to grow.
  const clientDetail = (client) => ({
    ...serializeClient(client),
    tabs: [...client.tabs.values()].map(serializeTab),
    activities: client.activities.slice(),
    logs: client.logs,
  });

  // Broadcasting the full list on every log line would be wasteful, so a
  // log-driven refresh (logCount/lastActivity) is throttled; structural changes
  // (a client appears/resumes) push immediately.
  let listThrottleTimer = null;
  const pushListThrottled = () => {
    if (listThrottleTimer) {
      return;
    }
    listThrottleTimer = setTimeout(() => {
      listThrottleTimer = null;
      sendClientsList();
    }, 1000);
  };

  const ingest = async (request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400 };
    }
    const clientId = body.clientId;
    if (!clientId || typeof clientId !== "string") {
      return { status: 400 };
    }
    const client = getOrCreateClient(clientId, request);

    const firstEver = !client.everSeen;
    const wasOnline = !firstEver && isOnline(client);
    client.everSeen = true;
    client.lastSeen = now();
    // navigator.webdriver, reported once per batch: true for any browser under
    // automation, including the headless firefox/webkit the user-agent hides.
    if (body.webdriver === true) {
      client.headless = true;
    }

    updateTab(client, body.tab);
    pruneTabs(client);
    pruneClients();

    if (firstEver || !wasOnline) {
      // The toast invites the reader to monitor the client that just appeared,
      // so it is only worth showing for a client there is something to watch:
      // one reaching the server over the network. The machine running the dev
      // server is the person reading the toast — it browses over localhost, its
      // devtools are one keystroke away and nothing is captured for it, so
      // announcing it means interrupting someone about themselves. It happens
      // more than one would think: the client id lives in localStorage, so the
      // same browser gets a fresh id per origin (localhost vs 127.0.0.1 vs the
      // LAN ip, another port) and in private windows, and each of those looks
      // like a brand new client to the server.
      if (!isLocalIp(client.ip)) {
        sendClientHere({
          // A report after a long quiet spell means the client was picked back
          // up rather than newly seen.
          reason: firstEver ? "new" : "resumed",
          client: serializeClient(client),
        });
      }
      sendClientsList();
    }

    const activities = Array.isArray(body.activities) ? body.activities : [];
    for (const rawActivity of activities) {
      const activity = recordActivity(client, rawActivity);
      sendClientActivity({ clientId, ...activity });
    }

    const logs = Array.isArray(body.logs) ? body.logs : [];
    for (const rawLog of logs) {
      const entry = {
        level: rawLog.level || "log",
        text:
          typeof rawLog.text === "string"
            ? rawLog.text.slice(0, LOG_TEXT_MAX)
            : "",
        ts: rawLog.ts || now(),
      };
      // styled console segments ({ text, css } per %c run), when present, so a
      // monitor can render colors; the plain text stays for copy/paste.
      if (Array.isArray(rawLog.segments)) {
        entry.segments = rawLog.segments.map((segment) => ({
          ...segment,
          text:
            typeof segment?.text === "string"
              ? segment.text.slice(0, LOG_TEXT_MAX)
              : "",
        }));
      }
      client.logs.push(entry);
      sendClientLog({ clientId, ...entry });
    }
    if (logs.length) {
      pruneLogs(client);
    }
    pushListThrottled();
    return { status: 204 };
  };

  const jsonResponse = (data) => {
    const json = JSON.stringify(data);
    return {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(json),
      },
      body: json,
    };
  };

  // Desktop pilots a client: validate a { clientId, tabId?, type, url? } command
  // and broadcast it as a "client_command" server event. The reporter runs it
  // only if the id (and tabId, when given) matches. type: "navigate" | "reload".
  const ingestCommand = async (request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400 };
    }
    const { clientId, tabId, type, url } = body;
    if (!clientId || typeof clientId !== "string") {
      return { status: 400 };
    }
    if (type !== "navigate" && type !== "reload") {
      return { status: 400 };
    }
    if (type === "navigate" && (!url || typeof url !== "string")) {
      return { status: 400 };
    }
    sendClientCommand({
      clientId,
      tabId: typeof tabId === "string" ? tabId : null,
      type,
      url: type === "navigate" ? url : null,
    });
    return { status: 204 };
  };

  // Map our two page URLs onto their real HTML files. Returning a graph URL
  // here (instead of serving the file from a raw route) makes the dev server
  // cook the page, which is what gets window.__server_events__ injected into it.
  const redirectToPage = (reference) => {
    if (reference.isInline || !reference.url.startsWith("file:")) {
      return null;
    }
    const { pathname, search } = new URL(reference.url);
    if (pathname.endsWith("/.internal/clients")) {
      return clientsPageFileUrl;
    }
    if (pathname.endsWith("/.internal/client")) {
      // carry ?id=… so the monitor page knows which client to watch
      return `${clientMonitorPageFileUrl}${search}`;
    }
    return null;
  };

  return {
    name: "jsenv:client_monitoring",
    appliesDuring: "dev",
    redirectReference: redirectToPage,
    serverEvents: {
      clients_list: (serverEventInfo) => {
        sendClientsList = () => serverEventInfo.sendServerEvent(snapshot());
      },
      client_log: (serverEventInfo) => {
        sendClientLog = (payload) => serverEventInfo.sendServerEvent(payload);
      },
      client_activity: (serverEventInfo) => {
        sendClientActivity = (payload) =>
          serverEventInfo.sendServerEvent(payload);
      },
      client_here: (serverEventInfo) => {
        sendClientHere = (payload) => serverEventInfo.sendServerEvent(payload);
      },
      client_command: (serverEventInfo) => {
        sendClientCommand = (payload) =>
          serverEventInfo.sendServerEvent(payload);
      },
    },
    transformUrlContent: {
      html: (urlInfo) => {
        // Injected into every page, including our own dashboard/monitor pages,
        // so opening one registers that browser as a client and any open page
        // gets toasted when another client appears.
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        injectJsenvScript(htmlAst, {
          src: clientReporterFileUrl,
          initCall: {
            callee: "window.__client_monitoring__.setup",
            params: {},
          },
          pluginName: "jsenv:client_monitoring",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
    serverRoutes: [
      // The two pages are actually served THROUGH the graph (see
      // redirectReference above) so they get window.__server_events__ injected.
      // These entries exist only to make the pages discoverable in the route
      // inspector (/.internal/route_inspector): their fetch returns null, which
      // makes the router fall through to the dev server's catch-all "GET *",
      // which does the real cooking + injection.
      {
        endpoint: "GET /.internal/clients",
        description:
          "Dashboard of every browser (client) connected to this dev server since it started.",
        availableMediaTypes: ["text/html"],
        declarationSource: import.meta.url,
        fetch: () => null,
      },
      {
        endpoint: "GET /.internal/client",
        description:
          "Live monitor (console logs + activity) for one client — pass ?id=<clientId>.",
        availableMediaTypes: ["text/html"],
        declarationSource: import.meta.url,
        fetch: () => null,
      },
      {
        endpoint: "POST /.internal/clients/report",
        description:
          "A browser reports its console output and activity heartbeat here.",
        declarationSource: import.meta.url,
        fetch: (request) => ingest(request),
      },
      {
        endpoint: "POST /.internal/clients/command",
        description:
          "Pilot a client from the dashboard: { clientId, tabId?, type: 'navigate'|'reload', url? }.",
        declarationSource: import.meta.url,
        fetch: (request) => ingestCommand(request),
      },
      {
        endpoint: "GET /.internal/clients.json",
        description: "Snapshot of every client seen since the server started.",
        availableMediaTypes: ["application/json"],
        declarationSource: import.meta.url,
        fetch: () => jsonResponse(snapshot()),
      },
      {
        endpoint: "GET /.internal/client.json",
        description:
          "One client's record — info plus buffered logs (?id=…), so a monitor opened late still has recent history.",
        availableMediaTypes: ["application/json"],
        declarationSource: import.meta.url,
        fetch: (request) => {
          const id = request.searchParams.get("id");
          const client = id && clients.get(id);
          return jsonResponse(client ? clientDetail(client) : { id, logs: [] });
        },
      },
    ],
  };
};

/*
 * cmd+K (ctrl+K elsewhere) on any page the dev server serves opens a list of
 * the .html files it serves, filter as you type, Enter to go there. cmd+E
 * (ctrl+E elsewhere) opens a page's file in the editor instead of going to it:
 * the current page from anywhere, the selected row from inside the switcher.
 *
 * The list is the one the filesystem plugin already publishes for everyone
 * (GET /.internal/pages.json, see protocol_file/html_pages.js) — this only adds
 * the way to reach it without leaving the page one is working on.
 *
 * Registered with the dev server rather than among the core plugins, next to
 * the other things that inject a client script: the script it adds is a
 * reference like any other, and it has to be added while references are still
 * being resolved — added later it stays a file:// url the browser refuses.
 *
 * A shortcut on every page is a shortcut taken from every page, so the page
 * comes first: the key is watched on the document, in the bubble phase, and
 * anything that called preventDefault on its way there keeps it. A page with
 * its own cmd+K owes nothing to this one.
 */


const clientFileUrl$1 = new URL("../js/page_switcher.js", import.meta.url)
  .href;

const jsenvPluginPageSwitcher = () => {
  return {
    name: "jsenv:page_switcher",
    // Dev only: it is a way around the source tree, which a built app has no
    // business carrying.
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        injectJsenvScript(htmlAst, {
          // A module: the tree it opens is the shared page picker
          // (protocol_file/client/page_picker.js), which it imports.
          type: "module",
          src: clientFileUrl$1,
          pluginName: "jsenv:page_switcher",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};

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
  if (
    reference.subtype === "new_url_first_arg" ||
    reference.subtype === "import_meta_resolve"
  ) {
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

// A bare specifier ("preact", "@jsenv/core/x.js") is resolved by node esm resolution,
// everything else ("/a.js", "./a.js", "http://example.com/a.js") by url resolution
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
      const { substitutions } = inlineReferenceInfo;
      const replacement = substitutions
        ? // the expressions the template holds take their placeholder's place
          // back; a template literal is written whatever the runtime supports,
          // transpilation runs after and lowers it when it has to
          renderCssTemplateLiteral(inlineUrlInfo.content, substitutions)
        : JS_QUOTES.escapeSpecialChars(inlineUrlInfo.content, { quote });
      if (replacement === null) {
        // a placeholder did not survive: the source stays as it was written
        return;
      }
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
      isBareSpecifier(externalReferenceInfo.specifier)
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
  return magicSource.toContentAndSourcemap();
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
  dev,
  build,
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
      dev,
      build,
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
        const closestPackageJson = packageDirectory.read(
          closestPackageDirectoryUrl,
        );
        if (!closestPackageJson) {
          // package.json can be momentarily missing while a package manager
          // is installing/updating that package (npm install running in watch mode)
          break version_relationship;
        }
        const packageVersion = closestPackageJson.version;
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
    dev,
    build,
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
      // "dev:*" conditions target packages under active development: they
      // apply to files resolved outside node_modules (sources, workspace
      // symlinks), never to installed packages.
      "dev:*": devResolver,
      // "development"/"production" follow the ecosystem semantics
      // (Vite, webpack): they describe how the app runs, not where the
      // package lives, so they apply to every package, node_modules
      // included. Dev server resolves "development"; build resolves
      // "production", unless the build is dev-flavored
      // (build({ entryPoints: { "./file.js": { dev: true } } }))
      // in which case it resolves "development" too.
      "development": Boolean(dev),
      "production": Boolean(build) && !dev,
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
  // One file imports many packages, so it depends on many package.json: the
  // relationship is identified by the package.json it points at, not by the
  // field alone. Keying on the field alone lets the first package imported
  // stand for every other one, and a version bump on any of the others then
  // leaves this file cooked against the version it saw first — the ?v= baked
  // in its specifiers names a package copy nobody else resolves to anymore.
  for (const referenceToOther of ownerUrlInfo.referenceToOthersSet) {
    if (
      referenceToOther.type === "package_json" &&
      referenceToOther.subtype === field &&
      referenceToOther.specifier === packageJsonUrl
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

const jsenvPluginNodeEsmResolution = ({
  packageDirectory,
  resolutionConfig = {},
  packageConditions,
  packageConditionsConfig = {},
  dev,
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
      dev: dev === undefined ? kitchenContext.dev : dev,
      build: kitchenContext.build,
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
        dev: dev === undefined ? kitchenContext.dev : dev,
        build: kitchenContext.build,
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
        // "/x" is the web meaning of a root-relative url: the root of what is
        // served, which is the source directory — not the directory the entry
        // point happens to sit in.
        const url = new URL(
          resource.slice(1),
          ownerUrlInfo.context.rootDirectoryUrl,
        );
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

/*
 * The .html files under the served directory, as urls one can navigate to.
 *
 * Lives here, next to the plugin that owns the filesystem, because more than
 * one feature wants the same list: the client dashboard sends a browser to one
 * of them, the page switcher (cmd+K) opens one in the current tab. Whoever asks
 * gets the same answer.
 *
 * Each page comes with where its file is (so it can be opened in an editor as
 * well as in the browser) and with what kind of page it is, read from where it
 * sits and
 * what it is called — the two conventions this repo already follows:
 * - "experiment": something tried out, under a lab/ directory or named
 *   *_experiment.html;
 * - "demo": something shown, under a demos/ directory or named *_demo.html;
 * - "page": everything else.
 *
 * Scanned on demand rather than watched: the list is asked for when a human
 * opens a picker, which is rare and never on a hot path, and a short cache is
 * enough to keep a burst of asks from walking the tree twice.
 */


const SCAN_TTL_MS = 5000;

// What to walk and what to skip, in the shape @jsenv/url-meta reads: the last
// matching pattern wins, so the exclusions come after the "every .html" rule.
// Dependencies, build output and jsenv's own caches hold no page worth going to.
const HTML_PAGE_ASSOCIATIONS = {
  page: {
    "**/*.html": true,
    "**/.*/": false,
    "**/node_modules/": false,
    "**/dist/": false,
    "**/build/": false,
    "**/coverage/": false,
    "**/git_ignored/": false,
    "**/old/": false,
  },
  experiment: {
    "**/lab/**/*.html": true,
    "**/*_experiment.html": true,
  },
  demo: {
    "**/demos/**/*.html": true,
    "**/*_demo.html": true,
  },
};

// An experiment inside a demos/ directory is an experiment: the more specific
// of the two wins, and "shown" is the weaker claim.
const readKind = (meta) => {
  if (meta.experiment) {
    return "experiment";
  }
  if (meta.demo) {
    return "demo";
  }
  return "page";
};

// Which package a page belongs to: the nearest directory above it holding a
// package.json, said as a url so whoever draws a tree can mark that very node.
// Not the root itself — everything is under it, and "the whole repo" is not a
// package one distinguishes from another. Memoized per directory: a scan asks
// the same question once per file and there are hundreds of them.
const createPackageDirectoryFinder = (rootDirectoryUrl) => {
  const cache = new Map();
  const find = (directoryUrl) => {
    if (cache.has(directoryUrl)) {
      return cache.get(directoryUrl);
    }
    let result = null;
    if (directoryUrl.length > String(rootDirectoryUrl).length) {
      result = existsSync(new URL("./package.json", directoryUrl))
        ? directoryUrl
        : find(new URL("../", directoryUrl).href);
    }
    cache.set(directoryUrl, result);
    return result;
  };
  return find;
};

const createHtmlPageLister = ({ rootDirectoryUrl }) => {
  let cache = null;
  let cachedAt = 0;

  return async () => {
    if (!rootDirectoryUrl) {
      return [];
    }
    const now = Date.now();
    if (cache && now - cachedAt < SCAN_TTL_MS) {
      return cache;
    }
    const fileResultArray = await collectFiles({
      directoryUrl: rootDirectoryUrl,
      associations: HTML_PAGE_ASSOCIATIONS,
      predicate: (meta) => Boolean(meta.page),
    });
    const findPackageDirectory = createPackageDirectoryFinder(rootDirectoryUrl);
    const pages = fileResultArray.map(({ relativeUrl, meta }) => {
      const fileUrl = new URL(relativeUrl, rootDirectoryUrl).href;
      const packageDirectoryUrl = findPackageDirectory(
        new URL("./", fileUrl).href,
      );
      return {
        url: `/${relativeUrl}`,
        // Where the file actually is, so whoever wants to open it in an editor
        // rather than in the browser has what GET /.internal/open_file/* asks
        // for (a file url) without having to know the root directory.
        fileUrl,
        kind: readKind(meta),
        // Relative to the root and without its trailing slash, which is how a
        // tree names its own nodes.
        packageUrl: packageDirectoryUrl
          ? `/${packageDirectoryUrl.slice(String(rootDirectoryUrl).length).replace(/\/$/, "")}`
          : null,
      };
    });
    cache = pages;
    cachedAt = now;
    return pages;
  };
};

const getDirectoryWatchPatterns = (
  directoryUrl,
  watchedDirectoryUrl,
  { sourceFilesConfig, defaultPatterns = true },
) => {
  const directoryUrlRelativeToWatchedDirectory = urlToRelativeUrl(
    directoryUrl,
    watchedDirectoryUrl,
  );
  const watchPatterns = {};
  if (defaultPatterns) {
    Object.assign(watchPatterns, {
      [`${directoryUrlRelativeToWatchedDirectory}**/*`]: true, // by default watch everything inside the source directory
      [`${directoryUrlRelativeToWatchedDirectory}**/.*`]: false, // file starting with a dot -> do not watch
      [`${directoryUrlRelativeToWatchedDirectory}**/.*/`]: false, // directory starting with a dot -> do not watch
      [`${directoryUrlRelativeToWatchedDirectory}**/node_modules/`]: false, // node_modules directory -> do not watch
    });
  }
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
  const addDirectoryToWatch = (directoryUrl, { defaultPatterns } = {}) => {
    Object.assign(
      watchPatterns,
      getDirectoryWatchPatterns(directoryUrl, watchedDirectoryUrl, {
        sourceFilesConfig,
        defaultPatterns,
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
      const workspaceDirectoryUrl = workspace.endsWith("*")
        ? new URL(workspace.slice(0, -1), packageDirectoryUrl)
        : new URL(workspace, packageDirectoryUrl);
      addDirectoryToWatch(workspaceDirectoryUrl, {
        // The source directory patterns already cover a workspace inside it.
        // Every pattern is tested against every file found while watching, so
        // the same patterns rooted at each workspace only multiply that work.
        defaultPatterns: !urlIsOrIsInsideOf(
          workspaceDirectoryUrl,
          sourceDirectoryUrl,
        ),
      });
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
      // must be read before applyFsStatEffectsOnUrlObject which forces the
      // trailing slash on directories
      const specifierUsesTrailingSlash = urlObject.pathname.endsWith("/");
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
          if (specifierUsesTrailingSlash) {
            // the trailing slash asks for a directory and there is none here
            // -> let 404 happen (same reasoning as the extension above)
            return null;
          }
          const spaFallbackUrl = getSpaFallbackUrl(reference);
          if (spaFallbackUrl) {
            return spaFallbackUrl;
          }
          return null;
        }
        if (fsStat.isDirectory()) {
          // When requesting a directory, check if we have an HTML entry file for that directory
          const directoryEntryFileUrl = getDirectoryEntryFileUrl(urlObject);
          if (directoryEntryFileUrl) {
            reference.fsStat = readEntryStatSync(directoryEntryFileUrl);
            return directoryEntryFileUrl;
          }
          if (!specifierUsesTrailingSlash) {
            // the trailing slash is what tells a directory apart from a route:
            // "/join/" is the directory, "/join" is a route owned by the SPA
            // even when "join/" exists in the source files.
            // Without this a source directory would shadow the route having
            // the same name and the SPA would be unreachable in dev while
            // being perfectly fine once built
            const spaFallbackUrl = getSpaFallbackUrl(reference);
            if (spaFallbackUrl) {
              reference.fsStat = readEntryStatSync(spaFallbackUrl, {
                nullIfNotFound: true,
              });
              return spaFallbackUrl;
            }
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
const getSpaFallbackUrl = (reference) => {
  const { requestedUrl, rootDirectoryUrl, mainFilePath } =
    reference.ownerUrlInfo.context;
  if (!requestedUrl) {
    // the SPA fallback answers a request; during build there is none
    return null;
  }
  const spaFallbackFileUrls = listSpaFallbackFileUrls(requestedUrl, {
    rootDirectoryUrl,
    mainFilePath,
  });
  for (const spaFallbackFileUrl of spaFallbackFileUrls) {
    if (existsSync(new URL(spaFallbackFileUrl))) {
      return spaFallbackFileUrl;
    }
  }
  // none exists: the main file it is, and the 404 answering for it lists
  // what was tried (see directory listing)
  return new URL(mainFilePath, rootDirectoryUrl).href;
};
// The html files that can answer a route, closest first: the entry file of
// the route's own directory ("index.html", then "<dirname>.html"), then of
// each directory above it up to the server root, then the main file.
const listSpaFallbackFileUrls = (
  requestedUrl,
  { rootDirectoryUrl, mainFilePath },
) => {
  const fileUrls = [];
  let directoryUrl = new URL("./", requestedUrl).href;
  while (urlIsOrIsInsideOf(directoryUrl, rootDirectoryUrl)) {
    fileUrls.push(new URL("index.html", directoryUrl).href);
    const filename = urlToFilename(directoryUrl);
    if (filename) {
      fileUrls.push(new URL(`${filename}.html`, directoryUrl).href);
    }
    if (directoryUrl === String(rootDirectoryUrl)) {
      break;
    }
    directoryUrl = new URL("../", directoryUrl).href;
  }
  const mainFileUrl = new URL(mainFilePath, rootDirectoryUrl).href;
  if (!fileUrls.includes(mainFileUrl)) {
    fileUrls.push(mainFileUrl);
  }
  return fileUrls;
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
        if (!request) {
          // no request we should not serve directoy listing
          return null;
        }
        const secFetchDest = request.headers["sec-fetch-dest"];
        if (secFetchDest && secFetchDest !== "document") {
          // we have sec fetch dest and it's not document so it's not a navigation request, we should not serve directory listing
          return null;
        }
        if (!secFetchDest) {
          // beware we might end up here when nav context is not trusted (http, ip url etc)
          // in that case we fallback to detecting if the request explicitly accepts html.
          // browsers navigating to a page send "text/html,..." explicitly; programmatic
          // fetch clients like Node.js send "*/*" which should NOT trigger directory listing.
          // We must NOT use pickContentType here because it matches "text/html" via the
          // "*/*" wildcard, causing programmatic fetches to receive the directory listing
          // HTML page (status 200) instead of a 404.
          const acceptHeader = request.headers.accept || "";
          if (!acceptHeader.includes("text/html")) {
            return null;
          }
        }
        // requestedUrl must be a proper file:// URL (no encoded slashes)
        if (requestedUrl.includes("%2F") || requestedUrl.includes("%2f")) {
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
    serverRoutes: [
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
    // a url without extension nor trailing slash is a route: in spa mode it
    // was answered with the closest html file, the 404 means none was found
    const urlNotFoundObject = new URL(urlNotFound);
    if (
      spa &&
      !urlToExtension(urlNotFoundObject) &&
      !urlNotFoundObject.pathname.endsWith("/")
    ) {
      enoentDetails.spaFallbackFilePaths = listSpaFallbackFileUrls(
        urlNotFound,
        { rootDirectoryUrl: serverRootDirectoryUrl, mainFilePath },
      ).map((fileUrl) =>
        FILE_AND_SERVER_URLS_CONVERTER.asServerUrl(
          fileUrl,
          serverRootDirectoryUrl,
        ),
      );
    }
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
  const listHtmlPages = createHtmlPageLister({ rootDirectoryUrl });

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
    {
      name: "jsenv:html_pages",
      appliesDuring: "dev",
      serverRoutes: [
        {
          endpoint: "GET /.internal/pages.json",
          description:
            "The .html files served under the source directory, as urls to navigate to.",
          availableMediaTypes: ["application/json"],
          declarationSource: import.meta.url,
          fetch: async () => ({
            status: 200,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
            body: JSON.stringify(await listHtmlPages()),
          }),
        },
      ],
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
          const urlObject = new URL(url);
          // taken before the read: a write landing in between moves the
          // stat past this one, so the dev server sees the content as
          // outdated (see isValid in the dev server) rather than the reverse
          const fileStat = statSync(urlObject);
          const fileBuffer = readFileSync(urlObject);
          urlInfo.data.fileStat = {
            mtimeMs: fileStat.mtimeMs,
            size: fileStat.size,
          };
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

const createResolveUrlError = ({
  jsenvPluginsController,
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
          ...detailsFromPluginController(jsenvPluginsController),
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
    const notInstalledStatus = readNotInstalledStatus(reference);
    if (notInstalledStatus) {
      const { packageName, declaredVersion, declaredBy, isProjectDependency } =
        notInstalledStatus;
      return createFailedToResolveUrlError({
        "reason": isProjectDependency
          ? `"${packageName}" is declared in package.json but not installed`
          : `"${packageName}" is declared by "${declaredBy}" but not installed`,
        "declared version": declaredVersion,
        "suggestion": `run npm install, the page will reload once "${packageName}" is installed`,
      });
    }
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
    ...detailsFromInjectionsOnOwner(reference),
    ...detailsFromValueThrown(error),
  });
};

const createFetchUrlContentError = ({
  jsenvPluginsController,
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
          ...detailsFromPluginController(jsenvPluginsController),
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
        ...detailsFromInjectionsOnOwner(urlInfo.firstReference),
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
  jsenvPluginsController,
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
          ...detailsFromPluginController(jsenvPluginsController),
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
          ...detailsFromPluginController(jsenvPluginsController),
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
  jsenvPluginsController,
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
        ...detailsFromPluginController(jsenvPluginsController),
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

// a bare specifier is resolved against the dependencies of the package
// containing the file that imports it, which is the project one for a source
// file but an other one for a file inside node_modules
const readNotInstalledStatus = (reference) => {
  const { ownerUrlInfo } = reference;
  const { packageDirectory } = ownerUrlInfo.context;
  if (!packageDirectory) {
    return null;
  }
  const declaringDirectoryUrl =
    packageDirectory.find(ownerUrlInfo.url) || packageDirectory.url;
  const packageName = packageNameFromSpecifier(reference.specifier);
  const status = readDependencyStatus(
    packageDirectory,
    packageName,
    declaringDirectoryUrl,
  );
  if (!status || status.state !== "missing") {
    return null;
  }
  return {
    ...status,
    isProjectDependency: declaringDirectoryUrl === packageDirectory.url,
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

// Injections write urls in html attributes before references are analyzed, so an url
// that still cannot be resolved may be a placeholder no injection replaced. Rather than
// guessing what a placeholder looks like (the key is free-form), tell the file it comes
// from: injections are configured for it.
const detailsFromInjectionsOnOwner = (reference) => {
  if (!reference) {
    return {};
  }
  const ownerUrlInfo = reference.ownerUrlInfo;
  if (ownerUrlInfo.type !== "html") {
    // "jsenv-ignore" is an html attribute
    return {};
  }
  const { hasInjections } = ownerUrlInfo.context;
  if (!hasInjections || !hasInjections(ownerUrlInfo.url)) {
    return {};
  }
  const { node, attributeName } = reference.astInfo || {};
  if (!node || !attributeName) {
    return {};
  }
  return {
    suggestion: `injections are configured for this file; when "${reference.specifier}" is meant to be written by one of them, check the placeholder spelling, or add "jsenv-ignore" so jsenv leaves that url alone:
<${node.nodeName} jsenv-ignore ${attributeName}="${reference.specifier}" />`,
  };
};

const detailsFromPluginController = (jsenvPluginsController) => {
  const currentPlugin = jsenvPluginsController.getCurrentPlugin();
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
        const directoryRelativeUrl = urlToRelativeUrl(
          reference.url,
          // the root url info has no originalUrl; it owns the reference
          // created for an incoming request ("http_request")
          reference.ownerUrlInfo.originalUrl || reference.ownerUrlInfo.url,
        );
        reference.filenameHint = directoryRelativeUrl;
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

const injectionSymbol = Symbol.for("jsenv_injection");
const INJECTIONS = {
  /**
   * Inject `Object.assign(window, { [key]: value })` at the top of the file
   * (into a script for html, into the module itself for js) instead of
   * replacing a placeholder: the value is read at runtime as a global.
   */
  global: (value) => {
    return { [injectionSymbol]: "global", value };
  },
  /**
   * Replace the placeholder when the file contains it, stay silent when it does not
   * (without this a missing placeholder is reported as a warning).
   */
  optional: (value) => {
    if (value && value[injectionSymbol]) {
      // a global injection is not a placeholder, it can't be missing from the file
      return value;
    }
    return { [injectionSymbol]: "optional", value };
  },
};

const readInjectionValue = (injection) => {
  if (injection && injection[injectionSymbol]) {
    return injection.value;
  }
  return injection;
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
      if (!isOptional && !urlInfo.contentInjectionUsedKeySet.has(key)) {
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
        replacement: asReplacement(value, urlInfo.type),
      });
      index = content.indexOf(key, end);
    }
  }
  return magicSource.toContentAndSourcemap();
};

// In JS the placeholder stands for a value, so it must be substituted by a literal.
// Everywhere else (html attributes and text, css, ...) it stands for a piece of text
// and is substituted as-is, so it can be concatenated: href="__BACKEND_URL__/users/me"
const asReplacement = (value, type) => {
  if (type === "js_classic" || type === "js_module") {
    return JSON.stringify(value, null, "  ");
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, "  ");
};

const injectGlobals = (content, globals, urlInfo) => {
  if (urlInfo.type === "html") {
    return globalInjectorOnHtml(content, globals, urlInfo);
  }
  if (urlInfo.type === "js_classic" || urlInfo.type === "js_module") {
    return globalsInjectorOnJs(content, globals, urlInfo);
  }
  throw new Error(
    createDetailedMessage(`cannot inject globals into "${urlInfo.type}"`, {
      file: urlInfo.url,
      ...(urlInfo.isInline
        ? { "inline content of": urlInfo.inlineUrlSite.url }
        : {}),
    }),
  );
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
  const injectionsForUrlInfoMap = new WeakMap();
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
        const findInjectionsGetterForUrl = (url) => {
          const { injectionsGetter } = URL_META.applyAssociations({
            url: asUrlWithoutSearch(url),
            associations: resolvedAssociations,
          });
          return injectionsGetter;
        };
        // errors and the build read this to know an unresolved url may come from
        // an injection, and word what they report accordingly
        context.hasInjections = (url) => {
          return Boolean(findInjectionsGetterForUrl(url));
        };
        const findInjectionsGetter = (urlInfo) => {
          const injectionsGetter = findInjectionsGetterForUrl(urlInfo.url);
          if (injectionsGetter) {
            return { injectionsGetter, isInherited: false };
          }
          if (urlInfo.isInline) {
            // content inlined into a file (a <script> inside html) is authored in that
            // file, so injections configured for the file must reach it too
            const found = findInjectionsGetter(
              urlInfo.firstReference.ownerUrlInfo,
            );
            if (found) {
              return {
                injectionsGetter: found.injectionsGetter,
                isInherited: true,
              };
            }
          }
          return null;
        };
        getInjections = async (urlInfo) => {
          const found = findInjectionsGetter(urlInfo);
          if (!found) {
            return null;
          }
          const { injectionsGetter, isInherited } = found;
          if (typeof injectionsGetter !== "function") {
            throw new TypeError("injectionsGetter must be a function");
          }
          const injections = await injectionsGetter(urlInfo);
          if (!injections || !isInherited) {
            return injections;
          }
          return asInheritedInjections(injections);
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
      const injections = await getInjections(urlInfo);
      if (!injections) {
        return {
          contentInjections: defaultInjections,
        };
      }
      injectionsForUrlInfoMap.set(urlInfo, injections);
      return {
        contentInjections: { ...defaultInjections, ...injections },
      };
    },
    // The content still holds the placeholders when references are analyzed: they are
    // replaced at the very end, once the type of every inline content is known.
    // A specifier must not wait for that, it would resolve "__BACKEND_URL__/users/me"
    // as a file sitting next to the document. Only the placeholder is resolved here,
    // then the specifier goes to whoever resolves this kind of url (node esm, web, ...)
    resolveReference: (reference) => {
      const { ownerUrlInfo } = reference;
      const injections = injectionsForUrlInfoMap.get(ownerUrlInfo);
      if (!injections) {
        return null;
      }
      const { specifier, keySet } = injectIntoSpecifier(
        reference.specifier,
        injections,
      );
      if (keySet.size === 0) {
        return null;
      }
      reference.specifier = specifier;
      for (const key of keySet) {
        // rewriting the specifier takes the placeholder out of the content,
        // so the injection step must not expect to find it there
        ownerUrlInfo.contentInjectionUsedKeySet.add(key);
      }
      return null;
    },
  };
};

const injectIntoSpecifier = (specifier, injections) => {
  let specifierInjected = specifier;
  const keySet = new Set();
  for (const key of Object.keys(injections)) {
    if (!specifierInjected.includes(key)) {
      continue;
    }
    const injection = injections[key];
    if (!isPlaceholderInjection(injection)) {
      continue;
    }
    const value = readInjectionValue(injection);
    if (typeof value !== "string") {
      continue;
    }
    specifierInjected = specifierInjected.replaceAll(key, value);
    keySet.add(key);
  }
  return { specifier: specifierInjected, keySet };
};

// What a file inlines (a <script> or a <style> inside html) is authored in that file
// and inherits its injections, with two adjustments:
// - a global belongs to the file itself, injecting it into each inline content would
//   repeat it and reach types that cannot receive globals (css)
// - a placeholder configured for the file is expected in one of its inline contents,
//   not in each, so a missing one is not worth a warning
const asInheritedInjections = (injections) => {
  const inheritedInjections = {};
  for (const key of Object.keys(injections)) {
    const value = injections[key];
    if (isPlaceholderInjection(value)) {
      inheritedInjections[key] = INJECTIONS.optional(value);
    }
  }
  if (Object.keys(inheritedInjections).length === 0) {
    return null;
  }
  return inheritedInjections;
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
  const { traverse, parseSync, types } = babel;
  const replacementMap = new Map();
  const valueExpressionSet = new Set();

  return {
    name: "metadata-replace",

    pre: (state) => {
      // https://github.com/babel/babel/blob/d50e78d45b608f6e0f6cc33aeb22f5db5027b153/packages/babel-traverse/src/path/replacement.js#L93
      const parseExpression = (value) => {
        const expressionNode = parseSync(value, state.opts).program.body[0]
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
 * A build can also be dev-flavored (build({ entryPoints: { "./file.js": { dev: true } } })):
 * import.meta.dev is then replaced by true, so a package can publish a build
 * that keeps its dev-only code, exposed to consumers via the "development"
 * package export condition.
 *
 * TODO: ideally during dev we would keep import.meta.dev and ensure we set it to true rather than replacing it with true?
 */


const jsenvPluginImportMetaScenarios = ({ dev } = {}) => {
  return {
    name: "jsenv:import_meta_scenario",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: (urlInfo) => {
        // Do not scan node modules for import.meta.dev/import.meta.build
        // - node modules won't have this in their code
        // - ;or should use other an other technic as this one won't be available
        // They would be discarded by content.includes detection
        // but it's cheaper to detect by URL than to scan potentially large files
        if (urlInfo.url.includes("/node_modules/")) {
          return null;
        }
        if (
          !urlInfo.content.includes("import.meta.dev") &&
          !urlInfo.content.includes("import.meta.test") &&
          !urlInfo.content.includes("import.meta.build")
        ) {
          return null;
        }
        const importMetaScenarioNodes = { dev: [], build: [] };
        visitJsAst(urlInfo.contentAst, {
          MemberExpression: (node) => {
            const name = getImportMetaPropertyName(node);
            if (name === "dev" || name === "build") {
              importMetaScenarioNodes[name].push(node);
            }
          },
        });
        const devNodes = importMetaScenarioNodes.dev;
        const buildNodes = importMetaScenarioNodes.build;
        const replacements = [];
        const replace = (node, value) => {
          replacements.push({ node, value });
        };
        if (urlInfo.context.build) {
          // during build ensure replacement for tree-shaking
          // (or for keeping dev code when the build is dev-flavored)
          devNodes.forEach((node) => {
            replace(node, dev ? "true" : "undefined");
          });
          buildNodes.forEach((node) => {
            replace(node, "true");
          });
        } else {
          // during dev we can let "import.meta.build" untouched
          // it will be evaluated to undefined.
          // Moreover it can be surprising to see some "undefined"
          // when source file contains "import.meta.build"
          devNodes.forEach((node) => {
            replace(node, "true");
          });
        }
        const magicSource = createMagicSource(urlInfo.content);
        replacements.forEach(({ node, value }) => {
          magicSource.replace({
            start: node.start,
            end: node.end,
            replacement: value,
          });
        });
        return magicSource.toContentAndSourcemap();
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
    // Do not scan node modules for __DEV__/__BUILD__
    // - node modules won't have this in their code
    // - ;or should use other an other technic as this one won't be available
    // They would be discarded by content.includes detection
    // but it's cheaper to detect by URL than to scan potentially large files
    if (urlInfo.url.includes("/node_modules/")) {
      return null;
    }
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
 * "jsenv:js_reference_analysis" reads the css assigned here as an inline css and
 * sends it through the css pipeline: transpilation, url() resolution, minification,
 * comments. A "${}" standing where a css value stands is swapped for a placeholder
 * and put back afterwards; anywhere else it makes the template unreadable and the
 * css is shipped exactly as written, with everything the pipeline does lost.
 *
 */


const jsenvPluginImportMetaCss = () => {
  const importMetaCssDevClientFileUrl = import.meta
    .resolve("../client/import_meta_css/import_meta_css_dev.js");
  const importMetaCssBuildClientFileUrl = import.meta
    .resolve("../client/import_meta_css/import_meta_css_build.js");

  return {
    name: "jsenv:import_meta_css",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo) => {
        // Do not scan node modules for import.meta.css
        // - unlikely to be there
        // - we don't watch node modules (too expensive)
        // They would be discarded by content.includes detection
        // but it's cheaper to detect by URL than to scan potentially large files
        if (urlInfo.url.includes("/node_modules/")) {
          return null;
        }
        if (!urlInfo.content.includes("import.meta.css")) {
          return null;
        }
        const importMetaCssNode = visitJsAstUntil(urlInfo.contentAst, {
          MemberExpression: (node) => getImportMetaPropertyName(node) === "css",
        });
        if (!importMetaCssNode) {
          return null;
        }
        if (urlInfo.context.build) {
          if (hasModuleScopeAssignment(urlInfo.contentAst)) {
            urlInfo.contentSideEffects.push({
              has: true,
              reason: "import.meta.css assigned at module scope",
            });
          }
          const packageName = urlInfo.packageName;
          const packageDirectoryUrl =
            urlInfo.packageDirectoryUrl || urlInfo.context.rootDirectoryUrl;
          const relativePathInPackage = urlInfo.originalUrl.slice(
            packageDirectoryUrl.length - 1,
          );
          const relativeUrl = packageName
            ? `${packageName}${relativePathInPackage}`
            : relativePathInPackage;
          const { code } = await applyBabelPlugins({
            babelPlugins: [
              [babelPluginRewriteImportMetaCssAssignment, { relativeUrl }],
            ],
            input: urlInfo.content,
            inputIsJsModule: true,
            inputUrl: urlInfo.originalUrl,
            outputUrl: urlInfo.generatedUrl,
            // the map would be dropped: the content sent back carries none
            options: { sourceMaps: false },
          });
          if (code === urlInfo.content) {
            // all assignments were already in array form (pre-built file) — nothing to do
            return null;
          }
          return injectImportMetaCss(urlInfo, {
            content: code,
            importFrom: importMetaCssBuildClientFileUrl,
            importName: "installImportMetaCssBuild",
            importAs: "__installImportMetaCssBuild__",
          });
        }
        return injectImportMetaCss(urlInfo, {
          content: urlInfo.content,
          importFrom: importMetaCssDevClientFileUrl,
          importName: "installImportMetaCssDev",
          importAs: "__installImportMetaCssDev__",
          hot: true,
        });
      },
    },
  };
};

// A stylesheet assigned at module scope is adopted when the module runs: that
// assignment IS the module's side effect. It has to be told, because a
// package.json "sideEffects" list is authoritative once it exists — a module
// it does not name is dropped whole when it is imported for nothing else, and
// its css silently leaves the build.
const hasModuleScopeAssignment = (ast) => {
  for (const node of ast.body) {
    if (node.type !== "ExpressionStatement") {
      continue;
    }
    const { expression } = node;
    if (
      expression.type === "AssignmentExpression" &&
      expression.operator === "=" &&
      getImportMetaPropertyName(expression.left) === "css"
    ) {
      return true;
    }
  }
  return false;
};

const babelPluginRewriteImportMetaCssAssignment = (
  { types: t },
  { relativeUrl },
) => {
  return {
    name: "rewrite-import-meta-css-assignment",
    visitor: {
      AssignmentExpression(path) {
        const { left, right } = path.node;
        if (left.type !== "MemberExpression") {
          return;
        }
        const { object, property } = left;
        if (object.type !== "MetaProperty") {
          return;
        }
        if (object.meta.name !== "import" || object.property.name !== "meta") {
          return;
        }
        if (property.name !== "css") {
          return;
        }
        // already transformed (e.g. pre-built file): leave as-is
        if (right.type === "ArrayExpression") {
          return;
        }
        path.node.right = t.arrayExpression([
          right,
          t.stringLiteral(relativeUrl),
        ]);
      },
    },
  };
};

const injectImportMetaCss = (
  urlInfo,
  { content, importFrom, importName, importAs, hot },
) => {
  const importMetaCssClientFileReference = urlInfo.dependencies.inject({
    parentUrl: urlInfo.url,
    type: "js_import",
    expectedType: "js_module",
    specifier: importFrom,
  });
  let importVariableName;
  let importBeforeFrom;
  if (importAs && importAs !== importName) {
    importBeforeFrom = `{ ${importName} as ${importAs} }`;
    importVariableName = importAs;
  } else {
    importBeforeFrom = `{ ${importName} } }`;
    importVariableName = importName;
  }

  const prelude = hot
    ? `import ${importBeforeFrom} from ${importMetaCssClientFileReference.generatedSpecifier};

const remove = ${importVariableName}(import.meta);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    remove();
  });
}

`
    : `import ${importBeforeFrom} from ${importMetaCssClientFileReference.generatedSpecifier};

${importVariableName}(import.meta);

`;

  return {
    content: `${prelude.replace(/\n/g, "")}${content}`,
  };
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

const analyzeImportMetaHot = (ast) => {
  const importMetaHotNodes = [];
  let hotDecline = false;
  let hotAcceptSelf = false;
  let hotAcceptSpecifiers = [];
  visitJsAst(ast, {
    MemberExpression: (node) => {
      if (getImportMetaPropertyName(node) === "hot") {
        importMetaHotNodes.push(node);
      }
    },
    CallExpression: (node) => {
      const methodName = getImportMetaHotMethodName(node);
      if (methodName === "accept") {
        const args = node.arguments;
        if (args.length === 0) {
          hotAcceptSelf = true;
          return;
        }
        const [firstArg] = args;
        if (isStringLiteral(firstArg)) {
          hotAcceptSpecifiers = [firstArg.value];
          return;
        }
        if (firstArg.type === "ArrayExpression") {
          hotAcceptSpecifiers = firstArg.elements.map((element) => {
            if (!isStringLiteral(element)) {
              throw new Error(
                `all array elements must be strings in "import.meta.hot.accept(array)"`,
              );
            }
            return element.value;
          });
          return;
        }
        // accept first arg can be "anything" such as
        // `const cb = () => {}; import.meta.hot.accept(cb)`
        hotAcceptSelf = true;
        return;
      }
      if (methodName === "decline") {
        hotDecline = true;
      }
    },
  });
  return {
    importMetaHotNodes,
    hotDecline,
    hotAcceptSelf,
    hotAcceptSpecifiers,
  };
};

// "import.meta.hot.<method>(...)"
const getImportMetaHotMethodName = (callNode) => {
  const { callee } = callNode;
  if (callee.type !== "MemberExpression" || callee.computed) {
    return null;
  }
  if (getImportMetaPropertyName(callee.object) !== "hot") {
    return null;
  }
  return callee.property.name;
};

const isStringLiteral = (node) => {
  return node.type === "Literal" && typeof node.value === "string";
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
      js_module: (urlInfo) => {
        // Do not scan node modules for import.meta.hot
        // - unlikely to be there
        // - we don't watch node modules (too expensive)
        // They would be discarded by content.includes detection
        // but it's cheaper to detect by URL than to scan potentially large files
        if (urlInfo.url.includes("/node_modules/")) {
          return null;
        }
        if (!urlInfo.content.includes("import.meta.hot")) {
          return null;
        }
        const {
          importMetaHotNodes,
          hotDecline,
          hotAcceptSelf,
          hotAcceptSpecifiers,
        } = analyzeImportMetaHot(urlInfo.contentAst);
        urlInfo.data.hotDecline = hotDecline;
        urlInfo.data.hotAcceptSelf = hotAcceptSelf;
        urlInfo.data.hotAcceptDependencies = hotAcceptSpecifiers.map(
          (specifier) => resolveHotAcceptSpecifier(urlInfo, specifier),
        );
        if (importMetaHotNodes.length === 0) {
          return null;
        }
        if (urlInfo.context.build) {
          return removeImportMetaHots(urlInfo, importMetaHotNodes);
        }
        return injectImportMetaHot(urlInfo, importMetaHotClientFileUrl);
      },
    },
  };
};

// The specifier given to import.meta.hot.accept() is one the file imports,
// so its url is known from that import (autoreload compares urls). A
// specifier the file does not import accepts nothing: it is kept as a plain
// url, never resolved as a dependency (that could throw on a bare specifier).
const resolveHotAcceptSpecifier = (urlInfo, specifier) => {
  for (const referenceToOther of urlInfo.referenceToOthersSet) {
    if (
      referenceToOther.type === "js_import" &&
      referenceToOther.specifier === specifier
    ) {
      return referenceToOther.url;
    }
  }
  try {
    return new URL(specifier, urlInfo.url).href;
  } catch {
    return specifier;
  }
};

const removeImportMetaHots = (urlInfo, importMetaHotNodes) => {
  const magicSource = createMagicSource(urlInfo.content);
  importMetaHotNodes.forEach((node) => {
    magicSource.replace({
      start: node.start,
      end: node.end,
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
  reloadRequestEventEmitter,
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
        // something outside the url graph wants the page back from scratch,
        // typically a dependency that just got installed into node_modules
        reloadRequestEventEmitter.on(({ cause, reason }) => {
          serverEventInfo.sendServerEvent({
            cause,
            type: "full",
            typeReason: reason,
          });
        });
      },
    },
    serverRoutes: [
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
  reloadRequestEventEmitter,
}) => {
  return [
    jsenvPluginHotSearchParam(),
    jsenvPluginAutoreloadClient(),
    jsenvPluginAutoreloadServer({
      clientFileChangeEventEmitter,
      clientFileDereferencedEventEmitter,
      reloadRequestEventEmitter,
    }),
  ];
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

/*
 * Tells the browser the static import graph of a page's module scripts, as
 * `Link: <url>; rel=modulepreload` response headers, so it can fetch every
 * module as soon as the page's headers arrive, without waiting to discover
 * them level by level (each level costing a round trip and, the first time,
 * a cook).
 *
 * Only what the graph already knows is listed: a module never cooked has no
 * known imports. The header is computed at each response from the graph as it
 * is then: a page gets its full list from its second load on, the first load
 * keeps the plain waterfall.
 *
 * Headers rather than <link> elements written into the page: the page content
 * stays what it is (served from memory, revalidated by etag) and the list can
 * grow without cooking the page again. And not references either: a reference
 * from the html to every module would make the html a dependent of each of
 * them, and a hot update propagating up the importers would reach the html
 * (which declines) instead of stopping at the module accepting it.
 *
 * OFF BY DEFAULT, to be enabled once the dev server speaks http/2 or http/3.
 * Over http/1.1 it makes pages slower — measured on a 500 modules page: first
 * paint 32ms -> 868ms, load 626ms -> 985ms. Knowing the urls earlier gives the
 * browser no extra resource: what it has is 6 connections per origin, and
 * every request goes through them in the order it was learned.
 * - Without the header, requests come in execution order: the parser asks
 *   for the render-blocking supervisor script first and gets a connection at
 *   once; transfer and execution overlap, a module executing and discovering
 *   its imports while the others download. On localhost the server answers
 *   from memory in 0.1ms, so the 6 connections are busy from the start.
 * - With the header, hundreds of requests take the 6 connections before the
 *   parser asks for the supervisor script, which then waits for a free
 *   connection behind 1MB+ transfers (520ms measured, 2s with 20ms of RTT).
 *   Meanwhile nothing renders and nothing executes: transfer, then execution,
 *   serialized. http/1.1 cannot reprioritize a queued request, and a
 *   modulepreload has the same priority as a script.
 * - And there is nothing to hide: the discovery latency a preload removes is
 *   ~1ms per graph level on localhost; with a real RTT a wide graph (more
 *   than 6 modules pending at any time) keeps the 6 connections saturated
 *   anyway, and the load takes requests / 6 * RTT whatever the order.
 * It pays off for a deep and narrow graph (connections idle, waiting for a
 * response to learn the next level), and over http/2 or http/3: no
 * connection limit, and the browser prioritizes the blocking script.
 */


const jsenvPluginModulepreload = () => {
  return {
    name: "jsenv:modulepreload",
    appliesDuring: "dev",
    augmentResponse: ({ urlInfo }) => {
      if (urlInfo.type !== "html") {
        return null;
      }
      const hrefs = collectStaticImportHrefs(urlInfo);
      if (hrefs.length === 0) {
        return null;
      }
      return {
        headers: {
          link: hrefs.map((href) => `<${href}>; rel=modulepreload`).join(", "),
        },
      };
    },
  };
};

const collectStaticImportHrefs = (htmlUrlInfo) => {
  const hrefSet = new Set();
  const visitedSet = new Set();
  const addHref = (reference) => {
    const specifier = urlSpecifierEncoding.decode(reference);
    if (typeof specifier !== "string") {
      return;
    }
    // "?hot" belongs to the request that cooked the importer, the page loading
    // now imports the url without it
    hrefSet.add(injectQueryParamsIntoSpecifier(specifier, { hot: undefined }));
  };
  const visitJsModule = (jsModuleUrlInfo) => {
    if (visitedSet.has(jsModuleUrlInfo)) {
      return;
    }
    visitedSet.add(jsModuleUrlInfo);
    for (const reference of jsModuleUrlInfo.referenceToOthersSet) {
      if (
        reference.type !== "js_import" ||
        reference.isWeak ||
        reference.isImplicit ||
        !STATIC_IMPORT_SUBTYPES.includes(reference.subtype) ||
        !reference.url.startsWith("file:")
      ) {
        continue;
      }
      const importedUrlInfo = reference.urlInfo;
      // never cooked: its content, hence its own imports, are unknown
      if (importedUrlInfo.type !== "js_module") {
        continue;
      }
      addHref(reference);
      visitJsModule(importedUrlInfo);
    }
  };
  for (const reference of htmlUrlInfo.referenceToOthersSet) {
    if (
      reference.type !== "script" ||
      reference.expectedType !== "js_module" ||
      // the scripts jsenv adds to every page are few, small and in memory
      reference.injected ||
      reference.isWeak
    ) {
      continue;
    }
    const scriptUrlInfo = reference.urlInfo;
    if (scriptUrlInfo.type !== "js_module") {
      continue;
    }
    if (!reference.isInline && reference.url.startsWith("file:")) {
      addHref(reference);
    }
    visitJsModule(scriptUrlInfo);
  }
  return Array.from(hrefSet);
};

const STATIC_IMPORT_SUBTYPES = ["import_static", "export_named", "export_all"];

/*
 * Tells the browser about the dependencies declared in package.json that
 * node_modules does not match, so the page can say it is running with something
 * else than what the project asks for.
 *
 * The state is sent on page load (it is known before any client connects) and
 * again whenever it changes, so a page opened during an install is updated
 * without being reloaded.
 */


const clientFileUrl = import.meta.resolve("../js/dependency_status.js");

const jsenvPluginDependencyStatus = ({
  dependencyProblemEventEmitter,
  getDependencyProblems,
  getDependencyWatchInfo = () => ({}),
}) => {
  return {
    name: "jsenv:dependency_status",
    appliesDuring: "dev",
    serverEvents: {
      dependency_status: (serverEventInfo) => {
        dependencyProblemEventEmitter.on((problems) => {
          // the state is baked into the html by the injection below, so a page
          // served from the graph as it is would come back with the previous
          // state, which is exactly what a reload triggered by an install does
          for (const urlInfo of serverEventInfo.kitchen.graph.urlInfoMap.values()) {
            if (urlInfo.type === "html" && urlInfo.content !== undefined) {
              urlInfo.onModified();
            }
          }
          serverEventInfo.sendServerEvent({ problems });
        });
      },
    },
    transformUrlContent: {
      html: (htmlUrlInfo) => {
        const htmlAst = parseHtml({
          html: htmlUrlInfo.content,
          url: htmlUrlInfo.url,
        });
        const clientReference = htmlUrlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: clientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: clientReference.generatedSpecifier,
          initCall: {
            callee: "initDependencyStatus",
            params: {
              problems: getDependencyProblems(),
              watchInfo: getDependencyWatchInfo(),
            },
          },
          pluginName: "jsenv:dependency_status",
        });
        return {
          content: stringifyHtmlAst(htmlAst),
        };
      },
    },
  };
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

const jsenvPluginCustomElementsRedefine = () => {
  const customElementsRedefineClientFileUrl = import.meta
    .resolve("../client/custom_elements_redefine/custom_elements_redefine.js");

  return {
    name: "jsenv:custom_elements_redefine",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        const reference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: customElementsRedefineClientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: reference.generatedSpecifier,
          initCall: {
            callee: "allowCustomElementsRedefine",
          },
          pluginName: "jsenv:custom_elements_redefine",
        });
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified,
        };
      },
    },
  };
};

const jsenvPluginRibbon = ({
  rootDirectoryUrl,
  htmlInclude = "/**/*.html",
  text,
  color,
  textColor,
  href,
  target,
  position,
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
    appliesDuring: "*",
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
            params: withoutUndefinedValues({
              text:
                text === undefined
                  ? urlInfo.context.dev
                    ? "DEV"
                    : "BUILD"
                  : text,
              color,
              textColor,
              href,
              target,
              position,
            }),
          },
          pluginName: "jsenv:ribbon",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};

const withoutUndefinedValues = (object) => {
  const objectWithoutUndefinedValues = {};
  for (const key of Object.keys(object)) {
    if (object[key] !== undefined) {
      objectWithoutUndefinedValues[key] = object[key];
    }
  }
  return objectWithoutUndefinedValues;
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

const jsenvPluginAutoreloadOnServerRestart = () => {
  const autoreloadOnRestartClientFileUrl = import.meta
    .resolve("@jsenv/server/src/plugins/autoreload_on_server_restart/client/autoreload_on_server_restart.js");

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
      if (reference.type !== "js_import") {
        // Only consolidate ES imports of a workspace package into its single
        // bundle. Other reference kinds are their own entry points — most
        // importantly an HTML <script src> pointing at a package file (jsenv
        // injects its own client scripts that way: server events, the client
        // monitoring reporter, custom-elements-redefine…). Redirecting those to
        // the package main would run the wrong module, and for @jsenv/core the
        // main is node-only code (node:url) that cannot be served to a browser.
        return null;
      }
      const ownerPackageDirectoryUrl = packageDirectory.find(
        reference.ownerUrlInfo.url,
      );
      if (ownerPackageDirectoryUrl === packageDirectoryUrl) {
        // Import between two files of the same package: the owner was reached
        // outside the package bundle (an HTML <script src> entry point, see
        // above). Consolidation only applies to references crossing into a
        // package from outside; redirecting an intra-package relative import
        // to the package main would run the wrong module.
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
  // during build, a dev-flavored entry point sets dev: true
  // (during dev the kitchen context already says so, no need to pass it)
  dev,

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
  modulepreload = false,
  dependencyStatus,
  cacheControl,
  scenarioPlaceholders = true,
  ribbon = true,
  dropToOpen = true,
  customElementsRedefine = true,
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
    // before reference analysis: an url written by an injection must hold its
    // final value when references are analyzed
    jsenvPluginInjections(injections),
    jsenvPluginReferenceAnalysis(referenceAnalysis),
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
            dev,
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
    jsenvPluginImportMetaScenarios({ dev }),
    ...(scenarioPlaceholders ? [jsenvPluginGlobalScenarios()] : []),
    jsenvPluginNodeRuntime({ runtimeCompat }),

    jsenvPluginImportMetaHot(),
    ...(clientAutoreload && clientAutoreload.enabled
      ? [jsenvPluginAutoreload(clientAutoreload)]
      : []),
    ...(modulepreload ? [jsenvPluginModulepreload()] : []),
    ...(dependencyStatus
      ? [jsenvPluginDependencyStatus(dependencyStatus)]
      : []),
    ...(cacheControl ? [jsenvPluginCacheControl(cacheControl)] : []),
    ...(ribbon ? [jsenvPluginRibbon({ rootDirectoryUrl, ...ribbon })] : []),
    ...(dropToOpen ? [jsenvPluginDropToOpen()] : []),
    ...(customElementsRedefine ? [jsenvPluginCustomElementsRedefine()] : []),
    jsenvPluginCleanHTML(),
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
    serverRoutes: [
      {
        endpoint: "GET /.internal/events.websocket",
        description: `Jsenv dev server emit server events on this endpoint. When a file is saved the "reload" event is sent here.`,
        fetch: serverEvents.fetch,
        declarationSource: import.meta.url,
      },
    ],
  };
};

/**
 * https://docs.google.com/document/d/1rfKPnxsNuXhnF7AiQZhu9kIwdiMS5hnAI05HBwFuBSM/edit?tab=t.0#heading=h.7nki9mck5t64
 * https://chromium.googlesource.com/devtools/devtools-frontend/+/main/docs/ecosystem/automatic_workspace_folders.md
 * https://github.com/ChromeDevTools/vite-plugin-devtools-json
 */


const devServerPluginChromeDevToolsJson = ({ sourceDirectoryUrl }) => {
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
    name: "jsenv:chrome_devtools_json",
    routes: [
      {
        endpoint: "GET /.well-known/appspecific/com.chrome.devtools.json",
        declarationSource: import.meta.url,
        fetch: (request, { kitchen }) => {
          return Response.json({
            workspace: {
              root: urlToFileSystemPath(sourceDirectoryUrl),
              uuid: getOrCreateUUID(kitchen),
            },
          });
        },
      },
    ],
  };
};

const devServerPluginInjectServerResponseHeader = ({
  sourceDirectoryUrl,
}) => {
  return {
    name: "jsenv:jsenv_inject_server_response_header",
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
  };
};

const devServerPluginOmegaErrorHandler = () => {
  return [
    {
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
          // the dev server runs with canExposeSensitiveData: file paths are welcome
          return convertFileSystemErrorToResponseProperties(error, {
            canExposeSensitiveData: true,
          });
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
    },
    serverPluginErrorHandler({
      sendErrorDetails: true,
    }),
  ];
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
  const sourcemap = jsUrlInfo.context.sourcemapsEnabled
    ? composeTwoSourcemaps(jsUrlInfo.sourcemap, magicResult.sourcemap)
    : null;
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
    options: { sourceMaps: jsUrlInfo.context.sourcemapsEnabled },
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
        const astToPrepend = babel.parseSync(codeToPrepend);
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
  const { url, line, column, content } = urlSite;
  const trace = { url, line, column };
  // A file references many urls and an error on one of them is rare: the code
  // frame (and the message embedding it) is built the first time it is read,
  // not for every reference found.
  defineLazyProperty(trace, "codeFrame", () =>
    content ? generateContentFrame({ content, line, column }) : "",
  );
  defineLazyProperty(trace, "message", () => stringifyUrlSite(urlSite));
  return trace;
};

const defineLazyProperty = (object, property, compute) => {
  const setValue = (value) => {
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
      const value = compute();
      setValue(value);
      return value;
    },
    set: setValue,
  });
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
    // placeholders already consumed somewhere else than the content (in a specifier),
    // so that not finding them in the content is not worth a warning
    contentInjectionUsedKeySet: new Set(),

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
          continue;
        }
        // A reference with a versioning effect writes this url's VERSION into
        // its owner's cooked content (the ?v= param, read from package.json):
        // this url modified means that content now embeds a stale version, so
        // the owner is as modified as an owner of inlined content. Without
        // this, the owner's cooked content survives the modification and a
        // validity check that "heals" this url (see isValid re-reading files
        // from disk) leaves the graph claiming the owner is fresh.
        if (referenceFromOther.hasVersioningEffect) {
          considerModified(referenceFromOther.ownerUrlInfo);
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
    if (sources && sources.length > 0) {
      sourcemap.sources = sources.map(
        (source) => new URL(source, urlInfo.originalUrl).href,
      );
      if (!wantSourcesContent) {
        sourcemap.sourcesContent = undefined;
      }
      return sourcemap;
    }
    // No source info at all (e.g. an empty sourcemap): only then fall back
    // to describing this url as its own source. A single source is real
    // information (it can point at a different file entirely, e.g. a
    // bundled chunk whose only literal content comes from another module)
    // and must not be discarded in favor of this assumption.
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
    // "sourcemap" is read last, and only when it will be used: a plugin can
    // hand it back as a getter that generates the map on first read, so that
    // nothing is generated for a kitchen that throws sourcemaps away
    const sourcemap =
      mayHaveSourcemap(urlInfo) && shouldHandleSourcemap(urlInfo)
        ? transformations.sourcemap
        : null;
    if (sourcemap) {
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

  // Written synchronously on purpose, and measured: async is the tempting
  // choice, but here it loses. A cold load cooks hundreds of files; their
  // synchronous writes block the event loop ~160ms in total, while
  // asynchronous writes queue in the threadpool behind tens of MB of content
  // and sourcemaps, and a response that waits for its own write then waits
  // ~36ms on average (18s summed over 500 responses). Not waiting is not an
  // option either: the last write lands after the test that cooked it has
  // ended, and the side-effect snapshots lose it.
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
      // a plugin producing a sourcemap can skip the work when it would be
      // thrown away (see shouldHandleSourcemap in url_info_transformations.js)
      sourcemapsEnabled:
        sourcemaps === "inline" ||
        sourcemaps === "file" ||
        sourcemaps === "programmatic",
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
    jsenvPluginsController: null,
  };
  const kitchenContext = kitchen.context;
  kitchenContext.kitchen = kitchen;

  let jsenvPluginsController;
  kitchen.setJsenvPluginsController = (value) => {
    jsenvPluginsController = kitchen.jsenvPluginsController = value;
  };

  const graph = createUrlGraph({
    name,
    rootDirectoryUrl,
    kitchen,
  });
  graph.urlInfoCreatedEventEmitter.on((urlInfoCreated) => {
    jsenvPluginsController.callHooks(
      "urlInfoCreated",
      urlInfoCreated,
      () => {},
    );
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
        const resolvedUrl = jsenvPluginsController.callHooksUntil(
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
            jsenvPluginsController.getLastPluginUsed().name
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
        jsenvPluginsController.callHooks(
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
        jsenvPluginsController,
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
      jsenvPluginsController.callHooks(
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
      const returnValue = jsenvPluginsController.callHooksUntil(
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
        await jsenvPluginsController.callAsyncHooksUntil(
          "fetchUrlContent",
          urlInfo,
        );
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
        jsenvPluginsController,
        urlInfo,
        error,
      });
    }
  };
  kitchenContext.fetchUrlContent = fetchUrlContent;

  const transformUrlContent = async (urlInfo) => {
    try {
      await jsenvPluginsController.callAsyncHooks(
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
        jsenvPluginsController,
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
      const finalizeReturnValue =
        await jsenvPluginsController.callAsyncHooksUntil(
          "finalizeUrlContent",
          urlInfo,
        );
      urlInfoTransformer.endTransformations(urlInfo, finalizeReturnValue);
    } catch (error) {
      throw createFinalizeUrlContentError({
        jsenvPluginsController,
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
          // Each phase timed into urlInfo.timing: the dev server turns it into
          // a server-timing response header, so devtools show where the time
          // to cook a file goes (fetch vs transform vs finalize).
          const timePhase = async (name, phase) => {
            const start = performance.now();
            await phase();
            urlInfo.timing[name] = performance.now() - start;
          };

          // "fetchUrlContent" hook
          await timePhase("fetch", () => urlInfo.fetchContent());

          // "transform" hook
          await timePhase("transform", () => urlInfo.transformContent());

          // "finalize" hook
          await timePhase("finalize", () => urlInfo.finalizeContent());
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
    jsenvPluginsController.callHooks("cooked", urlInfo, (cookedReturnValue) => {
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

// What the newest browser supports, and nothing less: the source untouched.
// A version no browser has, so that every feature known to runtime-compat
// counts as supported.
const UNKNOWN_CLIENT_RUNTIME_COMPAT = { chrome: "9999.0.0" };

const devServerPluginServeSourceFiles = ({
  packageDirectory,
  sourceDirectoryUrl,
  sourceMainFilePath,
  ignore,
  sourceFilesConfig,
  clientAutoreload,
  logLevel,

  runtimeCompat,
  onKitchenCreated,

  supervisor,
  sourcemaps,
  sourcemapsSourcesContent,
  outDirectoryUrl,

  serverStopAbortSignal,
  serverStopCallbackSet,
  devServerJsenvPluginStore,
  kitchenCache,
}) => {
  const { clientFileChangeEventEmitter, clientFileDereferencedEventEmitter } =
    clientAutoreload;

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

  const getOrCreateKitchen = async (request) => {
    const { runtimeName, runtimeVersion } = getRuntimeFromRequest(request);
    const runtimeId = `${runtimeName}@${runtimeVersion}`;
    const existing = kitchenCache.get(runtimeId);
    if (existing) {
      return existing;
    }
    let kitchen;
    // per url info, the file stat under which its content was last compared
    // with the file on disk and found identical (see isValid)
    const fileStatValidatedMap = new WeakMap();
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
    // A client we cannot identify (curl, fetch, a healthcheck, a proxy dropping
    // the user agent, the WebKit inspector re-requesting a page's resources
    // under its own agent) is served the source as it is written. Taking the
    // build targets instead would hand it the js module fallback and a heavy
    // transpilation — and, when the same page mixes identified and
    // unidentified requests, two incompatible versions of one module. An
    // actual ancient browser hiding its identity fails loudly instead, which
    // is the right failure for dev.
    const clientRuntimeCompat =
      runtimeName === "unknown"
        ? UNKNOWN_CLIENT_RUNTIME_COMPAT
        : { [runtimeName]: runtimeVersion };

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
          // The content held in memory is the file as it was read; a request
          // must never win a stale answer, whatever the watcher's latency,
          // and the ?v= a package.json decides even ends up in the browser's
          // immutable cache. So the file is checked on disk at every
          // validation — cheaply: a stat, compared with the one taken when
          // the content was read (or last found identical). Only a file
          // whose stat moved is read and hashed again.
          // Inline content (a <script> inside an html) has no file of its
          // own: it is as fresh as the html holding it, checked by the caller.
          if (!urlInfo.isInline) {
            let fileStat;
            try {
              fileStat = statSync(new URL(urlInfo.url), {
                throwIfNoEntry: false,
              });
            } catch {
              return false;
            }
            if (!fileStat) {
              urlInfo.onModified();
              return false;
            }
            const fileStatKnown =
              fileStatValidatedMap.get(urlInfo) || urlInfo.data.fileStat;
            const fileUnchanged =
              fileStatKnown &&
              fileStatKnown.mtimeMs === fileStat.mtimeMs &&
              fileStatKnown.size === fileStat.size;
            if (!fileUnchanged) {
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
                fileStatValidatedMap.delete(urlInfo);
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
              fileStatValidatedMap.set(urlInfo, {
                mtimeMs: fileStat.mtimeMs,
                size: fileStat.size,
              });
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
    const devServerJsenvPluginController = await createJsenvPluginsController(
      devServerJsenvPluginStore,
      kitchen,
    );
    kitchen.setJsenvPluginsController(devServerJsenvPluginController);

    serverStopCallbackSet.add(() => {
      devServerJsenvPluginController.callHooks("destroy", kitchen.context);
    });
    kitchenCache.set(runtimeId, kitchen);
    onKitchenCreated(kitchen);
    return kitchen;
  };

  const devServerPluginRoutes = {
    name: "jsenv:dev_server_routes",
    augmentRouteFetchSecondArg: async (request) => {
      const kitchen = await getOrCreateKitchen(request);
      return { kitchen };
    },
    routes: [
      ...devServerJsenvPluginStore.allServerRoutes,
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
              requestResource === "/" ? mainFilePath : requestResource.slice(1),
              rootDirectoryUrl,
            );
            requestedUrlObject.searchParams.delete("hot");
            // normalizeUrl, because searchParams.delete re-serializes the whole
            // query and turns a valueless param ("?enabled") into "?enabled=".
            // Every url in the graph is normalized the other way (kitchen.js
            // strips those "="), and requestedUrl is compared to graph urls as
            // a string: an inline urlInfo decides "is this request for me?"
            // that way (jsenv:inline_content_fetcher) and re-cooks its own
            // ALREADY COOKED content when the comparison wrongly fails.
            requestedUrl = normalizeUrl(requestedUrlObject.href);
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
          if (!reference) {
            // Inline content ("page.html@L10C7-L14C16.js") has no file of its
            // own: it is served from the reference its parent creates when it
            // is cooked. Without a usable referer the parent is not known —
            // devtools re-fetching a resource on its own, a second kitchen for
            // the same page (the WebKit inspector sends its own user agent) —
            // so it is derived from the url and cooked first.
            const inlineParentUrl = getInlineContentParentUrl(requestedUrl);
            if (inlineParentUrl) {
              const inlineParentUrlInfo =
                kitchen.graph.getUrlInfo(inlineParentUrl);
              // A parent cooked before the file changed still holds the
              // references it had then; the inline content is as fresh as its
              // parent, so the parent is cooked again before being asked.
              if (
                !inlineParentUrlInfo ||
                inlineParentUrlInfo.content === undefined ||
                !inlineParentUrlInfo.contentFinalized ||
                !inlineParentUrlInfo.isValid()
              ) {
                const rootUrlInfo = kitchen.graph.rootUrlInfo;
                const inlineParentWebUrl = WEB_URL_CONVERTER.asWebUrl(
                  inlineParentUrl,
                  {
                    origin: request.origin,
                    rootDirectoryUrl: sourceDirectoryUrl,
                  },
                );
                const parentReference =
                  rootUrlInfo.dependencies.createResolveAndFinalize({
                    trace: { message: parentUrl },
                    type: "http_request",
                    specifier: inlineParentWebUrl.slice(request.origin.length),
                  });
                await parentReference.urlInfo.cook({
                  request,
                  reference: parentReference,
                });
              }
              reference = kitchen.graph.inferReference(
                request.resource,
                inlineParentUrl,
              );
              if (!reference) {
                // The parent does not hold that inline content: the script was
                // edited out of the html. What the graph kept under this url is
                // what the parent used to say, it must not be served.
                return {
                  url: requestedUrl,
                  status: 404,
                  statusText: "no inline content at this position",
                };
              }
            }
          }
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
          const inlineParentUrlInfo = urlInfo.findParentIfInline();
          const urlInfoTargetedByCache = inlineParentUrlInfo || urlInfo;
          // The content held in memory is the response when it is finalized
          // and still valid. Content can be defined while a cook is still in
          // flight (a file watcher invalidation re-cooking in the background,
          // for instance): at that point it holds the raw fetched content,
          // transformations not applied yet. Serving that would send an html
          // without any of the injected scripts. An inline url info (a
          // <script> inside an html) is cooked again whenever the html
          // containing it is cooked: its content is as fresh as the html's,
          // so both must be valid.
          const hasFreshContent = (urlInfo) =>
            urlInfo.content !== undefined &&
            urlInfo.contentFinalized &&
            urlInfo.isValid();
          const memoryContentIsFresh = () =>
            inlineParentUrlInfo
              ? hasFreshContent(urlInfo) && hasFreshContent(inlineParentUrlInfo)
              : hasFreshContent(urlInfo);
          // a 304 goes through the hooks too: its headers stand for the
          // cached response's, they must say the same
          const augmentResponse = (response) => {
            const augmentResponseInfo = {
              ...kitchen.context,
              reference,
              urlInfo,
            };
            kitchen.jsenvPluginsController.callHooks(
              "augmentResponse",
              augmentResponseInfo,
              (returnValue) => {
                response = composeTwoResponses(response, returnValue);
              },
            );
            return response;
          };
          const respondWithNotModified = () => {
            const headers = {
              "cache-control": `private,max-age=0,must-revalidate`,
            };
            Object.keys(urlInfo.headers).forEach((key) => {
              if (key !== "content-length") {
                headers[key] = urlInfo.headers[key];
              }
            });
            return augmentResponse({
              status: 304,
              headers,
            });
          };

          try {
            if (!urlInfo.error && ifNoneMatch) {
              const [clientOriginalContentEtag, clientContentEtag] =
                ifNoneMatch.split("_");
              if (
                urlInfoTargetedByCache.originalContentEtag ===
                  clientOriginalContentEtag &&
                urlInfo.contentEtag === clientContentEtag &&
                memoryContentIsFresh()
              ) {
                return respondWithNotModified();
              }
            }
            // Cooking is not memoized in dev (see cookGuard in kitchen.js): a
            // request that reaches cook() re-fetches and re-transforms the file
            // even when nothing changed. The 304 path above already avoids that
            // for a browser that revalidates — but a browser with its cache
            // disabled (devtools open, the common way to reload during dev)
            // sends no if-none-match and would re-cook the entire graph on
            // every reload, turning a warm reload into seconds of transform
            // work. Same validity check as the 304 path, same trust: when the
            // graph's in-memory content is still valid, it IS the response —
            // only the status differs (200 with content, since there is no
            // client etag to match).
            const servableFromMemory =
              !urlInfo.error &&
              !urlInfo.response &&
              !cacheIsDisabledInResponseHeader(urlInfo) &&
              !cacheIsDisabledInResponseHeader(urlInfoTargetedByCache) &&
              // a "?hot" request exists to bypass every cache, this one
              // included: it must be cooked, because cooking is what rewrites
              // its references so "?hot" cascades to the modified files below
              // (see jsenv_plugin_hot_search_param) — the memory content was
              // cooked before the change and its references carry nothing.
              // The urlInfo itself often IS valid here (hot reload of a
              // dependency: the file re-requested did not change, one below
              // it did), so isValid() alone cannot catch this.
              !request.searchParams.has("hot") &&
              // ...and the mirror guard: content cooked UNDER a "?hot" request
              // carries "?hot" in its rewritten references, and is correct for
              // that request only. Served from memory to a normal request (a
              // fresh tab), the browser would then load "file.js" from one
              // importer and "file.js?hot=..." from another — the same module
              // evaluated twice, which breaks anything module-level (e.g. a
              // signal registry throwing on duplicate ids). Re-cooking under
              // the normal request rewrites the references clean.
              !urlInfo.contentCookedForHotRequest &&
              memoryContentIsFresh();
            if (!servableFromMemory) {
              await urlInfo.cook({ request, reference });
              urlInfo.contentCookedForHotRequest =
                request.searchParams.has("hot");
            }
            let { response } = urlInfo;
            if (response) {
              return response;
            }
            // the original content of an inline url info is the one of the file
            // containing it, but its cooked content is its own: it can change while
            // the containing file stays identical (an import resolving to a new
            // version of a package for instance)
            const eTag = `${urlInfoTargetedByCache.originalContentEtag}_${urlInfo.contentEtag}`;
            if (
              !urlInfo.error &&
              ifNoneMatch === eTag &&
              inlineParentUrlInfo &&
              !cacheIsDisabledInResponseHeader(urlInfoTargetedByCache)
            ) {
              return respondWithNotModified();
            }
            response = {
              url: reference.url,
              // a plugin can cook a complete response body for an url that is
              // not a 200: the directory listing does this to answer a request
              // for a file that does not exist with the explorer page
              status: urlInfo.status,
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
                      eTag,
                    }),
                ...urlInfo.headers,
                "content-type": urlInfo.contentType,
                "content-length": urlInfo.contentLength,
              },
              body: urlInfo.content,
              // Where the time went, readable in devtools (Network > Timing):
              // the server merges this into the server-timing header. Served
              // from memory: a marker saying so, since nothing was cooked for
              // this request. Cooked: what the kitchen measured (each plugin
              // hook, and the fetch/transform/finalize roll-ups).
              timing: servableFromMemory
                ? { "served from memory cache": null }
                : urlInfo.timing,
            };
            return augmentResponse(response);
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
              return fetchDirectory(reference.url, {
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
            // MODULE_NOT_FOUND: a specifier could not be resolved to a file,
            // so something is missing on the filesystem; 500 is for the errors
            // the server does not see coming
            if (code === "NOT_FOUND" || code === "MODULE_NOT_FOUND") {
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
          } finally {
            // What the request put on the url info context is for this
            // request only: a cook happening later for another reason (the
            // html holding an inline script is cooked again) must not see a
            // stale "requestedUrl" and take the inline script for a direct
            // request, which would make it pick the content of a previous
            // reference (see jsenv:inline_content_fetcher).
            forgetRequestFromContext(urlInfo.context);
          }
        },
      },
    ],
  };

  return [devServerPluginRoutes, ...devServerJsenvPluginStore.allServerPlugins];
};

const forgetRequestFromContext = (context) => {
  // own properties only: what is inherited from the owner context stays
  for (const key of ["request", "requestedUrl", "reference"]) {
    if (Object.hasOwn(context, key)) {
      delete context[key];
    }
  }
};

const cacheIsDisabledInResponseHeader = (urlInfo) => {
  return (
    urlInfo.headers["cache-control"] === "no-store" ||
    urlInfo.headers["cache-control"] === "no-cache"
  );
};

// "dir/page.html@L10C7-L14C16.js" -> "dir/page.html" (search kept: it is the
// parent's). Null for anything else — the inline url grammar is the one
// generateUrlForInlineContent writes (@jsenv/ast).
const getInlineContentParentUrl = (url) => {
  const urlObject = new URL(url);
  const match = /^(.+)@[^@/]*?L\d+C\d+(?:-L\d+C\d+)?\.[a-z0-9]+$/.exec(
    urlObject.pathname,
  );
  if (!match) {
    return null;
  }
  urlObject.pathname = match[1];
  return urlObject.href;
};

const EXECUTED_BY_TEST_PLAN = process.argv.includes("--jsenv-test");

/**
 * Starts the jsenv development server: serves files from a source directory,
 * transforming (cooking) them on the fly through a plugin pipeline, with live
 * reload. Built on top of `@jsenv/server`.
 *
 * See the "dev-server" skill (.agents/skills/dev-server) for the plugin system,
 * server events, and how internal pages get script injection.
 *
 * @param {Object} [params={}]
 * @param {string|URL} params.sourceDirectoryUrl - Root directory to serve (required; must exist).
 * @param {string} [params.sourceMainFilePath="./index.html"] - File served for "/".
 * @param {number} [params.port=3456] - Port to listen on (0 = a free port).
 * @param {string} [params.hostname] - Hostname to bind to.
 * @param {boolean} [params.acceptAnyIp=false] - Also accept connections on the machine's IPs (so other devices on the network — a phone — can reach the server). Off by default: exposing the dev server beyond localhost is an explicit choice, not something a dev tool decides.
 * @param {boolean|object} [params.https=false] - HTTPS as `{ certificate, privateKey }`.
 * @param {boolean} [params.http2=false] - HTTP/2 (requires https).
 * @param {Array} [params.plugins=[]] - jsenv plugins (transformUrlContent, serverRoutes, serverEvents, effect, …).
 * @param {Array} [params.serverPlugins=[]] - `@jsenv/server`-level plugins.
 * @param {boolean|object} [params.clientAutoreload=true] - Live reload; also gates the server-events channel.
 * @param {boolean|object} [params.serverTiming={ minDuration: 0.5 }] - server-timing response headers; `minDuration` (ms) drops entries that took less (0 when run by the test plan, so tests see every entry).
 * @param {boolean|object} [params.ribbon=true] - The "ribbon" overlay marking the page as non-production. As an object: `text` (defaults to `"DEV"`), `color` (background, defaults to `"orange"`), `textColor` (defaults to dark or light depending on `color`), `href` (turns the ribbon into a link; only then does it capture clicks), `target` (defaults to `"_blank"`), `position` (`"top-right"` (default), `"top-left"`, `"bottom-right"`, `"bottom-left"` draw a diagonal corner ribbon; `"top"`, `"bottom"` draw a full width band), `htmlInclude` (defaults to `"/**\/*.html"`).
 * @param {boolean} [params.supervisor=true] - Script supervisor (better error reporting).
 * @param {boolean} [params.modulepreload=false] - Send `Link: <url>; rel=modulepreload` response headers listing the static import graph of a page (as far as the graph knows it). Off by default, to enable once the server runs on http/2 or http/3: over http/1.1 the preloads take the 6 connections per origin ahead of the render-blocking scripts, and pages get slower (the why, with measures, in jsenv_plugin_modulepreload.js).
 * @param {boolean|object} [params.directoryListing=true] - Directory listing pages.
 * @param {object} [params.injections] - Values to inject into files, as `{ urlPattern: getInjections }`. Keys are url patterns relative to sourceDirectoryUrl (`"./index.html"`, `"**\/*.js"`), values are functions receiving `urlInfo` and returning (or resolving to) an object of placeholders to replace, named `__LIKE_THIS__` by convention. In JS the value is injected as a JS literal (a string brings its own quotes), everywhere else as-is so it can be concatenated: `href="__BACKEND_URL__/users/me"`. An html url pattern also covers what is inlined in that html, so `<script>window.backendUrl = __BACKEND_URL__;</script>` shares the value with every js file of the page. See `INJECTIONS.optional` and `INJECTIONS.global`.
 * @param {object} [params.runtimeCompat] - Target runtimes; warns when dev code wouldn't survive the build.
 * @param {string} [params.sourcemaps="inline"] - Sourcemap mode.
 * @param {AbortSignal} [params.signal] - Abort to stop the server.
 * @param {boolean} [params.handleSIGINT=true] - Stop on SIGINT.
 * @param {boolean} [params.keepProcessAlive=true] - Keep the process alive while running.
 *
 * @returns {Promise<{origin: string, sourceDirectoryUrl: URL, stop: () => Promise<void>, kitchenCache: object}>}
 * @throws {TypeError} On unknown params.
 *
 * @example
 * const server = await startDevServer({
 *   sourceDirectoryUrl: new URL("./src/", import.meta.url),
 * });
 * console.log(`Server started at ${server.origin}`);
 */
const startDevServer = async ({
  sourceDirectoryUrl,
  sourceMainFilePath = "./index.html",
  ignore,
  port = 3456,
  hostname,
  acceptAnyIp = false,
  https,
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  logLevel = EXECUTED_BY_TEST_PLAN ? "warn" : "info",
  serverLogLevel = "warn",
  serverRouterLogLevel = "warn",
  serverPlugins = [],

  signal = new AbortController().signal,
  handleSIGINT = true,
  keepProcessAlive = true,
  onStop = () => {},

  sourceFilesConfig = {},
  clientAutoreload = true,
  clientAutoreloadOnServerRestart = true,
  modulepreload = false,
  // server-timing response headers: devtools show how the time to answer is
  // spent (cook measures come from the kitchen, see urlInfo.timing). Entries
  // under minDuration are dropped so a human reads the measures that matter;
  // a test wants them all, hence 0 there.
  serverTiming = { minDuration: EXECUTED_BY_TEST_PLAN ? 0 : 0.5 },

  // The runtimeCompat the build will use: the dev server warns when code works
  // in dev but would not survive that build, and transpiles what those runtimes
  // lack. Left out, it is inferred exactly as build() infers it, so the two
  // never disagree on what they target.
  runtimeCompat,
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
  customElementsRedefine = true,
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
    if (runtimeCompat === undefined) {
      runtimeCompat =
        (await inferRuntimeCompatFromClosestPackage(sourceDirectoryUrl, {
          runtimeType: "browser",
        })) || browserDefaultRuntimeCompat;
    }
    if (clientAutoreload === true) {
      clientAutoreload = {};
    }
    if (clientAutoreload === false) {
      clientAutoreload = { enabled: false };
    }
  }

  const logger = createLogger({ logLevel });
  const startDevServerTask = createTaskLog(
    `start dev server for ${humanizeSourceDirectory(sourceDirectoryUrl)}`,
    {
      disabled: !logger.levels.info,
    },
  );

  const serverStopCallbackSet = new Set();
  const serverStopAbortController = new AbortController();
  serverStopCallbackSet.add(() => {
    serverStopAbortController.abort();
  });
  const serverStopAbortSignal = serverStopAbortController.signal;

  const kitchenCache = new Map();
  const packageDirectory = createPackageDirectory({ sourceDirectoryUrl });
  const clientFileChangeEventEmitter = createEventEmitter();
  const clientFileDereferencedEventEmitter = createEventEmitter();
  const reloadRequestEventEmitter = createEventEmitter();
  clientAutoreload = {
    enabled: true,
    clientServerEventsConfig: {},
    clientFileChangeEventEmitter,
    clientFileDereferencedEventEmitter,
    reloadRequestEventEmitter,
    ...clientAutoreload,
  };
  const dependencyProblemEventEmitter = createEventEmitter();
  const dependencyWatcher = watchDependencies(packageDirectory, {
    onChange: (problems) => {
      dependencyProblemEventEmitter.emit(problems);
    },
    onProblem: ({
      packageName,
      declaredVersion,
      installedVersion,
      declaredIn,
      state,
      severity,
    }) => {
      const message =
        state === "missing"
          ? `"${packageName}@${declaredVersion}" is declared in package.json but not installed, run npm install`
          : `"${packageName}" is installed in ${installedVersion} but package.json declares ${declaredVersion} in ${declaredIn}, run npm install`;
      if (severity === "warning") {
        logger.warn(message);
      } else {
        logger.info(message);
      }
    },
    onInstalled: ({ packageName, declaredVersion, severity }) => {
      logger.info(`"${packageName}@${declaredVersion}" is now installed`);
      if (severity !== "warning") {
        return;
      }
      reloadRequestEventEmitter.emit({
        cause: `${packageName}@${declaredVersion} installed`,
        reason: `a dependency became available in node_modules`,
      });
    },
  });
  serverStopCallbackSet.add(dependencyWatcher.stop);

  const devServerJsenvPluginStore = await createJsenvPluginStore([
    jsenvPluginServerEvents({ clientAutoreload }),
    // The client-monitoring dashboard is a dev-time convenience; a test-plan run
    // doesn't use it and shouldn't pay for the reporter being injected into
    // every page.
    ...(EXECUTED_BY_TEST_PLAN
      ? []
      : [
          jsenvPluginClientMonitoring(),
          // cmd+K on any served page to jump to another one.
          jsenvPluginPageSwitcher(),
        ]),
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
      modulepreload,
      dependencyStatus: {
        dependencyProblemEventEmitter,
        getDependencyProblems: dependencyWatcher.getProblems,
        getDependencyWatchInfo: dependencyWatcher.getWatchInfo,
      },
      cacheControl,
      ribbon,
      dropToOpen,
      customElementsRedefine,
    }),
  ]);

  const finalServerPlugins = [];
  finalServerPlugins.push(
    // "header" service
    devServerPluginInjectServerResponseHeader({ sourceDirectoryUrl }),
    // cors service
    serverPluginCORS({
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
    // chrome devtools
    devServerPluginChromeDevToolsJson({ sourceDirectoryUrl }),
    ...serverPlugins,
    devServerPluginServeSourceFiles({
      packageDirectory,
      sourceDirectoryUrl,
      sourceMainFilePath,
      ignore,
      sourceFilesConfig,
      clientAutoreload,

      logLevel,
      runtimeCompat,
      onKitchenCreated,

      supervisor,
      sourcemaps,
      sourcemapsSourcesContent,
      outDirectoryUrl,

      serverStopAbortSignal,
      serverStopCallbackSet,
      devServerJsenvPluginStore,
      kitchenCache,
    }),
    // jsenv error handler service
    devServerPluginOmegaErrorHandler(),
  );

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
    serverTiming,
    plugins: finalServerPlugins,
    // will allow to open file, provide more context on each route
    canExposeSensitiveData: true,
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

// "./src/" when inside the current working directory, the full path otherwise
const humanizeSourceDirectory = (sourceDirectoryUrl) => {
  const cwdUrl = pathToFileURL(`${process.cwd()}/`).href;
  if (urlIsOrIsInsideOf(sourceDirectoryUrl, cwdUrl)) {
    return `./${urlToRelativeUrl(sourceDirectoryUrl, cwdUrl)}`;
  }
  return urlToFileSystemPath(sourceDirectoryUrl);
};

export { startDevServer };
