import { urlToFileSystemPath } from "@jsenv/filesystem"

export const loadBabelConfigFromFile = async ({ projectDirectoryUrl }) => {
  const { loadOptionsAsync } = await import("@babel/core")
  const babelOptions = await loadOptionsAsync({
    root: urlToFileSystemPath(projectDirectoryUrl),
  })

  const babelPluginMap = {}
  babelOptions.plugins.forEach((plugin) => {
    babelPluginMap[plugin.key] = plugin
  })
  return { babelPluginMap }
}
