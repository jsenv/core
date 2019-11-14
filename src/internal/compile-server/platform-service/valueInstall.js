export const valueInstall = (object, name, value) => {
  const has = name in object
  const previous = object[name]

  object[name] = value

  return () => {
    if (has) {
      object[name] = previous
    } else {
      delete object[name]
    }
  }
}
