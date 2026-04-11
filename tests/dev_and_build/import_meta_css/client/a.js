export const setBodyBackgroundColor = (color) => {
  import.meta.css = /* css */ `
    body {
      background-color: ${color};
    }
  `;
};
