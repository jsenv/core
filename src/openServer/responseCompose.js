import { headersCompose } from "./headers.js"

const composeMapToKeyComposer = (composeMap) => (key, object, nextObject) => {
  if (key in object === false) {
    return nextObject[key]
  }

  if (key in composeMap === false) {
    return nextObject[key]
  }

  return composeMap[key](object[key], nextObject[key])
}

const keyComposerToReducer = (keyComposer) => {
  return (previous, object) => {
    const composed = { ...previous }
    Object.keys(object).forEach((key) => {
      composed[key] = keyComposer(key, previous, object)
    })
    return composed
  }
}

const composeMapToReducer = (composeMap) => {
  return keyComposerToReducer(composeMapToKeyComposer(composeMap))
}

const composeMapToCompose = (composeMap) => {
  const composeReducer = composeMapToReducer(composeMap)
  return (...objects) => {
    return objects.reduce(composeReducer, {})
  }
}

const responseComposeMap = {
  headers: headersCompose,
}

export const responseCompose = composeMapToCompose(responseComposeMap)
