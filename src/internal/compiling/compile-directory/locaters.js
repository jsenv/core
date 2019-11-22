import { resolveFileUrl } from "internal/urlUtils.js"

export const resolveAssetFileUrl = ({ asset, compiledFileUrl }) =>
  resolveFileUrl(asset, `${compiledFileUrl}__asset__/`)

export const resolveMetaJsonFileUrl = ({ compiledFileUrl }) =>
  resolveAssetFileUrl({ compiledFileUrl, asset: "meta.json" })

export const resolveSourceFileUrl = ({ source, compiledFileUrl }) =>
  resolveFileUrl(source, resolveMetaJsonFileUrl({ compiledFileUrl }))
