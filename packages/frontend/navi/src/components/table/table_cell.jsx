import { forwardRef, useImperativeHandle } from "preact/compat";
import { useRef } from "preact/hooks";

import { Editable, useEditionController } from "../edition/editable.jsx";
import { useSelectableElement } from "../selection/selection.jsx";
import {
  TableCellColumnResizeHandles,
  TableCellRowResizeHandles,
} from "./resize/table_resize.jsx";
import { TableCellStickyFrontier } from "./sticky/table_sticky.jsx";
import {
  useTableCell,
  useTableColumn,
  useTableDrag,
  useTableHead,
  useTableRow,
  useTableSelection,
  useTableSticky,
} from "./table_context.jsx";
import { Z_INDEX_EDITING } from "./z_indexes.js";

import.meta.css = /* css */ `
  .navi_table {
    font-size: 16px;
    font-family: Arial;

    --editing-border-color: #a8c7fa;
  }

  .navi_table td[data-editing] {
    padding: 0;
  }

  .navi_table td[data-editing] .navi_table_cell_content {
    outline: 2px solid #a8c7fa;
    outline-offset: 0px;
  }

  .navi_table td[data-editing] input {
    width: 100%;
    height: 100%;
    display: inline-flex;
    flex-grow: 1;
    padding: 0;
    padding-left: 8px;
    border-radius: 0; /* match table cell border-radius */
    border: none;
    font-size: 16px;
  }

  .navi_table td[data-editing] input[type="number"]::-webkit-inner-spin-button {
    width: 14px;
    height: 30px;
  }

  .navi_table td[data-editing] {
    outline: 2px solid var(--editing-border-color);
    z-index: ${Z_INDEX_EDITING};
  }
`;

export const TableCell = forwardRef((props, ref) => {
  let {
    cellId,
    value,
    style,
    textAlign,
    editable = true,
    canResizeWidth,
    canResizeHeight,
    // Header-specific props
    className,
    onClick,
    onMouseDown,
    cursor,
    // Additional props for headers
    selectionImpact,
    columnContainsSelectedCell,
  } = props;

  const tableHead = useTableHead();
  const isInTableHead = Boolean(tableHead);
  const row = useTableRow();
  const column = useTableColumn();
  const { columnIndex, rowIndex } = useTableCell();
  const { stickyLeftFrontierColumnIndex, stickyTopFrontierRowIndex } =
    useTableSticky();
  const { selectionController } = useTableSelection();
  const { grabTarget } = useTableDrag();

  if (canResizeWidth === undefined && rowIndex === 0) {
    canResizeWidth = true;
  }
  if (canResizeHeight === undefined && columnIndex === 0) {
    canResizeHeight = true;
  }

  const columnGrabbed = grabTarget === `column:${columnIndex}`;
  const stickyLeft = columnIndex < stickyLeftFrontierColumnIndex;
  const stickyTop = rowIndex < stickyTopFrontierRowIndex;
  const isStickyLeftFrontier = columnIndex === stickyLeftFrontierColumnIndex;
  const isAfterStickyLeftFrontier =
    columnIndex === stickyLeftFrontierColumnIndex + 1;
  const isStickyTopFrontier = false;
  const isAfterStickyTopFrontier = false;

  const cellRef = useRef();
  const { selected } = useSelectableElement(cellRef, {
    selectionController,
    selectionImpact,
    // value: cellId,
  });
  const { editing, startEditing, stopEditing } = useEditionController();

  useImperativeHandle(ref, () => ({
    startEditing,
    stopEditing,
    element: cellRef.current,
  }));

  const innerStyle = { ...style };

  if (cursor) {
    innerStyle.cursor = cursor;
  }

  const columnWidth = column.width;
  if (
    columnWidth === undefined ||
    // when column width becomes too small the padding would prevent it from shrinking
    columnWidth > 42
  ) {
    innerStyle.paddingLeft = "12px";
    innerStyle.paddingRight = "12px";
  }
  const rowHeight = row.height;
  if (
    rowHeight === undefined ||
    // when row height becomes too small the padding would prevent it from shrinking
    rowHeight > 42
  ) {
    innerStyle.paddingTop = "8px";
    innerStyle.paddingBottom = "8px";
  }
  if (columnWidth !== undefined) {
    innerStyle.maxWidth = `${columnWidth}px`;
  }
  if (rowHeight !== undefined) {
    innerStyle.maxHeight = `${rowHeight}px`;
  }
  if (textAlign) {
    innerStyle.textAlign = textAlign;
  }

  const TagName = isInTableHead ? "th" : "td";

  return (
    <TagName
      ref={cellRef}
      className={className}
      style={innerStyle}
      data-sticky-left={stickyLeft ? "" : undefined}
      data-sticky-top={stickyTop ? "" : undefined}
      data-sticky-left-frontier={
        stickyLeft && isStickyLeftFrontier ? "" : undefined
      }
      data-sticky-top-frontier={
        stickyTop && isStickyTopFrontier ? "" : undefined
      }
      data-after-sticky-left-frontier={
        isAfterStickyLeftFrontier ? "" : undefined
      }
      data-after-sticky-top-frontier={isAfterStickyTopFrontier ? "" : undefined}
      tabIndex={-1}
      data-value={cellId}
      data-selection-name={isInTableHead ? "column" : "cell"}
      data-selection-keyboard-toggle
      aria-selected={selected}
      data-editing={editing ? "" : undefined}
      data-grabbed={columnGrabbed ? "" : undefined}
      data-column-contains-selected-cell={
        columnContainsSelectedCell ? "" : undefined
      }
      onClick={onClick}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        if (!editable) {
          return;
        }
        startEditing(e);
      }}
      oneditrequested={(e) => {
        if (!editable) {
          return;
        }
        startEditing(e);
      }}
    >
      {editable ? (
        <Editable
          editing={editing}
          onEditEnd={stopEditing}
          value={value}
          action={() => {}}
        >
          {value}
        </Editable>
      ) : (
        value
      )}
      <TableCellStickyFrontier
        rowIndex={rowIndex}
        columnIndex={columnIndex}
        stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
        stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
      />
      {canResizeWidth && (
        <TableCellColumnResizeHandles
          columnIndex={columnIndex}
          columnMinWidth={column.minWidth}
          columnMaxWidth={column.maxWidth}
        />
      )}
      {canResizeHeight && (
        <TableCellRowResizeHandles
          rowIndex={rowIndex}
          rowMinHeight={row.minHeight}
          rowMaxHeight={row.maxHeight}
        />
      )}

      {isInTableHead && (
        <span className="navi_table_cell_content_bold_clone" aria-hidden="true">
          {value}
        </span>
      )}
      {columnGrabbed && <div className="navi_table_cell_placeholder"></div>}
    </TagName>
  );
});
