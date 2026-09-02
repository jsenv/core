/**
 * The address, as the browser holds it right now.
 *
 * On a demo about the url, the address bar is the thing being watched — and it
 * is the one part of the browser a screenshot of the page does not contain, and
 * that a reader following along on a phone may not see at all. So the page
 * draws it too.
 *
 * Cut to its last segment: these files live under a long repo path, and what
 * changes as one uses the page is the end of it.
 *
 * Not exported from the package — this is for navi's own demos.
 */

import { useDocumentUrl } from "../nav/browser_integration/document_url_signal.js";

const css = /* css */ `
  .navi_demo_address {
    padding: 6px 10px;
    color: #1a237e;
    font-size: 13px;
    font-family: ui-monospace, monospace;
    white-space: nowrap;
    background: #eaf2fd;
    border-radius: 6px;
    overflow-x: auto;
  }
`;

/**
 * @param {object} props
 * @param {string} [props.testId="address"] - So a test can read the address the
 *   page shows rather than the one the browser holds.
 */
export const DemoAddress = ({ testId = "address" }) => {
  import.meta.css = css;

  const url = useDocumentUrl();
  const { pathname, search } = new URL(url);
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  return (
    <div className="navi_demo_address" data-testid={testId}>
      …/{lastSegment}
      {search}
    </div>
  );
};
