import { uneval } from "@dmail/uneval"

export const createPlatformSetupSource = (data) => {
  return `window.__platform__ = window.__platform__.platform
window.__platform__.setup(${uneval(data)})`
}

export const createPlatformImportFileSource = (file, options) => {
  return `window__platform__.importFile(${uneval(file)}, ${uneval(options)})`
}
