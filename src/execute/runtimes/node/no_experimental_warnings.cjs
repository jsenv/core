// see https://github.com/nodejs/node/issues/47478
const originalEmit = process.emit
process.emit = (event, error) => {
  if (
    event === "warning" &&
    error.name === "ExperimentalWarning" &&
    error.message.includes("--experimental-loader")
  ) {
    return false
  }
  return originalEmit.call(process, event, error)
}
