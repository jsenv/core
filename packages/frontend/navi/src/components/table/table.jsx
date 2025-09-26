import { createContext } from "preact";
import { useContext, useRef } from "preact/hooks";

const ColGroupRefContext = createContext();
const useColGroup = () => useContext(ColGroupRefContext).current;
const ColumnContext = createContext();
const useColumn = () => useContext(ColumnContext);

const TableRowIndexRefContext = createContext();
const useTableRowIndexRef = () => useContext(TableRowIndexRefContext);

export const Table = ({ children }) => {
  const tableRowIndexRef = useRef();
  tableRowIndexRef.current = -1;

  const colGroupRef = useRef();
  colGroupRef.current = [];

  return (
    <table>
      <ColGroupRefContext.Provider value={colGroupRef}>
        <TableRowIndexRefContext.Provider value={tableRowIndexRef}>
          {children}
        </TableRowIndexRefContext.Provider>
      </ColGroupRefContext.Provider>
    </table>
  );
};
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
