import { fileRead } from "@dmail/helper"

const isWindows =
  typeof process !== "undefined" &&
  typeof process.platform === "string" &&
  process.platform.match(/^win/)

const fileUrlToPathname = (fileUrl) => {
  if (fileUrl.substr(0, 7) !== "file://") {
    throw new RangeError(`${fileUrl} is not a valid file url`)
  }
  if (isWindows) {
    return fileUrl.substr(8).replace(/\\/g, "/")
  }
  return fileUrl.substr(7)
}

export const fetchUsingFileSystem = async (href) => {
  // if we found a symlink we should send 307 ?
  // nope but we should update the returned url: key to the symlink target

  const pathname = fileUrlToPathname(href)
  const source = await fileRead(pathname)

  // on pourrait ajouter des info dans headers comme le mtime, e-tag ?
  return { url: href, status: 200, statusText: "OK", headers: {}, body: source }
}
