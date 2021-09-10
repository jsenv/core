/* eslint-env browser, node */

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

export const stringifyDataUrl = ({ mediaType, base64Flag = true, data }) => {
  if (!mediaType || mediaType === "text/plain;charset=US-ASCII") {
    // can be a buffer or a string, hence check on data.length instead of !data or data === ''
    if (data.length === 0) {
      return `data:,`
    }
    if (base64Flag) {
      return `data:,${data}`
    }
    return `data:,${dataToBase64(data)}`
  }
  if (base64Flag) {
    return `data:${mediaType};base64,${dataToBase64(data)}`
  }
  return `data:${mediaType},${data}`
}

export const dataUrlToRawData = ({ base64Flag, data }) => {
  return base64Flag ? base64ToString(data) : data
}

export const dataToBase64 =
  typeof window === "object"
    ? window.atob
    : (data) => Buffer.from(data).toString("base64")

export const base64ToString =
  typeof window === "object"
    ? window.btoa
    : (base64String) => Buffer.from(base64String, "base64").toString("utf8")
