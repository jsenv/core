import { resolveFileUrl } from "internal/urlUtils.js"

export const resolveAssetFileUrl = ({ compiledFileUrl, asset }) =>
  resolveFileUrl(asset, `${compiledFileUrl}__asset__/`)

export const resolveMetaJsonFileUrl = ({ compiledFileUrl }) =>
  resolveAssetFileUrl({ compiledFileUrl, asset: "meta.json" })

export const resolveSourceFileUrl = ({ compiledFileUrl, source }) =>
  resolveFileUrl(source, compiledFileUrl)
