// Let browser time to log an eventual warning about preload link not used
await new Promise((resolve) => {
  setTimeout(resolve, 5_000)
})
window.resolveResultPromise(42)
