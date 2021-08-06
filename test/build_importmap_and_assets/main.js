import urlFromStaticImport from "./img.png"

const urlFromDynamicImport = import("./img.png")

const urlFromImportMetaNotation = String(new URL("./img.png", import.meta.url))

export { urlFromStaticImport, urlFromDynamicImport, urlFromImportMetaNotation }
