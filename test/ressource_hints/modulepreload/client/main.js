// Let browser time to log an eventual warning about preload link not used
await new Promise((resolve) => {
  setTimeout(resolve, 5000)
})
window.resolveNamespacePromise({
  answer: 42,
})
