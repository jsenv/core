import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { JSENV_PATHNAME } from "./JSENV_PATH.js"
import { pathnameToRelativePathname } from "./operating-system-filename.js"

export const importMetaURLToFolderJsenvRelativePath = (importMetaURL) => {
  const pathname = hrefToPathname(importMetaURL)
  const dirname = pathnameToDirname(pathname)
  return pathnameToRelativePathname(dirname, JSENV_PATHNAME)
}
