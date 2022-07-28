import "./file.js"

if (import.meta.hot) {
  import.meta.hot.accept()
}

// let browser time to parse and apply css to the document
await new Promise((resolve) => setTimeout(resolve, 500))
window.resolveReadyPromise()
