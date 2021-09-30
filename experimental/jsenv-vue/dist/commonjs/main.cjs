'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var module$1 = require('module');
var util = require('@jsenv/util');
require('@jsenv/server');

/* global __filename */
const filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
const url = filenameContainsBackSlashes ? `file:///${__filename.replace(/\\/g, "/")}` : `file://${__filename}`;

const startsWithWindowsDriveLetter = string => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};
const windowsFilePathToUrl = windowsFilePath => {
  return `file:///${replaceBackSlashesWithSlashes(windowsFilePath)}`;
};
const replaceBackSlashesWithSlashes = string => string.replace(/\\/g, "/");

const setJavaScriptSourceMappingUrl = (javaScriptSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, () => {
    replaced = true;
    return sourceMappingFileUrl ? writeJavaScriptSourceMappingURL(sourceMappingFileUrl) : "";
  });

  if (replaced) {
    return sourceAfterReplace;
  }

  return sourceMappingFileUrl ? `${javaScriptSource}
${writeJavaScriptSourceMappingURL(sourceMappingFileUrl)}` : javaScriptSource;
};
const setCssSourceMappingUrl = (cssSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(cssSource, cssSourceMappingUrlCommentRegExp, () => {
    replaced = true;
    return sourceMappingFileUrl ? writeCssSourceMappingUrl(sourceMappingFileUrl) : "";
  });

  if (replaced) {
    return sourceAfterReplace;
  }

  return sourceMappingFileUrl ? `${cssSource}
${writeCssSourceMappingUrl(sourceMappingFileUrl)}` : cssSource;
};
const javascriptSourceMappingUrlCommentRegexp = /\/\/ ?# ?sourceMappingURL=([^\s'"]+)/g;
const cssSourceMappingUrlCommentRegExp = /\/\*# ?sourceMappingURL=([^\s'"]+) \*\//g; // ${"//#"} is to avoid a parser thinking there is a sourceMappingUrl for this file

const writeJavaScriptSourceMappingURL = value => `${"//#"} sourceMappingURL=${value}`;

const writeCssSourceMappingUrl = value => `/*# sourceMappingURL=${value} */`;

const sourcemapToBase64Url = sourcemap => {
  const asBase64 = Buffer.from(JSON.stringify(sourcemap)).toString("base64");
  return `data:application/json;charset=utf-8;base64,${asBase64}`;
};

const replaceSourceMappingUrl = (source, regexp, callback) => {
  let lastSourceMappingUrl;
  let matchSourceMappingUrl;

  while (matchSourceMappingUrl = regexp.exec(source)) {
    lastSourceMappingUrl = matchSourceMappingUrl;
  }

  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index;
    const before = source.slice(0, index);
    const after = source.slice(index);
    const mappedAfter = after.replace(regexp, (match, firstGroup) => {
      return callback(firstGroup);
    });
    return `${before}${mappedAfter}`;
  }

  return source;
};

const generateCompiledFileAssetUrl = (compiledFileUrl, assetName) => {
  return `${compiledFileUrl}__asset__${assetName}`;
};

