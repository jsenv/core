import { Box, ErrorBoundaryContext, Icon, Text } from "@jsenv/navi";
import { useErrorBoundary } from "preact/hooks";

import.meta.css = /* css */ `
  .page {
    min-width: max-content;
  }

  .page_head {
    position: sticky;
    top: 0;
    left: 0;
    z-index: 1;
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
  return (
    <header
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
      <Icon>{icon}</Icon>
      <Text color="lightgrey" userSelect="none" noWrap>
        {label}
      </Text>
      <span>{children}</span>
    </h1>
  );

  if (actions.length === 0) {
    return title;
  }

  return (
    <div className="page_head_with_actions">
      {title}
      <Box className="actions" selfAlignX="end">
        {actions.map((action) => {
          return action.component;
        })}
      </Box>
    </div>
  );
};
PageHead.Label = PageHeadLabel;

export const PageBody = ({ children }) => {
  return <section className="page_body">{children}</section>;
};
