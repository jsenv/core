import { URL_META } from "@jsenv/url-meta";
import { isFileSystemPath } from "@jsenv/urls";
import { createDetailedMessage } from "@jsenv/log";
import { sourcemapConverter } from "@jsenv/sourcemap";

import { fileUrlConverter } from "../file_url_converter.js";

export const bundleJsModules = async (
  jsModuleUrlInfos,
  {
    buildDirectoryUrl,
    include,
    chunks = {},
    strictExports = false,
    preserveDynamicImport = false,
    augmentDynamicImportUrlSearchParams = () => {},
    rollup,
    rollupInput = {},
    rollupOutput = {},
    rollupPlugins = [],
  },
) => {
  const {
    signal,
    logger,
    rootDirectoryUrl,
    assetsDirectory,
    graph,
    runtimeCompat,
    sourcemaps,
    minification,
    isSupportedOnCurrentClients,
  } = jsModuleUrlInfos[0].context;
  if (buildDirectoryUrl === undefined) {
    buildDirectoryUrl = jsModuleUrlInfos[0].context.buildDirectoryUrl;
  }

  let manualChunks;
  if (Object.keys(chunks).length) {
    const associations = URL_META.resolveAssociations(chunks, rootDirectoryUrl);
    manualChunks = (id) => {
      if (rollupOutput.manualChunks) {
        const manualChunkName = rollupOutput.manualChunks(id);
        if (manualChunkName) {
          return manualChunkName;
        }
      }
      const url = fileUrlConverter.asFileUrl(id);
      const urlObject = new URL(url);
      urlObject.search = "";
      const urlWithoutSearch = urlObject.href;
      const meta = URL_META.applyAssociations({
        url: urlWithoutSearch,
        associations,
      });
      const chunkName = Object.keys(meta).find((key) => meta[key]);
      return chunkName || null;
    };
  }

  const resultRef = { current: null };
  try {
    await applyRollupPlugins({
      rollup,
      rollupPlugins: [
        ...rollupPlugins,
        rollupPluginJsenv({
          signal,
          logger,
          rootDirectoryUrl,
          buildDirectoryUrl,
          assetsDirectory,
          graph,
          jsModuleUrlInfos,

          runtimeCompat,
          sourcemaps,
          include,
          preserveDynamicImport,
          augmentDynamicImportUrlSearchParams,
          strictExports,
          resultRef,
        }),
      ],
      rollupInput: {
        input: [],
        onwarn: (warning) => {
          if (warning.code === "CIRCULAR_DEPENDENCY") {
            return;
          }
          if (warning.code === "EVAL") {
            // ideally we should disable only for jsenv files
            return;
          }
          logger.warn(String(warning));
        },
        ...rollupInput,
      },
      rollupOutput: {
        compact: minification,
        minifyInternalExports: minification,
        generatedCode: {
          arrowFunctions: isSupportedOnCurrentClients("arrow_function"),
          constBindings: isSupportedOnCurrentClients("const_bindings"),
          objectShorthand: isSupportedOnCurrentClients(
            "object_properties_shorthand",
          ),
          reservedNamesAsProps: isSupportedOnCurrentClients("reserved_words"),
          symbols: isSupportedOnCurrentClients("symbols"),
        },
        ...rollupOutput,
        manualChunks,
      },
    });
    return resultRef.current.jsModuleBundleUrlInfos;
  } catch (e) {
    if (e.code === "MISSING_EXPORT") {
      const detailedMessage = createDetailedMessage(e.message, {
        frame: e.frame,
      });
      throw new Error(detailedMessage, { cause: e });
    }
    throw e;
  }
};

