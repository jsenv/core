"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createResponseGenerator = void 0;

// https://github.com/jsenv/core/blob/master/src/util/rest/helpers.js
const createResponseGenerator = ({
  services = []
}) => {
  const generateResponse = (...args) => {
    return new Promise((resolve, reject) => {
      const visit = index => {
        if (index >= services.length) {
          return resolve();
        }

        const service = services[index];
        Promise.resolve(service(...args)).then(value => {
          if (value) {
            resolve(value);
          } else {
            visit(index + 1);
          }
        }, value => {
          if (value) {
            reject(value);
          } else {
            visit(index + 1);
          }
        });
      };

      visit(0);
    }).then(value => {
      if (value) {
        return value;
      }

      return {
        status: 501,
        reason: "no implemented"
      };
    });
  };

  return generateResponse;
};

exports.createResponseGenerator = createResponseGenerator;
//# sourceMappingURL=createResponseGenerator.js.map