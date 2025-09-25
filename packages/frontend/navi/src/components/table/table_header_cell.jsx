const TableHeaderCell = ({
  stickyLeft,
  stickyTop,
  isStickyLeftFrontier,
  isStickyTopFrontier,
  isAfterStickyLeftFrontier,
  isAfterStickyTopFrontier,
  stickyLeftFrontierColumnIndex,
  onStickyLeftFrontierChange,
  stickyTopFrontierRowIndex,
  onStickyTopFrontierChange,
  columnId,
  columnWithSomeSelectedCell,
  columnMinWidth,
  columnMaxWidth,
  data,
  selectionController,
  grabbed,
  columnIndex,
  resizable,
  movable,
  onGrab,
  onDrag,
  onRelease,
  onResizeRequested,

  style,
  value,
  textAlign,
}) => {
  const columnContext = useColumnContext();

  const columnContainsSelectedCell =
    columnWithSomeSelectedCell.includes(columnId);

  return (
    <TableCell
      cellId={`header:${columnId}`}
      isHead={true}
      stickyLeft={stickyLeft}
      stickyTop={stickyTop}
      isStickyLeftFrontier={isStickyLeftFrontier}
      isStickyTopFrontier={isStickyTopFrontier}
      isAfterStickyLeftFrontier={isAfterStickyLeftFrontier}
      isAfterStickyTopFrontier={isAfterStickyTopFrontier}
      stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
      onStickyLeftFrontierChange={onStickyLeftFrontierChange}
      grabbed={grabbed}
      style={style}
      cursor={grabbed ? "grabbing" : movable ? "grab" : undefined}
      selectionController={selectionController}
      value={value}
      textAlign={textAlign}
      // Header-specific data attributes
      boldClone // ensure column width does not change when header becomes strong
      onMouseDown={(e) => {
        if (!movable) {
          return;
        }
        if (e.button !== 0) {
          return;
        }
        initDragTableColumnByMousedown(e, {
          onGrab,
          onDrag,
          onRelease,
        });
      }}
      selectionImpact={() => {
        const columnCells = data.map((row) => `${columnId}:${row.id}`);
        return columnCells;
      }}
      columnContainsSelectedCell={columnContainsSelectedCell}
    >
      <TableCellStickyFrontier
        rowIndex={0}
        columnIndex={columnIndex}
        stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
        onStickyLeftFrontierChange={onStickyLeftFrontierChange}
        stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
        onStickyTopFrontierChange={onStickyTopFrontierChange}
      />
      {resizable && (
        <TableCellColumnResizeHandles
          columnIndex={columnIndex}
          columnMinWidth={columnMinWidth}
          columnMaxWidth={columnMaxWidth}
          onResizeRequested={onResizeRequested}
        />
      )}
    </TableCell>
  );
};
