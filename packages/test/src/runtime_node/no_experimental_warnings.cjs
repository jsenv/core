// see https://github.com/nodejs/node/issues/47478
const originalEmit = process.emit
process.emit = (event, error) => {
  if (event === "warning" && error.name === "ExperimentalWarning") {
    if (
      error.message.includes("--experimental-loader") ||
      error.message.includes("Custom ESM Loaders is an experimental")
    ) {
      return false
    }
  }
  return originalEmit.call(process, event, error)
}
