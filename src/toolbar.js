import { setAttributes } from "./internal/exploring/util/dom.js"

const injectToolbar = async () => {
  const placeholder = getToolbarPlaceholder()

  const iframe = document.createElement("iframe")
  setAttributes(iframe, {
    tabindex: -1,
    // sandbox: "allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation",
    // allow: "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; vr",
    allowtransparency: true,
  })
  const iframeLoadedPromise = iframeToLoadedPromise(iframe)
  // set iframe src BEFORE putting it into the DOM (prevent firefox adding an history entry)
  iframe.setAttribute("src", new URL("./toolbar.html", import.meta.url))
  placeholder.parentNode.replaceChild(iframe, placeholder)

  await iframeLoadedPromise
  iframe.removeAttribute("tabindex")
}

const getToolbarPlaceholder = () => {
  const placeholder = queryPlaceholder()
  if (placeholder) {
    if (document.body.contains(placeholder)) {
      return placeholder
    }
    // otherwise iframe would not be visible because in <head>
    console.warn("element with [data-jsenv-toolbar-placeholder] must be inside document.body")
    return createTooolbarPlaceholder()
  }
  return createTooolbarPlaceholder()
}

const queryPlaceholder = () => document.querySelector("[data-jsenv-toolbar-placeholder]")

const createTooolbarPlaceholder = () => {
  const placeholder = document.createElement("span")
  document.body.appendChild(placeholder)
  return placeholder
}

const iframeToLoadedPromise = (iframe) => {
  return new Promise((resolve) => {
    const onload = () => {
      iframe.removeEventListener("load", onload, true)
      resolve()
    }
    iframe.addEventListener("load", onload, true)
  })
}

injectToolbar()
