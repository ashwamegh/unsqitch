-- Deploy orders to pg
-- Requires: users

CREATE TABLE appschema.orders (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES appschema.users (id),
    total      NUMERIC(10, 2) NOT NULL DEFAULT 0,
    placed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
