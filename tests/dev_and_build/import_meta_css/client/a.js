export const setCssA = (color) => {
  import.meta.css = /* css */ `
    body {
      background-color: ${color};
    }
  `;
};
