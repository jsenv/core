import { removeFolderDeep, resolvePath } from "./helpers.js"
import { inspect } from "./inspect.js"

export const sync = ({ rootLocation, cacheFolderRelativeLocation }) => {
  const cacheFolderLocation = resolvePath(rootLocation, cacheFolderRelativeLocation)

  return inspect({ rootLocation, cacheFolderRelativeLocation }).then((report) => {
    const foldersInvalid = report.filter(({ status }) => status !== "valid")

    return Promise.all(
      foldersInvalid.map(({ folder }) =>
        removeFolderDeep(resolvePath(cacheFolderLocation, folder)),
      ),
    )
  })
}
