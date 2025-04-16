# Why merge

As stated this repository will merge pull request to analyse its impact. This explains why it's needed.

To know impacts of a pull request changes on a given branch, these changes must be on the branch. To understand why we will simulate what happens starting from a git tree where:

- There is a `master` branch
- `me` branch is one commit ahead of `master`
- `other` branch is one commit ahead of `master`
- A pull request wants to merge `me` into `master`

> In upcoming "schemas", a capital letter represent a commit.

## Initial git tree

```txt
   ┌───D─── other (A+D)
   │
───A─────── master (A)
   │
   └───B─── me (A+B)
```

Now `other` gets merged into master

## Git tree after merging other branch

```txt
   ┌───D───┐ other (A+D)
   │       │
───A───────D─── master (A+D)
   │
   └───B──── me (A+B)
```

Now we push a commit to `me`

## Git tree after pushing into me branch

```txt
   ┌───D───┐ other (A+D)
   │       │
───A───────D─── master (A+D)
   │
   └───B───E─── me (A+B+E)
```

In this state:

- `me` is 1 commit behind `master` and 2 commits ahead
  > Pull request wants to merge `B,E` and does not contain `D`.
- merging pull request means adding `B+E` into `master`. Master would become `A+D+B+E`.
  > Depending how pull request gets merged order may differ but that's not important for this demonstration.

To compute the actual impact of merging `me` into `master` we must simulate the merge. Let's create a `merge` branch with this state.

## Git tree after creating merge branch

```txt
   ┌───D───┐ other (A+D)
   │       │
───A───────D──── master (A+D)
   │       │
   │       └───┬─── merge (A+D+B+E)
   │           │
   └───B───E───┘ me (A+B+E)
```

If `D` changes overlaps with `E` changes, impact is analysed after these changes are merged.

Moreover `D` changes that are not in `B` or `E` are ignored thanks to diff between `merge` and `master`.

```
merge = A+D+B+E
master = A+D
merge - master = B+E
```
