import RefreshRuntime from "react-refresh";

export const installReactRefresh = (url) => {
  if (!self.__react_refresh_installed__) {
    throw new Error("react refresh not installed");
  }

  let prevRefreshReg;
  let prevRefreshSig;
  prevRefreshReg = self.$RefreshReg$;
  prevRefreshSig = self.$RefreshSig$;
  self.$RefreshReg$ = (type, id) => {
    RefreshRuntime.register(type, `${url} ${id}`);
  };
  self.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;

  return {
    end: () => {
      self.$RefreshReg$ = prevRefreshReg;
      self.$RefreshSig$ = prevRefreshSig;
    },
    acceptCallback: () => {
      if (!self.__react_refresh_timeout__) {
        self.__react_refresh_timeout__ = setTimeout(() => {
          self.__react_refresh_timeout__ = 0;
          RefreshRuntime.performReactRefresh();
        }, 30);
      }
    },
  };
};
