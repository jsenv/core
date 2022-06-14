'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var node_module = require('module');
var url = require('url');
var node_fs = require('fs');
require('crypto');
require('fs');
require('path');
var node_util = require('util');
require('path');
var node_url = require('url');

const ensureUrlTrailingSlash = (url) => {
  return url.endsWith("/") ? url : `${url}/`
};

const isFileSystemPath = (value) => {
  if (typeof value !== "string") {
    throw new TypeError(
      `isFileSystemPath first arg must be a string, got ${value}`,
    )
  }

  if (value[0] === "/") {
    return true
  }

  return startsWithWindowsDriveLetter(value)
};

const startsWithWindowsDriveLetter = (string) => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false

  const secondChar = string[1];
  if (secondChar !== ":") return false

  return true
};

const fileSystemPathToUrl = (value) => {
  if (!isFileSystemPath(value)) {
    throw new Error(`received an invalid value for fileSystemPath: ${value}`)
  }
  return String(url.pathToFileURL(value))
};

const assertAndNormalizeDirectoryUrl = (value) => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      urlString = fileSystemPathToUrl(value);
    } else {
      try {
        urlString = String(new URL(value));
      } catch (e) {
        throw new TypeError(
          `directoryUrl must be a valid url, received ${value}`,
        )
      }
    }
  } else {
    throw new TypeError(
      `directoryUrl must be a string or an url, received ${value}`,
    )
  }

  if (!urlString.startsWith("file://")) {
    throw new Error(`directoryUrl must starts with file://, received ${value}`)
  }

  return ensureUrlTrailingSlash(urlString)
};

const assertAndNormalizeFileUrl = (value, baseUrl) => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      urlString = fileSystemPathToUrl(value);
    } else {
      try {
        urlString = String(new URL(value, baseUrl));
      } catch (e) {
        throw new TypeError(`fileUrl must be a valid url, received ${value}`)
      }
    }
  } else {
    throw new TypeError(`fileUrl must be a string or an url, received ${value}`)
  }

  if (!urlString.startsWith("file://")) {
    throw new Error(`fileUrl must starts with file://, received ${value}`)
  }

  return urlString
};

const urlToFileSystemPath = (url$1) => {
  let urlString = String(url$1);
  if (urlString[urlString.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    urlString = urlString.slice(0, -1);
  }
  const fileSystemPath = url.fileURLToPath(urlString);
  return fileSystemPath
};

/*
 * - stats object documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_class_fs_stats
 */

process.platform === "win32";

const isWindows = process.platform === "win32";
const baseUrlFallback = fileSystemPathToUrl(process.cwd());

/**
 * Some url might be resolved or remapped to url without the windows drive letter.
 * For instance
 * new URL('/foo.js', 'file:///C:/dir/file.js')
 * resolves to
 * 'file:///foo.js'
 *
 * But on windows it becomes a problem because we need the drive letter otherwise
 * url cannot be converted to a filesystem path.
 *
 * ensureWindowsDriveLetter ensure a resolved url still contains the drive letter.
 */

const ensureWindowsDriveLetter = (url, baseUrl) => {
  try {
    url = String(new URL(url));
  } catch (e) {
    throw new Error(`absolute url expected but got ${url}`)
  }

  if (!isWindows) {
    return url
  }

  try {
    baseUrl = String(new URL(baseUrl));
  } catch (e) {
    throw new Error(
      `absolute baseUrl expected but got ${baseUrl} to ensure windows drive letter on ${url}`,
    )
  }

  if (!url.startsWith("file://")) {
    return url
  }
  const afterProtocol = url.slice("file://".length);
  // we still have the windows drive letter
  if (extractDriveLetter(afterProtocol)) {
    return url
  }

  // drive letter was lost, restore it
  const baseUrlOrFallback = baseUrl.startsWith("file://")
    ? baseUrl
    : baseUrlFallback;
  const driveLetter = extractDriveLetter(
    baseUrlOrFallback.slice("file://".length),
  );
  if (!driveLetter) {
    throw new Error(
      `drive letter expected on baseUrl but got ${baseUrl} to ensure windows drive letter on ${url}`,
    )
  }
  return `file:///${driveLetter}:${afterProtocol}`
};

const extractDriveLetter = (ressource) => {
  // we still have the windows drive letter
  if (/[a-zA-Z]/.test(ressource[1]) && ressource[2] === ":") {
    return ressource[1]
  }
  return null
};

process.platform === "win32";

const urlIsInsideOf = (url, otherUrl) => {
  const urlObject = new URL(url);
  const otherUrlObject = new URL(otherUrl);

  if (urlObject.origin !== otherUrlObject.origin) {
    return false
  }

  const urlPathname = urlObject.pathname;
  const otherUrlPathname = otherUrlObject.pathname;
  if (urlPathname === otherUrlPathname) {
    return false
  }

  const isInside = urlPathname.startsWith(otherUrlPathname);
  return isInside
};

process.platform === "win32" ? `file///${process.cwd()[0]}:/` : "file:///";

const getRealFileSystemUrlSync = (
  fileUrl,
  { followLink = true } = {},
) => {
  const pathname = new URL(fileUrl).pathname;
  const parts = pathname.slice(1).split("/");
  let reconstructedFileUrl = `file:///`;
  if (process.platform === "win32") {
    const windowsDriveLetter = parts.shift();
    reconstructedFileUrl += `${windowsDriveLetter}/`;
  }
  let i = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const name = parts[i];
    i++;
    let namesOnFileSystem;
    try {
      namesOnFileSystem = node_fs.readdirSync(
        // When Node.js receives "C:/" on windows it returns
        // the process.cwd() directory content...
        // This can be fixed by passing "file:///C:/" directly but as a url object
        new URL(reconstructedFileUrl),
      );
    } catch (e) {
      if (e && e.code === "ENOENT") {
        return null
      }
      throw e
    }
    const foundOnFilesystem = namesOnFileSystem.includes(name);
    if (foundOnFilesystem) {
      reconstructedFileUrl += name;
    } else {
      const nameOnFileSystem = namesOnFileSystem.find(
        (nameCandidate) => nameCandidate.toLowerCase() === name.toLowerCase(),
      );
      if (!nameOnFileSystem) {
        return null
      }
      reconstructedFileUrl += nameOnFileSystem;
    }
    if (i === parts.length) {
      if (followLink) {
        const realPath = node_fs.realpathSync.native(
          urlToFileSystemPath(reconstructedFileUrl),
        );
        return fileSystemPathToUrl(realPath)
      }
      return reconstructedFileUrl
    }
    reconstructedFileUrl += "/";
  }
};

node_util.promisify(node_fs.readFile);

const readFileSync = (value, { as = "buffer" } = {}) => {
  const fileUrl = assertAndNormalizeFileUrl(value);
  const buffer = node_fs.readFileSync(new URL(fileUrl));
  if (as === "buffer") {
    return buffer
  }
  if (as === "string") {
    return buffer.toString()
  }
  if (as === "json") {
    return JSON.parse(buffer.toString())
  }
  throw new Error(
    `"as" must be one of "buffer","string","json" received "${as}"`,
  )
};

process.platform === "win32";

/* eslint-disable import/max-dependencies */

process.platform === "linux";

const isSpecifierForNodeBuiltin = (specifier) => {
  return (
    specifier.startsWith("node:") ||
    NODE_BUILTIN_MODULE_SPECIFIERS.includes(specifier)
  )
};

