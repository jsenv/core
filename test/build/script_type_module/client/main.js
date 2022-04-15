import { answer } from "./file.js"

setTimeout(() => {
  const url = import.meta.url
  window.resolveNamespacePromise({
    answer,
    url,
  })
}, 100)
