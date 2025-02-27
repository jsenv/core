// https://nodejs.org/api/webstreams.html#readablestreamgetreaderoptions
// we can read as text using TextDecoder, see https://developer.mozilla.org/fr/docs/Web/API/Fetch_API/Using_Fetch#traiter_un_fichier_texte_ligne_%C3%A0_ligne
import { createObservable } from "./observable.js";

export const observableFromNodeWebReadableStream = (nodeWebReadableStream) => {
  const observable = createObservable(({ next, error, complete }) => {
    const reader = nodeWebReadableStream.getReader();

    const readNext = async () => {
      try {
        const { done, value } = await reader.read();
        if (done) {
          complete();
          return;
        }
        next(value);
        readNext();
      } catch (e) {
        error(e);
      }
    };
    readNext();
    return () => {
      reader.cancel();
    };
  });

  return observable;
};
