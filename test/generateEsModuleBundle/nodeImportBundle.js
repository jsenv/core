import { resolveDirectoryUrl, resolveUrl } from "@jsenv/util"

export const nodeImportBundle = async ({
  projectDirectoryUrl,
  bundleDirectoryRelativeUrl,
  mainRelativeUrl,
  namespaceProperty = "default",
}) => {
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl)
  const mainFileUrl = resolveUrl(mainRelativeUrl, bundleDirectoryUrl)
  const namespace = await import(mainFileUrl)
  return {
    value: namespace[namespaceProperty],
  }
}
