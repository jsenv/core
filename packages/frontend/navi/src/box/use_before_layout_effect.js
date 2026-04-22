import { options } from "preact";

// ─── useBeforeLayoutEffect ─────────────────────────────────────────────
// Like useLayoutEffect but fires BEFORE any layout effects run in this
// commit — including children's. Supports deps array and cleanup return.
//
// Implementation:
//   options.__r  → capture current component instance before each render
//   pendingMap   → populated during render; cleared after each commit
//                  (regular Map, iterable; bounded to one commit cycle → no leak)
//   stateMap     → WeakMap<component, {cleanup, deps}>; persists across
//                  commits; auto-GC'd when component is destroyed → no leak
//   options.__c  → commitRoot callback: fires after refs are assigned,
//                  before any useLayoutEffect. Runs pending effects here.
//   options.unmount → calls cleanup when component unmounts.
export const useBeforeLayoutEffect = (fn, deps) => {
  const component = _currentComponent;
  if (component) {
    pendingMap.set(component, { fn, deps });
  }
};

const pendingMap = new Map(); // component → { fn, deps } — cleared each commit
const stateMap = new WeakMap(); // component → { cleanup, deps }  — persists, WeakMap → no leak

let _currentComponent = null;
const _prevBeforeRender = options.__r;
options.__r = (vnode) => {
  _currentComponent = vnode.__c;
  if (_prevBeforeRender) {
    _prevBeforeRender(vnode);
  }
};

const _prevCommit = options.__c;
options.__c = (root, commitQueue) => {
  for (const [component, { fn, deps }] of pendingMap) {
    const prev = stateMap.get(component);
    const prevDeps = prev ? prev.deps : undefined;
    let depsChanged;
    if (!prevDeps || !deps || prevDeps.length !== deps.length) {
      depsChanged = true;
    } else {
      depsChanged = deps.some((d, i) => !Object.is(d, prevDeps[i]));
    }
    if (depsChanged) {
      if (prev && prev.cleanup) {
        prev.cleanup();
      }
      const result = fn();
      const cleanup = typeof result === "function" ? result : undefined;
      stateMap.set(component, { cleanup, deps });
    }
  }
  pendingMap.clear();
  if (_prevCommit) {
    _prevCommit(root, commitQueue);
  }
};

const _prevUnmount = options.unmount;
options.unmount = (vnode) => {
  const component = vnode.__c;
  if (component) {
    const state = stateMap.get(component);
    if (state && state.cleanup) {
      state.cleanup();
    }
    // stateMap is a WeakMap so entry is GC'd automatically,
    // but deleting explicitly avoids holding cleanup fn longer than needed.
    stateMap.delete(component);
  }
  if (_prevUnmount) {
    _prevUnmount(vnode);
  }
};
