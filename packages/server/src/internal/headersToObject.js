export const headersToObject = (headers) => {
  const headersObject = {}
  headers.forEach((value, name) => {
    headersObject[name] = value
  })
  return headersObject
}
