import { fileUrlToPath } from "../../urlUtils.js"

export const bundleOptionsToRollupGenerateOptions = ({
  bundleDirectoryUrl,
  format,
  formatOutputOptions,
}) => {
  const dir = fileUrlToPath(bundleDirectoryUrl)

  return {
    // https://rollupjs.org/guide/en#output-dir
    dir,
    // https://rollupjs.org/guide/en#output-format
    format: formatToRollupFormat(format),
    // entryFileNames: `./[name].js`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    // we could exclude them
    // but it's better to put them directly
    // in case source files are not reachable
    // for whatever reason
    sourcemapExcludeSources: false,
    ...formatOutputOptions,
  }
}

const formatToRollupFormat = (format) => {
  if (format === "global") return "iife"
  if (format === "commonjs") return "cjs"
  if (format === "systemjs") return "system"
  throw new Error(`unexpected format, got ${format}`)
}
