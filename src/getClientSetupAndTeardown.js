export const getBrowserSetupAndTeardowm = ({ collectCoverage }) => {
  // keep in mind that setup and teardown will be stringified and evaluated in the context of the client
  // you cannot use any variable from server

  const setup = () => {}

  const teardown = collectCoverage
    ? (value) => {
        if ("__coverage__" in window === false) {
          throw new Error(`missing window.__coverage__`)
        }

        return {
          value,
          coverage: window.__coverage__,
        }
      }
    : (value) => {
        return { value }
      }

  return {
    setup,
    teardown,
  }
}

export const getNodeSetupAndTeardowm = ({ collectCoverage }) => {
  // keep in mind that setup and teardown will be stringified and evaluated in the context of the client
  // you cannot use any variable from server

  const setup = () => {}

  const teardown = collectCoverage
    ? (value) => {
        if ("__coverage__" in global === false) {
          throw new Error(`missing global.__coverage__`)
        }

        return {
          value,
          coverage: global.__coverage__,
        }
      }
    : (value) => {
        return { value }
      }

  return {
    setup,
    teardown,
  }
}
