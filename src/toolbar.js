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
  iframe.setAttribute("src", new URL("./internal/toolbar/toolbar.html", import.meta.url))
  placeholder.parentNode.replaceChild(iframe, placeholder)

  await iframeLoadedPromise
  iframe.removeAttribute("tabindex")

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

// this toolbar trigger should not be in there
// cause the iframe is now hidden with height of 0
// toolbarTrigger: display and register onclick
//     const toolbarTrigger = document.querySelector("#toolbar-trigger")
//     var timer
//     toolbarTrigger.onmouseenter = () => {
//       toolbarTrigger.setAttribute("data-animate", "")
//       timer = setTimeout(expandToolbarTrigger, 500)
//     }
//     toolbarTrigger.onmouseleave = () => {
//       clearTimeout(timer)
//       collapseToolbarTrigger()
//     }
//     toolbarTrigger.onfocus = () => {
//       toolbarTrigger.removeAttribute("data-animate")
//       expandToolbarTrigger()
//     }
//     toolbarTrigger.onblur = () => {
//       toolbarTrigger.removeAttribute("data-animate")
//       clearTimeout(timer)
//       collapseToolbarTrigger()
//     }
//     toolbarTrigger.onclick = showToolbar
//     // toolbarTrigger is hidden by default to avoid being shown
//     // when toolbar is shown on page load, ensure it's visible once toolbar is hidden
//     removeForceHideElement(toolbarTrigger)

//     const expandToolbarTrigger = () => {
//   const toolbarTrigger = document.querySelector("#toolbar-trigger")
//   toolbarTrigger.setAttribute("data-expanded", "")
// }

// const collapseToolbarTrigger = () => {
//   const toolbarTrigger = document.querySelector("#toolbar-trigger")
//   toolbarTrigger.removeAttribute("data-expanded", "")
// }
