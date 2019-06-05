import { fileRead } from "@dmail/helper"
import { hrefToPathname } from "@jsenv/module-resolution"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { pathnameToContentType } from "../../file-service/pathnameToContentType.js"

export const fetchUsingFileSystem = async (href) => {
  // if we found a symlink we should send 307 ?
  // nope but we should update the returned url: key to the symlink target

  const pathname = hrefToPathname(href)
  const path = pathnameToOperatingSystemPath(pathname)
  const source = await fileRead(path)

  // on pourrait ajouter des info dans headers comme le mtime, e-tag ?
  return {
    url: href,
    status: 200,
    statusText: "OK",
    headers: {
      "content-type": pathnameToContentType(pathname),
    },
    body: source,
  }
}
