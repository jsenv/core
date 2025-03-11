export const getAnswer = async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return 43;
};
