/**
 * The strip every demo starts with: what this demo is on the left, how to get
 * out of it on the right.
 *
 * Not exported from the package — this is for navi's own demos. It lives here
 * rather than being copy-pasted into each of them because the copies had
 * already started drifting (some had arrows, some had none, some pointed at
 * files that had moved).
 *
 * "Back to list" is a link to `./`, which the jsenv dev server answers with the
 * directory listing — the page one otherwise reaches by editing the address bar
 * down to the folder, or by mistyping a name and reading the 404.
 *
 * The neighbours are passed in rather than discovered: a demo is a standalone
 * html file and nothing in the page knows what sits next to it on disk. Working
 * that out belongs to whatever serves the directory (see this repo's own note
 * about a `<jsenv-directory-nav>` in the dev server), not to a component that
 * only has the document.
 */

const css = /* css */ `
  .navi_demo_header {
    display: flex;
    margin-bottom: 24px;
    padding-bottom: 12px;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px 24px;
    border-bottom: 1px solid #dde3ec;
  }
  .navi_demo_header > h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  .navi_demo_header_nav {
    display: flex;
    align-items: baseline;
    gap: 4px;
    color: #5b6472;
    font-size: 13px;
  }
  .navi_demo_header_nav a {
    padding: 4px 8px;
    color: #1a237e;
    text-decoration: none;
    border-radius: 6px;
  }
  .navi_demo_header_nav a:hover {
    background: #eaf2fd;
  }
  /* Kept in place rather than dropped: the pair reads as a position in a row of
     demos, and a missing side says "this is the first/last one". */
  .navi_demo_header_none {
    padding: 4px 8px;
    color: #b6bdc9;
  }
  .navi_demo_header_list {
    margin-left: 8px;
    padding-left: 16px;
    border-left: 1px solid #dde3ec;
  }
`;

/**
 * @param {object} props
 * @param {string} props.title - Shown as the page's own h1.
 * @param {{href: string, label: string}} [props.previous] - The demo before
 *   this one. Left out on the first one, which then shows a dead "←".
 * @param {{href: string, label: string}} [props.next] - …and after.
 * @param {string} [props.listHref="./"] - Where "all demos" goes.
 */
export const DemoHeader = ({ title, previous, next, listHref = "./" }) => {
  import.meta.css = css;

  return (
    <header className="navi_demo_header">
      <h1>{title}</h1>
      <nav className="navi_demo_header_nav">
        {previous ? (
          <a href={previous.href} title={`Previous: ${previous.label}`}>
            ← {previous.label}
          </a>
        ) : (
          <span className="navi_demo_header_none" aria-hidden="true">
            ←
          </span>
        )}
        {next ? (
          <a href={next.href} title={`Next: ${next.label}`}>
            {next.label} →
          </a>
        ) : (
          <span className="navi_demo_header_none" aria-hidden="true">
            →
          </span>
        )}
        <a className="navi_demo_header_list" href={listHref} title="All demos">
          all demos
        </a>
      </nav>
    </header>
  );
};
