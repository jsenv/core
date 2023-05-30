const fs = require("fs");

const fd = fs.openSync(__filename, "r");
console.log(fd);

const run = async () => {
  const filehandle = await fs.promises.open(__filename, "r");
  console.log(filehandle);
};

run();
