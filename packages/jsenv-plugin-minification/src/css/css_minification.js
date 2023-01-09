import { fileURLToPath } from "node:url"

export const minifyCss = async ({ cssUrlInfo, context }) => {
  const { transform } = await import("lightningcss")

  const targets = runtimeCompatToTargets(context.runtimeCompat)
  const { code, map } = transform({
    filename: fileURLToPath(cssUrlInfo.originalUrl),
    code: Buffer.from(cssUrlInfo.content),
    targets,
    minify: true,
  })
  return {
    content: String(code),
    sourcemap: map,
  }
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
