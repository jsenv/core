export const useCellGridFromRows = (rows, properties) => {
  const cellGrid = [];
  for (const object of rows) {
    const cellRow = [];
    for (const prop of properties) {
      cellRow.push(object[prop]);
    }
    cellGrid.push(cellRow);
  }
  return cellGrid;
};
