import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize({});
  const expect = "{}";
  assert({ actual, expect });
}

{
  // eslint-disable-next-line no-new-object
  const actual = humanize(new Object({}));
  const expect = "{}";
  assert({ actual, expect });
}

{
  const actual = humanize({}, { objectConstructor: true });
  const expect = "Object({})";
  assert({ actual, expect });
}

{
  const actual = humanize(
    { foo: true },
    { objectConstructor: true, useNew: true },
  );
  const expect = `new Object({
  "foo": true
})`;
  assert({
    actual,
    expect,
  });
}

{
  const actual = humanize({ 0: "foo" });
  const expect = `{
  0: "foo"
}`;
  assert({ actual, expect });
}

{
  const actual = humanize({ Infinity: "foo" });
  const expect = `{
  "Infinity": "foo"
}`;
  assert({ actual, expect });
}

{
  const actual = humanize({ name: "dam" }, { quote: "'" });
  const expect = `{
  'name': 'dam'
}`;
  assert({ actual, expect });
}

{
  const actual = humanize(
    { foo: true, nested: { bar: true } },
    { parenthesis: true },
  );
  const expect = `({
  "foo": true,
  "nested": ({
    "bar": true
  })
})`;
  assert({ actual, expect });
}

{
  const foo = { foo: true, bar: false };

  const actual = humanize(foo);
  const expect = `{
  "foo": true,
  "bar": false
}`;
  assert({ actual, expect });
}

{
  const actual = humanize(
    Object.create({
      foo: true,
    }),
  );
  const expect = "{}";
  assert({ actual, expect });
}

{
  const nested = { foo: { name: "dam" } };
  const actual = humanize(nested);
  const expect = `{
  "foo": {
    "name": "dam"
  }
}`;
  assert({ actual, expect });
}

{
  const circularObject = {
    foo: true,
  };
  circularObject.self = circularObject;
  const actual = humanize(circularObject);
  const expect = `{
  "foo": true,
  "self": Symbol.for('circular')
}`;
  assert({ actual, expect });
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
  const expect = `{
  "foo": true,
  "nested": {
    "bar": true,
    "parent": Symbol.for('circular')
  }
}`;
  assert({ actual, expect });
}

{
  const actual = humanize(Object.create(null));
  const expect = "{}";
  assert({ actual, expect });
}

{
  const object = Object.create(null);
  object[Symbol.toStringTag] = "stuff";
  const actual = humanize(object);
  const expect = `{
  [Symbol("Symbol.toStringTag")]: "stuff"
}`;
  assert({ actual, expect });
}

{
  const object = Object.create(null);
  object[Symbol.toStringTag] = "stuff";
  object.foo = true;
  const actual = humanize(object);
  const expect = `{
  "foo": true,
  [Symbol("Symbol.toStringTag")]: "stuff"
}`;
  assert({ actual, expect });
}

{
  const actual = humanize({ [Symbol()]: true });
  const expect = `{
  [Symbol()]: true
}`;
  assert({ actual, expect });
}
