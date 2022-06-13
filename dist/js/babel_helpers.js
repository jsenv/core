import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js";
import { findHighestVersion } from "@jsenv/utils/semantic_versioning/highest_version.js";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { injectImport } from "@jsenv/utils/js_ast/babel_utils.js";

// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js
// the list of possible helpers:
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
const babelHelperClientDirectoryUrl = new URL("../node_modules/@jsenv/babel-plugins/src/babel_helpers/", import.meta.url).href; // we cannot use "@jsenv/core/src/*" because babel helper might be injected
// into node_modules not depending on "@jsenv/core"

const getBabelHelperFileUrl = babelHelperName => {
  const babelHelperFileUrl = new URL(`./${babelHelperName}/${babelHelperName}.js`, babelHelperClientDirectoryUrl).href;
  return babelHelperFileUrl;
};
const babelHelperNameFromUrl = url => {
  if (!url.startsWith(babelHelperClientDirectoryUrl)) {
    return null;
  }

  const afterBabelHelperDirectory = url.slice(babelHelperClientDirectoryUrl.length);
  const babelHelperName = afterBabelHelperDirectory.slice(0, afterBabelHelperDirectory.indexOf("/"));
  return babelHelperName;
};

const require = createRequire(import.meta.url); // eslint-disable-next-line import/no-dynamic-require


const requireBabelPlugin = name => require(name);

