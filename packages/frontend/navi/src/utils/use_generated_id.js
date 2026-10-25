/**
 * An id for what the caller left unnamed, unique in the document for as long
 * as the component stays mounted.
 *
 * Not preact's `useId()`: it numbers from the nearest root it finds walking
 * up the vnodes, and a component rendered while a suspension has parked its
 * subtree finds none — it starts again at "P0-0", the id of a component still
 * on screen. A registry keyed by id then holds the newcomer, and loses the
 * first control when the newcomer leaves. navi renders on the client only, so
 * a counter is all the uniqueness needs.
 */

import { useState } from "preact/hooks";

let generatedIdCount = 0;

export const useGeneratedId = () => {
  const [id] = useState(() => {
    generatedIdCount++;
    return `navi_${generatedIdCount}`;
  });
  return id;
};
