import { fileRead } from "@dmail/helper"

const isWindows =
  typeof process !== "undefined" &&
  typeof process.platform === "string" &&
  process.platform.match(/^win/)

const fileUrlToPath = (fileUrl) => {
  if (fileUrl.substr(0, 7) !== "file://") {
    throw new RangeError(`${fileUrl} is not a valid file url`)
  }
  if (isWindows) {
    return fileUrl.substr(8).replace(/\\/g, "/")
  }
  return fileUrl.substr(7)
}

export const fetchUsingFileSystem = async (key) => {
  // if we found a symlink we should send 307 ?
  // nope but we should update the returned url: key to the symlink target

  const filePath = fileUrlToPath(key)
  const source = await fileRead(filePath)

  // on pourrait ajouter des info dans headers comme le mtime, e-tag ?
  return { url: key, status: 200, statusText: "OK", headers: {}, body: source }
}
