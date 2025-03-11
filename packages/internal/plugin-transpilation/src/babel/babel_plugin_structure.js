import { createRequire } from "node:module";

import { getBabelHelperFileUrl } from "./babel_helper_directory/babel_helper_directory.js";
import { babelPluginCompatMap } from "./babel_plugins_compatibility.js";

const requireBabelPlugin = createRequire(import.meta.url);

export const getBaseBabelPluginStructure = ({
  url,
  isSupported,
  // isJsModule,
  // getImportSpecifier,
}) => {
  const isBabelPluginNeeded = (babelPluginName) => {
    return !isSupported(babelPluginName, babelPluginCompatMap[babelPluginName]);
  };

  const babelPluginStructure = {};
  if (isBabelPluginNeeded("transform-numeric-separator")) {
    babelPluginStructure["transform-numeric-separator"] = requireBabelPlugin(
      "@babel/plugin-transform-numeric-separator",
    );
  }
  if (isBabelPluginNeeded("transform-json-strings")) {
    babelPluginStructure["transform-json-strings"] = requireBabelPlugin(
      "@babel/plugin-transform-json-strings",
    );
  }
  if (isBabelPluginNeeded("transform-object-rest-spread")) {
    babelPluginStructure["transform-object-rest-spread"] = requireBabelPlugin(
      "@babel/plugin-transform-object-rest-spread",
    );
  }
  if (isBabelPluginNeeded("transform-optional-catch-binding")) {
    babelPluginStructure["transform-optional-catch-binding"] =
      requireBabelPlugin("@babel/plugin-transform-optional-catch-binding");
  }
  if (isBabelPluginNeeded("transform-unicode-property-regex")) {
    babelPluginStructure["transform-unicode-property-regex"] =
      requireBabelPlugin("@babel/plugin-transform-unicode-property-regex");
  }
  // if (isBabelPluginNeeded("proposal-decorators") && content.includes("@")) {
  //   babelPluginStructure["proposal-decorators"] = [
  //     requireBabelPlugin("@babel/plugin-proposal-decorators"),
  //     {
  //       version: "2023-05",
  //     },
  //   ];
  // }
  if (isBabelPluginNeeded("transform-async-to-promises")) {
    babelPluginStructure["transform-async-to-promises"] = [
      requireBabelPlugin("babel-plugin-transform-async-to-promises"),
      {
        topLevelAwait: "ignore", // will be handled by "jsenv:top_level_await" plugin
        externalHelpers: false,
        // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
        // externalHelpers: isJsModule,
        // externalHelpersPath: isJsModule ? getImportSpecifier(
        //     "babel-plugin-transform-async-to-promises/helpers.mjs",
        //   ) : null
      },
    ];
  }
  if (isBabelPluginNeeded("transform-arrow-functions")) {
    babelPluginStructure["transform-arrow-functions"] = requireBabelPlugin(
      "@babel/plugin-transform-arrow-functions",
    );
  }
  if (isBabelPluginNeeded("transform-block-scoped-functions")) {
    babelPluginStructure["transform-block-scoped-functions"] =
      requireBabelPlugin("@babel/plugin-transform-block-scoped-functions");
  }
  if (isBabelPluginNeeded("transform-block-scoping")) {
    babelPluginStructure["transform-block-scoping"] = requireBabelPlugin(
      "@babel/plugin-transform-block-scoping",
    );
  }
  if (isBabelPluginNeeded("transform-classes")) {
    babelPluginStructure["transform-classes"] = requireBabelPlugin(
      "@babel/plugin-transform-classes",
    );
  }
  if (isBabelPluginNeeded("transform-computed-properties")) {
    babelPluginStructure["transform-computed-properties"] = requireBabelPlugin(
      "@babel/plugin-transform-computed-properties",
    );
  }
  if (isBabelPluginNeeded("transform-destructuring")) {
    babelPluginStructure["transform-destructuring"] = requireBabelPlugin(
      "@babel/plugin-transform-destructuring",
    );
  }
  if (isBabelPluginNeeded("transform-dotall-regex")) {
    babelPluginStructure["transform-dotall-regex"] = requireBabelPlugin(
      "@babel/plugin-transform-dotall-regex",
    );
  }
  if (isBabelPluginNeeded("transform-duplicate-keys")) {
    babelPluginStructure["transform-duplicate-keys"] = requireBabelPlugin(
      "@babel/plugin-transform-duplicate-keys",
    );
  }
  if (isBabelPluginNeeded("transform-exponentiation-operator")) {
    babelPluginStructure["transform-exponentiation-operator"] =
      requireBabelPlugin("@babel/plugin-transform-exponentiation-operator");
  }
  if (isBabelPluginNeeded("transform-for-of")) {
    babelPluginStructure["transform-for-of"] = requireBabelPlugin(
      "@babel/plugin-transform-for-of",
    );
  }
  if (isBabelPluginNeeded("transform-function-name")) {
    babelPluginStructure["transform-function-name"] = requireBabelPlugin(
      "@babel/plugin-transform-function-name",
    );
  }
  if (isBabelPluginNeeded("transform-literals")) {
    babelPluginStructure["transform-literals"] = requireBabelPlugin(
      "@babel/plugin-transform-literals",
    );
  }
  if (isBabelPluginNeeded("transform-new-target")) {
    babelPluginStructure["transform-new-target"] = requireBabelPlugin(
      "@babel/plugin-transform-new-target",
    );
  }
  if (isBabelPluginNeeded("transform-object-super")) {
    babelPluginStructure["transform-object-super"] = requireBabelPlugin(
      "@babel/plugin-transform-object-super",
    );
  }
  if (isBabelPluginNeeded("transform-parameters")) {
    babelPluginStructure["transform-parameters"] = requireBabelPlugin(
      "@babel/plugin-transform-parameters",
    );
  }
  if (isBabelPluginNeeded("transform-regenerator")) {
    babelPluginStructure["transform-regenerator"] = [
      requireBabelPlugin("@babel/plugin-transform-regenerator"),
      {
        asyncGenerators: true,
        generators: true,
        async: false,
      },
    ];
  }
  if (isBabelPluginNeeded("transform-shorthand-properties")) {
    babelPluginStructure["transform-shorthand-properties"] = [
      requireBabelPlugin("@babel/plugin-transform-shorthand-properties"),
    ];
  }
  if (isBabelPluginNeeded("transform-spread")) {
    babelPluginStructure["transform-spread"] = [
      requireBabelPlugin("@babel/plugin-transform-spread"),
    ];
  }
  if (isBabelPluginNeeded("transform-sticky-regex")) {
    babelPluginStructure["transform-sticky-regex"] = [
      requireBabelPlugin("@babel/plugin-transform-sticky-regex"),
    ];
  }
  if (isBabelPluginNeeded("transform-template-literals")) {
    babelPluginStructure["transform-template-literals"] = [
      requireBabelPlugin("@babel/plugin-transform-template-literals"),
    ];
  }
  if (
    isBabelPluginNeeded("transform-typeof-symbol") &&
    // prevent "typeof" to be injected into itself:
    // - not needed
    // - would create infinite attempt to transform typeof
    url !== getBabelHelperFileUrl("typeof")
  ) {
    babelPluginStructure["transform-typeof-symbol"] = [
      requireBabelPlugin("@babel/plugin-transform-typeof-symbol"),
    ];
  }
  if (isBabelPluginNeeded("transform-unicode-regex")) {
    babelPluginStructure["transform-unicode-regex"] = [
      requireBabelPlugin("@babel/plugin-transform-unicode-regex"),
    ];
  }
  return babelPluginStructure;
};
