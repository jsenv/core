Promise.reject(new Error("toto"));

await new Promise((resolve) => {
  setTimeout(resolve, 400);
});
