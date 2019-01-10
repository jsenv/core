import { createTwoWayStream } from "./createTwoWayStream.js"
import { pipe } from "./pipe.js"

export const createBody = (data) => {
  const twoWayStream = createTwoWayStream()
  pipe(
    data,
    twoWayStream,
  )

  const readAsString = () => {
    return twoWayStream.ended.then((buffers) => buffers.join(""))
  }

  const text = () => {
    return readAsString()
  }

  const arraybuffer = () => {
    return text().then(stringToArrayBuffer)
  }

  const json = () => {
    return text().then(JSON.parse)
  }

  return {
    ...twoWayStream,
    text,
    arraybuffer,
    json,
  }
}

const stringToArrayBuffer = (string) => {
  string = String(string)
  const buffer = new ArrayBuffer(string.length * 2) // 2 bytes for each char
  const bufferView = new Uint16Array(buffer)
  let i = 0
  while (i < string.length) {
    bufferView[i] = string.charCodeAt(i)
    i++
  }
  return buffer
}
