import {
  isFileSystemPath,
  fileSystemPathToUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

export const loadBabelPluginMapFromFile = async ({
  projectDirectoryUrl,
  babelConfigFileUrl,
}) => {
  const babelOptions = await loadBabelOptionsFromFile({
    projectDirectoryUrl,
    babelConfigFileUrl,
  })

  const babelPluginMap = {}
  babelOptions.plugins.forEach((plugin) => {
    const babelPluginName = babelPluginNameFromPlugin(plugin)
    babelPluginMap[babelPluginName] = plugin
  })

  return babelPluginMap
}

const loadBabelOptionsFromFile = async ({
  projectDirectoryUrl,
  babelConfigFileUrl,
}) => {
  const { loadOptionsAsync } = await import("@babel/core")
  const babelOptions = await loadOptionsAsync({
    cwd: urlToFileSystemPath(projectDirectoryUrl),
    configFile: babelConfigFileUrl
      ? urlToFileSystemPath(babelConfigFileUrl)
      : undefined,
  })
  return babelOptions
}

const babelPluginNameFromPlugin = ({ key }) => {
  if (
    isFileSystemPath(key) &&
    fileSystemPathToUrl(key).endsWith(
      "babel-plugin-transform-async-to-promises/async-to-promises.js",
    )
  ) {
    return "transform-async-to-promises"
  }
  return key
}