const NODE_BUILTIN_MODULE_SPECIFIERS = [
  "assert",
  "assert/strict",
  "async_hooks",
  "buffer_ieee754",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "_debugger",
  "dgram",
  "dns",
  "domain",
  "events",
  "freelist",
  "fs",
  "fs/promises",
  "_http_agent",
  "_http_client",
  "_http_common",
  "_http_incoming",
  "_http_outgoing",
  "_http_server",
  "http",
  "http2",
  "https",
  "inspector",
  "_linklist",
  "module",
  "net",
  "node-inspect/lib/_inspect",
  "node-inspect/lib/internal/inspect_client",
  "node-inspect/lib/internal/inspect_repl",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "smalloc",
  "_stream_duplex",
  "_stream_transform",
  "_stream_wrap",
  "_stream_passthrough",
  "_stream_readable",
  "_stream_writable",
  "stream",
  "stream/promises",
  "string_decoder",
  "sys",
  "timers",
  "_tls_common",
  "_tls_legacy",
  "_tls_wrap",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8/tools/arguments",
  "v8/tools/codemap",
  "v8/tools/consarray",
  "v8/tools/csvparser",
  "v8/tools/logreader",
  "v8/tools/profile_view",
  "v8/tools/splaytree",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
  // global is special
  "global",
];

const asDirectoryUrl = (url) => {
  const { pathname } = new URL(url);
  if (pathname.endsWith("/")) {
    return url
  }
  return new URL("./", url).href
};

const getParentUrl = (url) => {
  if (url.startsWith("file://")) {
    // With node.js new URL('../', 'file:///C:/').href
    // returns "file:///C:/" instead of "file:///"
    const ressource = url.slice("file://".length);
    const slashLastIndex = ressource.lastIndexOf("/");
    if (slashLastIndex === -1) {
      return url
    }
    const lastCharIndex = ressource.length - 1;
    if (slashLastIndex === lastCharIndex) {
      const slashBeforeLastIndex = ressource.lastIndexOf(
        "/",
        slashLastIndex - 1,
      );
      if (slashBeforeLastIndex === -1) {
        return url
      }
      return `file://${ressource.slice(0, slashBeforeLastIndex + 1)}`
    }

    return `file://${ressource.slice(0, slashLastIndex + 1)}`
  }
  return new URL(url.endsWith("/") ? "../" : "./", url).href
};

const isValidUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true
  } catch (e) {
    return false
  }
};

const urlToFilename = (url) => {
  const { pathname } = new URL(url);
  const pathnameBeforeLastSlash = pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename =
    slashLastIndex === -1
      ? pathnameBeforeLastSlash
      : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
  return filename
};

const defaultLookupPackageScope = (url) => {
  let scopeUrl = asDirectoryUrl(url);
  while (scopeUrl !== "file:///") {
    if (scopeUrl.endsWith("node_modules/")) {
      return null
    }
    const packageJsonUrlObject = new URL("package.json", scopeUrl);
    if (node_fs.existsSync(packageJsonUrlObject)) {
      return scopeUrl
    }
    scopeUrl = getParentUrl(scopeUrl);
  }
  return null
};

const defaultReadPackageJson = (packageUrl) => {
  const packageJsonUrl = new URL("package.json", packageUrl);
  const buffer = node_fs.readFileSync(packageJsonUrl);
  const string = String(buffer);
  try {
    return JSON.parse(string)
  } catch (e) {
    throw new Error(`Invalid package configuration`)
  }
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/tools/node_modules/eslint/node_modules/%40babel/core/lib/vendor/import-meta-resolve.js#L2473

const createInvalidModuleSpecifierError = ({
  specifier,
  parentUrl,
  reason,
}) => {
  const error = new Error(
    `Invalid module "${specifier}" ${reason} imported from ${node_url.fileURLToPath(
      parentUrl,
    )}`,
  );
  error.code = "INVALID_MODULE_SPECIFIER";
  return error
};

const createInvalidPackageTargetError = ({
  parentUrl,
  packageUrl,
  target,
  key,
  isImport,
  reason,
}) => {
  let message;
  if (key === ".") {
    message = `Invalid "exports" main target defined in ${node_url.fileURLToPath(
      packageUrl,
    )}package.json imported from ${node_url.fileURLToPath(parentUrl)}; ${reason}`;
  } else {
    message = `Invalid "${
      isImport ? "imports" : "exports"
    }" target ${JSON.stringify(target)} defined for "${key}" in ${node_url.fileURLToPath(
      packageUrl,
    )}package.json imported from ${node_url.fileURLToPath(parentUrl)}; ${reason}`;
  }
  const error = new Error(message);
  error.code = "INVALID_PACKAGE_TARGET";
  return error
};

const createPackagePathNotExportedError = ({
  subpath,
  parentUrl,
  packageUrl,
}) => {
  let message;
  if (subpath === ".") {
    message = `No "exports" main defined in ${node_url.fileURLToPath(
      packageUrl,
    )}package.json imported from ${node_url.fileURLToPath(parentUrl)}`;
  } else {
    message = `Package subpath "${subpath}" is not defined by "exports" in ${node_url.fileURLToPath(
      packageUrl,
    )}package.json imported from ${node_url.fileURLToPath(parentUrl)}`;
  }
  const error = new Error(message);
  error.code = "PACKAGE_PATH_NOT_EXPORTED";
  return error
};

const createModuleNotFoundError = ({ specifier, parentUrl }) => {
  const error = new Error(
    `Cannot find "${specifier}" imported from ${node_url.fileURLToPath(parentUrl)}`,
  );
  error.code = "MODULE_NOT_FOUND";
  return error
};

const createPackageImportNotDefinedError = ({
  specifier,
  packageUrl,
  parentUrl,
}) => {
  const error = new Error(
    `Package import specifier "${specifier}" is not defined in ${node_url.fileURLToPath(
      packageUrl,
    )}package.json imported from ${node_url.fileURLToPath(parentUrl)}`,
  );
  error.code = "PACKAGE_IMPORT_NOT_DEFINED";
  return error
};

// https://nodejs.org/api/packages.html#resolving-user-conditions
const readCustomConditionsFromProcessArgs = () => {
  const packageConditions = [];
  process.execArgv.forEach((arg) => {
    if (arg.includes("-C=")) {
      const packageCondition = arg.slice(0, "-C=".length);
      packageConditions.push(packageCondition);
    }
    if (arg.includes("--conditions=")) {
      const packageCondition = arg.slice(0, "--conditions=".length);
      packageConditions.push(packageCondition);
    }
  });
  return packageConditions
};

/*
 * https://nodejs.org/api/esm.html#resolver-algorithm-specification
 * https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L1
 * deviations from the spec:
 * - take into account "browser", "module" and "jsnext"
 * - the check for isDirectory -> throw is delayed is descoped to the caller
 * - the call to real path ->
 *   delayed to the caller so that we can decide to
 *   maintain symlink as facade url when it's outside project directory
 *   or use the real path when inside
 */

const applyNodeEsmResolution = ({
  conditions = [...readCustomConditionsFromProcessArgs(), "node", "import"],
  parentUrl,
  specifier,
  lookupPackageScope = defaultLookupPackageScope,
  readPackageJson = defaultReadPackageJson,
}) => {
  const resolution = applyPackageSpecifierResolution({
    conditions,
    parentUrl: String(parentUrl),
    specifier,
    lookupPackageScope,
    readPackageJson,
  });
  const { url } = resolution;
  if (url.startsWith("file:")) {
    if (url.includes("%2F") || url.includes("%5C")) {
      throw createInvalidModuleSpecifierError({
        specifier,
        parentUrl,
        reason: `must not include encoded "/" or "\\" characters`,
      })
    }
    return resolution
  }
  return resolution
};

const applyPackageSpecifierResolution = ({
  conditions,
  parentUrl,
  specifier,
  lookupPackageScope,
  readPackageJson,
}) => {
  // relative specifier
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    if (specifier[0] !== "/") {
      const browserFieldResolution = applyBrowserFieldResolution({
        conditions,
        parentUrl,
        specifier,
        lookupPackageScope,
        readPackageJson,
      });
      if (browserFieldResolution) {
        return browserFieldResolution
      }
    }
    return {
      type: "relative_specifier",
      url: new URL(specifier, parentUrl).href,
    }
  }
  if (specifier[0] === "#") {
    return applyPackageImportsResolution({
      conditions,
      parentUrl,
      specifier,
      lookupPackageScope,
      readPackageJson,
    })
  }
  try {
    const urlObject = new URL(specifier);
    if (specifier.startsWith("node:")) {
      return {
        type: "node_builtin_specifier",
        url: specifier,
      }
    }
    return {
      type: "absolute_specifier",
      url: urlObject.href,
    }
  } catch (e) {
    // bare specifier
    const browserFieldResolution = applyBrowserFieldResolution({
      conditions,
      parentUrl,
      packageSpecifier: specifier,
      lookupPackageScope,
      readPackageJson,
    });
    if (browserFieldResolution) {
      return browserFieldResolution
    }
    return applyPackageResolve({
      conditions,
      parentUrl,
      packageSpecifier: specifier,
      lookupPackageScope,
      readPackageJson,
    })
  }
};

