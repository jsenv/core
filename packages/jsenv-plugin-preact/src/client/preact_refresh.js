/* globals self */

import "@prefresh/core"
import { flush } from "@prefresh/utils"

export const installPreactRefresh = (url) => {
  let prevRefreshReg = self.$RefreshReg$ || (() => {})
  let prevRefreshSig = self.$RefreshSig$ || (() => (type) => type)
  self.$RefreshReg$ = (type, id) => {
    self.__PREFRESH__.register(type, `${url} ${id}`)
  }
  self.$RefreshSig$ = () => {
    let status = "begin"
    let savedType
    return (type, key, forceReset, getCustomHooks) => {
      if (!savedType) savedType = type
      status = self.__PREFRESH__.sign(
        type || savedType,
        key,
        forceReset,
        getCustomHooks,
        status,
      )
      return type
    }
  }
  return {
    end: () => {
      self.$RefreshReg$ = prevRefreshReg
      self.$RefreshSig$ = prevRefreshSig
    },
    acceptCallback: () => {
      flush()
    },
  }
}
