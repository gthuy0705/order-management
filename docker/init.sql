-- Separate databases so integration tests can wipe data without touching dev data.
CREATE DATABASE orders_dev;
CREATE DATABASE orders_test;
