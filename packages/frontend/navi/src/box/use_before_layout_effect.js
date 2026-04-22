/**
 * useBeforeLayoutEffect(fn, deps)
 *
 * Like useLayoutEffect but fires BEFORE any layout effect in the same commit —
 * including descendants'. Useful when a parent component sets DOM state (e.g.
 * styles) that children need to measure in their own useLayoutEffect.
 *
 * Timing guarantee:
 *   options.__c (commitRoot) fires after refs are assigned and before the
 *   layout-effects queue is flushed. We run pending callbacks there.
 *
 * Supports:
 *   - deps array: re-runs fn only when deps change (Object.is comparison)
 *   - cleanup: if fn returns a function, it is called before the next run
 *     and on unmount
 *
 * Memory safety:
 *   - pendingMap (Map) is cleared after every commit → bounded, no leak
 *   - stateMap (WeakMap) is keyed by component instance → auto-GC on destroy;
 *     options.unmount also deletes the entry eagerly to release the cleanup fn
 */

import { options } from "preact";

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
    // stateMap is a WeakMap so the entry is GC'd automatically,
    // but deleting explicitly releases the cleanup fn sooner.
    stateMap.delete(component);
  }
  if (_prevUnmount) {
    _prevUnmount(vnode);
  }
};

export const useBeforeLayoutEffect = (fn, deps) => {
  const component = _currentComponent;
  if (component) {
    pendingMap.set(component, { fn, deps });
  }
};
