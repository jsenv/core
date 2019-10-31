import { fileRead } from "@dmail/helper"
import { fileUrlToPath } from "../../urlHelpers.js"

const { ressourceToContentType, defaultContentTypeMap } = import.meta.require("@dmail/server")

export const fetchUsingFileSystem = async (url) => {
  // if we found a symlink we should send 307 ?
  // nope but we should update the returned url: key to the symlink target

  const path = fileUrlToPath(url)
  const source = await fileRead(path)

  // on pourrait ajouter des info dans headers comme le mtime, e-tag ?
  return {
    url,
    status: 200,
    statusText: "OK",
    headers: {
      "content-type": ressourceToContentType(path, defaultContentTypeMap),
    },
    body: source,
  }
}
