// Invalid property renaming cases
const invalidRename1 = ({ a: b }) => {
  console.log(b);
};
invalidRename1({ b: true }); // Should error - 'b' property doesn't exist, should be 'a'

const invalidRename2 = ({ a: b }) => {
  console.log(b);
};
invalidRename2({ c: true }); // Should error - 'c' property doesn't exist

const invalidMultipleRename = ({ prop1: x, prop2: y }) => {
  console.log(x, y);
};
invalidMultipleRename({ x: 1, y: 2 }); // Should error - should be prop1 and prop2
