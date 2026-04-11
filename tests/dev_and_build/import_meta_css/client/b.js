export const setBodyColor = (color) => {
  import.meta.css = /* css */ `
    body {
      color: ${color};
    }
  `;
};
