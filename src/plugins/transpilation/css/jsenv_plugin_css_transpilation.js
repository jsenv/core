import { fileURLToPath } from "node:url"

export const jsenvPluginCssTranspilation = () => {
  return {
    name: "jsenv:css_transpilation",
    appliesDuring: "*",
    transformUrlContent: {
      css: async (urlInfo, context) => {
        const { code, map } = await transpileCss(urlInfo, context)
        return {
          content: String(code),
          sourcemap: map,
        }
      },
    },
  }
}

const transpileCss = async (urlInfo, context) => {
  // https://lightningcss.dev/docs.html
  const { transform } = await import("lightningcss")

  const targets = runtimeCompatToTargets(context.runtimeCompat)
  const { code, map } = transform({
    filename: fileURLToPath(urlInfo.originalUrl),
    code: Buffer.from(urlInfo.content),
    targets,
    minify: false,
    drafts: {
      nesting: true,
      customMedia: true,
    },
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
