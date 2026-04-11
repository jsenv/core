export const setCssB = (color) => {
  import.meta.css = /* css */ `
    body {
      color: ${color};
    }
  `;
};
