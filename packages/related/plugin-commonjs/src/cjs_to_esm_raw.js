import { fileURLToPath } from "node:url";
import { createLogger } from "@jsenv/humanize";

import { rollupPluginCommonJsNamedExports } from "./rollup_plugin_commonjs_named_exports.js";

export const commonJsToJsModuleRaw = async ({
  logLevel,
  sourceFileUrl,

  browsers = true,
  replaceGlobalObject = browsers,
  replaceGlobalFilename = browsers,
  replaceGlobalDirname = browsers,
  replaceProcessEnvNodeEnv = browsers,
  replaceProcess = browsers,
  replaceBuffer = browsers,
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceMap = {},
  convertBuiltinsToBrowser = browsers,
  external = [],
  sourcemapExcludeSources,
} = {}) => {
  const logger = createLogger({ logLevel });
  if (!sourceFileUrl.startsWith("file:///")) {
    // it's possible to make rollup compatible with http:// for instance
    // however it's an exotic use case for now
    throw new Error(
      `compatible only with file:// protocol, got ${sourceFileUrl}`,
    );
  }
  const sourceFilePath = fileURLToPath(sourceFileUrl);

  const { nodeResolve } = await import("@rollup/plugin-node-resolve");
  const nodeResolveRollupPlugin = nodeResolve({
    mainFields: browsers
      ? [
          "browser:module",
          "module",
          "browser",
          "main:esnext",
          "jsnext:main",
          "main",
        ]
      : ["module", "main:esnext", "jsxnext:main", "main"],
    extensions: [".mjs", ".cjs", ".js", ".json"],
    preferBuiltins: false,
    exportConditions: [],
  });

  const { default: createJSONRollupPlugin } = await import(
    "@rollup/plugin-json"
  );
  const jsonRollupPlugin = createJSONRollupPlugin({
    preferConst: true,
    indent: "  ",
    compact: false,
    namedExports: true,
  });

  const { default: createReplaceRollupPlugin } = await import(
    "@rollup/plugin-replace"
  );
  const replaceRollupPlugin = createReplaceRollupPlugin({
    preventAssignment: true,
    values: {
      ...(replaceProcessEnvNodeEnv
        ? { "process.env.NODE_ENV": JSON.stringify(processEnvNodeEnv) }
        : {}),
      ...(replaceGlobalObject ? { global: "globalThis" } : {}),
      ...(replaceGlobalFilename ? { __filename: __filenameReplacement } : {}),
      ...(replaceGlobalDirname ? { __dirname: __dirnameReplacement } : {}),
      ...replaceMap,
    },
  });

  const { default: commonjs } = await import("@rollup/plugin-commonjs");
  // https://github.com/rollup/plugins/tree/master/packages/commonjs
  const commonJsRollupPlugin = commonjs({
    extensions: [".js", ".cjs"],
    // esmExternals: true,
    // defaultIsModuleExports: true,
    // requireReturnsDefault: "namespace",
    requireReturnsDefault: "auto",
  });

  const { default: createNodeGlobalRollupPlugin } = await import(
    "rollup-plugin-node-globals"
  );

  const commonJsNamedExportsRollupPlugin = rollupPluginCommonJsNamedExports({
    logger,
  });
  const { default: rollupPluginNodePolyfills } = await import(
    "rollup-plugin-polyfill-node"
  );

  const { rollup } = await import("rollup");
  const rollupBuild = await rollup({
    input: sourceFilePath,
    external,
    plugins: [
      nodeResolveRollupPlugin,
      jsonRollupPlugin,
      replaceRollupPlugin,
      commonJsRollupPlugin,
      commonJsNamedExportsRollupPlugin,
      ...(replaceProcess || replaceBuffer
        ? [
            createNodeGlobalRollupPlugin({
              global: false, // handled by replaceMap
              dirname: false, // handled by replaceMap
              filename: false, // handled by replaceMap
              process: replaceProcess,
              buffer: replaceBuffer,
            }),
          ]
        : []),
      ...(convertBuiltinsToBrowser
        ? [
            rollupPluginNodePolyfills({
              include: null,
            }),
          ]
        : []),
    ],
    onwarn: (warning) => {
      if (
        warning.code === "UNRESOLVED_IMPORT" &&
        warning.id.endsWith("?commonjs-external")
      ) {
        return;
      }

      const { loc, message } = warning;
      const logMessage = loc
        ? `${loc.file}:${loc.line}:${loc.column} ${message}`
        : message;

      // These warnings are usually harmless in packages, so don't show them by default
      if (
        warning.code === "CIRCULAR_DEPENDENCY" ||
        warning.code === "NAMESPACE_CONFLICT" ||
        warning.code === "THIS_IS_UNDEFINED" ||
        warning.code === "EMPTY_BUNDLE" ||
        warning.code === "UNUSED_EXTERNAL_IMPORT"
      ) {
        logger.debug(logMessage);
      } else {
        logger.warn(logMessage);
      }
    },
  });
  const abstractDirUrl = new URL("./dist/", sourceFileUrl); // to help rollup generate property sourcemap paths
  const generateOptions = {
    inlineDynamicImports: true,
    // https://rollupjs.org/guide/en#output-format
    format: "esm",
    // entryFileNames: `./[name].js`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources,
    exports: "named",
    dir: fileURLToPath(abstractDirUrl),
    sourcemapPathTransform: (relativePath) => {
      const sourceUrl = new URL(relativePath, abstractDirUrl).href;
      return sourceUrl;
    },
  };

  const { output } = await rollupBuild.generate(generateOptions);
  const { code, map } = output[0];
  return {
    content: code,
    sourcemap: map,
  };
};

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`;

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`;