const applyBrowserFieldResolution = ({
  conditions,
  parentUrl,
  packageSpecifier,
  lookupPackageScope,
  readPackageJson,
}) => {
  const browserCondition = conditions.includes("browser");
  if (!browserCondition) {
    return null
  }
  const packageUrl = lookupPackageScope(parentUrl);
  if (!packageUrl) {
    return null
  }
  const packageJson = readPackageJson(packageUrl);
  if (!packageJson) {
    return null
  }
  const { browser } = packageJson;
  if (!browser) {
    return null
  }
  if (typeof browser !== "object") {
    return null
  }
  let url;
  if (packageSpecifier.startsWith(".")) {
    const packageSpecifierUrl = new URL(packageSpecifier, parentUrl).href;
    const packageSpecifierRelativeUrl = packageSpecifierUrl.slice(
      packageUrl.length,
    );
    const packageSpecifierRelativeNotation = `./${packageSpecifierRelativeUrl}`;
    const browserMapping = browser[packageSpecifierRelativeNotation];
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageUrl).href;
    } else if (browserMapping === false) {
      url = `file:///@ignore/${packageSpecifierUrl.slice("file:///")}`;
    }
  } else {
    const browserMapping = browser[packageSpecifier];
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageUrl).href;
    } else if (browserMapping === false) {
      url = `file:///@ignore/${packageSpecifier}`;
    }
  }
  if (url) {
    return {
      type: "browser",
      packageUrl,
      packageJson,
      url,
    }
  }
  return null
};

const applyPackageImportsResolution = ({
  conditions,
  parentUrl,
  specifier,
  lookupPackageScope,
  readPackageJson,
}) => {
  if (!specifier.startsWith("#")) {
    throw createInvalidModuleSpecifierError({
      specifier,
      parentUrl,
      reason: "internal imports must start with #",
    })
  }
  if (specifier === "#" || specifier.startsWith("#/")) {
    throw createInvalidModuleSpecifierError({
      specifier,
      parentUrl,
      reason: "not a valid internal imports specifier name",
    })
  }
  const packageUrl = lookupPackageScope(parentUrl);
  if (packageUrl !== null) {
    const packageJson = readPackageJson(packageUrl);
    const { imports } = packageJson;
    if (imports !== null && typeof imports === "object") {
      const resolved = applyPackageImportsExportsResolution({
        conditions,
        parentUrl,
        packageUrl,
        packageJson,
        matchObject: imports,
        matchKey: specifier,
        isImports: true,
        lookupPackageScope,
        readPackageJson,
      });
      if (resolved) {
        return resolved
      }
    }
  }
  throw createPackageImportNotDefinedError({
    specifier,
    packageUrl,
    parentUrl,
  })
};

const applyPackageResolve = ({
  conditions,
  parentUrl,
  packageSpecifier,
  lookupPackageScope,
  readPackageJson,
}) => {
  if (packageSpecifier === "") {
    throw new Error("invalid module specifier")
  }
  if (
    conditions.includes("node") &&
    isSpecifierForNodeBuiltin(packageSpecifier)
  ) {
    return {
      type: "node_builtin_specifier",
      url: `node:${packageSpecifier}`,
    }
  }
  const { packageName, packageSubpath } =
    parsePackageSpecifier(packageSpecifier);
  if (
    packageName[0] === "." ||
    packageName.includes("\\") ||
    packageName.includes("%")
  ) {
    throw createInvalidModuleSpecifierError({
      specifier: packageName,
      parentUrl,
      reason: `is not a valid package name`,
    })
  }
  if (packageSubpath.endsWith("/")) {
    throw new Error("invalid module specifier")
  }
  const selfResolution = applyPackageSelfResolution({
    conditions,
    parentUrl,
    packageName,
    packageSubpath,
    lookupPackageScope,
    readPackageJson,
  });
  if (selfResolution) {
    return selfResolution
  }
  let currentUrl = parentUrl;
  while (currentUrl !== "file:///") {
    const packageUrl = new URL(`node_modules/${packageName}/`, currentUrl).href;
    if (!node_fs.existsSync(new URL(packageUrl))) {
      currentUrl = getParentUrl(currentUrl);
      continue
    }
    const packageJson = readPackageJson(packageUrl);
    if (packageJson !== null) {
      const { exports } = packageJson;
      if (exports !== null && exports !== undefined) {
        return applyPackageExportsResolution({
          conditions,
          parentUrl,
          packageUrl,
          packageJson,
          packageSubpath,
          exports,
          lookupPackageScope,
          readPackageJson,
        })
      }
    }
    return applyLegacySubpathResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      packageSubpath,
      lookupPackageScope,
      readPackageJson,
    })
  }
  throw createModuleNotFoundError({
    specifier: packageName,
    parentUrl,
  })
};

const applyPackageSelfResolution = ({
  conditions,
  parentUrl,
  packageName,
  packageSubpath,
  lookupPackageScope,
  readPackageJson,
}) => {
  const packageUrl = lookupPackageScope(parentUrl);
  if (!packageUrl) {
    return undefined
  }
  const packageJson = readPackageJson(packageUrl);
  if (!packageJson) {
    return undefined
  }
  if (packageJson.name !== packageName) {
    return undefined
  }
  const { exports } = packageJson;
  if (!exports) {
    const subpathResolution = applyLegacySubpathResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      packageSubpath,
      lookupPackageScope,
      readPackageJson,
    });
    if (subpathResolution && subpathResolution.type !== "subpath") {
      return subpathResolution
    }
    return undefined
  }
  return applyPackageExportsResolution({
    conditions,
    parentUrl,
    packageUrl,
    packageJson,
    packageSubpath,
    exports,
    lookupPackageScope,
    readPackageJson,
  })
};

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L642
const applyPackageExportsResolution = ({
  conditions,
  parentUrl,
  packageUrl,
  packageJson,
  packageSubpath,
  exports,
  lookupPackageScope,
  readPackageJson,
}) => {
  const exportsInfo = readExports({ exports, packageUrl });
  if (packageSubpath === ".") {
    const mainExport = applyMainExportResolution({ exports, exportsInfo });
    if (!mainExport) {
      throw createPackagePathNotExportedError({
        subpath: packageSubpath,
        parentUrl,
        packageUrl,
      })
    }
    const resolved = applyPackageTargetResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      key: ".",
      target: mainExport,
      lookupPackageScope,
      readPackageJson,
    });
    if (resolved) {
      return resolved
    }
    throw createPackagePathNotExportedError({
      subpath: packageSubpath,
      parentUrl,
      packageUrl,
    })
  }
  if (exportsInfo.type === "object" && exportsInfo.allKeysAreRelative) {
    const resolved = applyPackageImportsExportsResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      matchObject: exports,
      matchKey: packageSubpath,
      isImports: false,
      lookupPackageScope,
      readPackageJson,
    });
    if (resolved) {
      return resolved
    }
  }
  throw createPackagePathNotExportedError({
    subpath: packageSubpath,
    parentUrl,
    packageUrl,
  })
};

