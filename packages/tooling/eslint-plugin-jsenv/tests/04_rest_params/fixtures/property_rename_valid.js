// Valid property renaming cases
const validRename = ({ a: b }) => {
  console.log(b);
};
validRename({ a: true });

const validRenameWithRest = ({ a: b, ...rest }) => {
  console.log(b, rest);
};
validRenameWithRest({ a: true, c: false });

const multipleRename = ({ prop1: x, prop2: y }) => {
  console.log(x, y);
};
multipleRename({ prop1: 1, prop2: 2 });
