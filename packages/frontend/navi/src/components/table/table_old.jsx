// const RowNumberCell = ({
//   stickyLeft,
//   stickyTop,
//   isStickyLeftFrontier,
//   isStickyTopFrontier,
//   isAfterStickyLeftFrontier,
//   isAfterStickyTopFrontier,
//   stickyLeftFrontierColumnIndex,
//   onStickyLeftFrontierChange,
//   stickyTopFrontierRowIndex,
//   onStickyTopFrontierChange,
//   row,
//   columns,
//   rowWithSomeSelectedCell,
//   selectionController,
//   value,
//   resizable,
//   rowIndex,
//   rowMinHeight,
//   rowMaxHeight,
//   onResizeRequested,
//   style,
// }) => {
//   const cellRef = useRef();

//   const rowValue = `row:${row.id}`;
//   const { selected } = useSelectableElement(cellRef, {
//     selectionController,
//     selectionImpact: () => {
//       // Return all data cells in this row that should be impacted
//       return columns.map((col) => `${col.id}:${row.id}`);
//     },
//   });

//   const rowContainsSelectedCell = rowWithSomeSelectedCell.includes(row.id);

//   return (
//     <td
//       ref={cellRef}
//       data-sticky-left={stickyLeft ? "" : undefined}
//       data-sticky-top={stickyTop ? "" : undefined}
//       data-sticky-left-frontier={isStickyLeftFrontier ? "" : undefined}
//       data-sticky-top-frontier={isStickyTopFrontier ? "" : undefined}
//       data-after-sticky-left-frontier={
//         isAfterStickyLeftFrontier ? "" : undefined
//       }
//       data-after-sticky-top-frontier={isAfterStickyTopFrontier ? "" : undefined}
//       className="navi_row_number_cell"
//       data-row-contains-selected={rowContainsSelectedCell ? "" : undefined}
//       data-value={rowValue}
//       data-selection-name="row"
//       data-selection-keyboard-toggle
//       aria-selected={selected}
//       style={{ textAlign: "center", ...style }}
//       tabIndex={-1}
//     >
//       {value}
//       <TableCellStickyFrontier
//         columnIndex={0}
//         rowIndex={rowIndex}
//         stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
//         onStickyLeftFrontierChange={onStickyLeftFrontierChange}
//         stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
//         onStickyTopFrontierChange={onStickyTopFrontierChange}
//       />

//       {resizable && (
//         <TableCellRowResizeHandles
//           rowIndex={rowIndex}
//           onResizeRequested={onResizeRequested}
//           rowMinHeight={rowMinHeight}
//           rowMaxHeight={rowMaxHeight}
//         />
//       )}
//     </td>
//   );
// };
// <RowNumberCell
//                 // sticky left
//                 stickyLeft={firstColIsSticky}
//                 isStickyLeftFrontier={stickyLeftFrontierColumnIndex === 0}
//                 isAfterStickyLeftFrontier={
//                   stickyLeftFrontierColumnIndex === -1
//                 }
//                 stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
//                 onStickyLeftFrontierChange={onStickyLeftFrontierChange}
//                 // sticky top
//                 stickyTop={rowIsSticky}
//                 isStickyTopFrontier={isStickyTopFrontier}
//                 isAfterStickyTopFrontier={isAfterStickyTopFrontier}
//                 stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
//                 onStickyTopFrontierChange={onStickyTopFrontierChange}
//                 // other
//                 row={rowData}
//                 rowWithSomeSelectedCell={rowWithSomeSelectedCell}
//                 columns={columns}
//                 selectionController={selectionController}
//                 value={rowIndex + 1}
//                 resizable
//                 rowIndex={rowIndex + 1}
//                 rowMinHeight={rowOptions.minHeight}
//                 rowMaxHeight={rowOptions.maxHeight}
//                 onResizeRequested={(height, rowIndex) => {
//                   if (rowIndex === 0) {
//                     onGeneratedTopRowResize?.(height);
//                     return;
//                   }
//                   onRowResize?.(height, rowIndex - 1, rows[rowIndex - 1]);
//                 }}
//                 style={{
//                   maxWidth: generatedLeftColumnWidth
//                     ? `${generatedLeftColumnWidth}px`
//                     : undefined,
//                   maxHeight: rowOptions.height
//                     ? `${rowOptions.height}px`
//                     : undefined,
//                 }}
//               />
