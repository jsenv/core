# Warning beefore adding a new package

Creating many small packages is great to split code and make it reusable elswhere.

But don't go crazy creating too much of them because each package creates more indirection than having code directly into @jsenv/core.

Lots of package can create the sentiment of being overhelmed or that things are complex.

See also

"Moving many repository back to this GitHub repository feels tempting but should be reserved to a subset of repositories.
For example if we move back @jsenv/import-node-module it means we should also move the performance impact script back into this one. In the end too many information in a single place would cause overhead on several levels.
However for smaller repositories or where external usage is anecdotic or deeply connected to jsenv it would make sense to move them back here."
