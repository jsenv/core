import { answer } from "./file.js"

setTimeout(() => {
  const url = import.meta.url
  window.resolveResultPromise({
    answer,
    url,
  })
}, 100)