const featureCompats = {
  script_type_module: {
    edge: "16",
    firefox: "60",
    chrome: "61",
    safari: "10.1",
    opera: "48",
    ios: "10.3",
    android: "61",
    samsung: "8.2"
  },
  document_current_script: {
    edge: "12",
    firefox: "4",
    chrome: "29",
    safari: "8",
    opera: "16",
    android: "4.4",
    samsung: "4"
  },
  import_meta: {
    chrome: "64",
    edge: "79",
    firefox: "62",
    safari: "11.1",
    opera: "51",
    ios: "12",
    android: "9"
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#browser_compatibility
  import_dynamic: {
    android: "8",
    chrome: "63",
    edge: "79",
    firefox: "67",
    ios: "11.3",
    opera: "50",
    safari: "11.3",
    samsung: "8.0",
    node: "13.2"
  },
  top_level_await: {
    edge: "89",
    chrome: "89",
    firefox: "89",
    opera: "75",
    safari: "15",
    samsung: "15",
    ios: "15",
    node: "14.8"
  },
  // https://caniuse.com/import-maps
  importmap: {
    edge: "89",
    chrome: "89",
    opera: "76",
    samsung: "15"
  },
  import_type_json: {
    chrome: "91",
    edge: "91"
  },
  import_type_css: {
    chrome: "93",
    edge: "93"
  },
  import_type_text: {},
  // https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet#browser_compatibility
  new_stylesheet: {
    chrome: "73",
    edge: "79",
    opera: "53",
    android: "73"
  },
  // https://caniuse.com/?search=worker
  worker: {
    ie: "10",
    edge: "12",
    firefox: "3.5",
    chrome: "4",
    opera: "11.5",
    safari: "4",
    ios: "5",
    android: "4.4"
  },
  // https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker#browser_compatibility
  worker_type_module: {
    chrome: "80",
    edge: "80",
    opera: "67",
    android: "80"
  },
  worker_importmap: {},
  service_worker: {
    edge: "17",
    firefox: "44",
    chrome: "40",
    safari: "11.1",
    opera: "27",
    ios: "11.3",
    android: "12.12"
  },
  service_worker_type_module: {
    chrome: "80",
    edge: "80",
    opera: "67",
    android: "80"
  },
  shared_worker: {
    chrome: "4",
    edge: "79",
    firefox: "29",
    opera: "10.6"
  },
  shared_worker_type_module: {
    chrome: "80",
    edge: "80",
    opera: "67"
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis#browser_compatibility
  global_this: {
    edge: "79",
    firefox: "65",
    chrome: "71",
    safari: "12.1",
    opera: "58",
    ios: "12.2",
    android: "94",
    node: "12"
  },
  async_generator_function: {
    chrome: "63",
    opera: "50",
    edge: "79",
    firefox: "57",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "8",
    electron: "3"
  },
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#browser_compatibility
  template_literals: {
    chrome: "41",
    edge: "12",
    firefox: "34",
    opera: "28",
    safari: "9",
    ios: "9",
    android: "4",
    node: "4"
  }
};

const RUNTIME_COMPAT = {
  featureCompats,
  add: (originalRuntimeCompat, feature) => {
    const featureCompat = getFeatureCompat(feature);
    const runtimeCompat = { ...originalRuntimeCompat
    };
    Object.keys(featureCompat).forEach(runtimeName => {
      const firstVersion = originalRuntimeCompat[runtimeName];
      const secondVersion = featureCompat[runtimeName];
      runtimeCompat[runtimeName] = firstVersion ? findHighestVersion(firstVersion, secondVersion) : secondVersion;
    });
    return runtimeCompat;
  },
  isSupported: (runtimeCompat, feature) => {
    const featureCompat = getFeatureCompat(feature);
    const runtimeNames = Object.keys(runtimeCompat);
    const runtimeWithoutCompat = runtimeNames.find(runtimeName => {
      const runtimeVersion = runtimeCompat[runtimeName];
      const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity";
      const highestVersion = findHighestVersion(runtimeVersion, runtimeVersionCompatible);
      return highestVersion !== runtimeVersion;
    });
    return !runtimeWithoutCompat;
  }
};

const getFeatureCompat = feature => {
  if (typeof feature === "string") {
    const compat = featureCompats[feature];

    if (!compat) {
      throw new Error(`"${feature}" feature is unknown`);
    }

    return compat;
  }

  if (typeof feature !== "object") {
    throw new TypeError(`feature must be a string or an object, got ${feature}`);
  }

  return feature;
};

/* eslint-disable camelcase */
// copied from
// https://github.com/babel/babel/blob/e498bee10f0123bb208baa228ce6417542a2c3c4/packages/babel-compat-data/data/plugins.json#L1
// https://github.com/babel/babel/blob/master/packages/babel-compat-data/data/plugins.json#L1
// Because this is an hidden implementation detail of @babel/preset-env
// it could be deprecated or moved anytime.
// For that reason it makes more sens to have it inlined here
// than importing it from an undocumented location.
// Ideally it would be documented or a separate module
const babelPluginCompatMap = {
  "proposal-numeric-separator": {
    chrome: "75",
    opera: "62",
    edge: "79",
    firefox: "70",
    safari: "13",
    node: "12.5",
    ios: "13",
    samsung: "11",
    electron: "6"
  },
  "proposal-class-properties": {
    chrome: "74",
    opera: "61",
    edge: "79",
    node: "12",
    electron: "6.1"
  },
  "proposal-private-methods": {
    chrome: "84",
    opera: "71"
  },
  "proposal-nullish-coalescing-operator": {
    chrome: "80",
    opera: "67",
    edge: "80",
    firefox: "72",
    safari: "13.1",
    node: "14",
    electron: "8.1"
  },
  "proposal-optional-chaining": {
    chrome: "80",
    opera: "67",
    edge: "80",
    firefox: "74",
    safari: "13.1",
    node: "14",
    electron: "8.1"
  },
  "proposal-json-strings": {
    chrome: "66",
    opera: "53",
    edge: "79",
    firefox: "62",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "9",
    electron: "3"
  },
  "proposal-optional-catch-binding": {
    chrome: "66",
    opera: "53",
    edge: "79",
    firefox: "58",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3"
  },
  "transform-parameters": {
    chrome: "49",
    opera: "36",
    edge: "18",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.37"
  },
  "proposal-async-generator-functions": {
    chrome: "63",
    opera: "50",
    edge: "79",
    firefox: "57",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "8",
    electron: "3"
  },
  "proposal-object-rest-spread": {
    chrome: "60",
    opera: "47",
    edge: "79",
    firefox: "55",
    safari: "11.1",
    node: "8.3",
    ios: "11.3",
    samsung: "8",
    electron: "2"
  },
  "transform-dotall-regex": {
    chrome: "62",
    opera: "49",
    edge: "79",
    firefox: "78",
    safari: "11.1",
    node: "8.10",
    ios: "11.3",
    samsung: "8",
    electron: "3"
  },
  "proposal-unicode-property-regex": {
    chrome: "64",
    opera: "51",
    edge: "79",
    firefox: "78",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3"
  },
  "transform-named-capturing-groups-regex": {
    chrome: "64",
    opera: "51",
    edge: "79",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    electron: "3"
  },
  "transform-async-to-generator": {
    chrome: "55",
    opera: "42",
    edge: "15",
    firefox: "52",
    safari: "11",
    node: "7.6",
    ios: "11",
    samsung: "6",
    electron: "1.6"
  },
  "transform-exponentiation-operator": {
    chrome: "52",
    opera: "39",
    edge: "14",
    firefox: "52",
    safari: "10.1",
    node: "7",
    ios: "10.3",
    samsung: "6",
    electron: "1.3"
  },
  "transform-template-literals": {
    chrome: "41",
    opera: "28",
    edge: "13",
    electron: "0.22",
    firefox: "34",
    safari: "13",
    node: "4",
    ios: "13",
    samsung: "3.4"
  },
  "transform-literals": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "53",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.30"
  },
  "transform-function-name": {
    chrome: "51",
    opera: "38",
    edge: "79",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2"
  },
  "transform-arrow-functions": {
    chrome: "47",
    opera: "34",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  "transform-block-scoped-functions": {
    chrome: "41",
    opera: "28",
    edge: "12",
    firefox: "46",
    safari: "10",
    node: "4",
    ie: "11",
    ios: "10",
    samsung: "3.4",
    electron: "0.22"
  },
  "transform-classes": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  "transform-object-super": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  "transform-shorthand-properties": {
    chrome: "43",
    opera: "30",
    edge: "12",
    firefox: "33",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.28"
  },
  "transform-duplicate-keys": {
    chrome: "42",
    opera: "29",
    edge: "12",
    firefox: "34",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "3.4",
    electron: "0.25"
  },
  "transform-computed-properties": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "34",
    safari: "7.1",
    node: "4",
    ios: "8",
    samsung: "4",
    electron: "0.30"
  },
  "transform-for-of": {
    chrome: "51",
    opera: "38",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2"
  },
  "transform-sticky-regex": {
    chrome: "49",
    opera: "36",
    edge: "13",
    firefox: "3",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "0.37"
  },
  "transform-unicode-escapes": {
    chrome: "44",
    opera: "31",
    edge: "12",
    firefox: "53",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    electron: "0.30"
  },
  "transform-unicode-regex": {
    chrome: "50",
    opera: "37",
    edge: "13",
    firefox: "46",
    safari: "12",
    node: "6",
    ios: "12",
    samsung: "5",
    electron: "1.1"
  },
  "transform-spread": {
    chrome: "46",
    opera: "33",
    edge: "13",
    firefox: "36",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  "transform-destructuring": {
    chrome: "51",
    opera: "38",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    electron: "1.2"
  },
  "transform-block-scoping": {
    chrome: "49",
    opera: "36",
    edge: "14",
    firefox: "51",
    safari: "11",
    node: "6",
    ios: "11",
    samsung: "5",
    electron: "0.37"
  },
  "transform-typeof-symbol": {
    chrome: "38",
    opera: "25",
    edge: "12",
    firefox: "36",
    safari: "9",
    node: "0.12",
    ios: "9",
    samsung: "3",
    electron: "0.20"
  },
  "transform-new-target": {
    chrome: "46",
    opera: "33",
    edge: "14",
    firefox: "41",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    electron: "0.36"
  },
  "transform-regenerator": {
    chrome: "50",
    opera: "37",
    edge: "13",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    electron: "1.1"
  },
  "transform-member-expression-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20"
  },
  "transform-property-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20"
  },
  "transform-reserved-words": {
    chrome: "13",
    opera: "10.50",
    edge: "12",
    firefox: "2",
    safari: "3.1",
    node: "0.10",
    ie: "9",
    android: "4.4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.20"
  }
}; // copy of transform-async-to-generator
// so that async is not transpiled when supported