const isWindows = process.platform === "win32";
const transformResultToCompilationResult = async ({
  code,
  map,
  contentType = "application/javascript",
  metadata = {}
}, {
  projectDirectoryUrl,
  originalFileContent,
  originalFileUrl,
  compiledFileUrl,
  sourcemapFileUrl,
  sourcemapEnabled = true,
  // removing sourcesContent from map decrease the sourceMap
  // it also means client have to fetch source from server (additional http request)
  // some client ignore sourcesContent property such as vscode-chrome-debugger
  // Because it's the most complex scenario and we want to ensure client is always able
  // to find source from the sourcemap, we remove map.sourcesContent by default to test this.
  sourcemapExcludeSources = true,
  sourcemapMethod = "comment" // "comment", "inline"

}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof originalFileContent !== "string") {
    throw new TypeError(`originalFileContent must be a string, got ${originalFileContent}`);
  }

  if (typeof originalFileUrl !== "string") {
    throw new TypeError(`originalFileUrl must be a string, got ${originalFileUrl}`);
  }

  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`);
  }

  if (typeof sourcemapFileUrl !== "string") {
    throw new TypeError(`sourcemapFileUrl must be a string, got ${sourcemapFileUrl}`);
  }

  const sources = [];
  const sourcesContent = [];
  const assets = [];
  const assetsContent = [];
  let output = code;

  if (sourcemapEnabled && map) {
    if (map.sources.length === 0) {
      // may happen in some cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(originalFileUrl);
      sourcesContent.push(originalFileContent);
    } else {
      await Promise.all(map.sources.map(async (source, index) => {
        // be careful here we might received C:/Directory/file.js path from babel
        // also in case we receive relative path like directory\file.js we replace \ with slash
        // for url resolution
        const sourceFileUrl = isWindows && startsWithWindowsDriveLetter(source) ? windowsFilePathToUrl(source) : util.ensureWindowsDriveLetter(util.resolveUrl(isWindows ? replaceBackSlashesWithSlashes(source) : source, sourcemapFileUrl), sourcemapFileUrl);

        if (!sourceFileUrl.startsWith(projectDirectoryUrl)) {
          // do not track dependency outside project
          // it means cache stays valid for those external sources
          return;
        }

        map.sources[index] = util.urlToRelativeUrl(sourceFileUrl, sourcemapFileUrl);
        sources[index] = sourceFileUrl;

        if (map.sourcesContent && map.sourcesContent[index]) {
          sourcesContent[index] = map.sourcesContent[index];
        } else {
          const sourceFileContent = await util.readFile(sourceFileUrl);
          sourcesContent[index] = sourceFileContent;
        }
      }));
    }

    if (sourcemapExcludeSources) {
      delete map.sourcesContent;
    } // we don't need sourceRoot because our path are relative or absolute to the current location
    // we could comment this line because it is not set by babel because not passed during transform


    delete map.sourceRoot;
    const setSourceMappingUrl = contentType === "application/javascript" ? setJavaScriptSourceMappingUrl : setCssSourceMappingUrl;

    if (sourcemapMethod === "inline") {
      output = setSourceMappingUrl(output, sourcemapToBase64Url(map));
    } else if (sourcemapMethod === "comment") {
      const sourcemapFileRelativePathForModule = util.urlToRelativeUrl(sourcemapFileUrl, compiledFileUrl);
      output = setSourceMappingUrl(output, sourcemapFileRelativePathForModule);
      assets.push(sourcemapFileUrl);
      assetsContent.push(stringifyMap(map));
    }
  } else {
    sources.push(originalFileUrl);
    sourcesContent.push(originalFileContent);
  }

  const {
    coverage
  } = metadata;

  if (coverage) {
    const coverageAssetFileUrl = generateCompiledFileAssetUrl(compiledFileUrl, "coverage.json");
    assets.push(coverageAssetFileUrl);
    assetsContent.push(stringifyCoverage(coverage));
  }

  return {
    compiledSource: output,
    contentType,
    sources,
    sourcesContent,
    assets,
    assetsContent
  };
};

const stringifyMap = object => JSON.stringify(object, null, "  ");

const stringifyCoverage = object => JSON.stringify(object, null, "  ");

const require$1 = module$1.createRequire(url);

/**

minimalBabelPluginArray exists so that jsenv support latest js syntax by default.
Otherwise users have to explicitely enable those syntax when they use it.

*/

const syntaxDynamicImport = require$1("@babel/plugin-syntax-dynamic-import");

const syntaxImportMeta = require$1("@babel/plugin-syntax-import-meta");

const syntaxNumericSeparator = require$1("@babel/plugin-syntax-numeric-separator");

const minimalBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta, syntaxNumericSeparator];

// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel

const {
  addNamespace,
  addDefault,
  addNamed
} = require$1("@babel/helper-module-imports");

const {
  parseExpression
} = require$1("@babel/parser");

const babelPluginTransformImportMeta = (api, pluginOptions) => {
  const {
    replaceImportMeta
  } = pluginOptions;
  let babelState;

  const jsValueToAst = jsValue => {
    const valueAst = parseExpression(jsValue, babelState.opts);
    return valueAst;
  };

  return {
    pre: state => {
      babelState = state;
    },
    // visitor: {
    //   Program(path) {
    //     const metas = []
    //     const identifiers = new Set()
    //     path.traverse({
    //       MetaProperty(path) {
    //         const node = path.node
    //         if (node.meta && node.meta.name === "import" && node.property.name === "meta") {
    //           metas.push(path)
    //           Object.keys(path.scope.getAllBindings()).forEach((name) => {
    //             identifiers.add(name)
    //           })
    //         }
    //       },
    //     })
    //     if (metas.length === 0) {
    //       return
    //     }
    //   },
    // },
    visitor: {
      Program(programPath) {
        const metaPropertyPathMap = {};
        programPath.traverse({
          MemberExpression(path) {
            const {
              node
            } = path;
            const {
              object
            } = node;

            if (object.type !== "MetaProperty") {
              return;
            }

            const {
              property: objectProperty
            } = object;

            if (objectProperty.name !== "meta") {
              return;
            }

            const {
              property
            } = node;
            const {
              name
            } = property;

            if (name in metaPropertyPathMap) {
              metaPropertyPathMap[name].push(path);
            } else {
              metaPropertyPathMap[name] = [path];
            }
          }

        });
        Object.keys(metaPropertyPathMap).forEach(importMetaPropertyName => {
          replaceImportMeta(importMetaPropertyName, {
            replaceWithImport: ({
              namespace,
              name,
              from
            }) => {
              let importAst;

              if (namespace) {
                importAst = addNamespace(programPath, from);
              } else if (name) {
                importAst = addNamed(programPath, name, from);
              } else {
                importAst = addDefault(programPath, from);
              }

              metaPropertyPathMap[importMetaPropertyName].forEach(path => {
                path.replaceWith(importAst);
              });
            },
            replaceWithValue: value => {
              const valueAst = jsValueToAst(JSON.stringify(value));
              metaPropertyPathMap[importMetaPropertyName].forEach(path => {
                path.replaceWith(valueAst);
              });
            }
          });
        });
      }

    }
  };
};

const findAsyncPluginNameInBabelPluginMap = babelPluginMap => {
  if ("transform-async-to-promises" in babelPluginMap) {
    return "transform-async-to-promises";
  }

  if ("transform-async-to-generator" in babelPluginMap) {
    return "transform-async-to-generator";
  }

  return "";
};

// https://github.com/drudru/ansi_up/blob/master/ansi_up.js

const ansiToHTML = ansiString => {
  const Convert = require$1("ansi-to-html");

  return new Convert().toHtml(ansiString);
};

const ensureRegeneratorRuntimeImportBabelPlugin = (api, options) => {
  const {
    addSideEffect
  } = require$1("@babel/helper-module-imports");

  api.assertVersion(7);
  const {
    regeneratorRuntimeIdentifierName = "regeneratorRuntime",
    regeneratorRuntimeImportPath = "@jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js"
  } = options;
  return {
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const filepathname = filename.replace(/\\/g, "/");

        if (filepathname.endsWith("node_modules/regenerator-runtime/runtime.js")) {
          return;
        }

        const {
          node
        } = path;

        if (node.name === regeneratorRuntimeIdentifierName) {
          addSideEffect(path.scope.getProgramParent().path, regeneratorRuntimeImportPath);
        }
      }

    }
  };
};

const ensureGlobalThisImportBabelPlugin = (api, options) => {
  const {
    addSideEffect
  } = require$1("@babel/helper-module-imports");

  api.assertVersion(7);
  const {
    globalThisIdentifierName = "globalThis",
    globalThisImportPath = "@jsenv/core/helpers/global-this/global-this.js"
  } = options;
  return {
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const filepathname = filename.replace(/\\/g, "/");

        if (filepathname.endsWith("/helpers/global-this/global-this.js")) {
          return;
        }

        const {
          node
        } = path;

        if (node.name === globalThisIdentifierName) {
          addSideEffect(path.scope.getProgramParent().path, globalThisImportPath);
        }
      }

    }
  };
};

// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js

const {
  list
} = require$1("@babel/helpers");

const babelHelperNameInsideJsenvCoreArray = ["applyDecoratedDescriptor", "arrayLikeToArray", "arrayWithHoles", "arrayWithoutHoles", "assertThisInitialized", "AsyncGenerator", "asyncGeneratorDelegate", "asyncIterator", "asyncToGenerator", "awaitAsyncGenerator", "AwaitValue", "classCallCheck", "classNameTDZError", "classPrivateFieldDestructureSet", "classPrivateFieldGet", "classPrivateFieldLooseBase", "classPrivateFieldLooseKey", "classPrivateFieldSet", "classPrivateMethodGet", "classPrivateMethodSet", "classStaticPrivateFieldSpecGet", "classStaticPrivateFieldSpecSet", "classStaticPrivateMethodGet", "classStaticPrivateMethodSet", "construct", "createClass", "createForOfIteratorHelper", "createForOfIteratorHelperLoose", "createSuper", "decorate", "defaults", "defineEnumerableProperties", "defineProperty", "extends", "get", "getPrototypeOf", "inherits", "inheritsLoose", "initializerDefineProperty", "initializerWarningHelper", "instanceof", "interopRequireDefault", "interopRequireWildcard", "isNativeFunction", "isNativeReflectConstruct", "iterableToArray", "iterableToArrayLimit", "iterableToArrayLimitLoose", "jsx", "newArrowCheck", "nonIterableRest", "nonIterableSpread", "objectDestructuringEmpty", "objectSpread", "objectSpread2", "objectWithoutProperties", "objectWithoutPropertiesLoose", "possibleConstructorReturn", "readOnlyError", "set", "setPrototypeOf", "skipFirstGeneratorNext", "slicedToArray", "slicedToArrayLoose", "superPropBase", "taggedTemplateLiteral", "taggedTemplateLiteralLoose", "tdz", "temporalRef", "temporalUndefined", "toArray", "toConsumableArray", "toPrimitive", "toPropertyKey", "typeof", "unsupportedIterableToArray", "wrapAsyncGenerator", "wrapNativeSuper", "wrapRegExp"];
const babelHelperScope = "@jsenv/core/helpers/babel/"; // maybe we can put back / in front of .jsenv here because we will
// "redirect" or at least transform everything inside .jsenv
// not only everything inside .dist

const babelHelperAbstractScope = `.jsenv/helpers/babel/`;
const babelHelperNameToImportSpecifier = babelHelperName => {
  if (babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)) {
    return `${babelHelperScope}${babelHelperName}/${babelHelperName}.js`;
  }

  return `${babelHelperAbstractScope}${babelHelperName}/${babelHelperName}.js`;
};
const filePathToBabelHelperName = filePath => {
  const fileUrl = util.fileSystemPathToUrl(filePath);
  const babelHelperPrefix = "core/helpers/babel/";

  if (fileUrl.includes(babelHelperPrefix)) {
    const afterBabelHelper = fileUrl.slice(fileUrl.indexOf(babelHelperPrefix) + babelHelperPrefix.length);
    return afterBabelHelper.slice(0, afterBabelHelper.indexOf("/"));
  }

  if (fileUrl.includes(babelHelperAbstractScope)) {
    const afterBabelHelper = fileUrl.slice(fileUrl.indexOf(babelHelperAbstractScope) + babelHelperAbstractScope.length);
    return afterBabelHelper.slice(0, afterBabelHelper.indexOf("/"));
  }

  return null;
};

const {
  addDefault: addDefault$1
} = require$1("@babel/helper-module-imports"); // named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1
// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-plugin-external-helpers/src/index.js


const transformBabelHelperToImportBabelPlugin = api => {
  api.assertVersion(7);
  return {
    pre: file => {
      const cachedHelpers = {};
      file.set("helperGenerator", name => {
        // the list of possible helpers name
        // https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
        if (!file.availableHelper(name)) {
          return undefined;
        }

        if (cachedHelpers[name]) {
          return cachedHelpers[name];
        }

        const filePath = file.opts.filename;
        const babelHelperImportSpecifier = babelHelperNameToImportSpecifier(name);

        if (filePathToBabelHelperName(filePath) === name) {
          return undefined;
        }

        const helper = addDefault$1(file.path, babelHelperImportSpecifier, {
          nameHint: `_${name}`
        });
        cachedHelpers[name] = helper;
        return helper;
      });
    }
  };
};

/* eslint-disable import/max-dependencies */

const {
  transformAsync,
  transformFromAstAsync
} = require$1("@babel/core");

const transformModulesSystemJs = require$1("@babel/plugin-transform-modules-systemjs");

const proposalDynamicImport = require$1("@babel/plugin-proposal-dynamic-import");

const jsenvTransform = async ({
  inputCode,
  inputPath,
  inputRelativePath,
  inputAst,
  inputMap,
  babelPluginMap,
  moduleOutFormat,
  importMetaFormat,
  importMetaEnvFileSpecifier,
  importMeta = {},
  allowTopLevelAwait,
  transformTopLevelAwait,
  transformGenerator,
  transformGlobalThis,
  regeneratorRuntimeImportPath,
  sourcemapEnabled
}) => {
  // https://babeljs.io/docs/en/options
  const options = {
    filename: inputPath,
    filenameRelative: inputRelativePath,
    inputSourceMap: inputMap,
    configFile: false,
    babelrc: false,
    // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: sourcemapEnabled,
    sourceFileName: inputPath,
    // https://babeljs.io/docs/en/options#parseropts
    parserOpts: {
      allowAwaitOutsideFunction: allowTopLevelAwait
    }
  };
  const babelHelperName = filePathToBabelHelperName(inputPath); // to prevent typeof circular dependency

  if (babelHelperName === "typeof") {
    const babelPluginMapWithoutTransformTypeOf = {};
    Object.keys(babelPluginMap).forEach(key => {
      if (key !== "transform-typeof-symbol") {
        babelPluginMapWithoutTransformTypeOf[key] = babelPluginMap[key];
      }
    });
    babelPluginMap = babelPluginMapWithoutTransformTypeOf;
  }

  if (transformGenerator) {
    babelPluginMap = { ...babelPluginMap,
      "ensure-regenerator-runtime-import": [ensureRegeneratorRuntimeImportBabelPlugin, {
        regeneratorRuntimeImportPath
      }]
    };
  }

  if (transformGlobalThis) {
    babelPluginMap = { ...babelPluginMap,
      "ensure-global-this-import": [ensureGlobalThisImportBabelPlugin]
    };
  }

  babelPluginMap = {
    "transform-import-meta": [babelPluginTransformImportMeta, {
      replaceImportMeta: (metaPropertyName, {
        replaceWithImport,
        replaceWithValue
      }) => {
        if (metaPropertyName === "url") {
          if (importMetaFormat === "esmodule") {
            // keep native version
            return;
          }

          if (importMetaFormat === "systemjs") {
            // systemjs will handle it
            return;
          }

          if (importMetaFormat === "commonjs") {
            replaceWithImport({
              from: `@jsenv/core/src/internal/import-meta/import-meta-url-commonjs.js`
            });
            return;
          }

          if (importMetaFormat === "global") {
            replaceWithImport({
              from: `@jsenv/core/src/internal/import-meta/import-meta-url-global.js`
            });
            return;
          }

          return;
        }

        if (metaPropertyName === "resolve") {
          if (importMetaFormat === "esmodule") {
            // keep native version
            return;
          }

          if (importMetaFormat === "systemjs") {
            // systemjs will handle it
            return;
          }

          if (importMetaFormat === "commonjs") {
            replaceWithImport({
              from: `@jsenv/core/src/internal/import-meta/import-meta-resolve-commonjs.js`
            });
            return;
          }

          if (importMetaFormat === "global") {
            replaceWithImport({
              from: `@jsenv/core/src/internal/import-meta/import-meta-resolve-global.js`
            });
            return;
          }

          return;
        }

        if (metaPropertyName === "env") {
          replaceWithImport({
            namespace: true,
            from: importMetaEnvFileSpecifier
          });
          return;
        }

        replaceWithValue(importMeta[metaPropertyName]);
      }
    }],
    ...babelPluginMap,
    "transform-babel-helpers-to-import": [transformBabelHelperToImportBabelPlugin]
  };
  const asyncPluginName = findAsyncPluginNameInBabelPluginMap(babelPluginMap);

  if (moduleOutFormat === "systemjs" && transformTopLevelAwait && asyncPluginName) {
    const babelPluginArrayWithoutAsync = [];
    Object.keys(babelPluginMap).forEach(name => {
      if (name !== asyncPluginName) {
        babelPluginArrayWithoutAsync.push(babelPluginMap[name]);
      }
    }); // put body inside something like (async () => {})()

    const result = await babelTransform({
      ast: inputAst,
      code: inputCode,
      options: { ...options,
        plugins: [...minimalBabelPluginArray, ...babelPluginArrayWithoutAsync, [proposalDynamicImport], [transformModulesSystemJs]]
      }
    }); // we need to retranspile the await keywords now wrapped
    // inside Systemjs function.
    // They are ignored, at least by transform-async-to-promises
    // see https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/26

    const finalResult = await babelTransform({
      // ast: result.ast,
      code: result.code,
      options: { ...options,
        // about inputSourceMap see
        // https://github.com/babel/babel/blob/eac4c5bc17133c2857f2c94c1a6a8643e3b547a7/packages/babel-core/src/transformation/file/generate.js#L57
        // https://github.com/babel/babel/blob/090c364a90fe73d36a30707fc612ce037bdbbb24/packages/babel-core/src/transformation/file/merge-map.js#L6s
        inputSourceMap: result.map,
        plugins: [...minimalBabelPluginArray, babelPluginMap[asyncPluginName]]
      }
    });
    return { ...result,
      ...finalResult,
      metadata: { ...result.metadata,
        ...finalResult.metadata
      }
    };
  }

  const babelPluginArray = [...minimalBabelPluginArray, ...Object.keys(babelPluginMap).map(babelPluginName => babelPluginMap[babelPluginName]), ...(moduleOutFormat === "systemjs" ? [[proposalDynamicImport], [transformModulesSystemJs]] : [])];
  const result = await babelTransform({
    ast: inputAst,
    code: inputCode,
    options: { ...options,
      plugins: babelPluginArray
    }
  });
  return result;
};

const babelTransform = async ({
  ast,
  code,
  options
}) => {
  try {
    if (ast) {
      const result = await transformFromAstAsync(ast, code, options);
      return result;
    }

    return await transformAsync(code, options);
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      const message = error.message;
      throw createParseError({
        message: message.replace(ansiRegex, ""),
        messageHTML: ansiToHTML(message),
        filename: options.filename,
        lineNumber: error.loc.line,
        columnNumber: error.loc.column
      });
    }

    throw error;
  }
};

const pattern = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)", "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"].join("|");
const ansiRegex = new RegExp(pattern, "g");

const createParseError = data => {
  const {
    message
  } = data;
  const parseError = new Error(message);
  parseError.code = "PARSE_ERROR";
  parseError.data = data;
  return parseError;
};

const transformJs = async ({
  projectDirectoryUrl,
  code,
  url,
  urlAfterTransform,
  map,
  babelPluginMap,
  convertMap = {},
  moduleOutFormat = "esmodule",
  importMetaFormat = moduleOutFormat,
  importMetaEnvFileRelativeUrl,
  importMeta,
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformGenerator = true,
  transformGlobalThis = true,
  sourcemapEnabled = true
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof code === "undefined") {
    throw new TypeError(`code missing, received ${code}`);
  }

  if (typeof url !== "string") {
    throw new TypeError(`url must be a string, got ${url}`);
  }

  const {
    inputCode,
    inputMap
  } = await computeInputCodeAndInputMap({
    code: String(code),
    url,
    urlAfterTransform,
    map,
    projectDirectoryUrl,
    convertMap,
    sourcemapEnabled,
    allowTopLevelAwait
  });
  const inputPath = computeInputPath(url);
  const inputRelativePath = computeInputRelativePath(url, projectDirectoryUrl);
  const importMetaEnvFileUrl = util.resolveUrl(importMetaEnvFileRelativeUrl, projectDirectoryUrl);
  const importMetaEnvRelativeUrlForInput = util.urlToRelativeUrl(importMetaEnvFileUrl, url);
  const importMetaEnvFileSpecifier = relativeUrlToSpecifier(importMetaEnvRelativeUrlForInput);
  return jsenvTransform({
    inputCode,
    inputMap,
    inputPath,
    inputRelativePath,
    babelPluginMap,
    convertMap,
    moduleOutFormat,
    importMetaFormat,
    importMetaEnvFileSpecifier,
    importMeta,
    allowTopLevelAwait,
    transformTopLevelAwait,
    transformGenerator,
    transformGlobalThis,
    sourcemapEnabled
  });
};

const computeInputCodeAndInputMap = async ({
  code,
  url,
  urlAfterTransform,
  map,
  projectDirectoryUrl,
  convertMap,
  remap,
  allowTopLevelAwait
}) => {
  const structuredMetaMap = util.normalizeStructuredMetaMap({
    convert: convertMap
  }, projectDirectoryUrl);
  const {
    convert
  } = util.urlToMeta({
    url,
    structuredMetaMap
  });

  if (!convert) {
    return {
      inputCode: code,
      inputMap: map
    };
  }

  if (typeof convert !== "function") {
    throw new TypeError(`convert must be a function, got ${convert}`);
  } // TODO: handle map when passed


  const conversionResult = await convert({
    projectDirectoryUrl,
    code,
    url,
    urlAfterTransform,
    map,
    remap,
    allowTopLevelAwait
  });

  if (typeof conversionResult !== "object") {
    throw new TypeError(`convert must return an object, got ${conversionResult}`);
  }

  const inputCode = conversionResult.code;

  if (typeof inputCode !== "string") {
    throw new TypeError(`convert must return { code } string, got { code: ${inputCode} } `);
  }

  const inputMap = conversionResult.map;
  return {
    inputCode,
    inputMap
  };
};

const computeInputPath = url => {
  if (url.startsWith("file://")) {
    return util.urlToFileSystemPath(url);
  }

  return url;
};

const computeInputRelativePath = (url, projectDirectoryUrl) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return util.urlToRelativeUrl(url, projectDirectoryUrl);
  }

  return undefined;
};

const relativeUrlToSpecifier = relativeUrl => {
  if (relativeUrl.startsWith("../")) return relativeUrl;
  if (relativeUrl.startsWith("./")) return relativeUrl;
  return `./${relativeUrl}`;
};

const compileIdToBabelPluginMap = (compileId, {
  babelPluginMap,
  groupMap
}) => {
  const babelPluginMapForGroupMap = {};
  const groupBabelPluginMap = {};
  groupMap[compileId].babelPluginRequiredNameArray.forEach(babelPluginRequiredName => {
    if (babelPluginRequiredName in babelPluginMap) {
      groupBabelPluginMap[babelPluginRequiredName] = babelPluginMap[babelPluginRequiredName];
    }
  });
  return { ...groupBabelPluginMap,
    ...babelPluginMapForGroupMap
  };
};

const require$2 = module$1.createRequire(url);

const VueComponentCompiler = require$2("@vue/component-compiler");

const VueCompiler = VueComponentCompiler.createDefaultCompiler();
const jsenvCompilerForVue = ({
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  compileId,
  importMetaEnvFileRelativeUrl,
  importMeta,
  groupMap,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,
  writeOnFilesystem,
  sourcemapExcludeSources
}) => {
  if (!originalFileUrl.endsWith(".vue")) {
    return null;
  }

  return {
    compile: async originalFileContent => {
      const vueComponent = VueCompiler.compileToDescriptor(originalFileUrl, originalFileContent, "utf8");
      const assembledComponent = VueComponentCompiler.assemble(vueComponent, originalFileUrl, vueComponent);
      const {
        code,
        map
      } = assembledComponent;
      const sourcemapFileUrl = `${compiledFileUrl}.map`;
      map.sources = map.sources.map(source => {
        const sourceUrl = util.resolveUrl(source, sourcemapFileUrl);
        return util.urlToRelativeUrl(sourceUrl, sourcemapFileUrl);
      });
      const transformResult = await transformJs({
        projectDirectoryUrl,
        importMetaEnvFileRelativeUrl,
        importMeta,
        code,
        map,
        url: originalFileUrl,
        urlAfterTransform: compiledFileUrl,
        babelPluginMap: compileIdToBabelPluginMap(compileId, {
          groupMap,
          babelPluginMap
        }),
        convertMap,
        transformTopLevelAwait,
        moduleOutFormat,
        importMetaFormat
      });
      return transformResultToCompilationResult(transformResult, {
        projectDirectoryUrl,
        originalFileContent,
        originalFileUrl,
        compiledFileUrl,
        sourcemapFileUrl,
        sourcemapMethod: writeOnFilesystem ? "comment" : "inline",
        sourcemapExcludeSources
      });
    }
  };
};

exports.jsenvCompilerForVue = jsenvCompilerForVue;

//# sourceMappingURL=main.cjs.map