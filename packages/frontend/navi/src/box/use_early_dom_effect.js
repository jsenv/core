import { options } from "preact";

// Implementation notes:
//
// options.__r fires before each component render — we capture the current
// component instance (vnode.__c) so useEarlyDOMEffect can register itself.
//
// options.__c (commitRoot) fires after refs are assigned and before any
// useLayoutEffect runs. We flush all pending effects there.
// The DOM node is read from component.__v.__e (vnode → root DOM node),
// which Preact sets during diffing, before options.__c fires.
//
// stateMap (WeakMap) stores { cleanup, deps } per component instance.
// It's auto-GC'd when a component is destroyed; options.unmount also
// deletes entries eagerly to release cleanup functions sooner.
//
// pendingMap (Map) holds effects registered during the current render pass.
// It is always fully cleared in options.__c — bounded to one commit, no leak.

/**
 * Like useLayoutEffect, but runs before any layout effect in the commit —
 * including those of descendant components.
 *
 * Use this when a parent needs to mutate the DOM (e.g. apply styles) so that
 * children can read those mutations in their own useLayoutEffect.
 *
 * The DOM node of the component is passed as the first argument to fn.
 * The effect is skipped if no DOM node is found (e.g. on a fragment root).
 *
 * Supports deps and cleanup return, same as useLayoutEffect.
 */
export const useEarlyDOMEffect = (fn, deps, { needDOMNode = true } = {}) => {
  const component = _currentComponent;
  if (component) {
    pendingMap.set(component, { fn, deps, needDOMNode });
  }
};

// Populated during render, consumed + cleared in options.__c each commit.
const pendingMap = new Map(); // component → { fn, deps, ref }

// Persists across commits. WeakMap → no leak when component is destroyed.
const stateMap = new WeakMap(); // component → { cleanup, deps }

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
  for (const [component, { fn, deps, needDOMNode }] of pendingMap) {
    // component.__v is the component's vnode; __e is its root DOM node.
    // Both are set during diff, before options.__c fires.
    const element = component.__v && component.__v.__e;
    if (needDOMNode && !element) {
      continue;
    }
    const prev = stateMap.get(component);
    const prevDeps = prev ? prev.deps : undefined;
    let depsChanged;
    if (!prevDeps || !deps || prevDeps.length !== deps.length) {
      depsChanged = true;
    } else {
      for (let i = 0; i < deps.length; i++) {
        if (!Object.is(deps[i], prevDeps[i])) {
          depsChanged = true;
          break;
        }
      }
    }
    if (depsChanged) {
      if (prev && prev.cleanup) {
        prev.cleanup();
      }
      const result = fn(element);
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
    // stateMap is a WeakMap so the entry is GC'd automatically,
    // but deleting explicitly releases the cleanup fn sooner.
    stateMap.delete(component);
  }
  if (_prevUnmount) {
    _prevUnmount(vnode);
  }
};
