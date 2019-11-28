import { installErrorStackRemapping } from "./installErrorStackRemapping.js"

export const installBrowserErrorStackRemapping = ({
  resolveHref,
  SourceMapConsumer,
  indent,
} = {}) =>
  installErrorStackRemapping({
    resolveHref,
    fetchHref: fetchUrl,
    SourceMapConsumer,
    base64ToString,
    indent,
  })

const fetchUrl = async (href) => {
  const response = await fetch(href)
  const text = await response.text()
  return {
    status: response.status,
    // because once memoized fetch
    // gets annoying preventing you to read
    // body multiple times, even using response.clone()
    body: () => text,
  }
}

const base64ToString = (base64String) => window.btoa(base64String)
