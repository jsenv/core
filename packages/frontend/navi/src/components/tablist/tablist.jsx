import.meta.css = /* css */ `
  .navi_tablist {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    justify-content: space-between;
  }

  .navi_tablist > ul {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .navi_tablist > ul > li {
    display: inline-flex;
    position: relative;
  }

  .navi_tab {
    white-space: nowrap;
    display: flex;
    flex-direction: column;
  }

  .navi_tab_content {
    transition: background 0.12s ease-out;
    border-radius: 6px;
    text-decoration: none;
    line-height: 30px;
  }

  .navi_tab:hover .navi_tab_content {
    background: #dae0e7;
    color: #010409;
  }

  .navi_tab .active_marker {
    display: flex;
    background: transparent;
    border-radius: 0.1px;
    width: 100%;
    z-index: 1;
    height: 2px;
    margin-top: 5px;
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
    <nav className="navi_tablist" role="tablist" {...props}>
      <ul>
        {children.map((child) => {
          return <li key={child.props.key}>{child}</li>;
        })}
      </ul>
    </nav>
  );
};

export const Tab = ({ children, selected, ...props }) => {
  return (
    <div
      className="navi_tab"
      role="tab"
      aria-selected={selected ? "true" : "false"}
      {...props}
    >
      <div className="navi_tab_content">{children}</div>
      <span className="active_marker"></span>
    </div>
  );
};
