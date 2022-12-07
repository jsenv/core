import { setAttributes, setStyles } from "./ui/util/dom.js"

const jsenvLogoSvgUrl = new URL("./ui/jsenv_logo.svg", import.meta.url)

export const injectToolbar = async ({
  toolbarUrl,
  logLevel,
  theme,
  opened,
  animationsEnabled,
}) => {
  if (document.readyState !== "complete") {
    await new Promise((resolve) => {
      window.addEventListener("load", resolve)
    })
  }
  await new Promise((resolve) => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(resolve, { timeout: 400 })
    } else {
      window.requestAnimationFrame(resolve)
    }
  })
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
    "transition-duration": "0",
    "transition-property": "height, visibility",
    "border": "none",
  })
  const iframeLoadedPromise = iframeToLoadedPromise(iframe)
  iframe.name = encodeURIComponent(
    JSON.stringify({
      logLevel,
      theme,
      opened,
      animationsEnabled,
    }),
  )
  // set iframe src BEFORE putting it into the DOM (prevent firefox adding an history entry)
  iframe.setAttribute("src", toolbarUrl)
  placeholder.parentNode.replaceChild(iframe, placeholder)

  const listenToolbarStateChange = (callback) => {
    return addToolbarEventCallback(iframe, "toolbar_state_change", callback)
  }

  const cleanupInitOnReady = addToolbarEventCallback(
    iframe,
    "toolbar_ready",
    () => {
      cleanupInitOnReady()
      sendCommandToToolbar(iframe, "initToolbar")
      setTimeout(() => {
        listenToolbarStateChange(({ animationsEnabled }) => {
          if (animationsEnabled) {
            iframe.style.transitionDuration = "300ms"
          } else {
            iframe.style.transitionDuration = "0s"
          }
        })
      })
    },
  )

  const div = document.createElement("div")
  div.innerHTML = `
<div id="jsenv_toolbar_trigger" style="display:none">
  <svg id="jsenv_toolbar_trigger_icon">
    <use xlink:href="${jsenvLogoSvgUrl}#jsenv_logo"></use>
  </svg>
  <style>
    #jsenv_toolbar_trigger {
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

    #jsenv_toolbar_trigger:hover {
      cursor: pointer;
    }

    #jsenv_toolbar_trigger[data-expanded] {
      bottom: 0;
    }

    #jsenv_toolbar_trigger_icon {
      width: 35px;
      height: 35px;
      opacity: 0;
      transition: 600ms;
    }

    #jsenv_toolbar_trigger[data-expanded] #jsenv_toolbar_trigger_icon {
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
    sendCommandToToolbar(iframe, "openToolbar")
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

  listenToolbarStateChange(({ opened }) => {
    if (opened) {
      hideToolbarTrigger()
    } else {
      showToolbarTrigger()
    }
  })

  await iframeLoadedPromise
  iframe.removeAttribute("tabindex")

  return iframe
}

const addToolbarEventCallback = (iframe, eventName, callback) => {
  const messageEventCallback = (messageEvent) => {
    const { data } = messageEvent
    if (typeof data !== "object") {
      return
    }
    const { __jsenv__ } = data
    if (!__jsenv__) {
      return
    }
    if (__jsenv__.event !== eventName) {
      return
    }
    callback(__jsenv__.data)
  }
  window.addEventListener("message", messageEventCallback, false)
  return () => {
    window.removeEventListener("message", messageEventCallback, false)
  }
}

const sendCommandToToolbar = (iframe, command, ...args) => {
  iframe.contentWindow.postMessage(
    {
      __jsenv__: {
        command,
        args,
      },
    },
    window.origin,
  )
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

const queryPlaceholder = () => {
  return document.querySelector("[data-jsenv-toolbar-placeholder]")
}

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