const applyPackageImportsExportsResolution = ({
  conditions,
  parentUrl,
  packageUrl,
  packageJson,
  matchObject,
  matchKey,
  isImports,
  lookupPackageScope,
  readPackageJson,
}) => {
  if (!matchKey.includes("*") && matchObject.hasOwnProperty(matchKey)) {
    const target = matchObject[matchKey];
    return applyPackageTargetResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      key: matchKey,
      target,
      internal: isImports,
      lookupPackageScope,
      readPackageJson,
    })
  }
  const expansionKeys = Object.keys(matchObject)
    .filter((key) => key.split("*").length === 2)
    .sort(comparePatternKeys);
  for (const expansionKey of expansionKeys) {
    const [patternBase, patternTrailer] = expansionKey.split("*");
    if (matchKey === patternBase) continue
    if (!matchKey.startsWith(patternBase)) continue
    if (patternTrailer.length > 0) {
      if (!matchKey.endsWith(patternTrailer)) continue
      if (matchKey.length < expansionKey.length) continue
    }
    const target = matchObject[expansionKey];
    const subpath = matchKey.slice(
      patternBase.length,
      matchKey.length - patternTrailer.length,
    );
    return applyPackageTargetResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      key: matchKey,
      target,
      subpath,
      pattern: true,
      internal: isImports,
      lookupPackageScope,
      readPackageJson,
    })
  }
  return null
};

const applyPackageTargetResolution = ({
  conditions,
  parentUrl,
  packageUrl,
  packageJson,
  key,
  target,
  subpath = "",
  pattern = false,
  internal = false,
  lookupPackageScope,
  readPackageJson,
}) => {
  if (typeof target === "string") {
    if (pattern === false && subpath !== "" && !target.endsWith("/")) {
      throw new Error("invalid module specifier")
    }
    if (target.startsWith("./")) {
      const targetUrl = new URL(target, packageUrl).href;
      if (!targetUrl.startsWith(packageUrl)) {
        throw createInvalidPackageTargetError({
          parentUrl,
          packageUrl,
          target,
          key,
          isImport: internal,
          reason: `target must be inside package`,
        })
      }
      return {
        type: internal ? "imports_subpath" : "exports_subpath",
        packageUrl,
        packageJson,
        url: pattern
          ? targetUrl.replaceAll("*", subpath)
          : new URL(subpath, targetUrl).href,
      }
    }
    if (!internal || target.startsWith("../") || isValidUrl(target)) {
      throw createInvalidPackageTargetError({
        parentUrl,
        packageUrl,
        target,
        key,
        isImport: internal,
        reason: `target must starst with "./"`,
      })
    }
    return applyPackageResolve({
      conditions,
      parentUrl: packageUrl,
      packageSpecifier: pattern
        ? target.replaceAll("*", subpath)
        : `${target}${subpath}`,
      lookupPackageScope,
      readPackageJson,
    })
  }
  if (Array.isArray(target)) {
    if (target.length === 0) {
      return null
    }
    let lastResult;
    let i = 0;
    while (i < target.length) {
      const targetValue = target[i];
      i++;
      try {
        const resolved = applyPackageTargetResolution({
          conditions,
          parentUrl,
          packageUrl,
          packageJson,
          key: `${key}[${i}]`,
          target: targetValue,
          subpath,
          pattern,
          internal,
          lookupPackageScope,
          readPackageJson,
        });
        if (resolved) {
          return resolved
        }
        lastResult = resolved;
      } catch (e) {
        if (e.code === "INVALID_PACKAGE_TARGET") {
          continue
        }
        lastResult = e;
      }
    }
    if (lastResult) {
      throw lastResult
    }
    return null
  }
  if (target === null) {
    return null
  }
  if (typeof target === "object") {
    const keys = Object.keys(target);
    for (const key of keys) {
      if (Number.isInteger(key)) {
        throw new Error("Invalid package configuration")
      }
      if (key === "default" || conditions.includes(key)) {
        const targetValue = target[key];
        const resolved = applyPackageTargetResolution({
          conditions,
          parentUrl,
          packageUrl,
          packageJson,
          key,
          target: targetValue,
          subpath,
          pattern,
          internal,
          lookupPackageScope,
          readPackageJson,
        });
        if (resolved) {
          return resolved
        }
      }
    }
    return null
  }
  throw createInvalidPackageTargetError({
    parentUrl,
    packageUrl,
    target,
    key,
    isImport: internal,
    reason: `target must be a string, array, object or null`,
  })
};

const readExports = ({ exports, packageUrl }) => {
  if (Array.isArray(exports)) {
    return {
      type: "array",
    }
  }
  if (exports === null) {
    return {}
  }
  if (typeof exports === "object") {
    const keys = Object.keys(exports);
    const relativeKeys = [];
    const conditionalKeys = [];
    keys.forEach((availableKey) => {
      if (availableKey.startsWith(".")) {
        relativeKeys.push(availableKey);
      } else {
        conditionalKeys.push(availableKey);
      }
    });
    const hasRelativeKey = relativeKeys.length > 0;
    if (hasRelativeKey && conditionalKeys.length > 0) {
      throw new Error(
        `Invalid package configuration: cannot mix relative and conditional keys in package.exports
--- unexpected keys ---
${conditionalKeys.map((key) => `"${key}"`).join("\n")}
--- package.json ---
${packageUrl}`,
      )
    }
    return {
      type: "object",
      hasRelativeKey,
      allKeysAreRelative: relativeKeys.length === keys.length,
    }
  }
  if (typeof exports === "string") {
    return { type: "string" }
  }
  return {}
};

const parsePackageSpecifier = (packageSpecifier) => {
  if (packageSpecifier[0] === "@") {
    const firstSlashIndex = packageSpecifier.indexOf("/");
    if (firstSlashIndex === -1) {
      throw new Error("invalid module specifier")
    }
    const secondSlashIndex = packageSpecifier.indexOf("/", firstSlashIndex + 1);
    if (secondSlashIndex === -1) {
      return {
        packageName: packageSpecifier,
        packageSubpath: ".",
        isScoped: true,
      }
    }
    const packageName = packageSpecifier.slice(0, secondSlashIndex);
    const afterSecondSlash = packageSpecifier.slice(secondSlashIndex + 1);
    const packageSubpath = `./${afterSecondSlash}`;
    return {
      packageName,
      packageSubpath,
      isScoped: true,
    }
  }
  const firstSlashIndex = packageSpecifier.indexOf("/");
  if (firstSlashIndex === -1) {
    return {
      packageName: packageSpecifier,
      packageSubpath: ".",
    }
  }
  const packageName = packageSpecifier.slice(0, firstSlashIndex);
  const afterFirstSlash = packageSpecifier.slice(firstSlashIndex + 1);
  const packageSubpath = `./${afterFirstSlash}`;
  return {
    packageName,
    packageSubpath,
  }
};

