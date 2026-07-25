-- Verify orders on pg

SELECT id, user_id, total, placed_at FROM appschema.orders WHERE FALSE;
