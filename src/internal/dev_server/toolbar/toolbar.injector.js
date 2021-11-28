import { fetchExploringJson } from "@jsenv/core/src/internal/dev_server/exploring/fetchExploringJson.js"
import { setAttributes, setStyles } from "./util/dom.js"

// eslint-disable-next-line no-undef
const TOOLBAR_BUILD_RELATIVE_URL = __TOOLBAR_BUILD_RELATIVE_URL_

const injectToolbar = async () => {
  await new Promise((resolve) => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(resolve)
    } else {
      window.requestAnimationFrame(resolve)
    }
  })

  const { jsenvDirectoryRelativeUrl } = await fetchExploringJson()
  const jsenvDirectoryServerUrl = resolveUrl(
    jsenvDirectoryRelativeUrl,
    document.location.origin,
  )

  const placeholder = getToolbarPlaceholder()

  const iframe = document.createElement("iframe")
  setAttributes(iframe, {
    tabindex: -1,
    // sandbox: "allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation",
    // allow: "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; vr",
    allowtransparency: true,
  })
  setStyles(iframe, {
    "position": "fixed",
    "zIndex": 1000,
    "bottom": 0,
    "left": 0,
    "width": "100%",
    "height": 0,
    /* ensure toolbar children are not focusable when hidden */
    "visibility": "hidden",
    "transition-duration": "300ms",
    "transition-property": "height, visibility",
    "border": "none",
  })
  const iframeLoadedPromise = iframeToLoadedPromise(iframe)
  const jsenvToolbarHtmlServerUrl = resolveUrl(
    TOOLBAR_BUILD_RELATIVE_URL,
    jsenvDirectoryServerUrl,
  )
  // set iframe src BEFORE putting it into the DOM (prevent firefox adding an history entry)
  iframe.setAttribute("src", jsenvToolbarHtmlServerUrl)
  placeholder.parentNode.replaceChild(iframe, placeholder)

  await iframeLoadedPromise
  iframe.removeAttribute("tabindex")

  const listenToolbarIframeEvent = (event, fn) => {
    window.addEventListener(
      "message",
      (messageEvent) => {
        const { data } = messageEvent
        if (typeof data !== "object") return
        const { jsenv } = data
        if (!jsenv) return
        const { type } = data
        if (type !== event) return
        fn(data.value)
      },
      false,
    )
  }

  listenToolbarIframeEvent("toolbar-visibility-change", (visible) => {
    if (visible) {
      hideToolbarTrigger()
    } else {
      showToolbarTrigger()
    }
  })

  const div = document.createElement("div")
  const jsenvLogoUrl = resolveUrl(
    "./src/internal/dev_server/toolbar/jsenv-logo.svg",
    jsenvDirectoryServerUrl,
  )
  const jsenvLogoSvgSrc = jsenvLogoUrl
  div.innerHTML = `
<div id="jsenv-toolbar-trigger">
  <svg id="jsenv-toolbar-trigger-icon">
    <use xlink:href="${jsenvLogoSvgSrc}#jsenv-logo"></use>
  </svg>
  <style>
    #jsenv-toolbar-trigger {
      display: block;
      overflow: hidden;
      position: fixed;
      z-index: 1000;
      bottom: -32px;
      right: 20px;
      height: 40px;
      width: 40px;
      padding: 0;
      margin: 0;
      border-radius: 5px 5px 0 0;
      border: 1px solid rgba(0, 0, 0, 0.33);
      border-bottom: none;
      box-shadow: 0px 0px 6px 2px rgba(0, 0, 0, 0.46);
      background: transparent;
      text-align: center;
      transition: 600ms;
    }

    #jsenv-toolbar-trigger:hover {
      cursor: pointer;
    }

    #jsenv-toolbar-trigger[data-expanded] {
      bottom: 0;
    }

    #jsenv-toolbar-trigger-icon {
      width: 35px;
      height: 35px;
      opacity: 0;
      transition: 600ms;
    }

    #jsenv-toolbar-trigger[data-expanded] #jsenv-toolbar-trigger-icon {
      opacity: 1;
    }
  </style>
</div>`
  const toolbarTrigger = div.firstElementChild
  iframe.parentNode.appendChild(toolbarTrigger)

  let timer
  toolbarTrigger.onmouseenter = () => {
    toolbarTrigger.setAttribute("data-animate", "")
    timer = setTimeout(expandToolbarTrigger, 500)
  }
  toolbarTrigger.onmouseleave = () => {
    clearTimeout(timer)
    collapseToolbarTrigger()
  }
  toolbarTrigger.onfocus = () => {
    toolbarTrigger.removeAttribute("data-animate")
    expandToolbarTrigger()
  }
  toolbarTrigger.onblur = () => {
    toolbarTrigger.removeAttribute("data-animate")
    clearTimeout(timer)
    collapseToolbarTrigger()
  }
  toolbarTrigger.onclick = () => {
    window.__jsenv__.toolbar.show()
  }

  const showToolbarTrigger = () => {
    toolbarTrigger.style.display = "block"
  }

  const hideToolbarTrigger = () => {
    toolbarTrigger.style.display = "none"
  }

  const expandToolbarTrigger = () => {
    toolbarTrigger.setAttribute("data-expanded", "")
  }

  const collapseToolbarTrigger = () => {
    toolbarTrigger.removeAttribute("data-expanded", "")
  }
  hideToolbarTrigger()

  iframe.contentWindow.renderToolbar()

  return iframe
}

const getToolbarPlaceholder = () => {
  const placeholder = queryPlaceholder()
  if (placeholder) {
    if (document.body.contains(placeholder)) {
      return placeholder
    }
    // otherwise iframe would not be visible because in <head>
    console.warn(
      "element with [data-jsenv-toolbar-placeholder] must be inside document.body",
    )
    return createTooolbarPlaceholder()
  }
  return createTooolbarPlaceholder()
}

const queryPlaceholder = () =>
  document.querySelector("[data-jsenv-toolbar-placeholder]")

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

const resolveUrl = (url, baseUrl) => String(new URL(url, baseUrl))

if (document.readyState === "complete") {
  injectToolbar()
} else {
  window.addEventListener("load", injectToolbar)
}
