import { uneval } from "@dmail/uneval"

export const createBrowserSetupSource = ({
  compileMap = {},
  platformFile,
  remoteRoot,
  compileInto,
  hotreload,
  hotreloadSSERoot,
}) => {
  return `
	  window.__platformPromise__ = window.__browserLoader__.load({
			compileMap: ${uneval(compileMap)},
			platformFile: ${uneval(platformFile)},
			remoteRoot: ${uneval(remoteRoot)},
			compileInto: ${uneval(compileInto)},
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
}) => {
  return `
  window.__platformPromise__.then((platform) => {
		platform.executeFile(${uneval(file)}, { instrument: ${uneval(instrument)} })
	})
`
}
