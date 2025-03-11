import { DEV } from "#env";

export const greet = () => {
  return DEV ? "Welcome dev" : "Welcome";
};