babelPluginCompatMap["transform-async-to-promises"] = babelPluginCompatMap["transform-async-to-generator"];
babelPluginCompatMap["regenerator-transform"] = babelPluginCompatMap["transform-regenerator"];

const getBaseBabelPluginStructure = ({
  url,
  isSupported // isJsModule,
  // getImportSpecifier,

}) => {
  const isBabelPluginNeeded = babelPluginName => {
    return !isSupported(babelPluginCompatMap[babelPluginName]);
  };

  const babelPluginStructure = {};

  if (isBabelPluginNeeded("proposal-numeric-separator")) {
    babelPluginStructure["proposal-numeric-separator"] = requireBabelPlugin("@babel/plugin-proposal-numeric-separator");
  }

  if (isBabelPluginNeeded("proposal-json-strings")) {
    babelPluginStructure["proposal-json-strings"] = requireBabelPlugin("@babel/plugin-proposal-json-strings");
  }

  if (isBabelPluginNeeded("proposal-object-rest-spread")) {
    babelPluginStructure["proposal-object-rest-spread"] = requireBabelPlugin("@babel/plugin-proposal-object-rest-spread");
  }

  if (isBabelPluginNeeded("proposal-optional-catch-binding")) {
    babelPluginStructure["proposal-optional-catch-binding"] = requireBabelPlugin("@babel/plugin-proposal-optional-catch-binding");
  }

  if (isBabelPluginNeeded("proposal-unicode-property-regex")) {
    babelPluginStructure["proposal-unicode-property-regex"] = requireBabelPlugin("@babel/plugin-proposal-unicode-property-regex");
  }

  if (isBabelPluginNeeded("transform-async-to-promises")) {
    babelPluginStructure["transform-async-to-promises"] = [requireBabelPlugin("babel-plugin-transform-async-to-promises"), {
      topLevelAwait: "ignore",
      // will be handled by "jsenv:top_level_await" plugin
      externalHelpers: false // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
      // externalHelpers: isJsModule,
      // externalHelpersPath: isJsModule ? getImportSpecifier(
      //     "babel-plugin-transform-async-to-promises/helpers.mjs",
      //   ) : null

    }];
  }

  if (isBabelPluginNeeded("transform-arrow-functions")) {
    babelPluginStructure["transform-arrow-functions"] = requireBabelPlugin("@babel/plugin-transform-arrow-functions");
  }

  if (isBabelPluginNeeded("transform-block-scoped-functions")) {
    babelPluginStructure["transform-block-scoped-functions"] = requireBabelPlugin("@babel/plugin-transform-block-scoped-functions");
  }

  if (isBabelPluginNeeded("transform-block-scoping")) {
    babelPluginStructure["transform-block-scoping"] = requireBabelPlugin("@babel/plugin-transform-block-scoping");
  }

  if (isBabelPluginNeeded("transform-classes")) {
    babelPluginStructure["transform-classes"] = requireBabelPlugin("@babel/plugin-transform-classes");
  }

  if (isBabelPluginNeeded("transform-computed-properties")) {
    babelPluginStructure["transform-computed-properties"] = requireBabelPlugin("@babel/plugin-transform-computed-properties");
  }

  if (isBabelPluginNeeded("transform-destructuring")) {
    babelPluginStructure["transform-destructuring"] = requireBabelPlugin("@babel/plugin-transform-destructuring");
  }

  if (isBabelPluginNeeded("transform-dotall-regex")) {
    babelPluginStructure["transform-dotall-regex"] = requireBabelPlugin("@babel/plugin-transform-dotall-regex");
  }

  if (isBabelPluginNeeded("transform-duplicate-keys")) {
    babelPluginStructure["transform-duplicate-keys"] = requireBabelPlugin("@babel/plugin-transform-duplicate-keys");
  }

  if (isBabelPluginNeeded("transform-exponentiation-operator")) {
    babelPluginStructure["transform-exponentiation-operator"] = requireBabelPlugin("@babel/plugin-transform-exponentiation-operator");
  }

  if (isBabelPluginNeeded("transform-for-of")) {
    babelPluginStructure["transform-for-of"] = requireBabelPlugin("@babel/plugin-transform-for-of");
  }

  if (isBabelPluginNeeded("transform-function-name")) {
    babelPluginStructure["transform-function-name"] = requireBabelPlugin("@babel/plugin-transform-function-name");
  }

  if (isBabelPluginNeeded("transform-literals")) {
    babelPluginStructure["transform-literals"] = requireBabelPlugin("@babel/plugin-transform-literals");
  }

  if (isBabelPluginNeeded("transform-new-target")) {
    babelPluginStructure["transform-new-target"] = requireBabelPlugin("@babel/plugin-transform-new-target");
  }

  if (isBabelPluginNeeded("transform-object-super")) {
    babelPluginStructure["transform-object-super"] = requireBabelPlugin("@babel/plugin-transform-object-super");
  }

  if (isBabelPluginNeeded("transform-parameters")) {
    babelPluginStructure["transform-parameters"] = requireBabelPlugin("@babel/plugin-transform-parameters");
  }

  if (isBabelPluginNeeded("transform-regenerator")) {
    babelPluginStructure["transform-regenerator"] = [requireBabelPlugin("@babel/plugin-transform-regenerator"), {
      asyncGenerators: true,
      generators: true,
      async: false
    }];
  }

  if (isBabelPluginNeeded("transform-shorthand-properties")) {
    babelPluginStructure["transform-shorthand-properties"] = [requireBabelPlugin("@babel/plugin-transform-shorthand-properties")];
  }

  if (isBabelPluginNeeded("transform-spread")) {
    babelPluginStructure["transform-spread"] = [requireBabelPlugin("@babel/plugin-transform-spread")];
  }

  if (isBabelPluginNeeded("transform-sticky-regex")) {
    babelPluginStructure["transform-sticky-regex"] = [requireBabelPlugin("@babel/plugin-transform-sticky-regex")];
  }

  if (isBabelPluginNeeded("transform-template-literals")) {
    babelPluginStructure["transform-template-literals"] = [requireBabelPlugin("@babel/plugin-transform-template-literals")];
  }

  if (isBabelPluginNeeded("transform-typeof-symbol") && // prevent "typeof" to be injected into itself:
  // - not needed
  // - would create infinite attempt to transform typeof
  url !== getBabelHelperFileUrl("typeof")) {
    babelPluginStructure["transform-typeof-symbol"] = [requireBabelPlugin("@babel/plugin-transform-typeof-symbol")];
  }

  if (isBabelPluginNeeded("transform-unicode-regex")) {
    babelPluginStructure["transform-unicode-regex"] = [requireBabelPlugin("@babel/plugin-transform-unicode-regex")];
  }

  return babelPluginStructure;
};

// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1
// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-plugin-external-helpers/src/index.js

const babelPluginBabelHelpersAsJsenvImports = (babel, {
  getImportSpecifier
}) => {
  return {
    name: "babel-helper-as-jsenv-import",
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
        const fileUrl = pathToFileURL(filePath).href;

        if (babelHelperNameFromUrl(fileUrl) === name) {
          return undefined;
        }

        const babelHelperImportSpecifier = getBabelHelperFileUrl(name);
        const helper = injectImport({
          programPath: file.path,
          from: getImportSpecifier(babelHelperImportSpecifier),
          nameHint: `_${name}`,
          // disable interop, useless as we work only with js modules
          importedType: "es6" // importedInterop: "uncompiled",

        });
        cachedHelpers[name] = helper;
        return helper;
      });
    }
  };
};

const babelPluginNewStylesheetAsJsenvImport = (babel, {
  getImportSpecifier
}) => {
  const newStylesheetClientFileUrl = new URL("./new_stylesheet.js", import.meta.url).href;
  return {
    name: "new-stylesheet-as-jsenv-import",
    visitor: {
      Program: (programPath, {
        filename
      }) => {
        const fileUrl = pathToFileURL(filename).href;

        if (fileUrl === newStylesheetClientFileUrl) {
          return;
        }

        let usesNewStylesheet = false;
        programPath.traverse({
          NewExpression: path => {
            usesNewStylesheet = isNewCssStyleSheetCall(path.node);

            if (usesNewStylesheet) {
              path.stop();
            }
          },
          MemberExpression: path => {
            usesNewStylesheet = isDocumentAdoptedStyleSheets(path.node);

            if (usesNewStylesheet) {
              path.stop();
            }
          },
          CallExpression: path => {
            if (path.node.callee.type !== "Import") {
              // Some other function call, not import();
              return;
            }

            if (path.node.arguments[0].type !== "StringLiteral") {
              // Non-string argument, probably a variable or expression, e.g.
              // import(moduleId)
              // import('./' + moduleName)
              return;
            }

            const sourcePath = path.get("arguments")[0];
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath) || hasImportTypeCssAssertion(path);

            if (usesNewStylesheet) {
              path.stop();
            }
          },
          ImportDeclaration: path => {
            const sourcePath = path.get("source");
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath) || hasImportTypeCssAssertion(path);

            if (usesNewStylesheet) {
              path.stop();
            }
          },
          ExportAllDeclaration: path => {
            const sourcePath = path.get("source");
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath);

            if (usesNewStylesheet) {
              path.stop();
            }
          },
          ExportNamedDeclaration: path => {
            if (!path.node.source) {
              // This export has no "source", so it's probably
              // a local variable or function, e.g.
              // export { varName }
              // export const constName = ...
              // export function funcName() {}
              return;
            }

            const sourcePath = path.get("source");
            usesNewStylesheet = hasCssModuleQueryParam(sourcePath);

            if (usesNewStylesheet) {
              path.stop();
            }
          }
        });

        if (usesNewStylesheet) {
          injectImport({
            programPath,
            from: getImportSpecifier(newStylesheetClientFileUrl),
            sideEffect: true
          });
        }
      }
    }
  };
};

const isNewCssStyleSheetCall = node => {
  return node.type === "NewExpression" && node.callee.type === "Identifier" && node.callee.name === "CSSStyleSheet";
};

const isDocumentAdoptedStyleSheets = node => {
  return node.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === "document" && node.property.type === "Identifier" && node.property.name === "adoptedStyleSheets";
};

const hasCssModuleQueryParam = path => {
  const {
    node
  } = path;
  return node.type === "StringLiteral" && new URL(node.value, "https://jsenv.dev").searchParams.has(`css_module`);
};

const hasImportTypeCssAssertion = path => {
  const importAssertionsDescriptor = getImportAssertionsDescriptor(path.node.assertions);
  return Boolean(importAssertionsDescriptor.type === "css");
};

const getImportAssertionsDescriptor = importAssertions => {
  const importAssertionsDescriptor = {};

  if (importAssertions) {
    importAssertions.forEach(importAssertion => {
      importAssertionsDescriptor[importAssertion.key.name] = importAssertion.value.value;
    });
  }

  return importAssertionsDescriptor;
};

