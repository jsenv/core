const getResponse = () => {
  return [42];
};
const [answer] = getResponse();

console.log({
  ...{ answer },
});

export const b = "b";
