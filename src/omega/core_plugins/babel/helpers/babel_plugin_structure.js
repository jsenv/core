import { getBabelHelperFileUrl, requireBabelPlugin } from "@jsenv/babel-plugins"
import { babelPluginCompatMap } from "./babel_plugins_compatibility.js"

export const getBaseBabelPluginStructure = ({
  url,
  isSupportedOnRuntime,
  usesTopLevelAwait,
  //   // https://github.com/rpetrich/babel-plugin-transform-async-to-promises/blob/92755ff8c943c97596523e586b5fa515c2e99326/async-to-promises.ts#L55
  topLevelAwait = "simple",
  isJsModule,
}) => {
  const isBabelPluginNeeded = (babelPluginName) => {
    return !isSupportedOnRuntime(babelPluginCompatMap[babelPluginName])
  }

  const babelPluginStructure = {}
  if (isBabelPluginNeeded("proposal-numeric-separator")) {
    babelPluginStructure["proposal-numeric-separator"] = requireBabelPlugin(
      "@babel/plugin-proposal-numeric-separator",
    )
  }
  if (isBabelPluginNeeded("proposal-json-strings")) {
    babelPluginStructure["proposal-json-strings"] = requireBabelPlugin(
      "@babel/plugin-proposal-json-strings",
    )
  }
  if (isBabelPluginNeeded("proposal-object-rest-spread")) {
    babelPluginStructure["proposal-object-rest-spread"] = requireBabelPlugin(
      "@babel/plugin-proposal-object-rest-spread",
    )
  }
  if (isBabelPluginNeeded("proposal-optional-catch-binding")) {
    babelPluginStructure["proposal-optional-catch-binding"] =
      requireBabelPlugin("@babel/plugin-proposal-optional-catch-binding")
  }
  if (isBabelPluginNeeded("proposal-unicode-property-regex")) {
    babelPluginStructure["proposal-unicode-property-regex"] =
      requireBabelPlugin("@babel/plugin-proposal-unicode-property-regex")
  }
  if (
    isJsModule &&
    usesTopLevelAwait &&
    !isSupportedOnRuntime("top_level_await")
  ) {
    babelPluginStructure["transform-async-to-promises"] = [
      requireBabelPlugin("babel-plugin-transform-async-to-promises"),
      {
        topLevelAwait,
      },
    ]
  } else if (isBabelPluginNeeded("transform-async-to-promises")) {
    babelPluginStructure["transform-async-to-promises"] = requireBabelPlugin(
      "babel-plugin-transform-async-to-promises",
    )
  }
  if (isBabelPluginNeeded("transform-arrow-functions")) {
    babelPluginStructure["transform-arrow-functions"] = requireBabelPlugin(
      "@babel/plugin-transform-arrow-functions",
    )
  }
  if (isBabelPluginNeeded("transform-block-scoped-functions")) {
    babelPluginStructure["transform-block-scoped-functions"] =
      requireBabelPlugin("@babel/plugin-transform-block-scoped-functions")
  }
  if (isBabelPluginNeeded("transform-block-scoping")) {
    babelPluginStructure["transform-block-scoping"] = requireBabelPlugin(
      "@babel/plugin-transform-block-scoping",
    )
  }
  if (isBabelPluginNeeded("transform-classes")) {
    babelPluginStructure["transform-classes"] = requireBabelPlugin(
      "@babel/plugin-transform-classes",
    )
  }
  if (isBabelPluginNeeded("transform-computed-properties")) {
    babelPluginStructure["transform-computed-properties"] = requireBabelPlugin(
      "@babel/plugin-transform-computed-properties",
    )
  }
  if (isBabelPluginNeeded("transform-destructuring")) {
    babelPluginStructure["transform-destructuring"] = requireBabelPlugin(
      "@babel/plugin-transform-destructuring",
    )
  }
  if (isBabelPluginNeeded("transform-dotall-regex")) {
    babelPluginStructure["transform-dotall-regex"] = requireBabelPlugin(
      "@babel/plugin-transform-dotall-regex",
    )
  }
  if (isBabelPluginNeeded("transform-duplicate-keys")) {
    babelPluginStructure["transform-duplicate-keys"] = requireBabelPlugin(
      "@babel/plugin-transform-duplicate-keys",
    )
  }
  if (isBabelPluginNeeded("transform-exponentiation-operator")) {
    babelPluginStructure["transform-exponentiation-operator"] =
      requireBabelPlugin("@babel/plugin-transform-exponentiation-operator")
  }
  if (isBabelPluginNeeded("transform-for-of")) {
    babelPluginStructure["transform-for-of"] = requireBabelPlugin(
      "@babel/plugin-transform-for-of",
    )
  }
  if (isBabelPluginNeeded("transform-function-name")) {
    babelPluginStructure["transform-function-name"] = requireBabelPlugin(
      "@babel/plugin-transform-function-name",
    )
  }
  if (isBabelPluginNeeded("transform-literals")) {
    babelPluginStructure["transform-literals"] = requireBabelPlugin(
      "@babel/plugin-transform-literals",
    )
  }
  if (isBabelPluginNeeded("transform-new-target")) {
    babelPluginStructure["transform-new-target"] = requireBabelPlugin(
      "@babel/plugin-transform-new-target",
    )
  }
  if (isBabelPluginNeeded("transform-object-super")) {
    babelPluginStructure["transform-object-super"] = requireBabelPlugin(
      "@babel/plugin-transform-object-super",
    )
  }
  if (isBabelPluginNeeded("transform-parameters")) {
    babelPluginStructure["transform-parameters"] = requireBabelPlugin(
      "@babel/plugin-transform-parameters",
    )
  }
  if (isBabelPluginNeeded("transform-regenerator")) {
    babelPluginStructure["transform-regenerator"] = [
      requireBabelPlugin("@babel/plugin-transform-regenerator"),
      {
        asyncGenerators: true,
        generators: true,
        async: false,
      },
    ]
  }
  if (isBabelPluginNeeded("transform-shorthand-properties")) {
    babelPluginStructure["transform-shorthand-properties"] = [
      requireBabelPlugin("@babel/plugin-transform-shorthand-properties"),
    ]
  }
  if (isBabelPluginNeeded("transform-spread")) {
    babelPluginStructure["transform-spread"] = [
      requireBabelPlugin("@babel/plugin-transform-spread"),
    ]
  }
  if (isBabelPluginNeeded("transform-sticky-regex")) {
    babelPluginStructure["transform-sticky-regex"] = [
      requireBabelPlugin("@babel/plugin-transform-sticky-regex"),
    ]
  }
  if (isBabelPluginNeeded("transform-template-literals")) {
    babelPluginStructure["transform-template-literals"] = [
      requireBabelPlugin("@babel/plugin-transform-template-literals"),
    ]
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
    ]
  }
  if (isBabelPluginNeeded("transform-unicode-regex")) {
    babelPluginStructure["transform-unicode-regex"] = [
      requireBabelPlugin("@babel/plugin-transform-unicode-regex"),
    ]
  }
  return babelPluginStructure
}
