-- Verify appschema on pg

SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'appschema';
