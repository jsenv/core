export const listenEvent = (
  objectWithEventEmitter,
  eventName,
  callback,
  { once = false } = {},
) => {
  if (once) {
    objectWithEventEmitter.once(eventName, callback)
  } else {
    objectWithEventEmitter.addListener(eventName, callback)
  }
  return () => {
    objectWithEventEmitter.removeListener(eventName, callback)
  }
}
