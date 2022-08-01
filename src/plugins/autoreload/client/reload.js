import {
  parseSrcSet,
  stringifySrcSet,
} from "@jsenv/ast/src/html/html_src_set.js"

import { injectQuery, compareTwoUrlPaths } from "./url_helpers.js"

export const reloadHtmlPage = () => {
  window.location.reload(true)
}

// This function can consider everything as hot reloadable:
// - no need to check [hot-accept]and [hot-decline] attributes for instance
// This is because if something should full reload, we receive "full_reload"
// from server and this function is not called
export const getDOMNodesUsingUrl = (urlToReload) => {
  const nodes = []
  const shouldReloadUrl = (urlCandidate) => {
    return compareTwoUrlPaths(urlCandidate, urlToReload)
  }
  const visitNodeAttributeAsUrl = (node, attributeName) => {
    let attribute = node[attributeName]
    if (!attribute) {
      return
    }
    if (SVGAnimatedString && attribute instanceof SVGAnimatedString) {
      attribute = attribute.animVal
    }
    if (!shouldReloadUrl(attribute)) {
      return
    }
    nodes.push({
      node,
      reload: () => {
        node[attributeName] = injectQuery(attribute, { hmr: Date.now() })
      },
    })
  }
  Array.from(document.querySelectorAll(`link[rel="stylesheet"]`)).forEach(
    (link) => {
      visitNodeAttributeAsUrl(link, "href")
    },
  )
  Array.from(document.querySelectorAll(`link[rel="icon"]`)).forEach((link) => {
    visitNodeAttributeAsUrl(link, "href")
  })
  Array.from(document.querySelectorAll("script")).forEach((script) => {
    visitNodeAttributeAsUrl(script, "src")
    const inlinedFromSrc = script.getAttribute("inlined-from-src")
    if (inlinedFromSrc) {
      const inlinedFromUrl = new URL(inlinedFromSrc, window.location.origin)
        .href
      if (shouldReloadUrl(inlinedFromUrl)) {
        nodes.push({
          node: script,
          reload: () =>
            window.__supervisor__.reloadSupervisedScript({
              type: script.type,
              src: inlinedFromSrc,
            }),
        })
      }
    }
  })
  // There is no real need to update a.href because the resource will be fetched when clicked.
  // But in a scenario where the resource was already visited and is in browser cache, adding
  // the dynamic query param ensure the cache is invalidated
  Array.from(document.querySelectorAll("a")).forEach((a) => {
    visitNodeAttributeAsUrl(a, "href")
  })
  // About iframes:
  // - By default iframe itself and everything inside trigger a parent page full-reload
  // - Adding [hot-accept] on the iframe means parent page won't reload when iframe full/hot reload
  //   In that case and if there is code in the iframe and parent doing post message communication:
  //   you must put import.meta.hot.decline() for code involved in communication.
  //   (both in parent and iframe)
  Array.from(document.querySelectorAll("img")).forEach((img) => {
    visitNodeAttributeAsUrl(img, "src")
    const srcset = img.srcset
    if (srcset) {
      const srcCandidates = parseSrcSet(srcset)
      srcCandidates.forEach((srcCandidate) => {
        const url = new URL(srcCandidate.specifier, `${window.location.href}`)
        if (shouldReloadUrl(url)) {
          srcCandidate.specifier = injectQuery(url, { hmr: Date.now() })
        }
      })
      nodes.push({
        node: img,
        reload: () => {
          img.srcset = stringifySrcSet(srcCandidates)
        },
      })
    }
  })
  Array.from(document.querySelectorAll("source")).forEach((source) => {
    visitNodeAttributeAsUrl(source, "src")
  })
  // svg image tag
  Array.from(document.querySelectorAll("image")).forEach((image) => {
    visitNodeAttributeAsUrl(image, "href")
  })
  // svg use
  Array.from(document.querySelectorAll("use")).forEach((use) => {
    visitNodeAttributeAsUrl(use, "href")
  })
  return nodes
}

export const reloadJsImport = async (url) => {
  const urlWithHmr = injectQuery(url, { hmr: Date.now() })
  const namespace = await import(urlWithHmr)
  return namespace
}

export const reloadAllCss = () => {
  const links = Array.from(document.getElementsByTagName("link"))
  links.forEach((link) => {
    if (link.rel === "stylesheet") {
      link.href = injectQuery(link.href, { hmr: Date.now() })
    }
  })
}
