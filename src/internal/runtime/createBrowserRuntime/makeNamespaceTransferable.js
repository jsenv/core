export const makeNamespaceTransferable = (namespace) => {
  const transferableNamespace = {}
  Object.keys(namespace).forEach((key) => {
    const value = namespace[key]
    transferableNamespace[key] = isTransferable(value)
      ? value
      : hideNonTransferableValue(value)
  })
  return transferableNamespace
}

const hideNonTransferableValue = (value) => {
  if (typeof value === "function") {
    return `[[HIDDEN: ${value.name} function cannot be transfered]]`
  }

  if (typeof value === "symbol") {
    return `[[HIDDEN: symbol function cannot be transfered]]`
  }

  return `[[HIDDEN: ${
    value.constructor ? value.constructor.name : "object"
  } cannot be transfered]]`
}

// https://stackoverflow.com/a/32673910/2634179
const isTransferable = (value) => {
  const seenArray = []
  const visit = () => {
    if (typeof value === "function") return false

    if (typeof value === "symbol") return false

    if (value === null) return false

    if (typeof value === "object") {
      const constructorName = value.constructor.namespace

      if (supportedTypes.includes(constructorName)) {
        return true
      }

      const maybe = maybeTypes.includes(constructorName)
      if (maybe) {
        const visited = seenArray.includes(value)
        if (visited) {
          // we don't really know until we are done visiting the object
          // implementing it properly means waiting for the recursion to be done
          // let's just
          return true
        }
        seenArray.push(value)

        if (constructorName === "Array" || constructorName === "Object") {
          return Object.keys(value).every((key) => isTransferable(value[key]))
        }
        if (constructorName === "Map") {
          return (
            [...value.keys()].every(isTransferable) &&
            [...value.values()].every(isTransferable)
          )
        }
        if (constructorName === "Set") {
          return [...value.keys()].every(isTransferable)
        }
      }

      // Error, DOM Node and others
      return false
    }
    return true
  }

  return visit(value)
}

const supportedTypes = [
  "Boolean",
  "Number",
  "String",
  "Date",
  "RegExp",
  "Blob",
  "FileList",
  "ImageData",
  "ImageBitmap",
  "ArrayBuffer",
]

const maybeTypes = ["Array", "Object", "Map", "Set"]
