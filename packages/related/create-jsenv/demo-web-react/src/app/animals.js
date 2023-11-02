/*
 * This file exists to show code using the browser runtime to operate:
 * code writes "countDogs" function on window
 *
 * As a result testing "countDogs" should be done in a browser.
 * See "animals.test.html"
 */

window.countDogs = (animals) => {
  return animals.filter((animal) => animal === "dog").length;
};
