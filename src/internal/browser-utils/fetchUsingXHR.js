import { createDetailedMessage } from "@jsenv/logger"

export const fetchUsingXHR = async (
  url,
  {
    signal,
    method = "GET",
    credentials = "same-origin",
    headers = {},
    body = null,
  } = {},
) => {
  const headersPromise = createPromiseAndHooks()
  const bodyPromise = createPromiseAndHooks()

  const xhr = new XMLHttpRequest()

  const failure = (error) => {
    // if it was already resolved, we must reject the body promise
    if (headersPromise.settled) {
      bodyPromise.reject(error)
    } else {
      headersPromise.reject(error)
    }
  }

  const cleanup = () => {
    xhr.ontimeout = null
    xhr.onerror = null
    xhr.onload = null
    xhr.onreadystatechange = null
  }

  xhr.ontimeout = () => {
    cleanup()
    failure(new Error(`xhr request timeout on ${url}.`))
  }

  xhr.onerror = (error) => {
    cleanup()
    // unfortunately with have no clue why it fails
    // might be cors for instance
    failure(createRequestError(error, { url }))
  }

  xhr.onload = () => {
    cleanup()
    bodyPromise.resolve()
  }

  signal.addEventListener("abort", () => {
    xhr.abort()
    const abortError = new Error("aborted")
    abortError.name = "AbortError"
    failure(abortError)
  })

  xhr.onreadystatechange = () => {
    // https://developer.mozilla.org/fr/docs/Web/API/XMLHttpRequest/readyState
    const { readyState } = xhr

    if (readyState === 2) {
      headersPromise.resolve()
    } else if (readyState === 4) {
      cleanup()
      bodyPromise.resolve()
    }
  }

  xhr.open(method, url, true)
  Object.keys(headers).forEach((key) => {
    xhr.setRequestHeader(key, headers[key])
  })
  xhr.withCredentials = computeWithCredentials({ credentials, url })
  if ("responseType" in xhr && hasBlob) {
    xhr.responseType = "blob"
  }
  xhr.send(body)

  await headersPromise

  // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseURL
  const responseUrl =
    "responseURL" in xhr ? xhr.responseURL : headers["x-request-url"]
  let responseStatus = xhr.status
  const responseStatusText = xhr.statusText
  const responseHeaders = getHeadersFromXHR(xhr)

  const readBody = async () => {
    await bodyPromise

    const { status } = xhr
    // in Chrome on file:/// URLs, status is 0
    if (status === 0) {
      responseStatus = 200
    }

    const body = "response" in xhr ? xhr.response : xhr.responseText

    return {
      responseBody: body,
      responseBodyType: detectBodyType(body),
    }
  }

  const text = async () => {
    const { responseBody, responseBodyType } = await readBody()

    if (responseBodyType === "blob") {
      return blobToText(responseBody)
    }
    if (responseBodyType === "formData") {
      throw new Error("could not read FormData body as text")
    }
    if (responseBodyType === "dataView") {
      return arrayBufferToText(responseBody.buffer)
    }
    if (responseBodyType === "arrayBuffer") {
      return arrayBufferToText(responseBody)
    }
    // if (responseBodyType === "text" || responseBodyType === 'searchParams') {
    //   return body
    // }
    return String(responseBody)
  }

  const json = async () => {
    const responseText = await text()
    return JSON.parse(responseText)
  }

  const blob = async () => {
    if (!hasBlob) {
      throw new Error(`blob not supported`)
    }

    const { responseBody, responseBodyType } = await readBody()

    if (responseBodyType === "blob") {
      return responseBody
    }
    if (responseBodyType === "dataView") {
      return new Blob([cloneBuffer(responseBody.buffer)])
    }
    if (responseBodyType === "arrayBuffer") {
      return new Blob([cloneBuffer(responseBody)])
    }
    if (responseBodyType === "formData") {
      throw new Error("could not read FormData body as blob")
    }
    return new Blob([String(responseBody)])
  }

  const arrayBuffer = async () => {
    const { responseBody, responseBodyType } = await readBody()

    if (responseBodyType === "arrayBuffer") {
      return cloneBuffer(responseBody)
    }
    const responseBlob = await blob()
    return blobToArrayBuffer(responseBlob)
  }

  const formData = async () => {
    if (!hasFormData) {
      throw new Error(`formData not supported`)
    }
    const responseText = await text()
    return textToFormData(responseText)
  }

  return {
    url: responseUrl,
    status: responseStatus,
    statusText: responseStatusText,
    headers: responseHeaders,
    text,
    json,
    blob,
    arrayBuffer,
    formData,
  }
}

const canUseBlob = () => {
  if (typeof window.FileReader !== "function") return false

  if (typeof window.Blob !== "function") return false

  try {
    // eslint-disable-next-line no-new
    new Blob()
    return true
  } catch (e) {
    return false
  }
}

