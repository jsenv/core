import path from "path"

const normalizeSeparation = (filename) => filename.replace(/\\/g, "/")

export const resolvePath = (from, ...paths) => {
  return normalizeSeparation(path.resolve(from, ...paths))
}
