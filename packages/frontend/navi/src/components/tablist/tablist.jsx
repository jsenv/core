import { Box } from "../layout/box.jsx";

import.meta.css = /* css */ `
  .navi_tablist {
    display: flex;
    justify-content: space-between;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .navi_tablist > ul {
    display: flex;
    margin: 0;
    padding: 0;
    align-items: center;
    gap: 0.5rem;
    list-style: none;
  }

  .navi_tablist > ul > li {
    position: relative;
    display: inline-flex;
  }

  .navi_tab {
    display: flex;
    flex-direction: column;
    white-space: nowrap;
  }

  .navi_tab_content {
    display: flex;
    padding: 0 0.5rem;
    text-decoration: none;
    line-height: 30px;
    border-radius: 6px;
    transition: background 0.12s ease-out;
  }

  .navi_tab:hover .navi_tab_content {
    color: #010409;
    background: #dae0e7;
  }

  .navi_tab .active_marker {
    z-index: 1;
    display: flex;
    width: 100%;
    height: 2px;
    margin-top: 5px;
    background: transparent;
    border-radius: 0.1px;
  }

  /* Hidden bold clone to reserve space for bold width without affecting height */
  .navi_tab_content_bold_clone {
    display: block; /* in-flow so it contributes to width */
    height: 0; /* zero height so it doesn't change layout height */
    font-weight: 600; /* force bold to compute max width */
    visibility: hidden; /* not visible */
    pointer-events: none; /* inert */
    overflow: hidden; /* avoid any accidental height */
  }

  .navi_tab[aria-selected="true"] .active_marker {
    background: rgb(205, 52, 37);
  }

  .navi_tab[aria-selected="true"] .navi_tab_content {
    font-weight: 600;
  }
`;

export const TabList = ({ children, ...props }) => {
  return (
    <Box as="nav" baseClassName="navi_tablist" role="tablist" {...props}>
      <ul role="list">
        {children.map((child) => {
          return <li key={child.props.key}>{child}</li>;
        })}
      </ul>
    </Box>
  );
};

export const Tab = ({ children, selected, ...props }) => {
  return (
    <Box
      baseClassName="navi_tab"
      role="tab"
      aria-selected={selected ? "true" : "false"}
      {...props}
    >
      <div className="navi_tab_content">{children}</div>
      <div className="navi_tab_content_bold_clone" aria-hidden="true">
        {children}
      </div>
      <span className="active_marker"></span>
    </Box>
  );
};
