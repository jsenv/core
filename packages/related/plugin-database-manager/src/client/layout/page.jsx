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
`;

export const PageHead = ({ children, actions = [] }) => {
  return (
    <header className="page_head" data-position-sticky-fix>
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
