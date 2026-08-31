/**
 * One page, one navi.
 *
 * navi keeps contexts, registries and singletons at module scope, so a second
 * copy of the library in the same page is a second of each, and nothing
 * crosses between them. Every symptom of that lands far from the cause and
 * reads as an app bug: a <Loading> mounted by one copy is invisible to the
 * hook reading the other's context and reports itself missing, an action
 * registered in one is unknown to the other, focus and z-index each get a
 * second owner. So the copies are detected here, when the second one is
 * imported, and that import fails — the first thing that goes wrong says what
 * is wrong.
 *
 * A copy is a module evaluation, which is what the object added to the set
 * stands for; the urls are only there to tell the reader which two files to
 * compare. Two urls for one file on disk is the usual shape (a dev server
 * stamping a package version into specifiers, a bundle embedding navi next to
 * a copy resolved separately); two versions installed in node_modules is the
 * other.
 *
 * This module must stay in the entry chunk: the whole point is that it is
 * evaluated once per copy of navi, and a shared chunk would be evaluated once
 * for both.
 */

// Symbol.for so the set is the same one across copies — a copy cannot see the
// other's module scope, which is the very thing being detected.
const NAVI_INSTANCE_SET = Symbol.for("navi_instance_set");

const instanceSet = globalThis[NAVI_INSTANCE_SET] || new Set();
globalThis[NAVI_INSTANCE_SET] = instanceSet;
instanceSet.add({ url: import.meta.url });
if (instanceSet.size > 1) {
  const urlList = Array.from(instanceSet, ({ url }) => `- ${url}`).join("\n");
  throw new Error(`@jsenv/navi is loaded ${instanceSet.size} times in this page:
${urlList}
Each one builds its own contexts, stores and registries, so what one holds is invisible to the components using another.`);
}
