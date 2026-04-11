export const setBodyFontSize = (size) => {
  import.meta.css = /* css */ `
    body {
      font-size: ${size};
    }
  `;
};

// set top-level so installImportMetaCssBuild runs before a.js and b.js
setBodyFontSize("16px");
