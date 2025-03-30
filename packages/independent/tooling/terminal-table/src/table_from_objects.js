export const tableFromObjects = (
  objects,
  {
    head = {
      borderTop: { color: null },
      borderBottom: { color: null },
      borderLeft: { color: null },
      borderRight: { color: null },
    },
    body = {
      borderLeft: { color: null },
      borderRight: { color: null },
    },
  } = {},
) => {
  const propSet = new Set();
  for (const object of objects) {
    const names = Object.getOwnPropertyNames(object);
    for (const name of names) {
      propSet.add(name);
    }
  }
  const props = Array.from(propSet);
  const headLine = [];
  for (const prop of props) {
    const headCell = {
      value: prop,
      ...head,
    };
    headLine.push(headCell);
  }
  const bodyLines = [];
  let bodyLastLine;
  for (const object of objects) {
    const bodyLine = [];
    for (const prop of props) {
      const bodyCell = {
        value: object[prop],
        ...body,
      };
      bodyLine.push(bodyCell);
    }
    bodyLines.push(bodyLine);
    bodyLastLine = bodyLine;
  }
  if (bodyLastLine) {
    for (const bodyLastLineCell of bodyLastLine) {
      if (bodyLastLineCell.borderBottom === undefined) {
        bodyLastLineCell.borderBottom = { color: null };
      }
    }
  }
  return [headLine, ...bodyLines];
};
