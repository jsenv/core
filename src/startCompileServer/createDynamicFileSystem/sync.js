import { all } from "@dmail/action"
import { inspect } from "./inspect.js"
import { removeFolderDeep } from "./helpers.js"
import { resolvePath } from "../../resolvePath.js"

export const sync = ({ rootLocation, cacheFolderRelativeLocation }) => {
  const cacheFolderLocation = resolvePath(rootLocation, cacheFolderRelativeLocation)

  return inspect({ rootLocation, cacheFolderRelativeLocation }).then((report) => {
    const foldersInvalid = report.filter(({ status }) => status !== "valid")

    return all(
      foldersInvalid.map(({ folder }) =>
        removeFolderDeep(resolvePath(cacheFolderLocation, folder)),
      ),
    )
  })
}
