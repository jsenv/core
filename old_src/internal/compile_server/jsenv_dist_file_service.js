import { fetchFileSystem } from "@jsenv/server"

import { urlIsInsideOf } from "@jsenv/filesystem"

import { jsenvDistDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"

export const createJsenvDistFileService = ({
  projectDirectoryUrl,
  projectFileCacheStrategy,
}) => {
  return (request) => {
    const fileUrl = new URL(request.ressource.slice(1), projectDirectoryUrl)
      .href
    const fileIsInsideJsenvDistDirectory = urlIsInsideOf(
      fileUrl,
      jsenvDistDirectoryUrl,
    )
    if (!fileIsInsideJsenvDistDirectory) {
      return null
    }
    return fetchFileSystem(fileUrl, {
      headers: request.headers,
      etagEnabled: projectFileCacheStrategy === "etag",
      mtimeEnabled: projectFileCacheStrategy === "mtime",
      cacheControl: `private,max-age=${60 * 60 * 24 * 30},immutable`,
    })
  }
}