const hasBlob = canUseBlob()

const hasFormData = typeof window.FormData === "function"

const hasArrayBuffer = typeof window.ArrayBuffer === "function"

const hasSearchParams = typeof window.URLSearchParams === "function"

const createRequestError = (error, { url }) => {
  return new Error(
    createDetailedMessage(`error during xhr request on ${url}.`, {
      ["error stack"]: error.stack,
    }),
  )
}

const createPromiseAndHooks = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = (value) => {
      promise.settled = true
      res(value)
    }
    reject = (value) => {
      promise.settled = true
      rej(value)
    }
  })
  promise.resolve = resolve
  promise.reject = reject
  return promise
}

// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
const computeWithCredentials = ({ credentials, url }) => {
  if (credentials === "same-origin") {
    return originSameAsGlobalOrigin(url)
  }
  return credentials === "include"
}

const originSameAsGlobalOrigin = (url) => {
  // if we cannot read globalOrigin from window.location.origin, let's consider it's ok
  if (typeof window !== "object") return true
  if (typeof window.location !== "object") return true
  const globalOrigin = window.location.origin
  if (globalOrigin === "null") return true
  return hrefToOrigin(url) === globalOrigin
}

const detectBodyType = (body) => {
  if (!body) {
    return ""
  }
  if (typeof body === "string") {
    return "text"
  }
  if (hasBlob && Blob.prototype.isPrototypeOf(body)) {
    return "blob"
  }
  if (hasFormData && FormData.prototype.isPrototypeOf(body)) {
    return "formData"
  }
  if (hasArrayBuffer) {
    if (hasBlob && isDataView(body)) {
      return `dataView`
    }
    if (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body)) {
      return `arrayBuffer`
    }
  }
  if (hasSearchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
    return "searchParams"
  }
  return ""
}

// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/getAllResponseHeaders#Example
const getHeadersFromXHR = (xhr) => {
  const headerMap = {}

  const headersString = xhr.getAllResponseHeaders()
  if (headersString === "") return headerMap

  const lines = headersString.trim().split(/[\r\n]+/)
  lines.forEach((line) => {
    const parts = line.split(": ")
    const name = parts.shift()
    const value = parts.join(": ")
    headerMap[name.toLowerCase()] = value
  })

  return headerMap
}

const hrefToOrigin = (href) => {
  const scheme = hrefToScheme(href)

  if (scheme === "file") {
    return "file://"
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length
    const pathnameSlashIndex = href.indexOf("/", secondProtocolSlashIndex)

    if (pathnameSlashIndex === -1) return href
    return href.slice(0, pathnameSlashIndex)
  }

  return href.slice(0, scheme.length + 1)
}

const hrefToScheme = (href) => {
  const colonIndex = href.indexOf(":")
  if (colonIndex === -1) return ""
  return href.slice(0, colonIndex)
}

const isDataView = (obj) => {
  return obj && DataView.prototype.isPrototypeOf(obj)
}

const isArrayBufferView =
  ArrayBuffer.isView ||
  (() => {
    const viewClasses = [
      "[object Int8Array]",
      "[object Uint8Array]",
      "[object Uint8ClampedArray]",
      "[object Int16Array]",
      "[object Uint16Array]",
      "[object Int32Array]",
      "[object Uint32Array]",
      "[object Float32Array]",
      "[object Float64Array]",
    ]

    return (value) => {
      return (
        value && viewClasses.includes(Object.prototype.toString.call(value))
      )
    }
  })()

const textToFormData = (text) => {
  const form = new FormData()
  text
    .trim()
    .split("&")
    .forEach(function (bytes) {
      if (bytes) {
        const split = bytes.split("=")
        const name = split.shift().replace(/\+/g, " ")
        const value = split.join("=").replace(/\+/g, " ")
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
  return form
}

const blobToArrayBuffer = async (blob) => {
  const reader = new FileReader()
  const promise = fileReaderReady(reader)
  reader.readAsArrayBuffer(blob)
  return promise
}

const blobToText = (blob) => {
  const reader = new FileReader()
  const promise = fileReaderReady(reader)
  reader.readAsText(blob)
  return promise
}

const arrayBufferToText = (arrayBuffer) => {
  const view = new Uint8Array(arrayBuffer)
  const chars = new Array(view.length)
  let i = 0
  while (i < view.length) {
    chars[i] = String.fromCharCode(view[i])

    i++
  }
  return chars.join("")
}

const fileReaderReady = (reader) => {
  return new Promise(function (resolve, reject) {
    reader.onload = function () {
      resolve(reader.result)
    }
    reader.onerror = function () {
      reject(reader.error)
    }
  })
}

const cloneBuffer = (buffer) => {
  if (buffer.slice) {
    return buffer.slice(0)
  }
  const view = new Uint8Array(buffer.byteLength)
  view.set(new Uint8Array(buffer))
  return view.buffer
}
