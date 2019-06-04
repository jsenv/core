// eslint-disable-next-line import/no-unresolved
import { entryPointName, groupMap } from "/.jsenv/systemjs-balancer-data.js"
// eslint-disable-next-line import/no-unresolved
import { resolvePlatformGroup } from "/.jsenv/platform-group-resolver.js"

window.System.register([], (_export, _context) => {
  const execute = async () => {
    const compileId = resolvePlatformGroup({ groupMap })
    const scriptSrc = `./${compileId}/${entryPointName}.js`

    const namespace = await _context.import(scriptSrc)
    _export(namespace)
  }

  return {
    execute,
  }
})
