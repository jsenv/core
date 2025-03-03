import { createObservable } from "./observable.js";

export const createObservableBody = ({ opened }) => {
  const observableBody = createObservable(({ next, error, complete }) => {
    try {
      opened({
        write: (data) => {
          next(data);
        },
        close: () => {
          complete();
        },
      });
    } catch (e) {
      error(e);
    }
  });
  observableBody.isObservableBody = true;
  return observableBody;
};
