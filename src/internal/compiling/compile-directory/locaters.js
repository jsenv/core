import { resolveUrl } from "@jsenv/util"

export const resolveAssetFileUrl = ({ asset, compiledFileUrl }) =>
  resolveUrl(asset, compiledFileUrl)

export const resolveMetaJsonFileUrl = ({ compiledFileUrl }) =>
  resolveAssetFileUrl({ compiledFileUrl, asset: "meta.json" })

export const resolveSourceFileUrl = ({ source, compiledFileUrl }) =>
  resolveUrl(source, resolveMetaJsonFileUrl({ compiledFileUrl }))
