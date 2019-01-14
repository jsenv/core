export const registerProcessInterruptCallback = (callback) => {
  // SIGINT is CTRL+C from keyboard
  // http://man7.org/linux/man-pages/man7/signal.7.html
  // may also be sent by vscode https://github.com/Microsoft/vscode-node-debug/issues/1#issuecomment-405185642
  process.once("SIGINT", callback)
  return () => {
    process.removeListener("SIGINT", callback)
  }
}
