import { fetchExploringJson } from "@jsenv/core/src/internal/exploring/fetchExploringJson.js"
import { setAttributes, setStyles } from "./util/dom.js"

/*
We must connect to livereload server asap so that if a file is modified
while page is loading we are notified of it.

Otherwise it's possible that a file is loaded and used by browser then its modified before
livereload connection is established.

When toolbar is loaded it will open an other connection to server sent events and close this one.
*/
const connectLivereload = () => {
  const { EventSource } = window
  if (typeof EventSource !== "function") {
    return () => {}
  }

  const getLivereloadPreference = () => {
    return localStorage.hasOwnProperty("livereload")
      ? JSON.parse(localStorage.getItem("livereload"))
      : true
  }

  const url = document.location.href
  let isOpen = false
  let lastEventId
  const latestChangeMap = {}

  const events = {
    "file-modified": ({ data }) => {
      latestChangeMap[data] = "modified"
      if (getLivereloadPreference()) {
        window.location.reload(true)
      }
    },
    "file-removed": ({ data }) => {
      latestChangeMap[data] = "removed"
      if (getLivereloadPreference()) {
        window.location.reload(true)
      }
    },
    "file-added": ({ data }) => {
      latestChangeMap[data] = "added"
      if (getLivereloadPreference()) {
        window.location.reload(true)
      }
    },
  }

  const eventSourceOrigin = new URL(url).origin
  const eventSource = new EventSource(url, {
    withCredentials: true,
  })

  const disconnect = () => {
    eventSource.close()
  }

  eventSource.onopen = () => {
    isOpen = true
  }

  eventSource.onerror = (errorEvent) => {
    if (errorEvent.target.readyState === EventSource.CLOSED) {
      isOpen = false
    }
  }

  Object.keys(events).forEach((eventName) => {
    eventSource.addEventListener(eventName, (e) => {
      if (e.origin === eventSourceOrigin) {
        if (e.lastEventId) {
          lastEventId = e.lastEventId
        }
        events[eventName](e)
      }
    })
  })

  return () => {
    return {
      isOpen,
      latestChangeMap,
      lastEventId,
      disconnect,
    }
  }
}
// eslint-disable-next-line camelcase
window.__jsenv_eventsource__ = connectLivereload()

const injectToolbar = async () => {
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
    "./src/internal/toolbar/toolbar.html",
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
    "./src/internal/toolbar/jsenv-logo.svg",
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
