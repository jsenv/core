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
import { naviI18n } from "../../text/navi_i18n.js";
import { useAsyncData } from "./use_async_data.jsx";

/**
 * What a run settles with when the code did not come. Never a bug of the page:
 * the network is gone, or the document is stale — a deploy moved the chunks
 * and this document still asks for the old addresses. The browser says both
 * with the same TypeError and no status, so the loader's failure is wrapped
 * here into something an app can recognise without reading a message: one
 * rule in its boundary ("show it, offer to retry") and, when a retry fails the
 * same way, reloading the document is what brings the new code.
 */
export class CodeLoadError extends Error {
  constructor(specifier, cause) {
    super(naviI18n("lazy.code_load_failed"), { cause });
    this.name = "CodeLoadError";
    this.specifier = specifier;
    // A flag beside the class: the error crosses layers that may copy it, and
    // instanceof does not survive a copy.
    this.codeLoad = true;
  }
}
export const isCodeLoadError = (error) => {
  return Boolean(error && error.codeLoad);
};

/**
 * @param {() => Promise<Function | object>} load - what fetches the code,
 *   typically `() => import("./page.jsx")`. May resolve to the component
 *   itself or to the module: its `default` export, or its only exported
 *   function.
 * @returns {Function & { preload: () => void, action: object }} the component,
 *   rendering the loaded one with its props, its wait and its failure
 *   delegated to the boundaries above. `preload()` starts the fetch ahead of
 *   the render — on a link hovered, on an idle moment; a prefetch that fails
 *   is forgotten, the visit asks again. `action` is the import itself, for a
 *   screen that draws the wait or the failure where it stands:
 *   `useAsyncData(Page.action, { run: true, error: true })`.
 */
export const lazy = (load) => {
  const specifier = specifierFromLoader(load);
  const loadAction = createAction(
    async () => {
      let loaded;
      try {
        loaded = await load();
      } catch (e) {
        throw new CodeLoadError(specifier, e);
      }
      return resolveComponent(loaded);
    },
    { name: specifier ? `import ${specifier}` : "lazy" },
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
// signal, the debug output, a CodeLoadError) says which page is being fetched.
const specifierFromLoader = (load) => {
  const match = /import\(\s*["']([^"']+)["']/.exec(String(load));
  return match ? match[1] : undefined;
};
