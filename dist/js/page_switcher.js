import { isEditorKey, openPagePicker, isCommandKey, loadPages, asPageUrl } from "../page_picker.js";

/*
 * cmd+K / ctrl+K on any dev-served page: the .html files the server serves, as a
 * tree one walks, filter as you type, Enter to go there — cmd/ctrl+Enter to go
 * there in another tab and stay here, the same thing cmd+click on a row does.
 *
 * The tree itself is not this file's: it is the page picker the dev server ships
 * for everyone who has to ask "which page?" (see protocol_file/client/page_picker.js
 * — the clients dashboard asks it too, to send another browser somewhere). What
 * belongs here is the key, and what taking a row means in this tab.
 *
 * cmd+E / ctrl+E is the other half of the same question: instead of going to a
 * page, open its file in the editor (the server does it, see
 * GET /.internal/open_file/*). Pressed on the page itself it opens the page one
 * is on; pressed inside the switcher it opens the row one is looking at.
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


// The server asks the OS to open a file in whatever editor is configured
// (VSCode here) — it takes a file url, which is why the page list carries one
// per page (see html_pages.js).
const OPEN_FILE_ENDPOINT = "/.internal/open_file/";
// Open across a reload: this is a dev tool on a page one is editing, and a hot
// reload in the middle of looking for the next page should not close what one
// was looking at. In sessionStorage, not localStorage: it says what THIS tab was
// doing a second ago, which is not something to remember tomorrow.
const OPEN_KEY = "jsenv_page_switcher_open";

// The page this script is running in, as the list spells its urls.
const currentPageUrl = () => asPageUrl(window.location.href);

const isSwitcherKey = (event) =>
  (event.key === "k" || event.key === "K") && isCommandKey(event);

const FLASH_STYLE_TEXT = /* css */ `
  :host {
    position: fixed;
    right: 16px;
    bottom: 16px;
    /* Above the picker's own panel: it is the switcher that triggers it. */
    z-index: 2147483647;
    display: block;
    font-family: system-ui, sans-serif;
    pointer-events: none;
  }
  .flash {
    padding: 8px 14px;
    color: light-dark(#0f172a, #e2e8f0);
    font-size: 13px;
    background: light-dark(white, #1e293b);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    color-scheme: light dark;
  }
  .flash[data-error] {
    color: light-dark(#991b1b, #fecaca);
    background: light-dark(#fee2e2, #7f1d1d);
  }
`;

// Opening a file in an editor happens in another application, on another
// screen sometimes: without a word here, a press that failed and a press that
// worked look exactly the same. Its own host and its own shadow root, so it
// can be shown whether or not the switcher is open.
let flashHost = null;
let flashBox = null;
let flashTimeout = null;
const flash = (message, isError) => {
  if (!flashHost) {
    flashHost = document.createElement("div");
    const shadow = flashHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = FLASH_STYLE_TEXT;
    flashBox = document.createElement("div");
    flashBox.className = "flash";
    shadow.append(style, flashBox);
  }
  flashBox.textContent = message;
  flashBox.toggleAttribute("data-error", Boolean(isError));
  // Appended last every time, so it sits above the picker's host when both
  // are on the page and they share the same z-index.
  document.body.append(flashHost);
  window.clearTimeout(flashTimeout);
  flashTimeout = window.setTimeout(() => flashHost.remove(), 2500);
};

const openInEditor = async (file) => {
  if (!file || !file.fileUrl) {
    flash("This page is not a file the server lists.", true);
    return;
  }
  flash(`Opening ${file.name || file.url} in editor…`);
  try {
    const response = await fetch(
      `${OPEN_FILE_ENDPOINT}${encodeURIComponent(file.fileUrl)}`,
    );
    if (response.status === 404) {
      // The route exists only when the server is willing to expose the
      // machine it runs on (see start_server.js).
      flash("This server does not open files in an editor.", true);
    } else if (!response.ok) {
      flash(`Editor said no (${response.status}).`, true);
    }
  } catch {
    flash("Could not reach the dev server.", true);
  }
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

let picker = null;

// The same key opens it and puts it away: pressed while it is up, cmd+K is the
// reader saying "not this, back to what I was doing".
const toggleSwitcher = () => {
  if (picker) {
    picker.close();
    return;
  }
  openSwitcher();
};

const openSwitcher = () => {
  picker = openPagePicker({
    // The other key is written where one is already looking: a shortcut nobody
    // is told about is a shortcut nobody presses. Both names, not the one this
    // platform uses — the reader knows which of the two their keyboard has, and
    // it keeps what the panel says the same everywhere.
    placeholder: "Go to page…  (cmd/ctrl+Enter: new tab, cmd/ctrl+E: editor)",
    hereUrl: window.location.href,
    // Going there is something this browser can do, so a row is a link: its
    // menu, its middle click and its cmd+click all work.
    getHref: (page) => page.url,
    onPick: (page) => {
      // Going somewhere is done with it: what reopens across a reload is a
      // switcher one was still using.
      rememberOpen(false);
      window.location.href = page.url;
    },
    onEdit: (page) => {
      // Done with the switcher: the answer to "where does this live" arrives
      // in the editor, not here.
      rememberOpen(false);
      openInEditor(page);
    },
    onClose: () => {
      picker = null;
      rememberOpen(false);
    },
  });
  rememberOpen(true);
};

// The page one is looking at, in the editor. The list is where the file url
// comes from, so a page the server does not list (an @fs url, something under
// node_modules) says so rather than opening the wrong thing.
const openCurrentPageInEditor = async () => {
  const here = currentPageUrl();
  const pages = await loadPages();
  const page = pages.find((candidate) => candidate.url === here);
  openInEditor(page && { ...page, name: here.split("/").pop() });
};

// Last in line, on purpose: on window (the end of the bubble), and registered
// once the page has loaded — so every listener the page set up while parsing is
// already in place and has already had this press. If any of them called
// preventDefault, the key was theirs and nothing happens here.
const listenSwitcherKey = () => {
  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (isSwitcherKey(event)) {
      // Ours now: the browser has its own use for cmd+K (the address bar),
      // which it must not get.
      event.preventDefault();
      toggleSwitcher();
      return;
    }
    if (isEditorKey(event)) {
      event.preventDefault();
      openCurrentPageInEditor();
    }
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
