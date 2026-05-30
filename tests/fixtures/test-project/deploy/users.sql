-- Deploy users to pg
-- Requires: appschema

CREATE TABLE appschema.users (
    id    BIGSERIAL PRIMARY KEY,
    name  TEXT NOT NULL
);
