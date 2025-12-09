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
      --navi-color-light: white;
      --navi-color-dark: rgb(55, 60, 69);

      --navi-info-color-light: #eaf6fc;
      --navi-info-color: #376cc2;
      --navi-success-color-light: #ecf9ef;
      --navi-success-color: #50c464;
      --navi-warning-color-light: #fdf6e3;
      --navi-warning-color: #f19c05;
      --navi-error-color-light: #fcebed;
      --navi-error-color: #eb364b;

      --navi-xxs: 0.125em;
      --navi-xs: 0.25em;
      --navi-s: 0.5em;
      --navi-m: 1em;
      --navi-l: 1.5em;
      --navi-xl: 2em;
      --navi-xxl: 3em;
    }
  }
`;

export { installImportMetaCss };
//# sourceMappingURL=jsenv_navi_side_effects.js.map
