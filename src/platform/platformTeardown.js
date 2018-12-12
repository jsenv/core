export const teardownForOutput = (namespace) => {
  return namespace.output
}

export const teardownForOutputAndCoverageMap = (namespace) => {
  return Promise.resolve(namespace.output).then((output) => {
    const globalObject = typeof window === "object" ? window : global

    return {
      output,
      coverageMap: "__coverage__" in globalObject ? globalObject.__coverage__ : null,
    }
  })
}
