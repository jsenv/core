// keep in mind that setup and teardown will be stringified and evaluated client side
// you cannot use any variable from server

const teardownForValueAndTestAndCoverage = (value) => {
  const globalObject = typeof window === "undefined" ? global : window

  if ("__executeTest__" in globalObject === false) {
    throw new Error(`missing __executeTest__`)
  }

  return globalObject.executeTest().then((test) => {
    if ("__coverage__" in globalObject === false) {
      throw new Error(`missing __coverage__`)
    }

    return {
      value,
      test,
      coverage: globalObject.__coverage__,
    }
  })
}

const teardownForValueAndTest = (value) => {
  const globalObject = typeof window === "undefined" ? global : window

  if ("__executeTest__" in globalObject === false) {
    throw new Error(`missing __executeTest__`)
  }

  return globalObject.executeTest().then((test) => {
    return {
      value,
      test,
    }
  })
}

const teardownForValueAndCoverage = (value) => {
  const globalObject = typeof window === "undefined" ? global : window

  if ("__coverage__" in globalObject === false) {
    throw new Error(`missing __coverage__`)
  }

  return {
    value,
    coverage: globalObject.__coverage__,
  }
}

const teardownForValue = (value) => {
  return { value }
}

const getTeardown = ({ collectCoverage, executeTest }) => {
  if (executeTest) {
    return collectCoverage ? teardownForValueAndTestAndCoverage : teardownForValueAndTest
  }
  return collectCoverage ? teardownForValueAndCoverage : teardownForValue
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
