const getResponse = () => {
  return [42];
};
const [answer] = getResponse();

console.log({
  ...{ answer },
});

const b = "b";

export { b };
