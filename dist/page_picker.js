/*
 * "Which page?", asked the same way everywhere.
 *
 * The .html files the dev server serves (GET /.internal/pages.json, see
 * html_pages.js), as a tree one walks — or, the moment something is typed, as
 * a flat list of what matches. Toggle what kind of page one is after, Enter to
 * take the row one is looking at. What happens to
 * that row is the caller's business — cmd+K goes there in this tab, the clients
 * dashboard sends another browser there — and that is the only difference
 * between the two.
 *
 * Lives here, next to html_pages.js, for the reason written there: the list has
 * more than one reader, and so does the way of reading it. A second picker
 * drawn by hand would drift from this one the day either changes.
 *
 * A tree rather than a list of paths, because the paths are mostly the same
 * path: folding every directory that holds a single thing turns
 * "packages/frontend/navi/src/layout/demos/…" repeated forty times into one
 * line holding forty files — and the packages become something one can see,
 * count and fold away rather than something to type.
 *
 * It can be opened on top of any page (the switcher injects itself into all of
 * them), so everything it draws lives in a shadow root: the page's own CSS
 * cannot reach it and it cannot reach the page's.
 */

const PAGES_ENDPOINT = "/.internal/pages.json";
const STORAGE_KEY = "jsenv_page_picker";
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

let pagesPromise = null;
// Once per page load: the list is a filesystem scan behind a short cache
// server-side, and a picker opened twice in a row is the same list.
const loadPages = () => {
  pagesPromise ||= fetch(PAGES_ENDPOINT)
    .then((response) => response.json())
    .catch(() => []);
  return pagesPromise;
};

