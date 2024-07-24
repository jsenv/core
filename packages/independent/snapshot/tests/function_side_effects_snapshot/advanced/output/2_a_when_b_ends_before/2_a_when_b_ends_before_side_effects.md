1. console.log
```console
a_before_timeout_200
```

2. return promise

3. console.warn
```console
collectFunctionSideEffects called while other function(s) side effects are collected
```

4. console.log
```console
b_before_timeout_50
```

5. console.log
```console
b_after_timeout_50
```

6. write file "output/3_b_when_b_ends_before/3_b_when_b_ends_before_side_effects.md"
```md
1. console.warn
```console
collectFunctionSideEffects called while other function(s) side effects are collected
```

2. console.log
```console
b_before_timeout_50
```

3. return promise

4. console.log
```console
b_after_timeout_50
```

5. resolve
```js
undefined
```
```

7. console.log
```console
a_after_timeout_200
```

8. resolve
```js
undefined
```