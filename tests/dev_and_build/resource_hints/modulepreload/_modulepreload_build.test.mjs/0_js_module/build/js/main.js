
await new Promise((resolve) => {
  setTimeout(resolve, 5_000);
});
window.resolveResultPromise(42);