const babelPluginGlobalThisAsJsenvImport = (babel, {
  getImportSpecifier
}) => {
  const globalThisClientFileUrl = new URL("./global_this.js", import.meta.url).href;
  return {
    name: "global-this-as-jsenv-import",
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const fileUrl = pathToFileURL(filename).href;

        if (fileUrl === globalThisClientFileUrl) {
          return;
        }

        const {
          node
        } = path; // we should do this once, tree shaking will remote it but still

        if (node.name === "globalThis") {
          injectImport({
            programPath: path.scope.getProgramParent().path,
            from: getImportSpecifier(globalThisClientFileUrl),
            sideEffect: true
          });
        }
      }

    }
  };
};

const babelPluginRegeneratorRuntimeAsJsenvImport = (babel, {
  getImportSpecifier
}) => {
  const regeneratorRuntimeClientFileUrl = new URL("./regenerator_runtime.js", import.meta.url).href;
  return {
    name: "regenerator-runtime-as-jsenv-import",
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const fileUrl = pathToFileURL(filename).href;

        if (fileUrl === regeneratorRuntimeClientFileUrl) {
          return;
        }

        const {
          node
        } = path;

        if (node.name === "regeneratorRuntime") {
          injectImport({
            programPath: path.scope.getProgramParent().path,
            from: getImportSpecifier(regeneratorRuntimeClientFileUrl),
            sideEffect: true
          });
        }
      }

    }
  };
};

const jsenvPluginBabel = ({
  getCustomBabelPlugins,
  babelHelpersAsImport = true
} = {}) => {
  const transformWithBabel = async (urlInfo, context) => {
    const isJsModule = urlInfo.type === "js_module";
    const isWorker = urlInfo.subtype === "worker";
    const isServiceWorker = urlInfo.subtype === "service_worker";
    const isSharedWorker = urlInfo.subtype === "shared_worker";
    const isWorkerContext = isWorker || isServiceWorker || isSharedWorker;
    let {
      clientRuntimeCompat
    } = context;

    if (isWorker) {
      clientRuntimeCompat = RUNTIME_COMPAT.add(clientRuntimeCompat, "worker");
    } else if (isServiceWorker) {
      // when code is executed by a service worker we can assume
      // the execution context supports more than the default one
      // for instance arrow function are supported
      clientRuntimeCompat = RUNTIME_COMPAT.add(clientRuntimeCompat, "service_worker");
    } else if (isSharedWorker) {
      clientRuntimeCompat = RUNTIME_COMPAT.add(clientRuntimeCompat, "shared_worker");
    }

    const isSupported = feature => RUNTIME_COMPAT.isSupported(clientRuntimeCompat, feature);

    const getImportSpecifier = clientFileUrl => {
      const [reference] = context.referenceUtils.inject({
        type: "js_import_export",
        expectedType: "js_module",
        specifier: clientFileUrl
      });
      return JSON.parse(reference.generatedSpecifier);
    };

    const babelPluginStructure = getBaseBabelPluginStructure({
      url: urlInfo.url,
      isSupported,
      isWorkerContext,
      isJsModule,
      getImportSpecifier
    });

    if (getCustomBabelPlugins) {
      Object.assign(babelPluginStructure, getCustomBabelPlugins(context));
    }

    if (isJsModule && babelHelpersAsImport) {
      if (!isSupported("global_this")) {
        babelPluginStructure["global-this-as-jsenv-import"] = [babelPluginGlobalThisAsJsenvImport, {
          getImportSpecifier
        }];
      }

      if (!isSupported("async_generator_function")) {
        babelPluginStructure["regenerator-runtime-as-jsenv-import"] = [babelPluginRegeneratorRuntimeAsJsenvImport, {
          getImportSpecifier
        }];
      }

      if (!isSupported("new_stylesheet")) {
        babelPluginStructure["new-stylesheet-as-jsenv-import"] = [babelPluginNewStylesheetAsJsenvImport, {
          getImportSpecifier
        }];
      }

      if (Object.keys(babelPluginStructure).length > 0) {
        babelPluginStructure["babel-helper-as-jsenv-import"] = [babelPluginBabelHelpersAsJsenvImports, {
          getImportSpecifier
        }];
      }
    } // otherwise, concerning global_this, and new_stylesheet we must inject the code
    // (we cannot inject an import)


    const babelPlugins = Object.keys(babelPluginStructure).map(babelPluginName => babelPluginStructure[babelPluginName]);
    const {
      code,
      map
    } = await applyBabelPlugins({
      babelPlugins,
      urlInfo
    });
    return {
      content: code,
      sourcemap: map
    };
  };

  return {
    name: "jsenv:babel",
    appliesDuring: "*",
    finalizeUrlContent: {
      js_classic: transformWithBabel,
      js_module: transformWithBabel
    }
  };
};

// https://mathiasbynens.be/notes/globalthis

/* eslint-disable no-redeclare */

/* global globalThis */
let globalObject;

if (typeof globalThis === "object") {
  globalObject = globalThis;
} else {
  if (undefined) {
    globalObject = undefined;
  } else {
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, "__global__", {
      get() {
        return this;
      },

      configurable: true
    }); // eslint-disable-next-line no-undef

    globalObject = __global__;
    delete Object.prototype.__global__;
  }

  globalObject.globalThis = globalObject;
}

var globalObject$1 = globalObject;

