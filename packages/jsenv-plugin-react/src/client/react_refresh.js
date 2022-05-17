/* globals self */

import RefreshRuntime from "react-refresh"

export const installReactRefresh = (url) => {
  RefreshRuntime.injectIntoGlobalHook(self)
  self.$RefreshReg$ = () => {}
  self.$RefreshSig$ = () => (type) => type

  let prevRefreshReg
  let prevRefreshSig

  prevRefreshReg = self.$RefreshReg$
  prevRefreshSig = self.$RefreshSig$
  self.$RefreshReg$ = (type, id) => {
    RefreshRuntime.register(type, `${url} ${id}`)
  }
  self.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform

  return {
    end: () => {
      self.$RefreshReg$ = prevRefreshReg
      self.$RefreshSig$ = prevRefreshSig
    },
    acceptCallback: () => {
      if (!self.__vite_plugin_react_timeout) {
        self.__vite_plugin_react_timeout = setTimeout(() => {
          self.__vite_plugin_react_timeout = 0
          RefreshRuntime.performReactRefresh()
        }, 30)
      }
    },
  }
}
