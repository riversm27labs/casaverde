-- Execute no SQL Editor do Supabase, uma vez por loja.
-- Para outra loja, substitua cv_casaverde pelo mesmo STORE_SCHEMA do servidor.
BEGIN;
CREATE SCHEMA IF NOT EXISTS cv_casaverde;
REVOKE ALL ON SCHEMA cv_casaverde FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS cv_casaverde.records(id text PRIMARY KEY,kind text NOT NULL,data text NOT NULL,created bigint NOT NULL);
CREATE INDEX IF NOT EXISTS records_kind_idx ON cv_casaverde.records(kind);
CREATE TABLE IF NOT EXISTS cv_casaverde.admins(email text PRIMARY KEY,user_id text);
ALTER TABLE cv_casaverde.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_casaverde.admins ENABLE ROW LEVEL SECURITY;
-- Sem políticas públicas: somente o backend conecta via DATABASE_URL.
REVOKE ALL ON ALL TABLES IN SCHEMA cv_casaverde FROM PUBLIC,anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('cv-images','cv-images',false,16000000),('cv-invoices','cv-invoices',false,16000000) ON CONFLICT(id) DO NOTHING;
COMMIT;
