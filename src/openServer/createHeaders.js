/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/

const normalizeName = (headerName) => {
  headerName = String(headerName)
  if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(headerName)) {
    throw new TypeError("Invalid character in header field name")
  }

  return headerName.toLowerCase()
}

const normalizeValue = (headerValue) => {
  return String(headerValue)
}

const convertToClientName = (headerName) => {
  return headerName
}

// https://gist.github.com/mmazer/5404301
const parseHeaders = (headerString) => {
  var headers = {}
  var pairs
  var pair
  var index
  var i
  var j
  var key
  var value

  if (headerString) {
    pairs = headerString.split("\r\n")
    i = 0
    j = pairs.length
    for (; i < j; i++) {
      pair = pairs[i]
      index = pair.indexOf(": ")
      if (index > 0) {
        key = pair.slice(0, index)
        value = pair.slice(index + 2)
        headers[key] = value
      }
    }
  }

  return headers
}

export const createHeaders = (headers) => {
  const guard = "none"
  const map = new Map()

  const checkImmutability = () => {
    if (guard === "immutable") {
      throw new TypeError("headers are immutable")
    }
  }

  const has = (name) => map.has(normalizeName(name))

  const get = (name) => {
    name = normalizeName(name)
    return map.has(name) ? map.get(name)[0] : null
  }

  const getAll = (name) => {
    name = normalizeName(name)
    return map.has(name) ? map.get(name) : []
  }

  const set = (name, value) => {
    checkImmutability()

    name = normalizeName(name)
    value = normalizeValue(value)
    map.set(name, [value])
  }

  const append = (name, value) => {
    checkImmutability()

    name = normalizeName(name)
    value = normalizeValue(value)

    let values

    if (map.has(name)) {
      values = map.get(name)
    } else {
      values = []
    }

    values.push(value)
    map.set(name, values)
  }

  const combine = (name, value) => {
    if (map.has(name)) {
      value = `, ${normalizeValue(value)}`
    }

    return append(name, value)
  }

  const remove = (name) => {
    checkImmutability()

    name = normalizeName(name)
    return map.delete(name)
  }

  const entries = () => map.entries()

  const keys = () => map.keys()

  const values = () => map.values()

  const forEach = (fn, bind) => {
    Array.from(entries()).forEach(([headerName, headerValues]) => {
      headerValues.forEach((headerValue) => {
        fn.call(bind, headerName, headerValue)
      })
    })
  }

  const toString = () => {
    const headers = Array.from(entries()).map(([headerName, headerValues]) => {
      return `${convertToClientName(headerName)}: ${headerValues.join()}`
    })

    return headers.join("\r\n")
  }

  const toJSON = () => {
    const headers = {}

    Array.from(entries()).forEach(([headerName, headerValues]) => {
      headers[convertToClientName(headerName)] = headerValues
    })

    return headers
  }

  const populate = (headers) => {
    if (typeof headers === "string") {
      headers = parseHeaders(headers)
    } else if (Symbol.iterator in headers) {
      Array.from(headers).forEach(([name, values]) => {
        map.set(name, values)
      })
    } else if (typeof headers === "object") {
      Object.keys(headers).forEach((name) => {
        append(name, headers[name])
      })
    }
  }

  if (headers) {
    populate(headers)
  }

  return Object.freeze({
    has,
    get,
    getAll,
    set,
    append,
    combine,
    ["delete"]: remove,
    [Symbol.iterator]: () => map[Symbol.iterator](),
    entries,
    keys,
    values,
    forEach,
    toString,
    toJSON,
  })
}
