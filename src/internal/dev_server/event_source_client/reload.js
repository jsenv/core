import { htmlAttributeSrcSet } from "./html_attribute_src_set.js"

export const reloadHtmlPage = () => {
  window.parent.location.reload(true)
}

export const reloadDOMNodesUsingUrls = (...urlsToReload) => {
  const shouldReloadUrl = (urlCandidate) => {
    return urlsToReload.some((urlToReload) =>
      compareTwoUrlPaths(urlCandidate, urlToReload),
    )
  }
  const visitNodeAttributeAsUrl = (node, attributeName) => {
    const attributeValue = node[attributeName]
    if (attributeValue && shouldReloadUrl(attributeValue)) {
      node[attributeName] = injectQuery(attributeValue, { t: Date.now() })
    }
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
      img.srcset = htmlAttributeSrcSet.stringify(srcCandidates)
    }
  })
  Array.from(document.querySelectorAll("source")).forEach((source) => {
    visitNodeAttributeAsUrl(source, "src")
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

const compareTwoUrlPaths = (url, otherUrl) => {
  const urlObject = new URL(url)
  const otherUrlObject = new URL(otherUrl)
  return (
    urlObject.origin === otherUrlObject.origin &&
    urlObject.pathname === otherUrlObject.pathname
  )
}

const injectQuery = (url, query) => {
  const urlObject = new URL(url)
  const { searchParams } = urlObject
  Object.keys(query).forEach((key) => {
    searchParams.set(key, query[key])
  })
  return String(urlObject)
}