const applyMainExportResolution = ({ exports, exportsInfo }) => {
  if (exportsInfo.type === "array" || exportsInfo.type === "string") {
    return exports
  }
  if (exportsInfo.type === "object") {
    if (exportsInfo.hasRelativeKey) {
      return exports["."]
    }
    return exports
  }
  return undefined
};

const applyLegacySubpathResolution = ({
  conditions,
  parentUrl,
  packageUrl,
  packageJson,
  packageSubpath,
  lookupPackageScope,
  readPackageJson,
}) => {
  if (packageSubpath === ".") {
    return applyLegacyMainResolution({
      conditions,
      packageUrl,
      packageJson,
    })
  }
  const browserFieldResolution = applyBrowserFieldResolution({
    conditions,
    parentUrl,
    specifier: packageSubpath,
    lookupPackageScope,
    readPackageJson,
  });
  if (browserFieldResolution) {
    return browserFieldResolution
  }
  return {
    type: "subpath",
    packageUrl,
    packageJson,
    url: new URL(packageSubpath, packageUrl).href,
  }
};

const applyLegacyMainResolution = ({ conditions, packageUrl, packageJson }) => {
  for (const condition of conditions) {
    const conditionResolver = mainLegacyResolvers[condition];
    if (!conditionResolver) {
      continue
    }
    const resolved = conditionResolver(packageJson, packageUrl);
    if (resolved) {
      return {
        type: resolved.type,
        packageUrl,
        packageJson,
        url: new URL(resolved.path, packageUrl).href,
      }
    }
  }
  return {
    type: "default",
    packageUrl,
    packageJson,
    url: new URL("index.js", packageUrl).href,
  }
};
const mainLegacyResolvers = {
  import: (packageJson) => {
    if (typeof packageJson.module === "string") {
      return { type: "module", path: packageJson.module }
    }
    if (typeof packageJson.jsnext === "string") {
      return { type: "jsnext", path: packageJson.jsnext }
    }
    if (typeof packageJson.main === "string") {
      return { type: "main", path: packageJson.main }
    }
    return null
  },
  browser: (packageJson, packageUrl) => {
    const browserMain =
      typeof packageJson.browser === "string"
        ? packageJson.browser
        : typeof packageJson.browser === "object" &&
          packageJson.browser !== null
        ? packageJson.browser["."]
        : "";
    if (!browserMain) {
      if (typeof packageJson.module === "string") {
        return {
          type: "module",
          path: packageJson.module,
        }
      }
      return null
    }
    if (
      typeof packageJson.module !== "string" ||
      packageJson.module === browserMain
    ) {
      return {
        type: "browser",
        path: browserMain,
      }
    }
    const browserMainUrlObject = new URL(browserMain, packageUrl);
    const content = node_fs.readFileSync(browserMainUrlObject, "utf-8");
    if (
      (/typeof exports\s*==/.test(content) &&
        /typeof module\s*==/.test(content)) ||
      /module\.exports\s*=/.test(content)
    ) {
      return {
        type: "module",
        path: packageJson.module,
      }
    }
    return {
      type: "browser",
      path: browserMain,
    }
  },
  node: (packageJson) => {
    if (typeof packageJson.main === "string") {
      return {
        type: "main",
        path: packageJson.main,
      }
    }
    return null
  },
};

const comparePatternKeys = (keyA, keyB) => {
  if (!keyA.endsWith("/") && !keyA.contains("*")) {
    throw new Error("Invalid package configuration")
  }
  if (!keyB.endsWith("/") && !keyB.contains("*")) {
    throw new Error("Invalid package configuration")
  }
  const aStarIndex = keyA.indexOf("*");
  const baseLengthA = aStarIndex > -1 ? aStarIndex + 1 : keyA.length;
  const bStarIndex = keyB.indexOf("*");
  const baseLengthB = bStarIndex > -1 ? bStarIndex + 1 : keyB.length;
  if (baseLengthA > baseLengthB) {
    return -1
  }
  if (baseLengthB > baseLengthA) {
    return 1
  }
  if (aStarIndex === -1) {
    return 1
  }
  if (bStarIndex === -1) {
    return -1
  }
  if (keyA.length > keyB.length) {
    return -1
  }
  if (keyB.length > keyA.length) {
    return 1
  }
  return 0
};

// https://nodejs.org/dist/latest-v16.x/docs/api/packages.html#packages_determining_module_system)
const determineModuleSystem = (
  url,
  { ambiguousExtensions = [".js"] } = {},
) => {
  const inputTypeArgv = process.execArgv.find((argv) =>
    argv.startsWith("--input-type="),
  );
  if (inputTypeArgv) {
    const value = inputTypeArgv.slice("--input-type=".length);
    if (value === "module") {
      return "module"
    }
    if (value === "commonjs") {
      return "commonjs"
    }
  }
  const extension = extensionFromUrl(url);
  if (extension === ".mjs") {
    return "module"
  }
  if (extension === ".cjs") {
    return "commonjs"
  }
  if (extension === ".json") {
    return "url"
  }
  if (ambiguousExtensions.includes(extension)) {
    const packageUrl = defaultLookupPackageScope(url);
    if (!packageUrl) {
      return "commonjs"
    }
    const packageJson = defaultReadPackageJson(packageUrl);
    if (packageJson.type === "module") {
      return "module"
    }
    return "commonjs"
  }
  return "url"
  // throw new Error(`unsupported file extension (${extension})`)
};

const extensionFromUrl = (url) => {
  const { pathname } = new URL(url);
  const slashLastIndex = pathname.lastIndexOf("/");
  const filename =
    slashLastIndex === -1 ? pathname : pathname.slice(slashLastIndex + 1);
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) return ""
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = filename.slice(dotLastIndex);
  return extension
};

const applyFileSystemMagicResolution = (
  fileUrl,
  { fileStat, magicDirectoryIndex, magicExtensions },
) => {
  let lastENOENTError = null;
  const fileStatOrNull = (url) => {
    try {
      return node_fs.statSync(new URL(url))
    } catch (e) {
      if (e.code === "ENOENT") {
        lastENOENTError = e;
        return null
      }
      throw e
    }
  };
  fileStat = fileStat === undefined ? fileStatOrNull(fileUrl) : fileStat;

  if (fileStat && fileStat.isFile()) {
    return {
      found: true,
      url: fileUrl,
    }
  }
  if (fileStat && fileStat.isDirectory()) {
    if (magicDirectoryIndex) {
      const indexFileSuffix = fileUrl.endsWith("/") ? "index" : "/index";
      const indexFileUrl = `${fileUrl}${indexFileSuffix}`;
      const result = applyFileSystemMagicResolution(indexFileUrl, {
        magicDirectoryIndex: false,
        magicExtensions,
      });
      return {
        ...result,
        magicDirectoryIndex: true,
      }
    }
    return {
      found: true,
      url: fileUrl,
      isDirectory: true,
    }
  }
  if (magicExtensions && magicExtensions.length) {
    const parentUrl = new URL("./", fileUrl).href;
    const urlFilename = urlToFilename(fileUrl);
    const extensionLeadingToFile = magicExtensions.find((extensionToTry) => {
      const urlCandidate = `${parentUrl}${urlFilename}${extensionToTry}`;
      const stat = fileStatOrNull(urlCandidate);
      return stat
    });
    if (extensionLeadingToFile) {
      // magic extension worked
      return {
        found: true,
        url: `${fileUrl}${extensionLeadingToFile}`,
        magicExtension: extensionLeadingToFile,
      }
    }
  }
  // magic extension not found
  return {
    found: false,
    url: fileUrl,
    lastENOENTError,
  }
};

