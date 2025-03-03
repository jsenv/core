import { createObservable } from "./observable.js";

export const createObservableBody = ({ opened }) => {
  const observableBody = createObservable(({ next, error, complete }) => {
    try {
      const welcomeData = opened({
        write: (data) => {
          next(data);
        },
        close: () => {
          complete();
        },
      });
      // we must write something for fetch promise to resolve
      // this is conform to HTTP spec where client expect body to starts writing
      // before resolving response promise client side
      if (welcomeData === undefined) {
        console.warn(
          "opened should return some data to write to the client when joining",
        );
      }
      next(welcomeData);
    } catch (e) {
      error(e);
    }
  });
  observableBody.isObservableBody = true;
  return observableBody;
};