// A page url as the list spells it (see html_pages.js: "/" + the path from the
// root), out of anything holding one — a location, an absolute url, a path.
// Decoded, because a name with a space or an accent travels percent-encoded and
// would never match the list.
const asPageUrl = (url) => {
  if (!url) {
    return null;
  }
  try {
    return decodeURIComponent(new URL(url, window.location.origin).pathname);
  } catch {
    return String(url);
  }
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
  .title {
    padding: 12px 16px 0;
    font-weight: 600;
    font-size: 13px;
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
  /* A file IS a link when going there is something the browser can do — an
     href, so cmd/ctrl+click opens it in a tab and the browser's own menu offers
     the rest. It fills its row so the whole line stays the target. */
  li > .row {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 6px;
    color: inherit;
    text-decoration: none;
  }
  /* The page the picker was opened on, so one opened blind says where it starts
     from. Under the selection rule below, which must win when the two are the
     same row. */
  li[data-here] {
    background: light-dark(#eff6ff, #172554);
  }
  li[data-here] .strong {
    color: light-dark(#1d4ed8, #93c5fd);
  }
  li[data-current] {
    color: white;
    background: light-dark(#2563eb, #3b82f6);
  }
  /* Selected AND the page one is on: the selection owns the row's colours,
     accents included, or the name would be dark blue on blue. */
  li[data-current] .strong {
    color: inherit;
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
  /* The name is what one reads; the road to it is context — grey, but grey one
     can still read: on the dark panel #64748b sat barely above the background. */
  .dim {
    color: light-dark(#94a3b8, #94a3b8);
  }
  .strong {
    font-weight: 600;
  }
  /* The directory part of a flat search row. It shrinks before the name does,
     and from the left: the end of the road is the part that tells rows apart. */
  .path {
    min-width: 0;
    flex: 0 1 auto;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    overflow: hidden;
  }
  .path > bdo {
    direction: ltr;
    unicode-bidi: bidi-override;
  }
  .here {
    margin-left: auto;
    padding-left: 8px;
    color: light-dark(#1d4ed8, #93c5fd);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  li[data-current] .here {
    color: inherit;
    opacity: 0.85;
  }
  .count {
    margin-left: auto;
    padding-left: 8px;
    color: light-dark(#94a3b8, #94a3b8);
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

const readStoredState = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
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
    // private mode, quota — the picker works, it just forgets
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

// The road down to a file, as node paths — what has to be open for that file
// to be a row at all.
const pathTo = (node, matches, trail = []) => {
  if (node.files.some(matches)) {
    return trail;
  }
  for (const child of node.directories.values()) {
    const found = pathTo(child, matches, [...trail, child.path]);
    if (found) {
      return found;
    }
  }
  return null;
};

/*
 * Opens the picker and returns a handle on it: { close, isOpen }.
 *
 * - title: what the choice is for, when the caller is not the page itself
 *   ("Navigate macOS chrome to…"); the switcher, which IS the page, needs none.
 * - placeholder: the line inside the search field.
 * - hereUrl: the page to mark "here" and to start on — where the picker is
 *   opened from, whatever "from" means to the caller (this tab, another
 *   browser's tab).
 * - getHref: a url the row can be a real link to, when going there is something
 *   this browser can do. Left out, rows are plain rows — a picker that pilots
 *   another browser must not offer this one a way to follow.
 * - onPick(page): the row was taken (Enter, plain click). The picker has closed
 *   by then: what happens next is elsewhere, here or in another browser.
 * - onEdit(page): an extra action on the selected row, bound to cmd/ctrl+E.
 * - onClose(): the picker is gone, whether taken, escaped or clicked away.
 */
const openPagePicker = ({
  title,
  placeholder = "Go to page…",
  hereUrl,
  getHref,
  onPick,
  onEdit,
  onClose,
}) => {
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
  input.placeholder = placeholder;
  input.setAttribute("aria-label", title || placeholder);
  const kindsRow = document.createElement("div");
  kindsRow.className = "kinds";
  const list = document.createElement("ul");
  if (title) {
    const titleElement = document.createElement("div");
    titleElement.className = "title";
    titleElement.textContent = title;
    panel.append(titleElement);
  }
  panel.append(input, kindsRow, list);
  shadow.append(style, backdrop, panel);
  document.body.append(host);

  const focusedBefore = document.activeElement;
  let tree = null;
  // The rows as drawn, in order: what ↑/↓ walks and what Enter acts on.
  let rows = [];
  let currentIndex = 0;
  const here = asPageUrl(hereUrl);
  const isHere = (file) => Boolean(here) && file.url === here;
  // Folded away, but holding the page one starts on: opened for this session
  // only and never written down — what the reader folded is still what they
  // folded the next time they come here from somewhere else.
  const revealed = new Set();
  let closed = false;

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    host.remove();
    document.removeEventListener("keydown", onKeyDown, true);
    if (focusedBefore && focusedBefore.isConnected) {
      focusedBefore.focus();
    }
    onClose?.();
  };
  const searchNeedle = () => input.value.trim().toLowerCase();
  const matchesText = (file) => {
    const needle = searchNeedle();
    return needle ? file.url.toLowerCase().includes(needle) : true;
  };
  const matchesFilters = (file) => state.kinds[file.kind] && matchesText(file);
  const toggleCollapsed = (path) => {
    if (state.collapsed.has(path)) {
      state.collapsed.delete(path);
    } else {
      state.collapsed.add(path);
    }
    writeStoredState(state);
    render();
  };
  const pick = (file) => {
    // Closed first: the answer to "which page" has been given, and what the
    // caller does with it (navigate, pilot another browser) is not something to
    // do behind a panel still standing.
    close();
    onPick?.(file);
  };
  const activate = (row) => {
    if (!row) {
      return;
    }
    if (row.type === "file") {
      pick(row.file);
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
    // While something is typed the tree steps aside: what one is looking at is
    // the matches, not the folders that happen to hold them — so the matches
    // are a flat list, each carrying its own road, and the folding (untouched)
    // is waiting where it was when the field empties again.
    if (searchNeedle() !== "") {
      const matches = [];
      const collect = (node) => {
        for (const file of node.files) {
          if (matchesFilters(file)) {
            matches.push(file);
          }
        }
        for (const child of node.directories.values()) {
          collect(child);
        }
      };
      collect(tree);
      matches.sort((a, b) => a.url.localeCompare(b.url));
      for (const file of matches) {
        nextRows.push({ type: "file", file, depth: 0, showPath: true });
      }
      return nextRows;
    }
    const walk = (node, depth) => {
      const directories = [...node.directories.values()].sort((a, b) =>
        nodeName(a).localeCompare(nodeName(b)),
      );
      for (const child of directories) {
        const count = countMatches(child, matchesFilters);
        if (count === 0) {
          continue;
        }
        const collapsed =
          state.collapsed.has(child.path) && !revealed.has(child.path);
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
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        currentIndex = index;
        activate(row);
      });
      return item;
    }
    const href = getHref ? getHref(row.file) : null;
    const rowContent = document.createElement(href ? "a" : "span");
    rowContent.className = "row";
    if (href) {
      rowContent.href = href;
    }
    const icon = document.createElement("span");
    icon.className = "kind_icon";
    icon.textContent =
      KINDS.find((kind) => kind.id === row.file.kind)?.icon || "📄";
    icon.title = row.file.kind;
    const name = document.createElement("span");
    name.className = "strong";
    name.textContent = row.file.name;
    if (row.showPath) {
      // A flat row is its own road: the directory part rides along, grey, and
      // gives way (ellipsis on its left, where the repetition lives) before the
      // name ever would.
      const path = document.createElement("span");
      path.className = "dim path";
      // The rtl container puts the ellipsis on the left; the bdo keeps the
      // characters themselves reading left to right inside it.
      const pathText = document.createElement("bdo");
      pathText.setAttribute("dir", "ltr");
      pathText.textContent = row.file.url.slice(1, -row.file.name.length);
      path.append(pathText);
      rowContent.append(icon, path, name);
    } else {
      rowContent.append(icon, name);
    }
    if (isHere(row.file)) {
      item.setAttribute("data-here", "");
      const hereLabel = document.createElement("span");
      hereLabel.className = "here";
      hereLabel.textContent = "here";
      rowContent.append(hereLabel);
    }
    item.append(rowContent);
    item.addEventListener("click", (event) => {
      currentIndex = index;
      // Anything but a plain left click on a real link is the browser's
      // business — a new tab, a new window, a download: the picker stays
      // exactly as it is, still open, for the next one.
      if (
        href &&
        (event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey)
      ) {
        return;
      }
      // Taking the row goes through the same door as Enter, whatever it was
      // drawn as: the href is there for the browser's own menu, not to be the
      // way it normally happens.
      event.preventDefault();
      pick(row.file);
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
    if (onEdit && isEditorKey(event)) {
      // Taken whatever the row is: let go of on a directory it would reach the
      // page below and act on the page one came from, which is not what a key
      // pressed inside an open picker can be asking for.
      stop();
      const row = rows[currentIndex];
      if (!row || row.type !== "file") {
        return;
      }
      const { file } = row;
      close();
      onEdit(file);
    }
  }
  document.addEventListener("keydown", onKeyDown, true);
  backdrop.addEventListener("mousedown", close);
  input.addEventListener("input", () => {
    currentIndex = 0;
    render();
  });
  input.focus();

  loadPages().then((pages) => {
    if (closed) {
      return; // closed while the list was still coming
    }
    tree = buildTree(pages);
    // Opened on a page that is in the list: it is selected and scrolled to, so
    // the tree starts from where the reader already is rather than from the top
    // of a tree they then have to find themselves in.
    for (const path of pathTo(tree, isHere) || []) {
      revealed.add(path);
    }
    render();
    const hereIndex = rows.findIndex(
      (row) => row.type === "file" && isHere(row.file),
    );
    if (hereIndex !== -1) {
      currentIndex = hereIndex;
      render();
      list.children[currentIndex]?.scrollIntoView({ block: "center" });
    }
  });

  return {
    close,
    isOpen: () => !closed,
  };
};

// cmd on mac, ctrl elsewhere — the same split every editor makes.
const isCommandKey = (event) =>
  window.navigator.platform.toLowerCase().includes("mac")
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;

// E for edit, next to K for the same reason the two belong together: K asks
// "which page", E asks "where does this page live".
const isEditorKey = (event) =>
  (event.key === "e" || event.key === "E") && isCommandKey(event);

export { asPageUrl, isCommandKey, isEditorKey, loadPages, openPagePicker };
