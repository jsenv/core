import { markFileAsImported } from "../importTracker.js"

export const executeFile = ({
  file,
  remoteCompiledFile,
  setupSource = "",
  teardownSource = "",
}) => {
  markFileAsImported(file)

  return Promise.resolve().then(() => {
    const setup = eval(setupSource)
    const teardown = eval(teardownSource)

    return Promise.resolve()
      .then(setup)
      .then(() => global.System.import(remoteCompiledFile))
      .then(teardown)
  })
}
