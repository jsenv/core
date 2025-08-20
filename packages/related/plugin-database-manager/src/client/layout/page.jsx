import { initPositionSticky } from "@jsenv/dom";
import { ErrorBoundaryContext } from "@jsenv/navi";
import { useErrorBoundary, useLayoutEffect, useRef } from "preact/hooks";
import { IconAndText } from "../components/icon_and_text.jsx";

import.meta.css = /* css */ `
  .page_head {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    align-items: center;

    padding: 20px;
    background: white;
    position: sticky;
    top: 0;
  }

  .page_head h1 {
    margin: 0;
    line-height: 1em;
  }

  .page_head > .actions {
  }

  .page_body {
    padding-left: 20px;
    padding-right: 20px;
    padding-bottom: 20px;
  }

  .page_error {
    padding: 20px;
    background: #fdd;
    border: 1px solid red;

    margin-top: 0;
    margin-bottom: 20px;
  }
`;

export const Page = ({ children }) => {
  const [error, resetError] = useErrorBoundary();

  return (
    <ErrorBoundaryContext.Provider value={resetError}>
      {error && <PageError error={error} />}
      <div className="page">{children}</div>
    </ErrorBoundaryContext.Provider>
  );
};

const PageError = ({ error }) => {
  return (
    <div className="page_error">
      An error occured: {error.message}
      <details>
        <summary>More info</summary>
        <pre>
          <code>{error.stack}</code>
        </pre>
      </details>
    </div>
  );
};

export const PageHead = ({ children, actions = [] }) => {
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    return initPositionSticky(headerRef.current);
  }, []);

  return (
    <header ref={headerRef} className="page_head">
      {children}
      <div className="actions">
        {actions.map((action) => {
          return action.component;
        })}
      </div>
    </header>
  );
};
const PageHeadLabel = ({ icon, label, children }) => {
  return (
    <h1 style="display: flex; align-items: stretch; gap: 0.2em;">
      <IconAndText
        icon={icon}
        style={{
          color: "lightgrey",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </IconAndText>
      <span>{children}</span>
    </h1>
  );
};
PageHead.Label = PageHeadLabel;

export const PageBody = ({ children }) => {
  return <section className="page_body">{children}</section>;
};
