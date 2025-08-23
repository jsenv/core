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
  }

  .navi_tablist > ul > li {
    display: inline-flex;
    position: relative;
  }

  .active_marker {
    display: none;
  }

  li[aria-selected="true"] .active_marker {
    background: rgb(205, 52, 37);
    border-radius: 0.1px;
    bottom: 2px;
    height: 2px;
    position: absolute;
    width: 100%;
    z-index: 1;
    display: block;
  }
`;

export const TabList = ({ children, ...props }) => {
  return (
    <nav className="navi_tablist" role="tablist" {...props}>
      <ul>
        {children.map((child) => {
          return (
            <li key={child.props.key} data-active="">
              {child}
              <span className="active_marker"></span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export const Tab = ({ children, selected, ...props }) => {
  return (
    <div role="tab" aria-selected={selected ? "true" : "false"} {...props}>
      {children}
    </div>
  );
};
