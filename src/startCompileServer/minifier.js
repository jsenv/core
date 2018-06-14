import { transform, transformFromAst } from "babel-core"
import { mergeBabelOptions, createMinifiyOptions } from "@dmail/shared-config"

export const minifier = ({ code, ast, map }, { sourceMap }) => {
  const options = mergeBabelOptions(createMinifiyOptions(), {
    sourceMaps: sourceMap,
    inputSourceMap: map,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
  })

  if (ast) {
    return transformFromAst(ast, code, options)
  }
  return transform(code, options)
}

// "babel-plugin-minify-constant-folding": "0.0.4",
// "babel-plugin-minify-dead-code-elimination": "0.1.4",
// "babel-plugin-minify-guarded-expressions": "0.0.4",
// "babel-plugin-minify-mangle-names": "0.0.8",
// "babel-plugin-minify-simplify": "0.0.8",
// "babel-plugin-minify-type-constructors": "0.0.4",

// "babel-plugin-transform-merge-sibling-variables": "6.8.2",
// "babel-plugin-transform-minify-booleans": "6.8.0",
// "babel-plugin-transform-simplify-comparison-operators": "6.8.1",
// "babel-plugin-transform-undefined-to-void": "6.8.0",
