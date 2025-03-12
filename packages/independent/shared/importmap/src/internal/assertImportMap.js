export const assertImportMap = (value) => {
  if (value === null) {
    throw new TypeError(`an importMap must be an object, got null`)
  }

  const type = typeof value
  if (type !== "object") {
    throw new TypeError(`an importMap must be an object, received ${value}`)
  }

  if (Array.isArray(value)) {
    throw new TypeError(
      `an importMap must be an object, received array ${value}`,
    )
  }
}
