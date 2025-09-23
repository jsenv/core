import { forwardRef, useImperativeHandle } from "preact/compat";
import { useRef } from "preact/hooks";
import { Editable, useEditionController } from "../edition/editable.jsx";
import { useSelectableElement } from "../selection/selection.jsx";

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
    z-index: 2; /* To go above neighbours, but should not be too big to stay under the sticky cells */
  }
`;

export const TableCell = forwardRef((props, ref) => {
  const {
    isHead,
    cellId,
    boldClone,
    stickyX,
    stickyY,
    isStickyXFrontier,
    isStickyYFrontier,
    isAfterStickyXFrontier,
    isAfterStickyYFrontier,
    value,
    selectionController,
    grabbed,
    style,
    columnWidth,
    rowHeight,
    children,
    // Header-specific props
    className,
    onClick,
    onMouseDown,
    cursor,
    // Additional props for headers
    selectionImpact,
    columnContainsSelectedCell,
  } = props;

  const cellRef = useRef();
  const { selected } = useSelectableElement(cellRef, {
    selectionController,
    selectionImpact,
    // value: cellId,
  });
  const { editing, startEditing, stopEditing } = useEditionController();
  const TagName = isHead ? "th" : "td";

  useImperativeHandle(ref, () => ({
    startEditing,
    stopEditing,
    element: cellRef.current,
  }));

  const innerStyle = { ...style };

  if (cursor) {
    innerStyle.cursor = cursor;
  }

  if (
    columnWidth === undefined ||
    // when column width becomes too small the padding would prevent it from shrinking
    columnWidth > 42
  ) {
    innerStyle.paddingLeft = "12px";
    innerStyle.paddingRight = "12px";
  }
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

  return (
    <TagName
      ref={cellRef}
      className={className}
      style={innerStyle}
      data-sticky-x={stickyX ? "" : undefined}
      data-sticky-y={stickyY ? "" : undefined}
      data-sticky-x-frontier={stickyX && isStickyXFrontier ? "" : undefined}
      data-sticky-y-frontier={stickyY && isStickyYFrontier ? "" : undefined}
      data-after-sticky-x-frontier={isAfterStickyXFrontier ? "" : undefined}
      data-after-sticky-y-frontier={isAfterStickyYFrontier ? "" : undefined}
      tabIndex={-1}
      data-value={cellId}
      data-selection-name={isHead ? "column" : "cell"}
      data-selection-keyboard-toggle
      aria-selected={selected}
      data-editing={editing ? "" : undefined}
      data-grabbed={grabbed ? "" : undefined}
      data-column-contains-selected-cell={
        columnContainsSelectedCell ? "" : undefined
      }
      onClick={onClick}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        startEditing(e);
      }}
      oneditrequested={(e) => {
        startEditing(e);
      }}
    >
      <Editable editing={editing} onEditEnd={stopEditing} value={value}>
        {value}
      </Editable>
      {boldClone && (
        <span className="navi_table_cell_content_bold_clone" aria-hidden="true">
          {value}
        </span>
      )}
      {children}
    </TagName>
  );
});
