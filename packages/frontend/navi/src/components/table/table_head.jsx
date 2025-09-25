export const TableHead = ({
  grabTarget,
  grabColumn,
  releaseColumn,
  columnWithSomeSelectedCell,
  columns,
  data,
  firstRow,
  stickyLeftFrontierColumnIndex,
  stickyTopFrontierRowIndex,
  onStickyLeftFrontierChange,
  onStickyTopFrontierChange,
  onColumnResize,
  selectionController,
}) => {
  const firsRowIsSticky = stickyTopFrontierRowIndex > -1;

  return (
    <thead>
      <tr
        data-sticky-top={firsRowIsSticky ? "" : undefined}
        data-drag-sticky-frontier-top={firsRowIsSticky ? "" : undefined}
        data-drag-obstacle="move-row"
        style={{
          height: firstRow.height ? `${firstRow.height}px` : undefined,
        }}
      >
        {columns.map((column, columnIndex) => {
          const columnIsGrabbed = grabTarget === `column:${columnIndex}`;
          // const isLastColumn = index === columns.length - 1;
          const { header } = column;
          const { textAlign } = column;
          const headerCellContent =
            header === undefined
              ? ""
              : typeof header === "function"
                ? header({})
                : header;

          return (
            <HeaderCell
              key={column.id}
              // sticky left
              stickyLeft={columnIndex < stickyLeftFrontierColumnIndex}
              isStickyLeftFrontier={
                columnIndex + 1 === stickyLeftFrontierColumnIndex
              }
              isAfterStickyLeftFrontier={
                columnIndex + 1 === stickyLeftFrontierColumnIndex + 1
              }
              stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
              onStickyLeftFrontierChange={onStickyLeftFrontierChange}
              // sticky top
              stickyTop={firsRowIsSticky}
              isStickyTopFrontier={stickyTopFrontierRowIndex === 0}
              isAfterStickyTopFrontier={stickyTopFrontierRowIndex === -1}
              stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
              onStickyTopFrontierChange={onStickyTopFrontierChange}
              // other
              columnId={column.id}
              columnIndex={columnIndex + 1}
              columnWithSomeSelectedCell={columnWithSomeSelectedCell}
              data={data}
              selectionController={selectionController}
              grabbed={columnIsGrabbed}
              movable
              resizable
              columnMinWidth={column.minWidth}
              columnMaxWidth={column.maxWidth}
              rowMinHeight={firstRow.minHeight}
              onGrab={() => {
                grabColumn(columnIndex);
              }}
              onRelease={() => {
                releaseColumn(columnIndex);
              }}
              onResizeRequested={(width, columnIndex) => {
                onColumnResize?.(width, columnIndex, columns[columnIndex]);
              }}
              style={{
                maxWidth: column.width ? `${column.width}px` : undefined,
                maxHeight: firstRow.height ? `${firstRow.height}px` : undefined,
              }}
              textAlign={textAlign}
              value={headerCellContent}
            />
          );
        })}
      </tr>
    </thead>
  );
};
