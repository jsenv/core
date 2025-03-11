import { b } from "b";

export const doSomething = async () => {
  const { a } = await import("a");
  console.log(a);
};

export const logB = () => {
  console.log(b);
};