const LOG_LEVEL_OFF = "off";
const LOG_LEVEL_DEBUG = "debug";
const LOG_LEVEL_INFO = "info";
const LOG_LEVEL_WARN = "warn";
const LOG_LEVEL_ERROR = "error";

const createLogger = ({ logLevel = LOG_LEVEL_INFO } = {}) => {
  if (logLevel === LOG_LEVEL_DEBUG) {
    return {
      debug,
      info,
      warn,
      error,
    }
  }

  if (logLevel === LOG_LEVEL_INFO) {
    return {
      debug: debugDisabled,
      info,
      warn,
      error,
    }
  }

  if (logLevel === LOG_LEVEL_WARN) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn,
      error,
    }
  }

  if (logLevel === LOG_LEVEL_ERROR) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error,
    }
  }

  if (logLevel === LOG_LEVEL_OFF) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error: errorDisabled,
    }
  }

  throw new Error(`unexpected logLevel.
  --- logLevel ---
  ${logLevel}
  --- allowed log levels ---
  ${LOG_LEVEL_OFF}
  ${LOG_LEVEL_ERROR}
  ${LOG_LEVEL_WARN}
  ${LOG_LEVEL_INFO}
  ${LOG_LEVEL_DEBUG}`)
};

const debug = console.debug;

const debugDisabled = () => {};

const info = console.info;

const infoDisabled = () => {};

const warn = console.warn;

const warnDisabled = () => {};

const error = console.error;

const errorDisabled = () => {};

const createDetailedMessage = (message, details = {}) => {
  let string = `${message}`;

  Object.keys(details).forEach((key) => {
    const value = details[key];
    string += `
--- ${key} ---
${
  Array.isArray(value)
    ? value.join(`
`)
    : value
}`;
  });

  return string
};

const assertImportMap = (value) => {
  if (value === null) {
    throw new TypeError(`an importMap must be an object, got null`)
  }

  const type = typeof value;
  if (type !== "object") {
    throw new TypeError(`an importMap must be an object, received ${value}`)
  }

  if (Array.isArray(value)) {
    throw new TypeError(
      `an importMap must be an object, received array ${value}`,
    )
  }
};

const hasScheme = (string) => {
  return /^[a-zA-Z]{2,}:/.test(string)
};

const urlToScheme = (urlString) => {
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) return ""
  return urlString.slice(0, colonIndex)
};

const urlToPathname = (urlString) => {
  return ressourceToPathname(urlToRessource(urlString))
};

const urlToRessource = (urlString) => {
  const scheme = urlToScheme(urlString);

  if (scheme === "file") {
    return urlString.slice("file://".length)
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = urlString.slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    return afterProtocol.slice(pathnameSlashIndex)
  }

  return urlString.slice(scheme.length + 1)
};

const ressourceToPathname = (ressource) => {
  const searchSeparatorIndex = ressource.indexOf("?");
  return searchSeparatorIndex === -1
    ? ressource
    : ressource.slice(0, searchSeparatorIndex)
};

const urlToOrigin = (urlString) => {
  const scheme = urlToScheme(urlString);

  if (scheme === "file") {
    return "file://"
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length;
    const pathnameSlashIndex = urlString.indexOf("/", secondProtocolSlashIndex);

    if (pathnameSlashIndex === -1) return urlString
    return urlString.slice(0, pathnameSlashIndex)
  }

  return urlString.slice(0, scheme.length + 1)
};

const pathnameToParentPathname = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/"
  }

  return pathname.slice(0, slashLastIndex + 1)
};

// could be useful: https://url.spec.whatwg.org/#url-miscellaneous

const resolveUrl = (specifier, baseUrl) => {
  if (baseUrl) {
    if (typeof baseUrl !== "string") {
      throw new TypeError(writeBaseUrlMustBeAString({ baseUrl, specifier }))
    }
    if (!hasScheme(baseUrl)) {
      throw new Error(writeBaseUrlMustBeAbsolute({ baseUrl, specifier }))
    }
  }

  if (hasScheme(specifier)) {
    return specifier
  }

  if (!baseUrl) {
    throw new Error(writeBaseUrlRequired({ baseUrl, specifier }))
  }

  // scheme relative
  if (specifier.slice(0, 2) === "//") {
    return `${urlToScheme(baseUrl)}:${specifier}`
  }

  // origin relative
  if (specifier[0] === "/") {
    return `${urlToOrigin(baseUrl)}${specifier}`
  }

  const baseOrigin = urlToOrigin(baseUrl);
  const basePathname = urlToPathname(baseUrl);

  if (specifier === ".") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}`
  }

  // pathname relative inside
  if (specifier.slice(0, 2) === "./") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}${specifier.slice(2)}`
  }

  // pathname relative outside
  if (specifier.slice(0, 3) === "../") {
    let unresolvedPathname = specifier;
    const importerFolders = basePathname.split("/");
    importerFolders.pop();

    while (unresolvedPathname.slice(0, 3) === "../") {
      unresolvedPathname = unresolvedPathname.slice(3);
      // when there is no folder left to resolved
      // we just ignore '../'
      if (importerFolders.length) {
        importerFolders.pop();
      }
    }

    const resolvedPathname = `${importerFolders.join(
      "/",
    )}/${unresolvedPathname}`;
    return `${baseOrigin}${resolvedPathname}`
  }

  // bare
  if (basePathname === "") {
    return `${baseOrigin}/${specifier}`
  }
  if (basePathname[basePathname.length] === "/") {
    return `${baseOrigin}${basePathname}${specifier}`
  }
  return `${baseOrigin}${pathnameToParentPathname(basePathname)}${specifier}`
};

