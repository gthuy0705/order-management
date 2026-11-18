-- Separate databases so tests can wipe data without touching dev data:
-- orders_test is TRUNCATEd by integration tests, orders_e2e is used by the
-- Playwright server, so both suites can run at the same time.
-- (Only runs on an empty volume; `prisma migrate deploy` also creates a
-- missing database, so an existing volume needs no reset.)
CREATE DATABASE orders_dev;
CREATE DATABASE orders_test;
CREATE DATABASE orders_e2e;
