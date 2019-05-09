// eslint-disable-next-line import/no-unresolved
import { entryPointName, groupMap } from "/.jsenv/browser-balancer-data.js"
// eslint-disable-next-line import/no-unresolved
import { resolveBrowserGroup } from "/.jsenv/browser-group-resolver.js"

window.System.register([], (_export, _context) => {
  const execute = async () => {
    const compileId = await resolveBrowserGroup({ groupMap })
    const scriptSrc = `./${compileId}/${entryPointName}.js`

    const namespace = await _context.import(scriptSrc)
    _export(namespace)
  }

  return {
    execute,
  }
})
