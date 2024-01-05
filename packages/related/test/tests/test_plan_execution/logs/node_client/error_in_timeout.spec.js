await new Promise(() => {
  setTimeout(() => {
    throw new Error("here");
  }, 50);
});