const writeBaseUrlMustBeAString = ({
  baseUrl,
  specifier,
}) => `baseUrl must be a string.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlMustBeAbsolute = ({
  baseUrl,
  specifier,
}) => `baseUrl must be absolute.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlRequired = ({
  baseUrl,
  specifier,
}) => `baseUrl required to resolve relative specifier.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const tryUrlResolution = (string, url) => {
  const result = resolveUrl(string, url);
  return hasScheme(result) ? result : null
};

const resolveSpecifier = (specifier, importer) => {
  if (
    specifier === "." ||
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return resolveUrl(specifier, importer)
  }

  if (hasScheme(specifier)) {
    return specifier
  }

  return null
};

const applyImportMap = ({
  importMap,
  specifier,
  importer,
  createBareSpecifierError = ({ specifier, importer }) => {
    return new Error(
      createDetailedMessage(`Unmapped bare specifier.`, {
        specifier,
        importer,
      }),
    )
  },
  onImportMapping = () => {},
}) => {
  assertImportMap(importMap);
  if (typeof specifier !== "string") {
    throw new TypeError(
      createDetailedMessage("specifier must be a string.", {
        specifier,
        importer,
      }),
    )
  }
  if (importer) {
    if (typeof importer !== "string") {
      throw new TypeError(
        createDetailedMessage("importer must be a string.", {
          importer,
          specifier,
        }),
      )
    }
    if (!hasScheme(importer)) {
      throw new Error(
        createDetailedMessage(`importer must be an absolute url.`, {
          importer,
          specifier,
        }),
      )
    }
  }

  const specifierUrl = resolveSpecifier(specifier, importer);
  const specifierNormalized = specifierUrl || specifier;

  const { scopes } = importMap;
  if (scopes && importer) {
    const scopeSpecifierMatching = Object.keys(scopes).find(
      (scopeSpecifier) => {
        return (
          scopeSpecifier === importer ||
          specifierIsPrefixOf(scopeSpecifier, importer)
        )
      },
    );
    if (scopeSpecifierMatching) {
      const scopeMappings = scopes[scopeSpecifierMatching];
      const mappingFromScopes = applyMappings(
        scopeMappings,
        specifierNormalized,
        scopeSpecifierMatching,
        onImportMapping,
      );
      if (mappingFromScopes !== null) {
        return mappingFromScopes
      }
    }
  }

  const { imports } = importMap;
  if (imports) {
    const mappingFromImports = applyMappings(
      imports,
      specifierNormalized,
      undefined,
      onImportMapping,
    );
    if (mappingFromImports !== null) {
      return mappingFromImports
    }
  }

  if (specifierUrl) {
    return specifierUrl
  }

  throw createBareSpecifierError({ specifier, importer })
};

const applyMappings = (
  mappings,
  specifierNormalized,
  scope,
  onImportMapping,
) => {
  const specifierCandidates = Object.keys(mappings);

  let i = 0;
  while (i < specifierCandidates.length) {
    const specifierCandidate = specifierCandidates[i];
    i++;
    if (specifierCandidate === specifierNormalized) {
      const address = mappings[specifierCandidate];
      onImportMapping({
        scope,
        from: specifierCandidate,
        to: address,
        before: specifierNormalized,
        after: address,
      });
      return address
    }
    if (specifierIsPrefixOf(specifierCandidate, specifierNormalized)) {
      const address = mappings[specifierCandidate];
      const afterSpecifier = specifierNormalized.slice(
        specifierCandidate.length,
      );
      const addressFinal = tryUrlResolution(afterSpecifier, address);
      onImportMapping({
        scope,
        from: specifierCandidate,
        to: address,
        before: specifierNormalized,
        after: addressFinal,
      });
      return addressFinal
    }
  }

  return null
};

const specifierIsPrefixOf = (specifierHref, href) => {
  return (
    specifierHref[specifierHref.length - 1] === "/" &&
    href.startsWith(specifierHref)
  )
};

const sortImports = (imports) => {
  const mappingsSorted = {};

  Object.keys(imports)
    .sort(compareLengthOrLocaleCompare)
    .forEach((name) => {
      mappingsSorted[name] = imports[name];
    });

  return mappingsSorted
};

const sortScopes = (scopes) => {
  const scopesSorted = {};

  Object.keys(scopes)
    .sort(compareLengthOrLocaleCompare)
    .forEach((scopeSpecifier) => {
      scopesSorted[scopeSpecifier] = sortImports(scopes[scopeSpecifier]);
    });

  return scopesSorted
};

const compareLengthOrLocaleCompare = (a, b) => {
  return b.length - a.length || a.localeCompare(b)
};

const normalizeImportMap = (importMap, baseUrl) => {
  assertImportMap(importMap);

  if (!isStringOrUrl(baseUrl)) {
    throw new TypeError(formulateBaseUrlMustBeStringOrUrl({ baseUrl }))
  }

  const { imports, scopes } = importMap;

  return {
    imports: imports ? normalizeMappings(imports, baseUrl) : undefined,
    scopes: scopes ? normalizeScopes(scopes, baseUrl) : undefined,
  }
};

const isStringOrUrl = (value) => {
  if (typeof value === "string") {
    return true
  }

  if (typeof URL === "function" && value instanceof URL) {
    return true
  }

  return false
};

const normalizeMappings = (mappings, baseUrl) => {
  const mappingsNormalized = {};

  Object.keys(mappings).forEach((specifier) => {
    const address = mappings[specifier];

    if (typeof address !== "string") {
      console.warn(
        formulateAddressMustBeAString({
          address,
          specifier,
        }),
      );
      return
    }

    const specifierResolved = resolveSpecifier(specifier, baseUrl) || specifier;

    const addressUrl = tryUrlResolution(address, baseUrl);
    if (addressUrl === null) {
      console.warn(
        formulateAdressResolutionFailed({
          address,
          baseUrl,
          specifier,
        }),
      );
      return
    }

    if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
      console.warn(
        formulateAddressUrlRequiresTrailingSlash({
          addressUrl,
          address,
          specifier,
        }),
      );
      return
    }
    mappingsNormalized[specifierResolved] = addressUrl;
  });

  return sortImports(mappingsNormalized)
};

const normalizeScopes = (scopes, baseUrl) => {
  const scopesNormalized = {};

  Object.keys(scopes).forEach((scopeSpecifier) => {
    const scopeMappings = scopes[scopeSpecifier];
    const scopeUrl = tryUrlResolution(scopeSpecifier, baseUrl);
    if (scopeUrl === null) {
      console.warn(
        formulateScopeResolutionFailed({
          scope: scopeSpecifier,
          baseUrl,
        }),
      );
      return
    }
    const scopeValueNormalized = normalizeMappings(scopeMappings, baseUrl);
    scopesNormalized[scopeUrl] = scopeValueNormalized;
  });

  return sortScopes(scopesNormalized)
};

const formulateBaseUrlMustBeStringOrUrl = ({
  baseUrl,
}) => `baseUrl must be a string or an url.
--- base url ---
${baseUrl}`;

const formulateAddressMustBeAString = ({
  specifier,
  address,
}) => `Address must be a string.
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateAdressResolutionFailed = ({
  address,
  baseUrl,
  specifier,
}) => `Address url resolution failed.
--- address ---
${address}
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const formulateAddressUrlRequiresTrailingSlash = ({
  addressURL,
  address,
  specifier,
}) => `Address must end with /.
--- address url ---
${addressURL}
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateScopeResolutionFailed = ({
  scope,
  baseUrl,
}) => `Scope url resolution failed.
--- scope ---
${scope}
--- base url ---
${baseUrl}`;

const pathnameToExtension = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }

  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return ""
  // if (dotLastIndex === pathname.length - 1) return ""
  return pathname.slice(dotLastIndex)
};

const resolveImport = ({
  specifier,
  importer,
  importMap,
  defaultExtension = false,
  createBareSpecifierError,
  onImportMapping = () => {},
}) => {
  let url;
  if (importMap) {
    url = applyImportMap({
      importMap,
      specifier,
      importer,
      createBareSpecifierError,
      onImportMapping,
    });
  } else {
    url = resolveUrl(specifier, importer);
  }

  if (defaultExtension) {
    url = applyDefaultExtension({ url, importer, defaultExtension });
  }

  return url
};

const applyDefaultExtension = ({ url, importer, defaultExtension }) => {
  if (urlToPathname(url).endsWith("/")) {
    return url
  }

  if (typeof defaultExtension === "string") {
    const extension = pathnameToExtension(url);
    if (extension === "") {
      return `${url}${defaultExtension}`
    }
    return url
  }

  if (defaultExtension === true) {
    const extension = pathnameToExtension(url);
    if (extension === "" && importer) {
      const importerPathname = urlToPathname(importer);
      const importerExtension = pathnameToExtension(importerPathname);
      return `${url}${importerExtension}`
    }
  }

  return url
};

const applyUrlResolution = (specifier, importer) => {
  const url = new URL(specifier, importer).href;
  return ensureWindowsDriveLetter(url, importer)
};

