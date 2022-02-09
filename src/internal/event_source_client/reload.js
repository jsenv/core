import { htmlAttributeSrcSet } from "../transform_html/html_attribute_src_set.js"
import { injectQuery, compareTwoUrlPaths } from "./url_helpers.js"

export const reloadHtmlPage = () => {
  window.parent.location.reload(true)
}

// This function can consider everything as hot reloadable:
// - no need to check [hot-accept]and [hot-decline] attributes for instance
// This is because if something should full reload, we receive "full_reload"
// from server and this function is not called
export const reloadDOMNodesUsingUrls = (urlsToReload) => {
  const mutations = []
  const shouldReloadUrl = (urlCandidate) => {
    return urlsToReload.some((urlToReload) =>
      compareTwoUrlPaths(urlCandidate, urlToReload),
    )
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
    mutations.push(() => {
      node[attributeName] = injectQuery(attribute, { hmr: Date.now() })
    })
  }
  Array.from(document.querySelector("script")).forEach((script) => {
    visitNodeAttributeAsUrl(script, "src")
  })
  Array.from(document.querySelectorAll(`link[rel="stylesheet"]`)).forEach(
    (link) => {
      visitNodeAttributeAsUrl(link, "href")
    },
  )
  Array.from(document.querySelectorAll(`link[rel="icon"]`)).forEach((link) => {
    visitNodeAttributeAsUrl(link, "href")
  })
  Array.from(document.querySelectorAll("source")).forEach((source) => {
    visitNodeAttributeAsUrl(source, "src")
  })
  Array.from(document.querySelectorAll("img")).forEach((img) => {
    visitNodeAttributeAsUrl(img, "src")
    const srcset = img.srcset
    if (srcset) {
      const srcCandidates = htmlAttributeSrcSet.parse(srcset)
      srcCandidates.forEach((srcCandidate) => {
        const url = new URL(srcCandidate.specifier, `${window.location.href}`)
        if (shouldReloadUrl(url)) {
          srcCandidate.specifier = injectQuery(url, { hmr: Date.now() })
        }
      })
      mutations.push(() => {
        img.srcset = htmlAttributeSrcSet.stringify(srcCandidates)
      })
    }
  })
  // svg image tag
  Array.from(document.querySelectorAll("image")).forEach((image) => {
    visitNodeAttributeAsUrl(image, "href")
  })
  // svg use
  Array.from(document.querySelectorAll("use")).forEach((use) => {
    visitNodeAttributeAsUrl(use, "href")
  })
  mutations.forEach((mutation) => {
    mutation()
  })
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
