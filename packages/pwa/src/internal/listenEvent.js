export const listenEvent = (objectWithEventEmitter, event, callback) => {
  objectWithEventEmitter.addEventListener(event, callback)
  return () => {
    objectWithEventEmitter.removeEventListener(event, callback)
  }
}
