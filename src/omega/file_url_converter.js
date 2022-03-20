import { fileSystemPathToUrl, urlToFileSystemPath } from "@jsenv/filesystem"

export const fileUrlConverter = {
  asUrlWithoutSpecialParams: (fileUrl) => {
    const urlObject = new URL(fileUrl)
    let { origin, pathname, searchParams, hash } = urlObject
    // origin is "null" for "file://" urls with Node.js
    if (origin === "null" && urlObject.href.startsWith("file:")) {
      origin = "file://"
    }
    if (searchParams.has("json_module")) {
      searchParams.delete("json_module")
      return `${origin}${pathname}.json_module${stringifyQuery(
        searchParams,
      )}${hash}`
    }
    if (searchParams.has("css_module")) {
      searchParams.delete("css_module")
      return `${origin}${pathname}.css_module${stringifyQuery(
        searchParams,
      )}${hash}`
    }
    if (searchParams.has("text_module")) {
      searchParams.delete("text_module")
      return `${origin}${pathname}.text_module${stringifyQuery(
        searchParams,
      )}${hash}`
    }
    return fileUrl
  },
  asFilePath: (fileUrl) => {
    const fileUrlWithoutSpecialParam =
      fileUrlConverter.asUrlWithoutSpecialParams(fileUrl)
    const filePath = urlToFileSystemPath(fileUrlWithoutSpecialParam)
    return filePath
  },
  asFileUrl: (filePath) => {
    if (filePath.endsWith(".json_module")) {
      const jsonFileUrl = fileSystemPathToUrl(
        filePath.slice(0, -".json_module".length),
      )
      return `${jsonFileUrl}?json_module`
    }
    if (filePath.endsWith(".css_module")) {
      const cssFileUrl = fileSystemPathToUrl(
        filePath.slice(0, -".css_module".length),
      )
      return `${cssFileUrl}?css_module`
    }
    if (filePath.endsWith(".text_module")) {
      const textFileUrl = fileSystemPathToUrl(
        filePath.slice(0, -".text_module".length),
      )
      return `${textFileUrl}?text_module`
    }
    return fileSystemPathToUrl(filePath)
  },
}

const stringifyQuery = (searchParams) => {
  const search = searchParams.toString()
  return search ? `?${search}` : ""
}
