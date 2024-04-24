import { inspect } from "node:util";

const User = {};
const dam = Object.create(User);
dam.name = "toto";
console.log(inspect(dam));
process.exit(1);

const item = {
  a: true,
};
item.item = item;
const arr = [item, item, item];
console.log(inspect(arr));
process.exit(1);

var ar = new Array(1000000);
ar.fill("a");
console.log(ar);

const value = ["a", "b"];
value.foo = true;

console.log(inspect(value));

const value2 = {};
const err = new Error("message on several lines\n because]");
err.stack = "";
err.toto = true;
err.bar = "false";
err.thrid = "jdsfhvjafskahdjfwkshjkhjkhjkhjkhkjhkj";
value2.err = err;
value2.other = ["lakcshjkvhkjhjkhjkhjkhkhjkhkj"];
console.log(inspect(value2));

// Error(`message on several lines
// because`) {
//     toto: true
// }

const object = {};
const get = () => {
  return 10;
};
get.foo = "cosdhchsohuhiuhuihiuhiuhiuhiuhiuhiuhuihiu";
get.toot = "jiojiojojiojiojiojio";
object.get = get;
Object.defineProperty(object, "foo", {
  get,
  set: () => {},
  enumerable: true,
  configurable: false,
});
Object.preventExtensions(object);
console.log(inspect(object));

// {

//     "name": true
// }

const a = new Array(1000);
a.fill("toto");
console.log(inspect(a));

// const obj = {};
// const string = [...a].join("\n");
// obj.str = string;
// console.log(inspect(string));
