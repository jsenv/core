1. console.log
```console
start
```

2. return promise

3. console.info
```console
timeout done
```

4. console.warn
```console
a warning after 2nd timeout
```

5. console.warn
```console
and an other warning
```

6. write file "@jsenv/core/packages/independent/snapshot/tests/function_side_effects_snapshot/basic/toto.txt"
```txt
toto
```

7. reject
```undefined
Error: in the end we throw
  at @jsenv/core/packages/independent/snapshot/tests/function_side_effects_snapshot/basic/function_side_effects_snapshot_basic.test.mjs:83:11
  at async startTesting (@jsenv/core/packages/independent/snapshot/tests/function_side_effects_snapshot/basic/function_side_effects_snapshot_basic.test.mjs:32:5)
  at async @jsenv/core/packages/independent/snapshot/tests/function_side_effects_snapshot/basic/function_side_effects_snapshot_basic.test.mjs:41:1
```