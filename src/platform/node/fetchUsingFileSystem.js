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
  const filePath = fileUrlToPath(key)
  const source = await fileRead(filePath)
  return { status: 200, statusText: "", headers: {}, body: source }
}
