import { uneval } from "@dmail/uneval"

export const createBrowserPlatformSource = ({
  remoteRoot,
  compileInto,
  groupMap,
  hotreload,
  hotreloadSSERoot,
}) => {
  return `
  window.__platform__ = window.__browserPlatform__.createBrowserPlatform({
    remoteRoot: ${uneval(remoteRoot)},
    compileInto: ${uneval(compileInto)},
    groupMap: ${uneval(groupMap)},
    hotreload: ${uneval(hotreload)},
    hotreloadSSERoot: ${uneval(hotreloadSSERoot)},
    hotreloadCallback: function() {
      // we cannot just System.delete the file because the change may have any impact, we have to reload
      window.location.reload()
    }
	})
`
}

export const createBrowserExecuteSource = ({
  file,
  // if we want to instrument the code we are running we'll need a way
  // to show the coverage output somehow
  // we could create a special page able to display the coverage result
  // not in the MVP so we'll do that later
  instrument = false,
  setup = () => {},
  teardown = () => {},
}) => {
  return `
  window.__platform__.executeFile({
    file: ${uneval(file)},
    instrument: ${uneval(instrument)},
    setup: ${uneval(setup)},
    teardown: ${uneval(teardown)},
  })`
}
