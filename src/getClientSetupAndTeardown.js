// keep in mind that setup and teardown will be stringified and evaluated client side
// you cannot use any variable from server

const teardownForNamespaceAndTestAndCoverage = (namespace) => {
  return Promise.resolve(namespace.output).then((test) => {
    const globalObject = typeof window === "object" ? window : global

    return {
      namespace,
      test,
      coverage: "__coverage__" in globalObject ? globalObject.__coverage__ : null,
    }
  })
}

const teardownForNamespaceAndTest = (namespace) => {
  return Promise.resolve(namespace.output).then((test) => {
    return {
      namespace,
      test,
    }
  })
}

const teardownForNamespaceAndCoverage = (namespace) => {
  const globalObject = typeof window === "object" ? window : global

  return {
    namespace,
    coverage: "__coverage__" in globalObject ? globalObject.__coverage__ : null,
  }
}

const teardownForNamespace = (namespace) => {
  return { namespace }
}

const getTeardown = ({ collectCoverage, collectTest }) => {
  if (collectTest) {
    return collectCoverage ? teardownForNamespaceAndTestAndCoverage : teardownForNamespaceAndTest
  }
  return collectCoverage ? teardownForNamespaceAndCoverage : teardownForNamespace
}

export const getBrowserSetupAndTeardowm = ({ collectCoverage, collectTest }) => {
  const setup = () => {}

  return {
    setup,
    teardown: getTeardown({ collectCoverage, collectTest }),
  }
}

export const getNodeSetupAndTeardowm = ({ collectCoverage, collectTest }) => {
  const setup = () => {}

  return {
    setup,
    teardown: getTeardown({ collectCoverage, collectTest }),
  }
}
