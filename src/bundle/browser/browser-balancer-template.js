// eslint-disable-next-line import/no-unresolved
import { entryPointName, groupMap } from "BUNDLE_BROWSER_DATA.js"
// eslint-disable-next-line import/no-unresolved
import { resolveBrowserGroup } from "BROWSER_GROUP_RESOLVER.js"

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
