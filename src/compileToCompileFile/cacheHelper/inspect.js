import { JSON_FILE } from "./cache.js"
import { createETag, isFileNotFoundError, resolvePath } from "./helpers.js"
import { list } from "./list.js"
import { locateFile } from "./locateFile.js"
import { readFile } from "./readFile.js"

export const inspect = ({ rootLocation, cacheFolderRelativeLocation }) => {
  const cacheFolderLocation = resolvePath(rootLocation, cacheFolderRelativeLocation)

  return list({ rootLocation, cacheFolderRelativeLocation }).then((folders) => {
    return Promise.all(
      folders.map((folder) => {
        return readFile({ location: resolvePath(cacheFolderLocation, folder, JSON_FILE) })
          .then(JSON.parse)
          .then((cache) => {
            const inputLocation = locateFile(cache.inputRelativeLocation, rootLocation)
            return readFile({
              location: inputLocation,
              errorHandler: isFileNotFoundError,
            }).then(
              (content) => {
                const actual = createETag(content)
                const expected = cache.inputETag
                if (actual !== expected) {
                  return "input-file-modified"
                }
                return "valid"
              },
              () => Promise.resolve("input-file-missing"),
            )
          })
      }),
    ).then((foldersStatus) => {
      return foldersStatus.map((status, index) => {
        return { folder: folders[index], status }
      })
    })
  })
}
