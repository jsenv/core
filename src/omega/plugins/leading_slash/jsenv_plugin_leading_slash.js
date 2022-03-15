export const jsenvPluginLeadingSlash = () => {
  return {
    name: "jsenv:leading_slash",
    appliesDuring: "*",
    resolve: ({ context, specifier }) => {
      if (!specifier[0] === "/") {
        return null
      }
      return new URL(specifier.slice(1), context.rootDirectoryUrl).href
    },
  }
}
