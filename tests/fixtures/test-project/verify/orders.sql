BEGIN;

SELECT id, user_id, total, placed_at FROM orders WHERE false;

COMMIT;
