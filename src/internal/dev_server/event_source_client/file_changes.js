/* eslint-env browser */

import { isLivereloadEnabled } from "./livereload_preference.js"

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

export const reloadIfNeeded = () => {
  const customReloads = []
  const cssReloads = []
  const fullReloads = []

  Object.keys(fileChanges).forEach((key) => {
    const livereloadCallback = window.__jsenv__.livereloadingCallbacks[key]
    if (livereloadCallback) {
      customReloads.push(() => {
        delete fileChanges[key]
        livereloadCallback({
          reloadPage,
        })
      })
    } else if (
      key.endsWith(".css") ||
      key.endsWith(".scss") ||
      key.endsWith(".sass")
    ) {
      cssReloads.push(() => {
        delete fileChanges[key]
      })
    } else {
      fullReloads.push(key)
    }
  })

  if (fullReloads.lenght) {
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
