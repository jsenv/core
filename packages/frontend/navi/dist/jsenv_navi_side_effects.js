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

installImportMetaCss(import.meta);import.meta.css = /* css */ `
  @layer navi {
    :root {
      --navi-background-color-readonly: #d3d3d3;
      --navi-color-readonly: grey;
      --navi-background-color-disabled: #d3d3d3;
      --navi-color-disabled: #eeeeee;

      --navi-info-color: #2196f3;
      --navi-warning-color: #ff9800;
      --navi-error-color: #f44336;

      --navi-loader-color: light-dark(#355fcc, #3b82f6);
    }
  }
`;

export { installImportMetaCss };
//# sourceMappingURL=jsenv_navi_side_effects.js.map
