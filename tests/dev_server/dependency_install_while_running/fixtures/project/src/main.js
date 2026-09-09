// eslint-disable-next-line import-x/no-unresolved
import { version } from "dep";

window.mainRuns = (window.mainRuns || 0) + 1;
document.querySelector("#app").innerHTML = `
  <dt>dep version</dt>
  <dd>${version}</dd>
  <dt>copies of dep in the page</dt>
  <dd>${window.depInstances.length} (${window.depInstances.join(", ")})</dd>
  <dt>main.js runs</dt>
  <dd>${window.mainRuns}</dd>
`;
window.answer = version;

if (import.meta.hot) {
  import.meta.hot.accept();
}