/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var runtime = function (exports) {

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined$1; // More compressible than void 0.

  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function define(obj, key, value) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    return obj[key];
  }

  try {
    // IE 8 has a broken Object.defineProperty that only works on DOM objects.
    define({}, "");
  } catch (err) {
    define = function (obj, key, value) {
      return obj[key] = value;
    };
  }

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []); // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.

    generator._invoke = makeInvokeMethod(innerFn, self, context);
    return generator;
  }

  exports.wrap = wrap; // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.

  function tryCatch(fn, obj, arg) {
    try {
      return {
        type: "normal",
        arg: fn.call(obj, arg)
      };
    } catch (err) {
      return {
        type: "throw",
        arg: err
      };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed"; // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.

  var ContinueSentinel = {}; // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.

  function Generator() {}

  function GeneratorFunction() {}

  function GeneratorFunctionPrototype() {} // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.


  var IteratorPrototype = {};

  IteratorPrototype[iteratorSymbol] = function () {
    return this;
  };

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));

  if (NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunction.displayName = define(GeneratorFunctionPrototype, toStringTagSymbol, "GeneratorFunction"); // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.

  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function (method) {
      define(prototype, method, function (arg) {
        return this._invoke(method, arg);
      });
    });
  }

  exports.isGeneratorFunction = function (genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor ? ctor === GeneratorFunction || // For the native GeneratorFunction constructor, the best we can
    // do is to check its .name property.
    (ctor.displayName || ctor.name) === "GeneratorFunction" : false;
  };

  exports.mark = function (genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      define(genFun, toStringTagSymbol, "GeneratorFunction");
    }

    genFun.prototype = Object.create(Gp);
    return genFun;
  }; // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.


  exports.awrap = function (arg) {
    return {
      __await: arg
    };
  };

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);

      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;

        if (value && typeof value === "object" && hasOwn.call(value, "__await")) {
          return PromiseImpl.resolve(value.__await).then(function (value) {
            invoke("next", value, resolve, reject);
          }, function (err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return PromiseImpl.resolve(value).then(function (unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function (error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function (resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise = // If enqueue has been called before, then we want to wait until
      // all previous Promises have been resolved before calling invoke,
      // so that results are always delivered in the correct order. If
      // enqueue has not been called before, then it is important to
      // call invoke immediately, without waiting on a callback to fire,
      // so that the async generator function has the opportunity to do
      // any necessary setup in a predictable way. This predictability
      // is why the Promise constructor synchronously invokes its
      // executor callback, and why async functions synchronously
      // execute code before the first await. Since we implement simple
      // async functions in terms of async generators, it is especially
      // important to get this right, even though it requires care.
      previousPromise ? previousPromise.then(callInvokeWithMethodAndArg, // Avoid propagating failures to Promises returned by later
      // invocations of the iterator.
      callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
    } // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).


    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);

  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
    return this;
  };

  exports.AsyncIterator = AsyncIterator; // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.

  exports.async = function (innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    if (PromiseImpl === void 0) PromiseImpl = Promise;
    var iter = new AsyncIterator(wrap(innerFn, outerFn, self, tryLocsList), PromiseImpl);
    return exports.isGeneratorFunction(outerFn) ? iter // If outerFn is a generator, return the full iterator.
    : iter.next().then(function (result) {
      return result.done ? result.value : iter.next();
    });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;
    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        } // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume


        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;

        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);

          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;
        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);
        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;
        var record = tryCatch(innerFn, self, context);

        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done ? GenStateCompleted : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };
        } else if (record.type === "throw") {
          state = GenStateCompleted; // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.

          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  } // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.


  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];

    if (method === undefined$1) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        // Note: ["return"] must be used for ES3 parsing compatibility.
        if (delegate.iterator["return"]) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined$1;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError("The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (!info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value; // Resume execution at the desired location (see delegateYield).

      context.next = delegate.nextLoc; // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.

      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined$1;
      }
    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    } // The delegate iterator is finished, so forget it and continue with
    // the outer generator.


    context.delegate = null;
    return ContinueSentinel;
  } // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.


  defineIteratorMethods(Gp);
  define(Gp, toStringTagSymbol, "Generator"); // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.

  Gp[iteratorSymbol] = function () {
    return this;
  };

  Gp.toString = function () {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = {
      tryLoc: locs[0]
    };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{
      tryLoc: "root"
    }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function (object) {
    var keys = [];

    for (var key in object) {
      keys.push(key);
    }

    keys.reverse(); // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.

    return function next() {
      while (keys.length) {
        var key = keys.pop();

        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      } // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.


      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];

      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1,
            next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined$1;
          next.done = true;
          return next;
        };

        return next.next = next;
      }
    } // Return an iterator with no values.


    return {
      next: doneResult
    };
  }

  exports.values = values;

  function doneResult() {
    return {
      value: undefined$1,
      done: true
    };
  }

  Context.prototype = {
    constructor: Context,
    reset: function (skipTempReset) {
      this.prev = 0;
      this.next = 0; // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.

      this.sent = this._sent = undefined$1;
      this.done = false;
      this.delegate = null;
      this.method = "next";
      this.arg = undefined$1;
      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" && hasOwn.call(this, name) && !isNaN(+name.slice(1))) {
            this[name] = undefined$1;
          }
        }
      }
    },
    stop: function () {
      this.done = true;
      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;

      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },
    dispatchException: function (exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;

      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined$1;
        }

        return !!caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }
          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }
          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }
          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },
    abrupt: function (type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];

        if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry && (type === "break" || type === "continue") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },
    complete: function (record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" || record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },
    finish: function (finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];

        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },
    "catch": function (tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];

        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;

          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }

          return thrown;
        }
      } // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.


      throw new Error("illegal catch attempt");
    },
    delegateYield: function (iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined$1;
      }

      return ContinueSentinel;
    }
  }; // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.

  return exports;
}( // If this script is executing as a CommonJS module, use module.exports
// as the regeneratorRuntime namespace. Otherwise create a new empty
// object. Either way, the resulting object will be used to initialize
// the regeneratorRuntime variable at the top of this file.
typeof module === "object" ? module.exports : {});

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  Function("r", "regeneratorRuntime = r")(runtime);
}

/* eslint-disable */

