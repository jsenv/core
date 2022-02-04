/*
 * Some syntaxes assumed to be enabled by default
 */

export const babelPluginSyntaxes = () => {
  return {
    name: "syntaxes",

    manipulateOptions(opts, parserOpts) {
      parserOpts.plugins.push(["importAssertions"])
    },
  }
}
