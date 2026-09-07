/**
 * A component whose code is fetched on demand, the way its data is.
 *
 * The import is an action: it starts from the first render that needs it (or
 * from `preload()`), waits in the nearest `<Loading>`, fails in the nearest
 * `<ErrorBoundary>` with a `rerun` as the way back, and is counted by the
 * document busy signal like any other run. A page under `<Route>` therefore
 * fetches its code and its route action's data side by side, and shows one
 * wait for the two. See docs/dynamic_import.md.
 */

import { h } from "preact";

import { createAction } from "../../action/actions.js";
import { useAsyncData } from "./use_async_data.jsx";

/**
 * @param {() => Promise<Function | object>} load - what fetches the code,
 *   typically `() => import("./page.jsx")`. May resolve to the component
 *   itself or to the module: its `default` export, or its only exported
 *   function.
 * @returns {Function & { preload: () => void, action: object }} the component,
 *   rendering the loaded one with its props. `preload()` starts the fetch ahead
 *   of the render — on a link hovered, on an idle moment; a prefetch that fails
 *   is forgotten, the visit asks again.
 */
export const lazy = (load) => {
  const loadAction = createAction(
    async () => {
      const loaded = await load();
      return resolveComponent(loaded);
    },
    { name: nameFromLoader(load) },
  );

  const Lazy = (props) => {
    const [Component] = useAsyncData(loadAction, { run: true });
    return h(Component, props);
  };
  Lazy.displayName = `Lazy(${loadAction.name})`;
  Lazy.action = loadAction;
  // A prefetch is a prerun: nothing on screen asked for it. One that fails is
  // forgotten rather than reported — the visit that needs the code asks again
  // and shows its own failure; a boundary already showing this one keeps it
  // until the retry runs.
  Lazy.preload = () => {
    const prerunResult = loadAction.prerun({ reason: "preload" });
    // A run already in flight or done answers with nothing to wait for.
    if (prerunResult && typeof prerunResult.catch === "function") {
      prerunResult.catch(() => {
        loadAction.reset({ reason: "preload failed" });
      });
    }
  };
  return Lazy;
};

const resolveComponent = (loaded) => {
  if (typeof loaded === "function") {
    return loaded;
  }
  if (loaded && typeof loaded === "object") {
    if (typeof loaded.default === "function") {
      return loaded.default;
    }
    const functionExportNames = Object.keys(loaded).filter(
      (key) => typeof loaded[key] === "function",
    );
    if (functionExportNames.length === 1) {
      return loaded[functionExportNames[0]];
    }
    throw new Error(
      `lazy(): the module must export one component, found ${functionExportNames.length} (${functionExportNames.join(", ") || "none"}). Return the component from the loader to say which.`,
    );
  }
  throw new Error(`lazy(): expected a component or a module, got ${loaded}`);
};

// The specifier read off the loader's source, so the action (and the busy
// signal, and the debug output) says which page is being fetched.
const nameFromLoader = (load) => {
  const match = /import\(\s*["']([^"']+)["']/.exec(String(load));
  return match ? `import ${match[1]}` : "lazy";
};
