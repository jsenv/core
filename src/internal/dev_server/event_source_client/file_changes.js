import { isLivereloadEnabled } from "./livereload_preference.js"

export const reloadMetas = {}

let fileChanges = {}
let filechangeCallback = () => {}

export const getFileChanges = () => fileChanges

export const addFileChange = ({ file, eventType }) => {
  fileChanges[file] = eventType
  if (isLivereloadEnabled()) {
    reloadIfNeeded()
  } else {
    filechangeCallback()
  }
}

export const setFileChangeCallback = (callback) => {
  filechangeCallback = callback
}

// TODO: the following "parseCompiledUrl"
// already exists somewhere in the codebase: reuse the other one
const parseCompiledUrl = (url) => {
  const { pathname, search } = new URL(url)
  const ressource = `${pathname}${search}`
  const slashIndex = ressource.indexOf("/", 1)
  const compileDirectoryRelativeUrl = ressource.slice(1, slashIndex)
  const afterCompileDirectory = ressource.slice(slashIndex)
  const nextSlashIndex = afterCompileDirectory.indexOf("/")
  const compileId = afterCompileDirectory.slice(0, nextSlashIndex)
  const afterCompileId = afterCompileDirectory.slice(nextSlashIndex)
  return {
    compileDirectoryRelativeUrl,
    compileId,
    fileRelativeUrl: afterCompileId,
  }
}

const findReloadMetaUrl = (originalFileRelativeUrl) => {
  return Object.keys(reloadMetas).find((compileUrl) => {
    return (
      parseCompiledUrl(compileUrl).fileRelativeUrl === originalFileRelativeUrl
    )
  })
}

export const reloadIfNeeded = () => {
  const customReloads = []
  const cssReloads = []
  const fullReloads = []
  // TODO: we should not only look for reloadMeta keys
  // but also dependencies so the way we store reload meta must change
  Object.keys(fileChanges).forEach((key) => {
    const reloadMetaUrl = findReloadMetaUrl(key)
    const reloadMeta = reloadMetas[reloadMetaUrl]
    if (reloadMeta) {
      if (reloadMeta === "decline" || reloadMeta === "invalidate") {
        fullReloads.push(key)
        return
      }
      // TODO: dispose any previous hot call
      // TODO: handle reloadMeta.dependencies
      customReloads.push(() => {
        delete fileChanges[key]
        reloadMeta.reloadCallback()
      })
      return
    }
    if (
      key.endsWith(".css") ||
      key.endsWith(".scss") ||
      key.endsWith(".sass")
    ) {
      cssReloads.push(() => {
        delete fileChanges[key]
      })
      return
    }
    fullReloads.push(key)
  })
  if (fullReloads.length > 0) {
    reloadPage()
    return
  }
  customReloads.forEach((customReload) => {
    customReload()
  })
  if (cssReloads.length) {
    reloadAllCss()
    cssReloads.forEach((cssReload) => {
      cssReload()
    })
  }
  filechangeCallback()
}

const reloadAllCss = () => {
  const links = Array.from(window.parent.document.getElementsByTagName("link"))
  links.forEach((link) => {
    if (link.rel === "stylesheet") {
      const url = new URL(link.href)
      url.searchParams.set("t", Date.now())
      link.href = String(url)
    }
  })
}

const reloadPage = () => {
  window.parent.location.reload(true)
}
