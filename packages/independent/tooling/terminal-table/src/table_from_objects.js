export const tableFromObjects = (objects, { head, body, foot } = {}) => {
  const propSet = new Set();
  for (const object of objects) {
    const names = Object.getOwnPropertyNames(object);
    for (const name of names) {
      propSet.add(name);
    }
  }
  const props = Array.from(propSet);
  let headRow = [];
  if (head) {
    for (const prop of head) {
      const headCell = {
        borderLeft: {},
        borderRight: {},
        borderBottom: {},
        ...prop,
      };
      headRow.push(headCell);
    }
  } else {
    for (const prop of props) {
      const headCell = {
        value: prop,
        borderLeft: {},
        borderRight: {},
        borderBottom: {},
      };
      headRow.push(headCell);
    }
  }
  headRow[0].borderLeft = null;
  headRow[headRow.length - 1].borderRight = null;

  const bodyRows = [];
  let bodyLastRow;
  for (const object of objects) {
    const bodyRow = [];
    let x = 0;
    for (const prop of props) {
      const cellProps = body?.[x] || {};
      const bodyCell = {
        value: object[prop],
        borderLeft: {},
        borderRight: {},
        ...cellProps,
      };
      bodyRow.push(bodyCell);
      x++;
    }
    bodyRow[0].borderLeft = null;
    bodyRow[bodyRow.length - 1].borderRight = null;
    bodyRows.push(bodyRow);
    bodyLastRow = bodyRow;
  }
  if (bodyLastRow) {
    for (const bodyLastLineCell of bodyLastRow) {
      if (bodyLastLineCell.borderBottom === undefined) {
        bodyLastLineCell.borderBottom = { color: null };
      }
    }
  }

  const rows = [headRow, ...bodyRows];
  if (!foot) {
    return rows;
  }

  let footRow = [];
  for (const props of foot) {
    const footCell = {
      ...props,
      borderTop: {},
      borderLeft: {},
      borderRight: {},
    };
    footRow.push(footCell);
  }
  footRow[0].borderLeft = null;
  footRow[headRow.length - 1].borderRight = null;
  rows.push(footRow);
  return rows;
};
