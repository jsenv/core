import { fetchFileSystem } from "@jsenv/server"

export const createSourceFileService = ({
  projectDirectoryUrl,
  projectFileCacheStrategy,
  jsenvRemoteDirectory,
}) => {
  return async (request) => {
    const fileUrl = new URL(request.ressource.slice(1), projectDirectoryUrl)
      .href
    const fromFileSystem = () =>
      fetchFileSystem(fileUrl, {
        headers: request.headers,
        etagEnabled: projectFileCacheStrategy === "etag",
        mtimeEnabled: projectFileCacheStrategy === "mtime",
      })

    const filesystemResponse = await fromFileSystem()
    if (
      filesystemResponse.status === 404 &&
      jsenvRemoteDirectory.isFileUrlForRemoteUrl(fileUrl)
    ) {
      try {
        await jsenvRemoteDirectory.loadFileUrlFromRemote(fileUrl, request)
        // re-fetch filesystem instead to ensure response headers are correct
        return fromFileSystem()
      } catch (e) {
        if (e && e.asResponse) {
          return e.asResponse()
        }
        throw e
      }
    }
    return filesystemResponse
  }
}
