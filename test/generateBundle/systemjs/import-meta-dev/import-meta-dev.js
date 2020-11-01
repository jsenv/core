let value
if (import.meta.dev) {
  value = await import("./file.dev.js")
} else {
  value = null
}

export { value }
