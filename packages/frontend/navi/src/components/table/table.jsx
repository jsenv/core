import { createContext } from "preact";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { TableDragCloneContainer } from "./drag/table_drag_clone_container.jsx";
import { TableColumnResizer, TableRowResizer } from "./resize/table_resize.jsx";
import { TableStickyFrontier } from "./sticky/table_sticky.jsx";
import "./table_css.js";

const ColGroupRefContext = createContext();
const useColGroup = () => useContext(ColGroupRefContext).current;
const ColumnContext = createContext();
const useColumn = () => useContext(ColumnContext);

const TableRowIndexRefContext = createContext();
const useTableRowIndexRef = () => useContext(TableRowIndexRefContext);

export const Table = forwardRef((props, ref) => {
  const { children } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => {
    return innerRef.current;
  });
  const tableContainerRef = useRef();

  const tableRowIndexRef = useRef();
  tableRowIndexRef.current = -1;

  const colGroupRef = useRef();
  colGroupRef.current = [];

  // ability to drag columns
  const [grabTarget, setGrabTarget] = useState(null);
  const grabColumn = (columnIndex) => {
    setGrabTarget(`column:${columnIndex}`);
  };
  const releaseColumn = () => {
    setGrabTarget(null);
  };

  return (
    <div ref={tableContainerRef} className="navi_table_container">
      <table>
        <ColGroupRefContext.Provider value={colGroupRef}>
          <TableRowIndexRefContext.Provider value={tableRowIndexRef}>
            {children}
          </TableRowIndexRefContext.Provider>
        </ColGroupRefContext.Provider>
      </table>
      <TableUIContainer>
        <TableDragCloneContainer dragging={Boolean(grabTarget)} />
        <TableColumnResizer />
        <TableRowResizer />
        <TableStickyFrontier />
      </TableUIContainer>
    </div>
  );
});
export const Colgroup = ({ children }) => {
  return <colgroup>{children}</colgroup>;
};
export const Col = ({ width }) => {
  const colGroup = useColGroup();
  const colIndex = colGroup.length;
  colGroup[colIndex] = { width };
  return <col />;
};

const TableHeadContext = createContext();
const useIsInTableHead = () => useContext(TableHeadContext) === true;
export const TableHead = ({ children }) => {
  return (
    <thead>
      <TableHeadContext.Provider value={true}>
        {children}
      </TableHeadContext.Provider>
    </thead>
  );
};
export const TableBody = ({ children }) => {
  return <tbody>{children}</tbody>;
};

const CellColumnIndexContext = createContext();
const useCellColumnIndex = () => useContext(CellColumnIndexContext);
const CellRowIndexContext = createContext();
const useCellRowIndex = () => useContext(CellRowIndexContext);

export const TableRow = ({ children }) => {
  const tableRowIndexRef = useTableRowIndexRef();
  tableRowIndexRef.current++;
  const tableRowIndex = tableRowIndexRef.current;
  const colGroup = useColGroup();

  return (
    <tr>
      <CellRowIndexContext.Provider value={tableRowIndex}>
        {children.map((child, columnIndex) => {
          const col = colGroup[columnIndex];
          return (
            <CellColumnIndexContext.Provider
              key={columnIndex}
              value={columnIndex}
            >
              <ColumnContext.Provider value={col}>
                {child}
              </ColumnContext.Provider>
            </CellColumnIndexContext.Provider>
          );
        })}
      </CellRowIndexContext.Provider>
    </tr>
  );
};
export const TableCell = ({ children }) => {
  const columnIndex = useCellColumnIndex();
  const rowIndex = useCellRowIndex();
  const column = useColumn();
  const isInTableHead = useIsInTableHead();
  const TagName = isInTableHead ? "th" : "td";

  return (
    <TagName
      data-row-index={rowIndex}
      data-column-index={columnIndex}
      data-column-width={column.width}
    >
      {children}
    </TagName>
  );
};

const TableUIContainer = ({ children }) => {
  const ref = useRef();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const tableContainer = element.closest(".navi_table_container");
    element.style.setProperty(
      "--table-scroll-width",
      `${tableContainer.scrollWidth}px`,
    );
    element.style.setProperty(
      "--table-scroll-height",
      `${tableContainer.scrollHeight}px`,
    );
  }, []);

  return (
    <div ref={ref} className="navi_table_ui_container">
      {children}
    </div>
  );
};
