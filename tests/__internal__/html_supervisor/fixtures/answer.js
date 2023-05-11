export const getAnswer = async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return 43;
};

// eslint-disable-next-line import/no-default-export
export default 42;
