/*
 * Displays the "some dependencies are outdated" warning overlay.
 *
 * A missing dependency is not handled here: it makes the import fail, so the
 * error overlay already says it, with more precision (which import, where).
 *
 * The overlay does not only describe the problem, it shows the dev server
 * watching for the fix: the paths being looked at are named and kept alive on
 * screen, so waiting for "npm install" feels like waiting for something that is
 * actually going to happen.
 */

let removeOverlay = () => {};
let watchInfoFromServer = {};
// packages listed as outdated at some point, and the path watched for each;
// what leaves this map has been installed while the overlay was open, which is
// worth showing as such
const outdatedPathMap = new Map();

export const initDependencyStatus = ({ problems, watchInfo }) => {
  watchInfoFromServer = watchInfo || {};
  render(problems);
  // without the server events channel the page only knows the state it was
  // served with, which is still better than nothing
  if (window.__server_events__) {
    window.__server_events__.listenEvents({
      dependency_status: (event) => {
        render(event.data.problems);
      },
    });
  }
};

const render = (problems) => {
  const outdatedList = problems.filter(({ state }) => state === "outdated");
  removeOverlay();
  removeOverlay = () => {};
  const installedList = [];
  for (const [packageName, watchedPath] of outdatedPathMap) {
    if (!outdatedList.some((problem) => problem.packageName === packageName)) {
      installedList.push({ packageName, watchedPath });
    }
  }
  if (outdatedList.length === 0) {
    outdatedPathMap.clear();
    return;
  }
  for (const { packageName, watchedPath } of outdatedList) {
    outdatedPathMap.set(packageName, watchedPath);
  }
  const supervisor = window.__supervisor__;
  if (!supervisor || !supervisor.reportWarning) {
    console.warn(summarize(outdatedList));
    return;
  }
  removeOverlay = supervisor.reportWarning({
    title:
      outdatedList.length === 1
        ? "A dependency is outdated"
        : `${outdatedList.length} dependencies are outdated`,
    text: outdatedList.map(describe).join("\n\n"),
    details: [
      "The page is running with what is installed in node_modules, which is not what package.json asks for. It may work, but it is not the code the project expects.",
      "Run npm install to fix it. If an install is already running, there is nothing to do but wait.",
    ],
    node: createWatchNode(outdatedList, installedList),
  });
};

const describe = ({ packageName, declaredVersion, installedVersion }) => {
  return `${packageName}
  package.json declares  ${declaredVersion}
  node_modules holds     ${installedVersion || "an unknown version"}`;
};

const summarize = (outdatedList) => {
  return `[jsenv] outdated dependencies, run npm install: ${outdatedList
    .map(({ packageName }) => packageName)
    .join(", ")}`;
};

const createWatchNode = (outdatedList, installedList) => {
  const { packageJsonPath = "package.json", pollInterval } =
    watchInfoFromServer;
  const node = document.createElement("div");
  node.className = "dependency_watch";
  const rows = [];
  rows.push(
    createRow({
      state: "watching",
      path: packageJsonPath,
      // a file watcher, not a poll: an edit here is what puts a dependency out
      // of date in the first place
      note: "on every change",
      pollInterval,
    }),
  );
  for (const { packageName, declaredVersion, watchedPath } of outdatedList) {
    rows.push(
      createRow({
        state: "watching",
        path: watchedPath || `node_modules/${packageName}/package.json`,
        note: pollInterval
          ? `waiting for ${declaredVersion}, read every ${pollInterval}ms`
          : `waiting for ${declaredVersion}`,
        pollInterval,
      }),
    );
  }
  for (const { packageName, watchedPath } of installedList) {
    rows.push(
      createRow({
        state: "done",
        path: watchedPath || `node_modules/${packageName}/package.json`,
        note: "installed",
      }),
    );
  }
  node.innerHTML = `
<style>
  ${watchCSS}
</style>
<div class="dependency_watch_head">
  <span class="dependency_watch_live">
    <span class="dependency_watch_live_dot"></span>watching
  </span>
  <span class="dependency_watch_head_text">
    the files that will tell the install is over
  </span>
</div>
<div class="dependency_watch_rows">
  ${rows.join("\n  ")}
</div>
<div class="dependency_watch_effect" data-copy-line>
  As soon as node_modules matches package.json, this page reloads by itself.
</div>`;
  return node;
};

const createRow = ({ state, path, note, pollInterval }) => {
  const sweepStyle = pollInterval
    ? ` style="animation-duration: ${pollInterval}ms"`
    : "";
  return `<div class="dependency_watch_row" data-state="${state}">
    <span class="dependency_watch_row_icon"></span>
    <code class="dependency_watch_row_path">${escapeHtml(path)}</code>
    <span class="dependency_watch_row_note">${escapeHtml(note)}</span>
    ${
      state === "watching"
        ? `<span class="dependency_watch_row_sweep"${sweepStyle}></span>`
        : ""
    }
  </div>`;
};

const escapeHtml = (string) => {
  return String(string)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const watchCSS = /* css */ `
  .dependency_watch_head {
    display: flex;
    margin-bottom: 8px;
    align-items: center;
    gap: 8px;
  }
  .dependency_watch_live {
    display: flex;
    padding: 2px 8px;
    align-items: center;
    gap: 6px;
    color: #ffab40;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border: 1px solid currentColor;
    border-radius: 999px;
  }
  .dependency_watch_live_dot {
    width: 7px;
    height: 7px;
    background: currentColor;
    border-radius: 50%;
    animation: dependency_watch_pulse <X>s ease-in-out infinite;
  }
  @keyframes dependency_watch_pulse {
    0%,
    100% {
      opacity: 0.25;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1.15);
    }
  }
  .dependency_watch_head_text {
    font-size: 13px;
  }

  .dependency_watch_rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .dependency_watch_row {
    position: relative;
    display: flex;
    padding: 6px 10px;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #333;
    border-radius: 4px;
    overflow: hidden;
  }
  .dependency_watch_row_icon {
    width: 8px;
    height: 8px;
    flex: none;
    border: 1px solid #ffab40;
    border-radius: 50%;
  }
  .dependency_watch_row[data-state="done"] .dependency_watch_row_icon {
    background: #7fd67f;
    border-color: #7fd67f;
  }
  .dependency_watch_row_path {
    color: #eee;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }
  .dependency_watch_row_note {
    margin-left: auto;
    padding-left: 8px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0.8;
  }
  .dependency_watch_row[data-state="done"] .dependency_watch_row_note {
    color: #7fd67f;
    opacity: 1;
  }
  /* the sweep is the watching made visible: one pass per read */
  .dependency_watch_row_sweep {
    position: absolute;
    top: 0;
    left: 0;
    width: 35%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 171, 64, 0.16),
      transparent
    );
    animation: dependency_watch_sweep <X>s linear infinite;
    pointer-events: none;
  }
  @keyframes dependency_watch_sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(340%);
    }
  }

  .dependency_watch_effect {
    margin-top: 8px;
    color: #ffab40;
    font-size: 13px;
  }

  @media (prefers-reduced-motion: reduce) {
    .dependency_watch_live_dot {
      animation: none;
    }
    .dependency_watch_row_sweep {
      display: none;
    }
  }
`;
