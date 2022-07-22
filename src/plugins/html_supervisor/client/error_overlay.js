import { formatError } from "./error_formatter.js"

const JSENV_ERROR_OVERLAY_TAGNAME = "jsenv-error-overlay"

export const displayErrorInDocument = async (
  error,
  {
    rootDirectoryUrl,
    errorBaseUrl,
    openInEditor,
    url,
    line,
    column,
    reportedBy,
    requestedRessource,
  },
) => {
  const { theme, title, text, tip } = formatError(error, {
    rootDirectoryUrl,
    errorBaseUrl,
    openInEditor,
    url,
    line,
    column,
    reportedBy,
    requestedRessource,
  })

  let jsenvErrorOverlay = new JsenvErrorOverlay({
    theme,
    title,
    text,
    tip,
  })
  document.querySelectorAll(JSENV_ERROR_OVERLAY_TAGNAME).forEach((node) => {
    node.parentNode.removeChild(node)
  })
  document.body.appendChild(jsenvErrorOverlay)
  const removeErrorOverlay = () => {
    if (jsenvErrorOverlay && jsenvErrorOverlay.parentNode) {
      document.body.removeChild(jsenvErrorOverlay)
      jsenvErrorOverlay = null
    }
  }
  if (window.__reloader__) {
    window.__reloader__.onstatuschange = () => {
      if (window.__reloader__.status === "reloading") {
        removeErrorOverlay()
      }
    }
  }
  return removeErrorOverlay
}

class JsenvErrorOverlay extends HTMLElement {
  constructor({ theme, title, text, tip }) {
    super()
    this.root = this.attachShadow({ mode: "open" })
    this.root.innerHTML = `
<style>
  ${overlayCSS}
</style>
<div class="backdrop"></div>
<div class="overlay" data-theme=${theme}>
  <h1 class="title">
    ${title}
  </h1>
  <pre class="text">${text}</pre>
  <div class="tip">
    ${tip}
  </div>
</div>`
    this.root.querySelector(".backdrop").onclick = () => {
      if (!this.parentNode) {
        // not in document anymore
        return
      }
      this.root.querySelector(".backdrop").onclick = null
      this.parentNode.removeChild(this)
    }
  }
}

if (customElements && !customElements.get(JSENV_ERROR_OVERLAY_TAGNAME)) {
  customElements.define(JSENV_ERROR_OVERLAY_TAGNAME, JsenvErrorOverlay)
}

const overlayCSS = `
:host {
  position: fixed;
  z-index: 99999;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  margin: 0;
  background: rgba(0, 0, 0, 0.66);
}

.backdrop {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
}

.overlay {
  position: relative;
  background: rgba(0, 0, 0, 0.95);
  width: 800px;
  margin: 30px auto;
  padding: 25px 40px;
  padding-top: 0;
  overflow: hidden; /* for h1 margins */
  border-radius: 4px 8px;
  box-shadow: 0 20px 40px rgb(0 0 0 / 30%), 0 15px 12px rgb(0 0 0 / 20%);
  box-sizing: border-box;
  font-family: monospace;
  direction: ltr;
}

h1 {
  color: red;
  text-align: center;
}

pre {
  overflow: auto;
  max-width: 100%;
  /* padding is nice + prevents scrollbar from hiding the text behind it */
  /* does not work nicely on firefox though https://bugzilla.mozilla.org/show_bug.cgi?id=748518 */
  padding: 20px; 
}

.tip {
  border-top: 1px solid #999;
  padding-top: 12px;
}

[data-theme="dark"] {
  color: #999;
}
[data-theme="dark"] pre {
  background: #111;
  border: 1px solid #333;
  color: #eee;
}

[data-theme="light"] {
  color: #EEEEEE;
}
[data-theme="light"] pre {
  background: #1E1E1E;
  border: 1px solid white;
  color: #EEEEEE;
}

pre a {
  color: inherit;
}`