const rollupPluginJsenv = ({
  // logger,
  rootDirectoryUrl,
  buildDirectoryUrl,
  assetsDirectory,
  graph,
  jsModuleUrlInfos,
  sourcemaps,

  include,
  preserveDynamicImport,
  augmentDynamicImportUrlSearchParams,
  strictExports,

  resultRef,
}) => {
  let _rollupEmitFile = () => {
    throw new Error("not implemented");
  };
  const format = jsModuleUrlInfos.some((jsModuleUrlInfo) =>
    jsModuleUrlInfo.filename.endsWith(".cjs"),
  )
    ? "cjs"
    : "esm";
  const emitChunk = (chunk) => {
    return _rollupEmitFile({
      type: "chunk",
      ...chunk,
    });
  };
  let importCanBeBundled = () => true;
  if (include) {
    const associations = URL_META.resolveAssociations(
      { bundle: include },
      rootDirectoryUrl,
    );
    importCanBeBundled = (url) => {
      return URL_META.applyAssociations({ url, associations }).bundle;
    };
  }
  const urlImporters = {};

  return {
    name: "jsenv",
    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args);
      let previousNonEntryPointModuleId;
      jsModuleUrlInfos.forEach((jsModuleUrlInfo) => {
        const id = jsModuleUrlInfo.url;
        if (jsModuleUrlInfo.isEntryPoint) {
          emitChunk({
            id,
          });
          return;
        }
        emitChunk({
          id,
          implicitlyLoadedAfterOneOf: previousNonEntryPointModuleId
            ? [previousNonEntryPointModuleId]
            : null,
          preserveSignature: strictExports
            ? "strict"
            : jsModuleUrlInfo.referenceFromOthersSet.size < 2
            ? "allow-extension"
            : "strict",
        });
        previousNonEntryPointModuleId = id;
      });
    },
    async generateBundle(outputOptions, rollupResult) {
      _rollupEmitFile = (...args) => this.emitFile(...args);

      const jsModuleBundleUrlInfos = {};
      Object.keys(rollupResult).forEach((fileName) => {
        const rollupFileInfo = rollupResult[fileName];
        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (rollupFileInfo.type === "chunk") {
          const sourceUrls = Object.keys(rollupFileInfo.modules).map((id) =>
            fileUrlConverter.asFileUrl(id),
          );

          let url;
          let originalUrl;
          if (rollupFileInfo.facadeModuleId) {
            url = fileUrlConverter.asFileUrl(rollupFileInfo.facadeModuleId);
            originalUrl = url;
          } else {
            url = new URL(rollupFileInfo.fileName, buildDirectoryUrl).href;
            if (rollupFileInfo.isDynamicEntry) {
              originalUrl = sourceUrls[sourceUrls.length - 1];
            } else {
              originalUrl = url;
            }
          }

          const jsModuleBundleUrlInfo = {
            url,
            originalUrl,
            type: format === "esm" ? "js_module" : "common_js",
            data: {
              bundlerName: "rollup",
              bundleRelativeUrl: rollupFileInfo.fileName,
              usesImport:
                rollupFileInfo.imports.length > 0 ||
                rollupFileInfo.dynamicImports.length > 0,
              isDynamicEntry: rollupFileInfo.isDynamicEntry,
            },
            sourceUrls,
            contentType: "text/javascript",
            content: rollupFileInfo.code,
            sourcemap: rollupFileInfo.map,
          };
          jsModuleBundleUrlInfos[url] = jsModuleBundleUrlInfo;
        }
      });
      resultRef.current = {
        jsModuleBundleUrlInfos,
      };
    },
    outputOptions: (outputOptions) => {
      // const sourcemapFile = buildDirectoryUrl
      Object.assign(outputOptions, {
        format,
        dir: fileUrlConverter.asFilePath(buildDirectoryUrl),
        sourcemap: sourcemaps === "file" || sourcemaps === "inline",
        // sourcemapFile,
        sourcemapPathTransform: (relativePath) => {
          return new URL(relativePath, buildDirectoryUrl).href;
        },
        entryFileNames: () => {
          return `[name].js`;
        },
        chunkFileNames: (chunkInfo) => {
          const insideJs = willBeInsideJsDirectory({
            chunkInfo,
            fileUrlConverter,
            jsModuleUrlInfos,
          });
          let nameFromUrlInfo;
          if (chunkInfo.facadeModuleId) {
            const url = fileUrlConverter.asFileUrl(chunkInfo.facadeModuleId);
            const urlInfo = jsModuleUrlInfos.find(
              (jsModuleUrlInfo) => jsModuleUrlInfo.url === url,
            );
            if (urlInfo) {
              nameFromUrlInfo = urlInfo.filename;
            }
          }
          const name = nameFromUrlInfo || `${chunkInfo.name}.js`;
          return insideJs ? `${assetsDirectory}js/${name}` : `${name}`;
        },
        // https://rollupjs.org/guide/en/#outputpaths
        // paths: (id) => {
        //   return id
        // },
      });
    },
    // https://rollupjs.org/guide/en/#resolvedynamicimport
    resolveDynamicImport: (specifier, importer) => {
      if (preserveDynamicImport) {
        let urlObject;
        if (specifier[0] === "/") {
          urlObject = new URL(specifier.slice(1), rootDirectoryUrl);
        } else {
          if (isFileSystemPath(importer)) {
            importer = fileUrlConverter.asFileUrl(importer);
          }
          urlObject = new URL(specifier, importer);
        }
        const searchParamsToAdd =
          augmentDynamicImportUrlSearchParams(urlObject);
        if (searchParamsToAdd) {
          Object.keys(searchParamsToAdd).forEach((key) => {
            const value = searchParamsToAdd[key];
            if (value === undefined) {
              urlObject.searchParams.delete(key);
            } else {
              urlObject.searchParams.set(key, value);
            }
          });
        }
        return { external: true, id: urlObject.href };
      }
      return null;
    },
    resolveId: (specifier, importer = rootDirectoryUrl) => {
      if (isFileSystemPath(importer)) {
        importer = fileUrlConverter.asFileUrl(importer);
      }
      let url;
      if (specifier[0] === "/") {
        url = new URL(specifier.slice(1), rootDirectoryUrl).href;
      } else {
        url = new URL(specifier, importer).href;
      }
      const existingImporter = urlImporters[url];
      if (!existingImporter) {
        urlImporters[url] = importer;
      }
      if (!url.startsWith("file:")) {
        return { id: url, external: true };
      }
      if (!importCanBeBundled(url)) {
        return { id: url, external: true };
      }
      const urlInfo = graph.getUrlInfo(url);
      if (!urlInfo) {
        // happen when excluded by referenceAnalysis.include
        return { id: url, external: true };
      }
      if (urlInfo.url.startsWith("ignore:")) {
        return { id: url, external: true };
      }
      const filePath = fileUrlConverter.asFilePath(url);
      return filePath;
    },
    async load(rollupId) {
      const fileUrl = fileUrlConverter.asFileUrl(rollupId);
      const urlInfo = graph.getUrlInfo(fileUrl);
      return {
        code: urlInfo.content,
        map:
          (sourcemaps === "file" || sourcemaps === "inline") &&
          urlInfo.sourcemap
            ? sourcemapConverter.toFilePaths(urlInfo.sourcemap)
            : null,
      };
    },
  };
};

