export const parseDataUrl = (dataUrl) => {
  const afterDataProtocol = dataUrl.slice("data:".length)
  const commaIndex = afterDataProtocol.indexOf(",")
  const beforeComma = afterDataProtocol.slice(0, commaIndex)

  let mediaType
  let base64Flag
  if (beforeComma.endsWith(`;base64`)) {
    mediaType = beforeComma.slice(0, -`;base64`.length)
    base64Flag = true
  } else {
    mediaType = beforeComma
    base64Flag = false
  }

  const afterComma = afterDataProtocol.slice(commaIndex + 1)
  return {
    mediaType: mediaType === "" ? "text/plain;charset=US-ASCII" : mediaType,
    base64Flag,
    data: afterComma,
  }
}
