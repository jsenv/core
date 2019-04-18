import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { ROOT_FOLDER } from "./ROOT_FOLDER.js"

export const hrefToFolderJsenvRelative = (href) => {
  const pathname = hrefToPathname(href)
  const dirname = pathnameToDirname(pathname)
  if (!dirname.startsWith(`${ROOT_FOLDER}/`))
    throw new Error(`href is not inside jsenv project.
href: ${href}
jsenv project root: ${ROOT_FOLDER}`)

  return dirname.slice(`${ROOT_FOLDER}/`.length)
}
