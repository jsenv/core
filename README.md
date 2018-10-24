# dev-server

TODO

[] update coverageMap to make it compatible with node and chromium executors

[] think how we are going to handle file change while coverage is being collected
I would go for cancel what we are doing then restart frim the beginning
but it means cancel must resolve the promise to something and
we must be able to cleanup everything
and we must enable file watching without hotreloading
we will watch file but instead of hotreloading we'll cancel and reluanch coverage collect

[] update chromium client to make it work with coverage
keep in mind that chromium client will become external so we'll tell him
how to run the files

[] coverage with a file using output resolving async so that coverage awaits
that we are done with running the files