(function () {

  if (typeof document === "undefined" || "adoptedStyleSheets" in document) {
    return;
  }

  var hasShadyCss = "ShadyCSS" in window && !ShadyCSS.nativeShadow;
  var bootstrapper = document.implementation.createHTMLDocument("");
  var closedShadowRootRegistry = new WeakMap();

  var _DOMException = typeof DOMException === "object" ? Error : DOMException;

  var defineProperty = Object.defineProperty;
  var forEach = Array.prototype.forEach;

  var hasBrokenRules = function () {
    var style = bootstrapper.createElement("style");
    style.textContent = '.x{content:"y"}';
    bootstrapper.body.appendChild(style);
    return style.sheet.cssRules[0].style.content !== '"y"';
  }();

  var brokenRulePatterns = [/content:\s*["']/gm];

  function fixBrokenRules(content) {
    return brokenRulePatterns.reduce(function (acc, pattern) {
      return acc.replace(pattern, "$&%%%");
    }, content);
  }

  var placeholderPatterns = [/(content:\s*["'])%%%/gm];
  var getCssText = hasBrokenRules ? function (rule) {
    return placeholderPatterns.reduce(function (acc, pattern) {
      return acc.replace(pattern, "$1");
    }, rule.cssText);
  } : function (rule) {
    return rule.cssText;
  };
  var importPattern = /@import.+?;?$/gm;

  function rejectImports(contents) {
    var _contents = contents.replace(importPattern, "");

    if (_contents !== contents) {
      console.warn("@import rules are not allowed here. See https://github.com/WICG/construct-stylesheets/issues/119#issuecomment-588352418");
    }

    return _contents.trim();
  }

  function clearRules(sheet) {
    for (var i = 0; i < sheet.cssRules.length; i++) {
      sheet.deleteRule(0);
    }
  }

  function insertAllRules(from, to) {
    forEach.call(from.cssRules, function (rule, i) {
      to.insertRule(getCssText(rule), i);
    });
  }

  function isElementConnected(element) {
    return "isConnected" in element ? element.isConnected : document.contains(element);
  }

  function unique(arr) {
    return arr.filter(function (value, index) {
      return arr.indexOf(value) === index;
    });
  }

  function diff(arr1, arr2) {
    return arr1.filter(function (value) {
      return arr2.indexOf(value) === -1;
    });
  }

  function removeNode(node) {
    node.parentNode.removeChild(node);
  }

  function getShadowRoot(element) {
    return element.shadowRoot || closedShadowRootRegistry.get(element);
  }

  var cssStyleSheetMethods = ["addRule", "deleteRule", "insertRule", "removeRule"];
  var NonConstructedStyleSheet = CSSStyleSheet;
  var nonConstructedProto = NonConstructedStyleSheet.prototype;

  nonConstructedProto.replace = function () {
    return Promise.reject(new _DOMException("Can't call replace on non-constructed CSSStyleSheets."));
  };

  nonConstructedProto.replaceSync = function () {
    throw new _DOMException("Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.");
  };

  function isCSSStyleSheetInstance(instance) {
    return typeof instance === "object" ? proto$1.isPrototypeOf(instance) || nonConstructedProto.isPrototypeOf(instance) : false;
  }

  function isNonConstructedStyleSheetInstance(instance) {
    return typeof instance === "object" ? nonConstructedProto.isPrototypeOf(instance) : false;
  }

  var $basicStyleSheet = new WeakMap();
  var $locations = new WeakMap();
  var $adoptersByLocation = new WeakMap();

  function addAdopterLocation(sheet, location) {
    var adopter = document.createElement("style");
    $adoptersByLocation.get(sheet).set(location, adopter);
    $locations.get(sheet).push(location);
    return adopter;
  }

  function getAdopterByLocation(sheet, location) {
    return $adoptersByLocation.get(sheet).get(location);
  }

  function removeAdopterLocation(sheet, location) {
    $adoptersByLocation.get(sheet).delete(location);
    $locations.set(sheet, $locations.get(sheet).filter(function (_location) {
      return _location !== location;
    }));
  }

  function restyleAdopter(sheet, adopter) {
    requestAnimationFrame(function () {
      clearRules(adopter.sheet);
      insertAllRules($basicStyleSheet.get(sheet), adopter.sheet);
    });
  }

  function checkInvocationCorrectness(self) {
    if (!$basicStyleSheet.has(self)) {
      throw new TypeError("Illegal invocation");
    }
  }

  function ConstructedStyleSheet() {
    var self = this;
    var style = document.createElement("style");
    bootstrapper.body.appendChild(style);
    $basicStyleSheet.set(self, style.sheet);
    $locations.set(self, []);
    $adoptersByLocation.set(self, new WeakMap());
  }

  var proto$1 = ConstructedStyleSheet.prototype;

  proto$1.replace = function replace(contents) {
    try {
      this.replaceSync(contents);
      return Promise.resolve(this);
    } catch (e) {
      return Promise.reject(e);
    }
  };

  proto$1.replaceSync = function replaceSync(contents) {
    checkInvocationCorrectness(this);

    if (typeof contents === "string") {
      var self_1 = this;
      var style = $basicStyleSheet.get(self_1).ownerNode;
      style.textContent = hasBrokenRules ? fixBrokenRules(rejectImports(contents)) : rejectImports(contents);
      $basicStyleSheet.set(self_1, style.sheet);
      $locations.get(self_1).forEach(function (location) {
        if (location.isConnected()) {
          restyleAdopter(self_1, getAdopterByLocation(self_1, location));
        }
      });
    }
  };

  defineProperty(proto$1, "cssRules", {
    configurable: true,
    enumerable: true,
    get: function cssRules() {
      checkInvocationCorrectness(this);
      return $basicStyleSheet.get(this).cssRules;
    }
  });
  cssStyleSheetMethods.forEach(function (method) {
    proto$1[method] = function () {
      var self = this;
      checkInvocationCorrectness(self);
      var args = arguments;
      $locations.get(self).forEach(function (location) {
        if (location.isConnected()) {
          var sheet = getAdopterByLocation(self, location).sheet;
          sheet[method].apply(sheet, args);
        }
      });

      if (hasBrokenRules) {
        if (method === "insertRule") {
          args[0] = fixBrokenRules(args[0]);
        }

        if (method === "addRule") {
          args[1] = fixBrokenRules(args[1]);
        }
      }

      var basic = $basicStyleSheet.get(self);
      return basic[method].apply(basic, args);
    };
  });
  defineProperty(ConstructedStyleSheet, Symbol.hasInstance, {
    configurable: true,
    value: isCSSStyleSheetInstance
  });
  var defaultObserverOptions = {
    childList: true,
    subtree: true
  };
  var locations = new WeakMap();

  function getAssociatedLocation(element) {
    var location = locations.get(element);

    if (!location) {
      location = new Location(element);
      locations.set(element, location);
    }

    return location;
  }

  function attachAdoptedStyleSheetProperty(constructor) {
    defineProperty(constructor.prototype, "adoptedStyleSheets", {
      configurable: true,
      enumerable: true,
      get: function () {
        return getAssociatedLocation(this).sheets;
      },
      set: function (sheets) {
        getAssociatedLocation(this).update(sheets);
      }
    });
  }

  function traverseWebComponents(node, callback) {
    var iter = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT, function (foundNode) {
      return getShadowRoot(foundNode) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }, null, false);

    for (var next = void 0; next = iter.nextNode();) {
      callback(getShadowRoot(next));
    }
  }

  var $element = new WeakMap();
  var $uniqueSheets = new WeakMap();
  var $observer = new WeakMap();

  function isExistingAdopter(self, element) {
    return element instanceof HTMLStyleElement && $uniqueSheets.get(self).some(function (sheet) {
      return getAdopterByLocation(sheet, self);
    });
  }

  function getAdopterContainer(self) {
    var element = $element.get(self);
    return element instanceof Document ? element.body : element;
  }

  function adopt(self) {
    var styleList = document.createDocumentFragment();
    var sheets = $uniqueSheets.get(self);
    var observer = $observer.get(self);
    var container = getAdopterContainer(self);
    observer.disconnect();
    sheets.forEach(function (sheet) {
      styleList.appendChild(getAdopterByLocation(sheet, self) || addAdopterLocation(sheet, self));
    });
    container.insertBefore(styleList, null);
    observer.observe(container, defaultObserverOptions);
    sheets.forEach(function (sheet) {
      restyleAdopter(sheet, getAdopterByLocation(sheet, self));
    });
  }

  function Location(element) {
    var self = this;
    self.sheets = [];
    $element.set(self, element);
    $uniqueSheets.set(self, []);
    $observer.set(self, new MutationObserver(function (mutations, observer) {
      if (!document) {
        observer.disconnect();
        return;
      }

      mutations.forEach(function (mutation) {
        if (!hasShadyCss) {
          forEach.call(mutation.addedNodes, function (node) {
            if (!(node instanceof Element)) {
              return;
            }

            traverseWebComponents(node, function (root) {
              getAssociatedLocation(root).connect();
            });
          });
        }

        forEach.call(mutation.removedNodes, function (node) {
          if (!(node instanceof Element)) {
            return;
          }

          if (isExistingAdopter(self, node)) {
            adopt(self);
          }

          if (!hasShadyCss) {
            traverseWebComponents(node, function (root) {
              getAssociatedLocation(root).disconnect();
            });
          }
        });
      });
    }));
  }

  Location.prototype = {
    isConnected: function () {
      var element = $element.get(this);
      return element instanceof Document ? element.readyState !== "loading" : isElementConnected(element.host);
    },
    connect: function () {
      var container = getAdopterContainer(this);
      $observer.get(this).observe(container, defaultObserverOptions);

      if ($uniqueSheets.get(this).length > 0) {
        adopt(this);
      }

      traverseWebComponents(container, function (root) {
        getAssociatedLocation(root).connect();
      });
    },
    disconnect: function () {
      $observer.get(this).disconnect();
    },
    update: function (sheets) {
      var self = this;
      var locationType = $element.get(self) === document ? "Document" : "ShadowRoot";

      if (!Array.isArray(sheets)) {
        throw new TypeError("Failed to set the 'adoptedStyleSheets' property on " + locationType + ": Iterator getter is not callable.");
      }

      if (!sheets.every(isCSSStyleSheetInstance)) {
        throw new TypeError("Failed to set the 'adoptedStyleSheets' property on " + locationType + ": Failed to convert value to 'CSSStyleSheet'");
      }

      if (sheets.some(isNonConstructedStyleSheetInstance)) {
        throw new TypeError("Failed to set the 'adoptedStyleSheets' property on " + locationType + ": Can't adopt non-constructed stylesheets");
      }

      self.sheets = sheets;
      var oldUniqueSheets = $uniqueSheets.get(self);
      var uniqueSheets = unique(sheets);
      var removedSheets = diff(oldUniqueSheets, uniqueSheets);
      removedSheets.forEach(function (sheet) {
        removeNode(getAdopterByLocation(sheet, self));
        removeAdopterLocation(sheet, self);
      });
      $uniqueSheets.set(self, uniqueSheets);

      if (self.isConnected() && uniqueSheets.length > 0) {
        adopt(self);
      }
    }
  };
  window.CSSStyleSheet = ConstructedStyleSheet;
  attachAdoptedStyleSheetProperty(Document);

  if ("ShadowRoot" in window) {
    attachAdoptedStyleSheetProperty(ShadowRoot);
    var proto = Element.prototype;
    var attach_1 = proto.attachShadow;

    proto.attachShadow = function attachShadow(init) {
      var root = attach_1.call(this, init);

      if (init.mode === "closed") {
        closedShadowRootRegistry.set(this, root);
      }

      return root;
    };
  }

  var documentLocation = getAssociatedLocation(document);

  if (documentLocation.isConnected()) {
    documentLocation.connect();
  } else {
    document.addEventListener("DOMContentLoaded", documentLocation.connect.bind(documentLocation));
  }
})();

export { RUNTIME_COMPAT as R, babelHelperNameFromUrl as b, globalObject$1 as g, jsenvPluginBabel as j, requireBabelPlugin as r };
