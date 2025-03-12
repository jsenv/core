export const logA = async () => {
  const { a } = await import("a");
  console.log(a);
};

export const logB = async () => {
  const { b } = await import("b");

  console.log(b);
};
