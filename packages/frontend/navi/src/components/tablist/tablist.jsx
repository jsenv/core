import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { Box } from "../layout/box.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_tablist {
      --tab-background: transparent;
      --tab-background-hover: #dae0e7;
      --tab-color: inherit;
      --tab-color-hover: #010409;
    }
  }

  .navi_tablist {
    display: flex;
    justify-content: space-around;
    line-height: 2em;
    overflow-x: auto;
    overflow-y: hidden;

    --x-tab-background: var(--tab-background);
    --x-tab-color: var(--tab-color);
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

    &:hover {
      --x-tab-background: var(--tab-background-hover);
      --x-tab-color: var(--tab-color-hover);
    }

    .navi_tab_content {
      display: flex;
      padding: 0 0.5rem;
      color: var(--x-tab-color);
      background: var(--x-tab-background);
      border-radius: 6px;
      transition: background 0.12s ease-out;
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

    .navi_tab_active_marker {
      z-index: 1;
      display: flex;
      width: 100%;
      height: 2px;
      margin-top: 5px;
      background: transparent;
      border-radius: 0.1px;
    }

    &[aria-selected="true"] {
      .navi_tab_content {
        font-weight: 600;
      }
      .navi_tab_active_marker {
        background: rgb(205, 52, 37);
      }
    }
  }
`;

const TabListUnderlinerContext = createContext();

export const TabList = ({ children, spacing, underline, ...props }) => {
  return (
    <Box as="nav" baseClassName="navi_tablist" role="tablist" {...props}>
      <Box as="ul" column role="list" spacing={spacing}>
        <TabListUnderlinerContext.Provider value={underline}>
          {children.map((child) => {
            return <li key={child.props.key}>{child}</li>;
          })}
        </TabListUnderlinerContext.Provider>
      </Box>
    </Box>
  );
};

export const Tab = ({ children, selected, ...props }) => {
  const tabListUnderline = useContext(TabListUnderlinerContext);

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
      {tabListUnderline && <span className="navi_tab_active_marker"></span>}
    </Box>
  );
};
