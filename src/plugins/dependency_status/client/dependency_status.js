/*
 * Displays the "some dependencies are outdated" warning overlay.
 *
 * A missing dependency is not handled here: it makes the import fail, so the
 * error overlay already says it, with more precision (which import, where).
 */

let removeOverlay = () => {};

export const initDependencyStatus = ({ problems }) => {
  render(problems);
  window.__server_events__.listenEvents({
    dependency_status: (event) => {
      render(event.data.problems);
    },
  });
};

const render = (problems) => {
  const outdatedList = problems.filter(({ state }) => state === "outdated");
  removeOverlay();
  removeOverlay = () => {};
  if (outdatedList.length === 0) {
    return;
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
      "This page reloads on its own as soon as node_modules matches package.json.",
    ],
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
