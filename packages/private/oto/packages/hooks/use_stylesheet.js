import { useLayoutEffect } from "preact/hooks";

export const useStylesheet = (stylesheet) => {
  useLayoutEffect(() => {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (s) => s !== stylesheet,
      );
    };
  }, []);
};
