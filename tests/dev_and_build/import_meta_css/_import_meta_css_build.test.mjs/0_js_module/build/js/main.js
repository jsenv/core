import.meta.css =         `body {
  background-color: red;
}`;

window.resolveResultPromise(
  window.getComputedStyle(document.body).backgroundColor,
);