/*
 * This file is not actually used
 * It exists to demo how to test a function by "animals.test.html"
 */

export const countDogs = (animals) => {
  return animals.filter((animal) => animal === "dog").length;
};
