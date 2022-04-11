export const jsenvPluginLeadingSlash = () => {
  return {
    name: "jsenv:leading_slash",
    appliesDuring: "*",
    resolve: ({ specifier }, { rootDirectoryUrl }) => {
      if (specifier[0] !== "/") {
        return null
      }
      return new URL(specifier.slice(1), rootDirectoryUrl).href
    },
  }
}
