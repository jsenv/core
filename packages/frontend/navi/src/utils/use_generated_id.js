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
 *
 * Held in a ref, not in useState: @preact/signals' shouldComponentUpdate
 * skips the render of a component holding hook state whose props did not
 * change, so an id kept as state would change when its caller renders.
 */

import { useRef } from "preact/hooks";

let generatedIdCount = 0;

export const useGeneratedId = () => {
  const idRef = useRef(null);
  if (idRef.current === null) {
    generatedIdCount++;
    idRef.current = `navi_${generatedIdCount}`;
  }
  return idRef.current;
};
