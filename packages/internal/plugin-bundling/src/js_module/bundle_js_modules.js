import { lookupPackageDirectory, readPackageAtOrNull } from "@jsenv/filesystem";
import { createDetailedMessage } from "@jsenv/humanize";
import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";
import { isSpecifierForNodeBuiltin } from "@jsenv/node-esm-resolution/src/node_builtin_specifiers.js";
import { sourcemapConverter } from "@jsenv/sourcemap";
import { URL_META } from "@jsenv/url-meta";
import {
  injectQueryParams,
  isFileSystemPath,
  urlToBasename,
} from "@jsenv/urls";
import { readFileSync } from "node:fs";
import { fileUrlConverter } from "../file_url_converter.js";

export const bundleJsModules = async (
  jsModuleUrlInfos,
  {
    buildDirectoryUrl,
    include,
    chunks = {},
    strictExports = false,
    isolateDynamicImports = undefined,
    preserveDynamicImports = false,
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
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
  if (isolateDynamicImports === undefined && nodeRuntimeEnabled) {
    isolateDynamicImports = true;
  }

  const PATH_AND_URL_CONVERTER = {
    asFileUrl: fileUrlConverter.asFileUrl,
    asFilePath: fileUrlConverter.asFilePath,
  };

  if (isolateDynamicImports) {
    PATH_AND_URL_CONVERTER.asFileUrl = (path, stripDynamicImportId) => {
      const fileUrl = fileUrlConverter.asFileUrl(path);
      if (!stripDynamicImportId) {
        return fileUrl;
      }
      if (!fileUrl.includes("dynamic_import_id")) {
        return fileUrl;
      }
      return injectQueryParams(fileUrl, {
        dynamic_import_id: undefined,
      });
    };
  }

  const generateBundleWithRollup = async () => {
    let manualChunks;
    if (chunks) {
      let workspaces;
      let packageName;
      const packageDirectoryUrl = lookupPackageDirectory(rootDirectoryUrl);
      if (packageDirectoryUrl) {
        const packageJSON = readPackageAtOrNull(packageDirectoryUrl);
        if (packageJSON) {
          packageName = packageJSON.name;
          workspaces = packageJSON.workspaces;
        }
      }
      let nodeModuleChunkName = "node_modules";
      let packagesChunkName = "packages";

      if (packageName) {
        let packageNameAsFilename = packageName
          .replaceAll("@", "")
          .replaceAll("-", "_")
          .replaceAll("/", "_");
        nodeModuleChunkName = `${packageNameAsFilename}_node_modules`;
        packagesChunkName = `${packageNameAsFilename}_packages`;
      }
      chunks[nodeModuleChunkName] = {
        "file:///**/node_modules/": true,
        ...chunks.vendors,
      };
      if (workspaces) {
        const workspacePatterns = {};
        for (const workspace of workspaces) {
          const workspacePattern = new URL(
            workspace.endsWith("/*") ? workspace.slice(0, -1) : workspace,
            packageDirectoryUrl,
          ).href;
          workspacePatterns[workspacePattern] = true;
        }
        chunks[packagesChunkName] = {
          ...workspacePatterns,
          ...chunks.workspaces,
        };
      }

      const associations = URL_META.resolveAssociations(
        chunks,
        rootDirectoryUrl,
      );
      manualChunks = (id, manualChunksApi) => {
        if (rollupOutput.manualChunks) {
          const manualChunkName = rollupOutput.manualChunks(
            id,
            manualChunksApi,
          );
          if (manualChunkName) {
            return manualChunkName;
          }
        }
        const moduleInfo = manualChunksApi.getModuleInfo(id);
        if (moduleInfo.isEntry || moduleInfo.dynamicImporters.length) {
          return null;
        }
        const url = PATH_AND_URL_CONVERTER.asFileUrl(id);
        const urlObject = new URL(url);
        urlObject.search = "";
        const urlWithoutSearch = urlObject.href;
        const meta = URL_META.applyAssociations({
          url: urlWithoutSearch,
          associations,
        });
        for (const chunkNameCandidate of Object.keys(meta)) {
          if (meta[chunkNameCandidate]) {
            return chunkNameCandidate;
          }
        }
        return undefined;
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
            PATH_AND_URL_CONVERTER,

            runtimeCompat,
            sourcemaps,
            include,
            preserveDynamicImports,
            augmentDynamicImportUrlSearchParams,
            isolateDynamicImports,
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
            if (
              warning.code === "INVALID_ANNOTATION" &&
              warning.loc.file.includes("/node_modules/")
            ) {
              return;
            }
            if (
              warning.code === "EMPTY_BUNDLE" &&
              (warning.names.join("").endsWith("node_modules") ||
                warning.names.join("").endsWith("packages"))
            ) {
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

  const jsModuleBundleUrlInfos = await generateBundleWithRollup();
  return jsModuleBundleUrlInfos;
};

const rollupPluginJsenv = ({
  // logger,
  rootDirectoryUrl,
  buildDirectoryUrl,
  graph,
  jsModuleUrlInfos,
  PATH_AND_URL_CONVERTER,

  runtimeCompat,
  sourcemaps,
  include,
  preserveDynamicImports,
  isolateDynamicImports,
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

  const getOriginalUrl = (rollupFileInfo, stripDynamicImportId) => {
    if (
      // - explicitely emitted by emitChunk
      // - import.meta.resolve("")
      rollupFileInfo.isEntry ||
      // - new URL("", import.meta.url)
      rollupFileInfo.isImplicitEntry
    ) {
      const { facadeModuleId } = rollupFileInfo;
      if (facadeModuleId) {
        return PATH_AND_URL_CONVERTER.asFileUrl(
          facadeModuleId,
          stripDynamicImportId,
        );
      }
    }
    if (rollupFileInfo.isDynamicEntry) {
      const { moduleIds } = rollupFileInfo;
      const lastModuleId = moduleIds[moduleIds.length - 1];
      return PATH_AND_URL_CONVERTER.asFileUrl(
        lastModuleId,
        stripDynamicImportId,
      );
    }
    return new URL(rollupFileInfo.fileName, buildDirectoryUrl).href;
  };

  const packageSideEffectsCacheMap = new Map();
  const readClosestPackageJsonSideEffects = (url) => {
    const packageDirectoryUrl = lookupPackageDirectory(url);
    if (!packageDirectoryUrl) {
      return undefined;
    }
    const fromCache = packageSideEffectsCacheMap.get(packageDirectoryUrl);
    if (fromCache) {
      return fromCache.value;
    }
    try {
      const packageFileContent = readFileSync(
        new URL("./package.json", packageDirectoryUrl),
        "utf8",
      );
      const packageJSON = JSON.parse(packageFileContent);
      const value = packageJSON.sideEffects;
      if (Array.isArray(value)) {
        const sideEffectPatterns = {};
        for (const v of value) {
          sideEffectPatterns[v] = true;
        }
        const associations = URL_META.resolveAssociations(
          { sideEffects: sideEffectPatterns },
          packageDirectoryUrl,
        );
        const isMatching = (url) => {
          const meta = URL_META.applyAssociations({ url, associations });
          return meta.sideEffects || false;
        };
        packageSideEffectsCacheMap.set(packageDirectoryUrl, {
          value: isMatching,
        });
      } else {
        packageSideEffectsCacheMap.set(packageDirectoryUrl, { value });
      }
      return value;
    } catch {
      packageSideEffectsCacheMap.set(packageDirectoryUrl, { value: undefined });
      return undefined;
    }
  };
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
  const packageConditions = [nodeRuntimeEnabled ? "node" : "browser", "import"];
  const inferSideEffectsFromResolvedUrl = (url) => {
    if (url.startsWith("ignore:")) {
      // console.log(`may have side effect: ${url}`);
      // double ignore we must keep the import
      return null;
    }
    if (isSpecifierForNodeBuiltin(url)) {
      return false;
    }
    const closestPackageJsonSideEffects =
      readClosestPackageJsonSideEffects(url);
    if (closestPackageJsonSideEffects === undefined) {
      // console.log(`may have side effect: ${url}`);
      return null;
    }
    if (typeof closestPackageJsonSideEffects === "function") {
      const haveSideEffect = closestPackageJsonSideEffects(url);
      // if (haveSideEffect) {
      //   console.log(`have side effect: ${url}`);
      // }
      return haveSideEffect;
    }
    return closestPackageJsonSideEffects;
  };
  const getModuleSideEffects = (url, importer) => {
    if (!url.startsWith("ignore:")) {
      return inferSideEffectsFromResolvedUrl(url);
    }
    url = url.slice("ignore:".length);
    if (url.startsWith("file:")) {
      return inferSideEffectsFromResolvedUrl(url);
    }
    try {
      const result = applyNodeEsmResolution({
        conditions: packageConditions,
        parentUrl: importer,
        specifier: url,
      });
      return inferSideEffectsFromResolvedUrl(result.url);
    } catch {
      return null;
    }
  };

  const resolveImport = (specifier, importer) => {
    if (specifier[0] === "/") {
      return new URL(specifier.slice(1), rootDirectoryUrl);
    }
    return new URL(specifier, importer);
  };

  const importIdSet = new Set();
  const assignImportId = (urlImportedDynamically) => {
    const basename = urlToBasename(urlImportedDynamically);
    let importIdCandidate = basename;
    let positiveInteger = 1;
    while (importIdSet.has(importIdCandidate)) {
      importIdCandidate = `${basename}_${positiveInteger}`;
      positiveInteger++;
    }
    const importId = importIdCandidate;
    importIdSet.add(importId);
    return importId;
  };

  return {
    name: "jsenv",
    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args);
      let previousNonEntryPointModuleId;
      for (const jsModuleUrlInfo of jsModuleUrlInfos) {
        const id = jsModuleUrlInfo.url;
        if (jsModuleUrlInfo.isEntryPoint) {
          emitChunk({
            id,
          });
          continue;
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
        if (jsModuleUrlInfo.originalUrl.startsWith("file:")) {
          previousNonEntryPointModuleId = id;
        }
      }
    },
    async generateBundle(outputOptions, rollupResult) {
      _rollupEmitFile = (...args) => this.emitFile(...args);

      const createBundledFileInfo = (rollupFileInfo) => {
        const originalUrl = getOriginalUrl(rollupFileInfo);
        const sourceUrls = Object.keys(rollupFileInfo.modules).map((id) =>
          PATH_AND_URL_CONVERTER.asFileUrl(id),
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
                  if (
                    preserveDynamicImports &&
                    reference.subtype === "dynamic_import"
                  ) {
                    // when dynamic import are preserved, no need to remap them
                    return reference.specifier;
                  }
                  if (
                    reference.type !== "js_import" ||
                    reference.subtype === "import_meta_resolve"
                  ) {
                    // rollup generate specifiers only for static and dynamic imports
                    // other references (like new URL()) are ignored
                    // there is no need to remap them back
                    return reference.specifier;
                  }
                  const specifierBeforeRollup = specifierToUrlMap.get(
                    reference.specifier,
                  );
                  if (!specifierBeforeRollup) {
                    console.warn(
                      `cannot remap "${reference.specifier}" back to specifier before rollup, this is unexpected.`,
                    );
                    return reference.specifier;
                  }
                  return specifierBeforeRollup;
                }
              : undefined,
        };
      };

      const jsModuleBundleUrlInfos = {};
      const fileNames = Object.keys(rollupResult);
      const originalUrlSet = new Set();
      for (const fileName of fileNames) {
        const rollupFileInfo = rollupResult[fileName];
        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (rollupFileInfo.type === "chunk") {
          const jsModuleInfo = createBundledFileInfo(rollupFileInfo);
          const originalUrl = jsModuleInfo.originalUrl;
          if (originalUrlSet.has(originalUrl)) {
            throw new Error(
              `duplicate bundle info, cannot override ${originalUrl}`,
            );
          }
          originalUrlSet.add(originalUrl);
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
        dir: PATH_AND_URL_CONVERTER.asFilePath(rootDirectoryUrl),
        sourcemap: sourcemaps === "file" || sourcemaps === "inline",
        // sourcemapFile,
        sourcemapPathTransform: (relativePath) => {
          return new URL(relativePath, rootDirectoryUrl).href;
        },
        entryFileNames: () => {
          return `[name].js`;
        },
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.isEntry) {
            const originalFileUrl = getOriginalUrl(chunkInfo, true);
            const jsModuleUrlInfo = jsModuleUrlInfos.find(
              (candidate) => candidate.url === originalFileUrl,
            );
            if (jsModuleUrlInfo && jsModuleUrlInfo.filenameHint) {
              return jsModuleUrlInfo.filenameHint;
            }
          }
          if (chunkInfo.isDynamicEntry) {
            const originalFileUrl = getOriginalUrl(chunkInfo, true);
            const urlInfo =
              jsModuleUrlInfos[0].context.kitchen.graph.getUrlInfo(
                originalFileUrl,
              );
            if (urlInfo && urlInfo.filenameHint) {
              return urlInfo.filenameHint;
            }
          }
          return `${chunkInfo.name}.js`;
        },
      });
    },
    // https://rollupjs.org/guide/en/#resolvedynamicimport
    resolveDynamicImport: (specifier, importer) => {
      if (typeof specifier !== "string") {
        // Receiving an ASTNode (specifier is dynamic)
        return null;
      }
      if (!specifier.startsWith("file:")) {
        return { id: specifier, external: true };
      }
      if (preserveDynamicImports) {
        if (isFileSystemPath(importer)) {
          importer = PATH_AND_URL_CONVERTER.asFileUrl(importer);
        }
        const urlObject = resolveImport(specifier, importer);
        const searchParamsToAdd =
          augmentDynamicImportUrlSearchParams(urlObject);
        if (searchParamsToAdd) {
          injectQueryParams(urlObject, searchParamsToAdd);
        }
        const id = urlObject.href;
        return { id, external: true };
      }
      if (isolateDynamicImports) {
        if (isFileSystemPath(importer)) {
          importer = PATH_AND_URL_CONVERTER.asFileUrl(importer);
        }
        const urlObject = resolveImport(specifier, importer);
        const importId = assignImportId(urlObject.href);
        injectQueryParams(urlObject, {
          dynamic_import_id: importId,
        });
        const url = urlObject.href;
        const filePath = PATH_AND_URL_CONVERTER.asFilePath(url);
        return { id: filePath };
      }
      return null;
    },
    resolveId: (specifier, importer = rootDirectoryUrl) => {
      if (isFileSystemPath(importer)) {
        importer = PATH_AND_URL_CONVERTER.asFileUrl(importer);
      }
      const resolvedUrlObject = resolveImport(specifier, importer);
      const resolvedUrl = resolvedUrlObject.href;
      if (!resolvedUrl.startsWith("file:")) {
        return {
          id: resolvedUrl,
          external: true,
          moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
        };
      }
      if (!importCanBeBundled(resolvedUrl)) {
        return {
          id: resolvedUrl,
          external: true,
          moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
        };
      }
      if (resolvedUrl.startsWith("ignore:")) {
        return {
          id: resolvedUrl,
          external: true,
          moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
        };
      }
      if (importer.includes("dynamic_import_id")) {
        const importerUrlObject = new URL(importer);
        const dynamicImportId =
          importerUrlObject.searchParams.get("dynamic_import_id");
        if (dynamicImportId) {
          injectQueryParams(resolvedUrlObject, {
            dynamic_import_id: dynamicImportId,
          });
          const isolatedResolvedUrl = resolvedUrlObject.href;
          return {
            id: PATH_AND_URL_CONVERTER.asFilePath(isolatedResolvedUrl),
            external: false,
            moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
          };
        }
      }
      return {
        id: PATH_AND_URL_CONVERTER.asFilePath(resolvedUrl),
        external: false,
        moduleSideEffects: getModuleSideEffects(resolvedUrl, importer),
      };
    },
    async load(rollupId) {
      const fileUrl = PATH_AND_URL_CONVERTER.asFileUrl(rollupId, true);
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
    treeshake: {
      ...rollupInput.treeshake,
    },
    plugins: rollupPlugins,
  });
  const rollupOutputArray = await rollupReturnValue.generate(rollupOutput);
  return rollupOutputArray;
};
