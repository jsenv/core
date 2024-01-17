import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize({});
  const expected = "{}";
  assert({ actual, expected });
}

{
  // eslint-disable-next-line no-new-object
  const actual = humanize(new Object({}));
  const expected = "{}";
  assert({ actual, expected });
}

{
  const actual = humanize({}, { objectConstructor: true });
  const expected = "Object({})";
  assert({ actual, expected });
}

{
  const actual = humanize(
    { foo: true },
    { objectConstructor: true, useNew: true },
  );
  const expected = `new Object({
  "foo": true
})`;
  assert({
    actual,
    expected,
  });
}

{
  const actual = humanize({ 0: "foo" });
  const expected = `{
  0: "foo"
}`;
  assert({ actual, expected });
}

{
  const actual = humanize({ Infinity: "foo" });
  const expected = `{
  "Infinity": "foo"
}`;
  assert({ actual, expected });
}

{
  const actual = humanize({ name: "dam" }, { quote: "'" });
  const expected = `{
  'name': 'dam'
}`;
  assert({ actual, expected });
}

{
  const actual = humanize(
    { foo: true, nested: { bar: true } },
    { parenthesis: true },
  );
  const expected = `({
  "foo": true,
  "nested": ({
    "bar": true
  })
})`;
  assert({ actual, expected });
}

{
  const foo = { foo: true, bar: false };

  const actual = humanize(foo);
  const expected = `{
  "foo": true,
  "bar": false
}`;
  assert({ actual, expected });
}

{
  const actual = humanize(
    Object.create({
      foo: true,
    }),
  );
  const expected = "{}";
  assert({ actual, expected });
}

{
  const nested = { foo: { name: "dam" } };
  const actual = humanize(nested);
  const expected = `{
  "foo": {
    "name": "dam"
  }
}`;
  assert({ actual, expected });
}

{
  const circularObject = {
    foo: true,
  };
  circularObject.self = circularObject;
  const actual = humanize(circularObject);
  const expected = `{
  "foo": true,
  "self": Symbol.for('circular')
}`;
  assert({ actual, expected });
}

{
  const nestedCircularObject = {
    foo: true,
  };
  nestedCircularObject.nested = {
    bar: true,
    parent: nestedCircularObject,
  };
  const actual = humanize(nestedCircularObject);
  const expected = `{
  "foo": true,
  "nested": {
    "bar": true,
    "parent": Symbol.for('circular')
  }
}`;
  assert({ actual, expected });
}

{
  const actual = humanize(Object.create(null));
  const expected = "{}";
  assert({ actual, expected });
}

{
  const object = Object.create(null);
  object[Symbol.toStringTag] = "stuff";
  const actual = humanize(object);
  const expected = `{
  [Symbol("Symbol.toStringTag")]: "stuff"
}`;
  assert({ actual, expected });
}

{
  const object = Object.create(null);
  object[Symbol.toStringTag] = "stuff";
  object.foo = true;
  const actual = humanize(object);
  const expected = `{
  "foo": true,
  [Symbol("Symbol.toStringTag")]: "stuff"
}`;
  assert({ actual, expected });
}

{
  const actual = humanize({ [Symbol()]: true });
  const expected = `{
  [Symbol()]: true
}`;
  assert({ actual, expected });
}
