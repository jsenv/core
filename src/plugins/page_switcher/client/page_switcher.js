/*
 * cmd+K / ctrl+K on any dev-served page: the .html files the server serves, as a
 * tree one walks, filter as you type, Enter to go there.
 *
 * A tree rather than a list of paths, because the paths are mostly the same
 * path: folding every directory that holds a single thing turns
 * "packages/frontend/navi/src/layout/demos/…" repeated forty times into one
 * line holding forty files — and the packages become something one can see,
 * count and fold away rather than something to type.
 *
 * Injected into every page (see jsenv_plugin_page_switcher.js), which is why it
 * is careful about what it takes:
 * - the key is watched at the end of the bubble, on window, and a press that
 *   was already handled (defaultPrevented) is left alone — a page with its own
 *   cmd+K keeps it, and gets it first;
 * - nothing is fetched, built or styled until the first time it opens;
 * - everything it renders lives in a shadow root, so the page's own CSS cannot
 *   reach it and it cannot reach the page's.
 */

// Everything below lives in here rather than at the top level: this file is
// injected as a classic script, where a top-level `const` becomes a global
// lexical binding shared with every other script on the page — one named CSS
// took window.CSS away from the whole page, one named setup collided with
// another injected client. A function scope owes nothing to anybody.
(() => {
  const PAGES_ENDPOINT = "/.internal/pages.json";
  const STORAGE_KEY = "jsenv_page_switcher";
  // Open across a reload: this is a dev tool on a page one is editing, and a hot
  // reload in the middle of looking for the next page should not close what one
  // was looking at. In sessionStorage, not localStorage: it says what THIS tab was
  // doing a second ago, which is not something to remember tomorrow.
  const OPEN_KEY = "jsenv_page_switcher_open";
  // What kind of page it is, as the server reads it from where the file sits and
  // what it is called (see html_pages.js): something tried out, something shown,
  // or a page like any other.
  const KINDS = [
    { id: "demo", icon: "🎬", label: "demos" },
    { id: "experiment", icon: "🧪", label: "experiments" },
    { id: "page", icon: "📄", label: "pages" },
  ];
  // Demos alone to begin with: they are what one comes here for nine times out of
  // ten, and a tree opening on five hundred files is a tree nobody reads. The
  // other two are one click away, and the choice is remembered.
  const DEFAULT_KIND_STATE = { demo: true, experiment: false, page: false };

  const isSwitcherKey = (event) => {
    if (event.key !== "k" && event.key !== "K") {
      return false;
    }
    // cmd on mac, ctrl elsewhere — the same split every editor makes.
    return window.navigator.platform.toLowerCase().includes("mac")
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;
  };

  const STYLE_TEXT = /* css */ `
    :host {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: block;
      font-family: system-ui, sans-serif;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
    }
    .panel {
      position: absolute;
      top: 10vh;
      left: 50%;
      display: flex;
      width: min(640px, calc(100vw - 32px));
      max-height: 70vh;
      flex-direction: column;
      color: light-dark(#0f172a, #e2e8f0);
      background: light-dark(white, #1e293b);
      border-radius: 10px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      color-scheme: light dark;
      translate: -50% 0;
      overflow: hidden;
    }
    input {
      padding: 14px 16px;
      color: inherit;
      font-size: 15px;
      font-family: inherit;
      background: transparent;
      border: none;
      outline: none;
    }
    .kinds {
      display: flex;
      padding: 0 12px 10px;
      gap: 6px;
      border-bottom: 1px solid light-dark(#e2e8f0, #334155);
    }
    .kind_toggle {
      display: flex;
      padding: 4px 9px;
      align-items: center;
      gap: 5px;
      color: light-dark(#475569, #cbd5e1);
      font-size: 12px;
      font-family: inherit;
      background: light-dark(#f1f5f9, #0f172a);
      border: 1px solid transparent;
      border-radius: 999px;
      cursor: pointer;
    }
    .kind_toggle[data-on] {
      color: light-dark(#1d4ed8, #bfdbfe);
      background: light-dark(#dbeafe, #1e3a8a);
      border-color: light-dark(#93c5fd, #3b82f6);
    }
    .kind_toggle .count {
      margin: 0;
      padding: 0;
      opacity: 0.7;
    }
    ul {
      margin: 0;
      padding: 6px;
      list-style: none;
      overflow-y: auto;
    }
    li {
      display: flex;
      padding: 5px 8px;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-family: ui-monospace, monospace;
      white-space: nowrap;
      border-radius: 6px;
      cursor: pointer;
    }
    li[data-current] {
      color: white;
      background: light-dark(#2563eb, #3b82f6);
    }
    li[data-current] .dim,
    li[data-current] .count {
      color: inherit;
      opacity: 0.85;
    }
    .twisty {
      width: 1em;
      flex: none;
      opacity: 0.6;
    }
    .kind_icon {
      width: 1.2em;
      flex: none;
      font-size: 12px;
    }
    /* The name is what one reads; the road to it is context. */
    .dim {
      color: light-dark(#94a3b8, #64748b);
    }
    .strong {
      font-weight: 600;
    }
    .count {
      margin-left: auto;
      padding-left: 8px;
      color: light-dark(#94a3b8, #64748b);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .empty {
      padding: 14px 16px;
      color: light-dark(#64748b, #94a3b8);
      font-size: 13px;
      cursor: default;
    }
  `;

  let pagesPromise = null;
  const loadPages = () => {
    // Once per page load: the list is a filesystem scan behind a short cache
    // server-side, and a switcher opened twice in a row is the same list.
    pagesPromise ||= fetch(PAGES_ENDPOINT)
      .then((response) => response.json())
      .catch(() => []);
    return pagesPromise;
  };

  const readStoredState = () => {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(STORAGE_KEY) || "{}",
      );
      return {
        kinds: { ...DEFAULT_KIND_STATE, ...stored.kinds },
        // What was folded AWAY is what is remembered, not what was opened: a
        // directory that appears later (a new package, a new demos/) is open like
        // everything else rather than hidden by a memory that predates it.
        collapsed: new Set(
          Array.isArray(stored.collapsed) ? stored.collapsed : [],
        ),
      };
    } catch {
      return { kinds: { ...DEFAULT_KIND_STATE }, collapsed: new Set() };
    }
  };
  const writeStoredState = (state) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ kinds: state.kinds, collapsed: [...state.collapsed] }),
      );
    } catch {
      // private mode, quota — the switcher works, it just forgets
    }
  };

  /*
   * The tree, built from the paths and folded where folding loses nothing: a
   * directory holding a single directory and no file of its own is merged with
   * it, so one line reads "docs/users/b_dev/" instead of three. What is left is
   * the shape of the choices there are to make.
   */
  const buildTree = (pages) => {
    const root = { segments: [], path: "", directories: new Map(), files: [] };
    // The directories that ARE a package (the server found the package.json, see
    // html_pages.js): in a monorepo that is what one is looking for, so it is
    // written plainly while the rest of the road stays grey.
    const packagePathSet = new Set(
      pages.map((page) => page.packageUrl).filter(Boolean),
    );
    for (const page of pages) {
      const segments = page.url.split("/").filter(Boolean);
      const fileName = segments.pop();
      let node = root;
      for (const segment of segments) {
        let child = node.directories.get(segment);
        if (!child) {
          const path = `${node.path}/${segment}`;
          child = {
            // Segment by segment rather than one string: folding glues several
            // directories into one row, and only the one that IS a package is
            // written plainly (see renderRow).
            segments: [{ name: segment, isPackage: packagePathSet.has(path) }],
            path,
            directories: new Map(),
            files: [],
          };
          node.directories.set(segment, child);
        }
        node = child;
      }
      node.files.push({ ...page, name: fileName });
    }

    const fold = (node) => {
      for (const child of node.directories.values()) {
        fold(child);
      }
      // Nothing of its own and a single way down: the two are one step.
      while (node.files.length === 0 && node.directories.size === 1) {
        const [only] = node.directories.values();
        node.segments = [...node.segments, ...only.segments];
        node.path = only.path;
        node.directories = only.directories;
        node.files = only.files;
      }
      node.files.sort((a, b) => a.name.localeCompare(b.name));
      return node;
    };
    return fold(root);
  };

  // The whole of a folded row, for sorting and nothing else.
  const nodeName = (node) =>
    node.segments.map((segment) => segment.name).join("/");

  // What is left of a node once the filters have had their say — used both to
  // decide whether to draw it and to say how much is under it.
  const countMatches = (node, matches) => {
    let count = 0;
    for (const file of node.files) {
      if (matches(file)) {
        count++;
      }
    }
    for (const child of node.directories.values()) {
      count += countMatches(child, matches);
    }
    return count;
  };

  const rememberOpen = (isOpen) => {
    try {
      if (isOpen) {
        window.sessionStorage.setItem(OPEN_KEY, "1");
      } else {
        window.sessionStorage.removeItem(OPEN_KEY);
      }
    } catch {
      // private mode, quota — it just will not come back
    }
  };
  const wasOpen = () => {
    try {
      return window.sessionStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  };

  let open = null;

  const openSwitcher = async () => {
    if (open) {
      open.input.select();
      return;
    }
    const state = readStoredState();
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE_TEXT;
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    const panel = document.createElement("div");
    panel.className = "panel";
    const input = document.createElement("input");
    input.type = "search";
    input.placeholder = "Go to page…";
    input.setAttribute("aria-label", "Go to page");
    const kindsRow = document.createElement("div");
    kindsRow.className = "kinds";
    const list = document.createElement("ul");
    panel.append(input, kindsRow, list);
    shadow.append(style, backdrop, panel);
    document.body.append(host);

    const focusedBefore = document.activeElement;
    let tree = null;
    // The rows as drawn, in order: what ↑/↓ walks and what Enter acts on.
    let rows = [];
    let currentIndex = 0;

    const close = () => {
      open = null;
      rememberOpen(false);
      host.remove();
      document.removeEventListener("keydown", onKeyDown, true);
      if (focusedBefore && focusedBefore.isConnected) {
        focusedBefore.focus();
      }
    };
    const searchNeedle = () => input.value.trim().toLowerCase();
    const matchesText = (file) => {
      const needle = searchNeedle();
      return needle ? file.url.toLowerCase().includes(needle) : true;
    };
    const matchesFilters = (file) =>
      state.kinds[file.kind] && matchesText(file);
    const toggleCollapsed = (path) => {
      if (state.collapsed.has(path)) {
        state.collapsed.delete(path);
      } else {
        state.collapsed.add(path);
      }
      writeStoredState(state);
      render();
    };
    const activate = (row) => {
      if (!row) {
        return;
      }
      if (row.type === "file") {
        // Going somewhere is done with it: what reopens across a reload is a
        // switcher one was still using.
        rememberOpen(false);
        window.location.href = row.file.url;
        return;
      }
      toggleCollapsed(row.node.path);
    };

    const renderKinds = () => {
      kindsRow.textContent = "";
      for (const kind of KINDS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "kind_toggle";
        if (state.kinds[kind.id]) {
          button.setAttribute("data-on", "");
        }
        const label = document.createElement("span");
        label.textContent = `${kind.icon} ${kind.label}`;
        const count = document.createElement("span");
        count.className = "count";
        // How many there would be, not how many there are: a count that answered
        // to its own toggle would read 0 for everything switched off.
        count.textContent = tree
          ? countMatches(
              tree,
              (file) => file.kind === kind.id && matchesText(file),
            )
          : 0;
        button.append(label, count);
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          state.kinds[kind.id] = !state.kinds[kind.id];
          writeStoredState(state);
          render();
        });
        kindsRow.append(button);
      }
    };

    const buildRows = () => {
      const nextRows = [];
      // While something is typed the tree opens itself: what one is looking at is
      // the matches, not the folders that happen to hold them.
      const searching = searchNeedle() !== "";
      const walk = (node, depth) => {
        const directories = [...node.directories.values()].sort((a, b) =>
          nodeName(a).localeCompare(nodeName(b)),
        );
        for (const child of directories) {
          const count = countMatches(child, matchesFilters);
          if (count === 0) {
            continue;
          }
          const collapsed = !searching && state.collapsed.has(child.path);
          nextRows.push({
            type: "directory",
            node: child,
            depth,
            count,
            collapsed,
          });
          if (!collapsed) {
            walk(child, depth + 1);
          }
        }
        for (const file of node.files) {
          if (matchesFilters(file)) {
            nextRows.push({ type: "file", file, depth });
          }
        }
      };
      walk(tree, 0);
      return nextRows;
    };

    const renderRow = (row, index) => {
      const item = document.createElement("li");
      item.style.paddingLeft = `${8 + row.depth * 14}px`;
      if (index === currentIndex) {
        item.setAttribute("data-current", "");
      }
      if (row.type === "directory") {
        const twisty = document.createElement("span");
        twisty.className = "twisty";
        twisty.textContent = row.collapsed ? "▸" : "▾";
        // One box for the whole path, so the row's own gap does not fall between
        // two halves of the same name.
        const path = document.createElement("span");
        for (const segment of row.node.segments) {
          const name = document.createElement("span");
          name.className = segment.isPackage ? "strong" : "dim";
          name.textContent = `${segment.name}/`;
          path.append(name);
        }
        item.append(twisty, path);
        const count = document.createElement("span");
        count.className = "count";
        count.textContent = row.count;
        item.append(count);
      } else {
        const icon = document.createElement("span");
        icon.className = "kind_icon";
        icon.textContent =
          KINDS.find((kind) => kind.id === row.file.kind)?.icon || "📄";
        icon.title = row.file.kind;
        const name = document.createElement("span");
        name.className = "strong";
        name.textContent = row.file.name;
        item.append(icon, name);
      }
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        currentIndex = index;
        activate(row);
      });
      return item;
    };

    const render = () => {
      renderKinds();
      rows = buildRows();
      if (currentIndex >= rows.length) {
        currentIndex = 0;
      }
      list.textContent = "";
      if (rows.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty";
        empty.textContent = "Nothing matches.";
        list.append(empty);
        return;
      }
      for (const [index, row] of rows.entries()) {
        list.append(renderRow(row, index));
      }
    };
    const moveCurrent = (delta) => {
      if (rows.length === 0) {
        return;
      }
      currentIndex = (currentIndex + delta + rows.length) % rows.length;
      render();
      list.children[currentIndex]?.scrollIntoView({ block: "nearest" });
    };

    // In the capture phase, and on the document: while this is open it IS the
    // page as far as the keyboard goes, and whatever the page below listens for
    // must not answer at the same time.
    function onKeyDown(event) {
      const stop = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      if (event.key === "Escape") {
        stop();
        close();
        return;
      }
      if (event.key === "Enter") {
        stop();
        activate(rows[currentIndex]);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        stop();
        moveCurrent(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const row = rows[currentIndex];
        // A file has nothing to fold, and a folder already the right way round
        // has nothing to do: the caret keeps the key in both cases.
        if (!row || row.type !== "directory") {
          return;
        }
        const wantCollapsed = event.key === "ArrowLeft";
        if (row.collapsed === wantCollapsed) {
          return;
        }
        stop();
        toggleCollapsed(row.node.path);
        return;
      }
      if (isSwitcherKey(event)) {
        stop();
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    backdrop.addEventListener("mousedown", close);

    open = { input, close };
    rememberOpen(true);
    input.focus();

    const pages = await loadPages();
    if (!open) {
      return; // closed while the list was still coming
    }
    tree = buildTree(pages);
    render();
    input.addEventListener("input", () => {
      currentIndex = 0;
      render();
    });
  };

  // Last in line, on purpose: on window (the end of the bubble), and registered
  // once the page has loaded — so every listener the page set up while parsing is
  // already in place and has already had this press. If any of them called
  // preventDefault, the key was theirs and nothing happens here.
  const listenSwitcherKey = () => {
    window.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || !isSwitcherKey(event)) {
        return;
      }
      // Ours now: the browser has its own use for cmd+K (the address bar), which
      // it must not get.
      event.preventDefault();
      openSwitcher();
    });
  };
  const setup = () => {
    listenSwitcherKey();
    if (wasOpen()) {
      openSwitcher();
    }
  };
  if (document.readyState === "complete") {
    setup();
  } else {
    window.addEventListener("load", setup, { once: true });
  }
})();
