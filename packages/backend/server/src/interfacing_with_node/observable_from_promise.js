import { createObservable } from "./observable.js";

export const observableFromPromise = (promise) => {
  return createObservable(async ({ next, error, complete }) => {
    try {
      const value = await promise;
      next(value);
      complete();
    } catch (e) {
      error(e);
    }
  });
};
