import { JSON_FILE } from "./cache.js"
import { readFolder, resolvePath } from "./helpers.js"

export const list = ({ rootLocation, cacheFolderRelativeLocation }) => {
  const cacheFolderLocation = resolvePath(rootLocation, cacheFolderRelativeLocation)

  const visit = (folderRelativeLocation, folders = []) => {
    const folderLocation = resolvePath(cacheFolderLocation, folderRelativeLocation)

    return readFolder(folderLocation)
      .then((names) => {
        if (names.includes(JSON_FILE)) {
          folders.push(folderRelativeLocation)
          return
        }
        return Promise.all(names.map((name) => visit(resolvePath(folderLocation, name), folders)))
      })
      .then(() => folders)
  }

  return visit(cacheFolderLocation)
}
