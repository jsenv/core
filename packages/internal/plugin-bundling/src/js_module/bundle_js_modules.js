import { URL_META } from "@jsenv/url-meta";
import { isFileSystemPath } from "@jsenv/urls";
import { createDetailedMessage } from "@jsenv/humanize";
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
    runtimeCompat,
    sourcemaps,
    isSupportedOnCurrentClients,
    getPluginMeta,
  } = jsModuleUrlInfos[0].context;
  const graph = jsModuleUrlInfos[0].graph;
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
  const willMinifyJsModule = Boolean(getPluginMeta("willMinifyJsModule"));
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
        compact: willMinifyJsModule,
        minifyInternalExports: willMinifyJsModule,
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
    jsModuleUrlInfo.filenameHint.endsWith(".cjs"),
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

  const getOriginalUrl = (rollupFileInfo) => {
    const { facadeModuleId } = rollupFileInfo;
    if (facadeModuleId) {
      return fileUrlConverter.asFileUrl(facadeModuleId);
    }
    if (rollupFileInfo.isDynamicEntry) {
      const { moduleIds } = rollupFileInfo;
      const lastModuleId = moduleIds[moduleIds.length - 1];
      return fileUrlConverter.asFileUrl(lastModuleId);
    }
    return new URL(rollupFileInfo.fileName, rootDirectoryUrl).href;
  };

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
        let preserveSignature;
        if (strictExports) {
          preserveSignature = "strict";
        } else {
          // When referenced only once we can enable allow-extension
          // otherwise stick to strict exports to ensure all importers
          // receive the correct exports
          let firstStrongRef = null;
          let hasMoreThanOneStrongRefFromOther = false;
          for (const referenceFromOther of jsModuleUrlInfo.referenceFromOthersSet) {
            if (referenceFromOther.isWeak) {
              continue;
            }
            if (firstStrongRef) {
              hasMoreThanOneStrongRefFromOther = true;
              break;
            }
            firstStrongRef = referenceFromOther;
          }
          preserveSignature = hasMoreThanOneStrongRefFromOther
            ? "strict"
            : "allow-extension";
        }
        emitChunk({
          id,
          implicitlyLoadedAfterOneOf: previousNonEntryPointModuleId
            ? [previousNonEntryPointModuleId]
            : null,
          preserveSignature,
        });
        previousNonEntryPointModuleId = id;
      });
    },
    async generateBundle(outputOptions, rollupResult) {
      _rollupEmitFile = (...args) => this.emitFile(...args);

      const createBundledFileInfo = (rollupFileInfo) => {
        const originalUrl = getOriginalUrl(rollupFileInfo);
        const sourceUrls = Object.keys(rollupFileInfo.modules).map((id) =>
          fileUrlConverter.asFileUrl(id),
        );

        const specifierToUrlMap = new Map();
        const { imports, dynamicImports } = rollupFileInfo;
        for (const importFileName of imports) {
          if (!importFileName.startsWith("file:")) {
            const importRollupFileInfo = rollupResult[importFileName];
            if (!importRollupFileInfo) {
              // happens for external import, like "ignore:" or anything marked as external
              specifierToUrlMap.set(importFileName, importFileName);
              continue;
            }
            const importUrl = getOriginalUrl(importRollupFileInfo);
            const rollupSpecifier = `./${importRollupFileInfo.fileName}`;
            specifierToUrlMap.set(rollupSpecifier, importUrl);
          }
        }
        for (const dynamicImportFileName of dynamicImports) {
          if (!dynamicImportFileName.startsWith("file:")) {
            const dynamicImportRollupFileInfo =
              rollupResult[dynamicImportFileName];
            if (!dynamicImportRollupFileInfo) {
              // happens for external import, like "ignore:" or anything marked as external
              specifierToUrlMap.set(
                dynamicImportFileName,
                dynamicImportFileName,
              );
              continue;
            }
            const dynamicImportUrl = getOriginalUrl(
              dynamicImportRollupFileInfo,
            );
            const rollupSpecifier = `./${dynamicImportRollupFileInfo.fileName}`;
            specifierToUrlMap.set(rollupSpecifier, dynamicImportUrl);
          }
        }

        const generatedToShareCode =
          !rollupFileInfo.isEntry &&
          !rollupFileInfo.isDynamicEntry &&
          !rollupFileInfo.isImplicitEntry;

        return {
          originalUrl,
          type: format === "esm" ? "js_module" : "common_js",
          data: {
            bundlerName: "rollup",
            bundleRelativeUrl: rollupFileInfo.fileName,
            usesImport:
              rollupFileInfo.imports.length > 0 ||
              rollupFileInfo.dynamicImports.length > 0,
            isDynamicEntry: rollupFileInfo.isDynamicEntry,
            generatedToShareCode,
          },
          sourceUrls,
          contentType: "text/javascript",
          content: rollupFileInfo.code,
          sourcemap: rollupFileInfo.map,
          // rollup is generating things like "./file.js"
          // that must be converted back to urls for jsenv
          remapReference:
            specifierToUrlMap.size > 0
              ? (reference) => {
                  // rollup generate specifiers only for static and dynamic imports
                  // other references (like new URL()) are ignored
                  // there is no need to remap them back
                  if (
                    reference.type === "js_import" &&
                    reference.subtype !== "import_meta_resolve"
                  ) {
                    return specifierToUrlMap.get(reference.specifier);
                  }
                  return reference.specifier;
                }
              : undefined,
        };
      };

      const jsModuleBundleUrlInfos = {};
      const fileNames = Object.keys(rollupResult);
      for (const fileName of fileNames) {
        const rollupFileInfo = rollupResult[fileName];
        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (rollupFileInfo.type === "chunk") {
          const jsModuleInfo = createBundledFileInfo(rollupFileInfo);
          jsModuleBundleUrlInfos[jsModuleInfo.originalUrl] = jsModuleInfo;
        }
      }

      resultRef.current = {
        jsModuleBundleUrlInfos,
      };
    },
    outputOptions: (outputOptions) => {
      // const sourcemapFile = buildDirectoryUrl
      Object.assign(outputOptions, {
        format,
        dir: fileUrlConverter.asFilePath(rootDirectoryUrl),
        sourcemap: sourcemaps === "file" || sourcemaps === "inline",
        // sourcemapFile,
        sourcemapPathTransform: (relativePath) => {
          return new URL(relativePath, rootDirectoryUrl).href;
        },
        entryFileNames: () => {
          return `[name].js`;
        },
        chunkFileNames: (chunkInfo) => {
          return `${chunkInfo.name}.js`;
        },
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
  const rollupReturnValue = await rollup({
    ...rollupInput,
    plugins: rollupPlugins,
  });
  const rollupOutputArray = await rollupReturnValue.generate(rollupOutput);
  return rollupOutputArray;
};
