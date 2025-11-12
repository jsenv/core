const installImportMetaCss = (importMeta) => {
  const stylesheet = new CSSStyleSheet({ baseUrl: importMeta.url });

  let called = false;
  // eslint-disable-next-line accessor-pairs
  Object.defineProperty(importMeta, "css", {
    configurable: true,
    set(value) {
      if (called) {
        throw new Error("import.meta.css setter can only be called once");
      }
      called = true;
      stylesheet.replaceSync(value);
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        stylesheet,
      ];
    },
  });
};

installImportMetaCss(import.meta);
import.meta.css = /* css */ `
  @layer navi {
    :root {
      --navi-focus-outline-color: light-dark(#4476ff, #3b82f6);
      --navi-loader-color: light-dark(#355fcc, #3b82f6);
      --navi-selection-border-color: #0078d4;
      --navi-selection-background-color: #eaf1fd;
    }
  }
`;

export { installImportMetaCss };
//# sourceMappingURL=jsenv_navi_side_effects.js.map
