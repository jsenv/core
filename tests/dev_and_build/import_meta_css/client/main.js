import.meta.css = /* css */ `
  body {
    background-color: red;
  }
`;

window.resolveResultPromise(
  window.getComputedStyle(document.body).backgroundColor,
);
