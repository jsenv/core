/* globals self */

import RefreshRuntime from "react-refresh"

// see https://github.com/vitejs/vite/blob/0858450b2a258b216ae9aa797cc02e9a0d4eb0af/packages/plugin-react/src/fast-refresh.ts#L29-L35
RefreshRuntime.injectIntoGlobalHook(self)
self.$RefreshReg$ = () => {}
self.$RefreshSig$ = () => (type) => type
const debounce = (fn, delay) => {
  let handle
  return () => {
    clearTimeout(handle)
    handle = setTimeout(fn, delay)
  }
}
// see https://github.com/vitejs/vite/blob/0858450b2a258b216ae9aa797cc02e9a0d4eb0af/packages/plugin-react/src/fast-refresh.ts#L16-L26
RefreshRuntime.performReactRefresh = debounce(
  RefreshRuntime.performReactRefresh,
  16,
)

self.__react_refresh_installed__ = true
