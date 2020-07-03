import { setAttributes, setStyles } from "./internal/toolbar/util/dom.js"

const injectToolbar = async () => {
  const placeholder = getToolbarPlaceholder()

  const iframe = document.createElement("iframe")
  setAttributes(iframe, {
    tabindex: -1,
    // sandbox: "allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation",
    // allow: "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; vr",
    allowtransparency: true,
  })
  setStyles(iframe, {
    position: "fixed",
    bottom: 0,
    width: "100%",
    height: 0,
    /* ensure toolbar children are not focusable when hidden */
    visibility: "hidden",
    border: "none",
  })
  const iframeLoadedPromise = iframeToLoadedPromise(iframe)
  // set iframe src BEFORE putting it into the DOM (prevent firefox adding an history entry)
  iframe.setAttribute("src", new URL("./toolbar.html", import.meta.url))
  placeholder.parentNode.replaceChild(iframe, placeholder)

  await iframeLoadedPromise
  iframe.removeAttribute("tabindex")

  // l'idée maintenant va etre de pouvoir communiquer entre
  // ici et la toolbar (a priori peu de chose, juste pour savoir quand elle est open/closed)
  // et ajuster le site en fonction

  // ça il faudra le faire seulement a certain moment
  // on va recevoir un toolbarOpenRequest, toolbarCloseRequest
  // ou alors toolbarWillOpen bref et on est responsable d'adapter le site ici
  showToolbar(iframe)

  return iframe
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

const showToolbar = (iframe) => {
  // maybe we should use js animation here because we would not conflict with css
  const restoreBodyStyles = setStyles(document.body, {
    "scroll-padding-bottom": "40px", // same hre we should add 40px
    "transition-property": "padding-bottom",
    "transition-duration": "300ms",
    "padding-bottom": "40px", // if there is already one we should add 40px
  })
  const restoreIframeStyles = setStyles(iframe, {
    "height": "40px",
    "visibility": "visible",
    "transition-property": "height, visibility",
    "transition-duration": "300ms",
  })
  return () => {
    restoreBodyStyles()
    restoreIframeStyles()
  }
}
