// https://github.com/snowpackjs/snowpack/blob/main/esinstall/src/rollup-plugins/rollup-plugin-wrap-install-targets.ts

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { Worker } from "node:worker_threads";
import resolve from "resolve";
import isValidIdentifier from "is-valid-identifier";
import { init, parse } from "cjs-module-lexer";

const importWrapper = {
  wrap: (specifier) => {
    return `cjs_scan:${specifier}`;
  },
  unwrap: (specifier) => {
    return specifier.slice("cjs_scan:".length);
  },
  isWrapped: (specifier) => {
    return specifier.startsWith("cjs_scan:");
  },
};

export const rollupPluginCommonJsNamedExports = ({ logger }) => {
  const scanResults = {};

  return {
    name: "scan_cjs_named_exports",
    async buildStart({ input }) {
      await init();
      await Promise.all(
        Object.keys(input).map(async (key) => {
          const inputFilePath = input[key];
          let namedCjs = detectStaticExports({
            logger,
            filePath: inputFilePath,
          });
          if (!namedCjs) {
            namedCjs = await detectExportsUsingSandboxedRuntime({
              logger,
              filePath: inputFilePath,
            });
          }
          scanResults[inputFilePath] = {
            all: true,
            default: true,
            namespace: true,
            named: [],
            namedCjs,
          };
          input[key] = importWrapper.wrap(inputFilePath);
        }),
      );
    },
    resolveId(specifier) {
      if (importWrapper.isWrapped(specifier)) {
        return specifier;
      }
      return null;
    },
    load(id) {
      if (!importWrapper.isWrapped(id)) {
        return null;
      }
      const inputFilePath = importWrapper.unwrap(id);
      const scanResult = scanResults[inputFilePath];
      let uniqueNamedExports = scanResult.named;
      const namedCjs = scanResult.namedCjs;
      if (namedCjs.length) {
        uniqueNamedExports = namedCjs;
        scanResult.default = true;
      }
      const codeForExports = generateCodeForExports({
        uniqueNamedExports,
        scanResult,
        inputFilePath,
      });
      return codeForExports;
    },
  };
};

/*
 * Attempt #1: Static analysis: Lower Fidelity, but faster.
 * Do our best job to statically scan a file for named exports. This uses "cjs-module-lexer", the
 * same CJS export scanner that Node.js uses internally. Very fast, but only works on some modules,
 * depending on how they were build/written/compiled.
 */
const detectStaticExports = ({ logger, filePath, visited = new Set() }) => {
  const isMainEntrypoint = visited.size === 0;
  // Prevent infinite loops via circular dependencies.
  if (visited.has(filePath)) {
    return [];
  }
  visited.add(filePath);

  const fileContents = readFileSync(filePath, "utf8");
  try {
    const { exports, reexports } = parse(fileContents);
    // If re-exports were detected (`exports.foo = require(...)`) then resolve them here.
    let resolvedReexports = [];
    if (reexports.length > 0) {
      reexports.forEach((reexport) => {
        const reExportedFilePath = resolve.sync(reexport, {
          basedir: fileURLToPath(new URL("./", pathToFileURL(filePath))),
        });
        const staticExports = detectStaticExports({
          logger,
          filePath: reExportedFilePath,
          visited,
        });
        if (staticExports) {
          resolvedReexports = [...resolvedReexports, ...staticExports];
        }
      });
    }
    const resolvedExports = Array.from(
      new Set([...exports, ...resolvedReexports]),
    ).filter(isValidNamedExport);

    if (isMainEntrypoint && resolvedExports.length === 0) {
      return [];
    }

    return resolvedExports;
  } catch (err) {
    // Safe to ignore, this is usually due to the file not being CJS.
    logger.debug(`detectStaticExports ${filePath}: ${err.message}`);
    return [];
  }
};

/*
 * Attempt #2b - Sandboxed runtime analysis: More powerful, but slower.
 * This will only work on UMD and very simple CJS files (require not supported).
 * run safely sandbox untrusted code (no access no Node.js primitives, just JS).
 * If nothing was detected, return undefined.
 */
export const detectExportsUsingSandboxedRuntime = async ({
  logger,
  filePath,
}) => {
  try {
    const workerThread = new Worker(
      new URL("./worker_runtime.mjs", import.meta.url),
    );
    workerThread.postMessage({
      filePath,
    });
    const promise = new Promise((resolve, reject) => {
      workerThread.on("error", reject);
      workerThread.on("message", (message) => {
        resolve(message);
        workerThread.terminate();
      });
    });
    const result = await promise;
    if (result.errorMessage) {
      throw new Error(result.errorMessage);
    }
    const exportNames = result.exportNames;
    logger.debug(
      `detectExportsUsingSandboxedRuntime success ${filePath}: ${exportNames}`,
    );
    return exportNames.filter((identifier) => isValidIdentifier(identifier));
  } catch (err) {
    logger.debug(
      `detectExportsUsingSandboxedRuntime error ${filePath}: ${err.message}`,
    );
    return [];
  }
};

const isValidNamedExport = (name) =>
  name !== "default" && name !== "__esModule" && isValidIdentifier(name);

const generateCodeForExports = ({
  uniqueNamedExports,
  scanResult,
  inputFilePath,
}) => {
  const from = inputFilePath.split(path.win32.sep).join(path.posix.sep);
  const lines = [
    ...(scanResult.namespace ? [stringifyNamespaceReExport({ from })] : []),
    ...(scanResult.default ? [stringifyDefaultReExport({ from })] : []),
    ...(uniqueNamedExports.length
      ? [stringifyNamedReExports({ namedExports: uniqueNamedExports, from })]
      : []),
  ];
  return lines.join(`
`);
};

const stringifyNamespaceReExport = ({ from }) => {
  return `export * from "${from}";`;
};

const stringifyDefaultReExport = ({ from }) => {
  return `import __jsenv_default_import__ from "${from}";
export default __jsenv_default_import__;`;
};

const stringifyNamedReExports = ({ namedExports, from }) => {
  return `export { ${namedExports.join(",")} } from "${from}";`;
};
