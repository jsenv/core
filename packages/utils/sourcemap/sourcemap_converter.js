import {
  isFileSystemPath,
  fileSystemPathToUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

export const sourcemapConverter = {
  toFileUrls: (sourcemap) => {
    sourcemap.sources = sourcemap.sources.map((source) => {
      return isFileSystemPath(source) ? fileSystemPathToUrl(source) : source
    })
    return sourcemap
  },
  toFilePaths: (sourcemap) => {
    sourcemap.sources = sourcemap.sources.map((source) => {
      return urlToFileSystemPath(source)
    })
    return sourcemap
  },
}
