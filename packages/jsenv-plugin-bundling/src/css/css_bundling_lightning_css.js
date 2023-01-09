import { fileURLToPath } from "node:url"

// Do not use until https://github.com/parcel-bundler/parcel-css/issues/181
export const bundleCss = async (urlInfo, context) => {
  const { bundle } = await import("lightningcss")

  const targets = runtimeCompatToTargets(context.runtimeCompat)
  const { code, map } = bundle({
    filename: fileURLToPath(urlInfo.originalUrl),
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
