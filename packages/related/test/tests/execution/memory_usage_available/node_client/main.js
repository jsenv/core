setTimeout(() => {
  global.array = Array(1e6).fill("some string");
}, 1_000);

await new Promise((resolve) => {
  setTimeout(resolve, 4_000);
});