const applyRollupPlugins = async ({
  rollup,
  rollupPlugins,
  rollupInput,
  rollupOutput,
}) => {
  if (!rollup) {
    const rollupModule = await import("rollup");
    rollup = rollupModule.rollup;
  }
  const { importAssertions } = await import("acorn-import-assertions");
  const rollupReturnValue = await rollup({
    ...rollupInput,
    plugins: rollupPlugins,
    acornInjectPlugins: [
      importAssertions,
      ...(rollupInput.acornInjectPlugins || []),
    ],
  });
  const rollupOutputArray = await rollupReturnValue.generate(rollupOutput);
  return rollupOutputArray;
};

const willBeInsideJsDirectory = ({
  chunkInfo,
  fileUrlConverter,
  jsModuleUrlInfos,
}) => {
  // if the chunk is generated dynamically by rollup
  // for an entry point jsenv will put that file inside js/ directory
  // if it's generated dynamically for a file already in js/ directory
  // both will be inside the js/ directory
  if (!chunkInfo.facadeModuleId) {
    // generated by rollup
    return true;
  }
  const url = fileUrlConverter.asFileUrl(chunkInfo.facadeModuleId);
  const jsModuleUrlInfo = jsModuleUrlInfos.find(
    (jsModuleUrlInfo) => jsModuleUrlInfo.url === url,
  );
  if (!jsModuleUrlInfo) {
    // generated by rollup
    return true;
  }
  if (!jsModuleUrlInfo.isEntryPoint) {
    // not an entry point, jsenv will put it inside js/ directory
    return true;
  }
  return false;
};
