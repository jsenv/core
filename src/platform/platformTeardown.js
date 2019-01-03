export const teardownForOutput = (namespace) => {
  return namespace.output
}

export const teardownForOutputAndCoverageMap = async (namespace) => {
  const output = await namespace.output
  const globalObject = typeof window === "object" ? window : global

  return {
    output,
    coverageMap: "__coverage__" in globalObject ? globalObject.__coverage__ : null,
  }
}
