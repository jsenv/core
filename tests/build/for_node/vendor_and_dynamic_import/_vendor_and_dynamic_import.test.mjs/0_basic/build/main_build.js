const logA = async () => {
  const { a } = await import("a");
  console.log(a);
};

const logB = async () => {
  const { b } = await import("b");

  console.log(b);
};

export { logA, logB };