const readImportmap = ({
  logger,
  rootDirectoryUrl,
  importmapFileRelativeUrl,
}) => {
  if (typeof importmapFileRelativeUrl === "undefined") {
    return null
  }
  if (typeof importmapFileRelativeUrl !== "string") {
    throw new TypeError(
      `importmapFileRelativeUrl must be a string, got ${importmapFileRelativeUrl}`,
    )
  }
  const importmapFileUrl = applyUrlResolution(
    importmapFileRelativeUrl,
    rootDirectoryUrl,
  );
  if (!urlIsInsideOf(importmapFileUrl, rootDirectoryUrl)) {
    logger.warn(`import map file is outside root directory.
--- import map file ---
${urlToFileSystemPath(importmapFileUrl)}
--- root directory ---
${urlToFileSystemPath(rootDirectoryUrl)}`);
  }
  let importmapFileBuffer;
  try {
    importmapFileBuffer = readFileSync(importmapFileUrl);
  } catch (e) {
    if (e && e.code === "ENOENT") {
      logger.error(`importmap file not found at ${importmapFileUrl}`);
      return null
    }
    throw e
  }
  let importMap;
  try {
    const importmapFileString = String(importmapFileBuffer);
    importMap = JSON.parse(importmapFileString);
  } catch (e) {
    if (e && e.code === "SyntaxError") {
      logger.error(`syntax error in importmap file
--- error stack ---
${e.stack}
--- importmap file ---
${importmapFileUrl}`);
      return null
    }
    throw e
  }
  return normalizeImportMap(importMap, importmapFileUrl)
};

const applyImportmapResolution = (
  specifier,
  {
    logger,
    rootDirectoryUrl,
    importmapFileRelativeUrl,
    importDefaultExtension,
    importer,
  },
) => {
  const importmap = readImportmap({
    logger,
    rootDirectoryUrl,
    importmapFileRelativeUrl,
  });
  try {
    return resolveImport({
      specifier,
      importer,
      // by passing importMap to null resolveImport behaves
      // almost like new URL(specifier, importer)
      // we want to force the importmap resolution
      // so that bare specifiers are considered unhandled
      // even if there is no importmap file
      importMap: importmap || {},
      defaultExtension: importDefaultExtension,
    })
  } catch (e) {
    if (e.message.includes("bare specifier")) {
      logger.debug("unmapped bare specifier");
      return null
    }
    throw e
  }
};

// https://github.com/benmosher/eslint-plugin-import/blob/master/resolvers/node/index.js

const interfaceVersion = 2;

const resolve = (
  source,
  file,
  {
    logLevel,
    rootDirectoryUrl,
    packageConditions = ["browser", "import"],
    ambiguousExtensions = [".js", ".html", ".jsx", ".ts", ".tsx"],
    importmapFileRelativeUrl,
    caseSensitive = true,
    // NICE TO HAVE: allow more control on when magic resolution applies:
    // one might want to enable this for node_modules but not for project files
    magicDirectoryIndex = false,
    magicExtensions = false,
  },
) => {
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl);
  const logger = createLogger({ logLevel });
  logger.debug(`
resolve import.
--- specifier ---
${source}
--- importer ---
${file}
--- root directory path ---
${urlToFileSystemPath(rootDirectoryUrl)}`);

  packageConditions = [
    ...readCustomConditionsFromProcessArgs(),
    ...packageConditions,
  ];
  const browserInPackageConditions = packageConditions.includes("browser");
  const nodeInPackageConditions = packageConditions.includes("node");
  if (nodeInPackageConditions && isSpecifierForNodeBuiltin(source)) {
    logger.debug(`-> native node module`);
    return {
      found: true,
      path: null,
    }
  }

  const importer = String(fileSystemPathToUrl(file));
  const onUrl = (url) => {
    if (url.startsWith("file:")) {
      url = ensureWindowsDriveLetter(url, importer);
      return handleFileUrl(url, {
        logger,
        caseSensitive,
        magicDirectoryIndex,
        magicExtensions,
      })
    }
    if (url.startsWith("node:") && !nodeInPackageConditions) {
      logger.warn(
        `Warning: ${file} is using "node:" scheme but "node" is not in packageConditions (importing "${source}")`,
      );
    }
    logger.debug(`-> consider found because of scheme ${url}`);
    return handleRemainingUrl()
  };

  const specifier = source;
  try {
    if (
      browserInPackageConditions &&
      !nodeInPackageConditions &&
      specifier[0] === "/"
    ) {
      return onUrl(new URL(specifier.slice(1), rootDirectoryUrl).href)
    }

    // data:*, http://*, https://*, file://*
    if (isAbsoluteUrl(specifier)) {
      return onUrl(specifier)
    }
    if (importmapFileRelativeUrl) {
      const urlFromImportmap = applyImportmapResolution(specifier, {
        logger,
        rootDirectoryUrl,
        importmapFileRelativeUrl,
        importer,
      });
      if (urlFromImportmap) {
        return onUrl(urlFromImportmap)
      }
    }
    const moduleSystem = determineModuleSystem(importer, {
      ambiguousExtensions,
    });
    if (moduleSystem === "commonjs") {
      return onUrl(node_module.createRequire(importer).resolve(specifier))
    }
    if (moduleSystem === "module") {
      const nodeResolution = applyNodeEsmResolution({
        conditions: packageConditions,
        parentUrl: importer,
        specifier,
      });
      if (nodeResolution) {
        return onUrl(nodeResolution.url)
      }
    }
    if (moduleSystem === "url") {
      return onUrl(applyUrlResolution(specifier, importer))
    }
    throw new Error("not found")
  } catch (e) {
    logger.debug(`Error while resolving "${source}" imported from "${file}"
--- error stack ---
${e.stack}`);
    return {
      found: false,
      path: null,
    }
  }
};

const handleFileUrl = (
  fileUrl,
  { logger, magicDirectoryIndex, magicExtensions, caseSensitive },
) => {
  fileUrl = `file://${new URL(fileUrl).pathname}`; // remove query params from url
  const fileResolution = applyFileSystemMagicResolution(fileUrl, {
    magicDirectoryIndex,
    magicExtensions,
  });
  if (!fileResolution.found) {
    logger.debug(`-> file not found at ${fileUrl}`);
    return {
      found: false,
      path: urlToFileSystemPath(fileUrl),
    }
  }
  fileUrl = fileResolution.url;
  const realFileUrl = getRealFileSystemUrlSync(fileUrl, {
    // we don't follow link because we care only about the theoric file location
    // without this realFileUrl and fileUrl can be different
    // and we would log the warning about case sensitivity
    followLink: false,
  });
  const filePath = urlToFileSystemPath(fileUrl);
  const realFilePath = urlToFileSystemPath(realFileUrl);
  if (caseSensitive && realFileUrl !== fileUrl) {
    logger.warn(
      `WARNING: file found for ${filePath} but would not be found on a case sensitive filesystem.
The real file path is ${realFilePath}.
You can choose to disable this warning by disabling case sensitivity.
If you do so keep in mind windows users would not find that file.`,
    );
    return {
      found: false,
      path: realFilePath,
    }
  }
  logger.debug(`-> found file at ${realFilePath}`);
  return {
    found: true,
    path: realFilePath,
  }
};

const handleRemainingUrl = () => {
  return {
    found: true,
    path: null,
  }
};

const isAbsoluteUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true
  } catch (e) {
    return false
  }
};

exports.interfaceVersion = interfaceVersion;
exports.resolve = resolve;
