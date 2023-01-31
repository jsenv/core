// https://felixgerschau.com/how-to-communicate-with-service-workers/
export const sendMessageUsingChannel = (objectWithPostMessage, message) => {
  const { port1, port2 } = new MessageChannel()
  return new Promise((resolve, reject) => {
    port1.onmessage = function (event) {
      if (event.data.status === "rejected") {
        reject(event.data.value)
      } else {
        resolve(event.data.value)
      }
    }
    objectWithPostMessage.postMessage(message, [port2])
  })
}
