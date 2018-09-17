// keep in mind that setup and teardown will be stringified and evaluated client side
// you cannot use any variable from server

const teardownForNamespaceAndTestAndCoverage = (namespace) => {
  const globalObject = typeof window === "object" ? window : global
  const __test__ = "__test__" in globalObject ? globalObject.__test__ : () => null

  return Promise.resolve()
    .then(__test__)
    .then((test) => {
      return {
        namespace,
        test,
        coverage: "__coverage__" in globalObject ? globalObject.__coverage__ : null,
      }
    })
}

const teardownForNamespaceAndTest = (namespace) => {
  const globalObject = typeof window === "object" ? window : global
  const __test__ = "__test__" in globalObject ? globalObject.__test__ : () => null

  return Promise.resolve()
    .then(__test__)
    .then((test) => {
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

const getTeardown = ({ collectCoverage, executeTest }) => {
  if (executeTest) {
    return collectCoverage ? teardownForNamespaceAndTestAndCoverage : teardownForNamespaceAndTest
  }
  return collectCoverage ? teardownForNamespaceAndCoverage : teardownForNamespace
}

export const getBrowserSetupAndTeardowm = ({ collectCoverage, executeTest }) => {
  const setup = () => {}

  return {
    setup,
    teardown: getTeardown({ collectCoverage, executeTest }),
  }
}

export const getNodeSetupAndTeardowm = ({ collectCoverage, executeTest }) => {
  const setup = () => {}

  return {
    setup,
    teardown: getTeardown({ collectCoverage, executeTest }),
  }
}
