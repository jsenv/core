import { transformReplaceExpressions } from "./jsenv_babel_plugins/transform_replace_expressions.js"

export const getJsenvBabelPluginStructure = () => {
  return {
    "transform-replace-expressions": [transformReplaceExpressions, {}],
  }
}
