export const jsenvPluginLeadingSlash = () => {
  return {
    name: "jsenv:leading_slash",
    appliesDuring: "*",
    resolveUrl: (reference, context) => {
      if (reference.specifier[0] !== "/") {
        return null
      }
      return new URL(reference.specifier.slice(1), context.rootDirectoryUrl)
        .href
    },
  }
}
