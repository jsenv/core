import { applyLeadingSlashUrlResolution } from "@jsenv/core/src/omega/kitchen/leading_slash_url_resolution.js"

export const jsenvPluginLeadingSlash = () => {
  return {
    name: "jsenv:leading_slash",
    resolve: ({ rootDirectoryUrl, specifier }) => {
      const resolved = applyLeadingSlashUrlResolution(
        specifier,
        rootDirectoryUrl,
      )
      if (resolved) {
        return resolved
      }
      return null
    },
  }
}
