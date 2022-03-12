export const createBuilUrlsGenerator = ({ baseUrl }) => {
  // TODO: normalize baseUrl
  // if a valid url:
  //   - ensure trailing slash
  // otherwise assert it's a string +
  //   - ensure leading slash
  //   - ensure trailing slash

  const cache = {}
  const generate = (name, directoryRelativeUrl) => {
    let names = cache[directoryRelativeUrl]
    if (!names) {
      names = []
      cache[directoryRelativeUrl] = names
    }

    let nameCandidate = name
    let integer = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!names.includes(nameCandidate)) {
        names.push(nameCandidate)
        break
      }
      integer++
      nameCandidate = `${name}${integer}`
    }
    if (directoryRelativeUrl === "/") {
      return `${baseUrl}${nameCandidate}`
    }
    return `${baseUrl}${directoryRelativeUrl}${nameCandidate}`
  }

  return {
    generate,
  }
}
