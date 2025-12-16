import { initPositionSticky } from "@jsenv/dom";
import { ErrorBoundaryContext, IconAndText } from "@jsenv/navi";
import { useErrorBoundary, useLayoutEffect, useRef } from "preact/hooks";

import.meta.css = /* css */ `
  .page {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .page_head {
    position: sticky;
    top: 0;
    display: flex;

    padding: 20px;
    flex-direction: column;
    justify-content: space-between;
    gap: 10px;
    background: white;

    background-color: rgb(239, 242, 245);
    border-bottom: 1px solid rgb(69, 76, 84);
  }

  .page_head h1 {
    margin: 0;
    line-height: 1em;
  }

  .page_head_with_actions {
    display: flex;
    flex-direction: row;
  }

  .page_head > .actions {
  }

  .page_body {
    padding-top: 20px;
    padding-right: 20px;
    padding-bottom: 20px;
    padding-left: 20px;
  }

  .page_error {
    margin-top: 0;
    margin-bottom: 20px;
    padding: 20px;
    background: #fdd;
    border: 1px solid red;
  }
`;

export const Page = ({ children, ...props }) => {
  const [error, resetError] = useErrorBoundary();

  return (
    <ErrorBoundaryContext.Provider value={resetError}>
      {error && <PageError error={error} />}
      <div className="page" {...props}>
        {children}
      </div>
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

export const PageHead = ({ children, spacingBottom, ...rest }) => {
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    return initPositionSticky(headerRef.current);
  }, []);

  return (
    <header
      ref={headerRef}
      className="page_head"
      style={{
        ...(spacingBottom === undefined
          ? {}
          : { paddingBottom: `${spacingBottom}px` }),
      }}
      {...rest}
    >
      {children}
    </header>
  );
};
const PageHeadLabel = ({ icon, label, children, actions = [] }) => {
  const title = (
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

  if (actions.length === 0) {
    return title;
  }

  return (
    <div className="page_head_with_actions">
      {title}
      <div className="actions">
        {actions.map((action) => {
          return action.component;
        })}
      </div>
    </div>
  );
};
PageHead.Label = PageHeadLabel;

export const PageBody = ({ children }) => {
  return <section className="page_body">{children}</section>;
};
