import { createRequire } from "node:module"
import { urlToFileSystemPath } from "@jsenv/filesystem"

const require = createRequire(import.meta.url)

export const transpileWithParcel = (urlInfo, context) => {
  const css = require("@parcel/css")
  const targets = runtimeCompatToTargets(context.runtimeCompat)
  const { code, map } = css.transform({
    filename: urlToFileSystemPath(urlInfo.originalUrl),
    code: Buffer.from(urlInfo.content),
    targets,
    minify: false,
  })
  return { code, map }
}

export const minifyWithParcel = (urlInfo, context) => {
  const css = require("@parcel/css")
  const targets = runtimeCompatToTargets(context.runtimeCompat)
  const { code, map } = css.transform({
    filename: urlToFileSystemPath(urlInfo.originalUrl),
    code: Buffer.from(urlInfo.content),
    targets,
    minify: true,
  })
  return { code, map }
}

export const bundleWithParcel = (urlInfo, context) => {
  const targets = runtimeCompatToTargets(context.runtimeCompat)
  const css = require("@parcel/css")
  const { code, map } = css.bundle({
    filename: urlToFileSystemPath(urlInfo.originalUrl),
    targets,
    minify: false,
  })
  return { code, map }
}

const runtimeCompatToTargets = (runtimeCompat) => {
  const targets = {}
  ;["chrome", "firefox", "ie", "opera", "safari"].forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName]
    if (version) {
      targets[runtimeName] = versionToBits(version)
    }
  })
  return targets
}

const versionToBits = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10))
  return (major << 16) | (minor << 8) | patch
}
