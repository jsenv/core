/*
 * cmd+K / ctrl+K on any dev-served page: a list of the .html files the server
 * serves, filter as you type, Enter to go there.
 *
 * Injected into every page (see jsenv_plugin_page_switcher.js), which is why it
 * is careful about what it takes:
 * - the key is watched on the document in the BUBBLE phase, and a press that
 *   was already handled (defaultPrevented) is left alone — a page with its own
 *   cmd+K keeps it, and gets it first;
 * - nothing is fetched, built or styled until the first time it opens;
 * - everything it renders lives in a shadow root, so the page's own CSS cannot
 *   reach it and it cannot reach the page's.
 */

const PAGES_ENDPOINT = "/.internal/pages.json";
const MAX_SHOWN = 200;
// What kind of page it is, as the server reads it from where the file sits and
// what it is called (see html_pages.js): something tried out, something shown,
// or a page like any other.
const KIND_ICON = {
  experiment: "🧪",
  demo: "🎬",
  page: "📄",
};

const isSwitcherKey = (event) => {
  if (event.key !== "k" && event.key !== "K") {
    return false;
  }
  // cmd on mac, ctrl elsewhere — the same split every editor makes.
  return window.navigator.platform.toLowerCase().includes("mac")
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
};

// Not named CSS: this file is injected as a classic script, where a top-level
// const becomes a global lexical binding — one named CSS would shadow the real
// window.CSS for every other script on the page (CSS.escape would be gone).
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
    top: 12vh;
    left: 50%;
    display: flex;
    width: min(560px, calc(100vw - 32px));
    max-height: 60vh;
    flex-direction: column;
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
    border-bottom: 1px solid light-dark(#e2e8f0, #334155);
    outline: none;
  }
  ul {
    margin: 0;
    padding: 6px;
    list-style: none;
    overflow-y: auto;
  }
  li {
    display: flex;
    padding: 7px 10px;
    align-items: center;
    gap: 8px;
    color: light-dark(#0f172a, #e2e8f0);
    font-size: 13px;
    font-family: ui-monospace, monospace;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-radius: 6px;
    cursor: pointer;
    overflow: hidden;
  }
  li[data-current] {
    color: white;
    background: light-dark(#2563eb, #3b82f6);
  }
  .kind {
    width: 1.2em;
    flex: none;
    /* Kept legible on the highlighted row too: an emoji ignores color, the
       letter beside it must not. */
    font-size: 12px;
    text-align: center;
  }
  .empty {
    padding: 14px 16px;
    color: light-dark(#64748b, #94a3b8);
    font-size: 13px;
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

let open = null;

const openSwitcher = async () => {
  if (open) {
    open.input.select();
    return;
  }
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
  const list = document.createElement("ul");
  panel.append(input, list);
  shadow.append(style, backdrop, panel);
  document.body.append(host);

  const focusedBefore = document.activeElement;
  let matches = [];
  let currentIndex = 0;

  const close = () => {
    open = null;
    host.remove();
    document.removeEventListener("keydown", onKeyDown, true);
    if (focusedBefore && focusedBefore.isConnected) {
      focusedBefore.focus();
    }
  };
  const go = () => {
    const page = matches[currentIndex];
    if (page) {
      window.location.href = page.url;
    }
  };
  const render = (pages) => {
    const needle = input.value.trim().toLowerCase();
    matches = needle
      ? pages.filter((page) => page.url.toLowerCase().includes(needle))
      : pages;
    currentIndex = 0;
    list.textContent = "";
    if (matches.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = pages.length ? "No page matches." : "No page found.";
      list.append(empty);
      return;
    }
    for (const [index, page] of matches.slice(0, MAX_SHOWN).entries()) {
      const item = document.createElement("li");
      const kind = document.createElement("span");
      kind.className = "kind";
      kind.textContent = KIND_ICON[page.kind] || KIND_ICON.page;
      kind.title = page.kind;
      const label = document.createElement("span");
      label.textContent = page.url;
      item.append(kind, label);
      if (index === 0) {
        item.setAttribute("data-current", "");
      }
      // mousedown, not click: the press must not reach the page underneath, and
      // going away on mouseup would fight the backdrop closing on mousedown.
      item.addEventListener("mousedown", createItemMouseDown(index));
      list.append(item);
    }
  };
  const createItemMouseDown = (index) => (event) => {
    event.preventDefault();
    currentIndex = index;
    go();
  };
  const moveCurrent = (delta) => {
    const items = [...list.querySelectorAll("li:not(.empty)")];
    if (items.length === 0) {
      return;
    }
    items[currentIndex]?.removeAttribute("data-current");
    currentIndex = (currentIndex + delta + items.length) % items.length;
    const item = items[currentIndex];
    item.setAttribute("data-current", "");
    item.scrollIntoView({ block: "nearest" });
  };

  // In the capture phase, and on the document: while this is open it IS the
  // page as far as the keyboard goes, and whatever the page below listens for
  // must not answer at the same time.
  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      go();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveCurrent(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (isSwitcherKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }
  document.addEventListener("keydown", onKeyDown, true);
  backdrop.addEventListener("mousedown", close);

  open = { input, close };
  input.focus();

  const pages = await loadPages();
  if (!open) {
    return; // closed while the list was still coming
  }
  render(pages);
  input.addEventListener("input", () => render(pages));
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
if (document.readyState === "complete") {
  listenSwitcherKey();
} else {
  window.addEventListener("load", listenSwitcherKey, { once: true });
}
