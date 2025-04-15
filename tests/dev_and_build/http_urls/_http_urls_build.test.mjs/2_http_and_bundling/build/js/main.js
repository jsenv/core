const url = import.meta.url;

const answer = 42;

window.resolveResultPromise({
  url: url.replace(window.origin, "window.origin"),
  answer,
});