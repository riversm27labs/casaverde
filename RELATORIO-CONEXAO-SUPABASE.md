# Conexão Supabase — 22/10/2026

## Revisão da URI e preparação privada

O `.env` agora existe, mas a verificação encontrou `DATABASE_URL` e as credenciais relacionadas vazias. Foram preparados `STORE_SCHEMA=cv_casaverde` e `DATABASE_SSL=require`, sem preencher ou inventar segredos. A versão anterior do `.env` foi preservada em arquivo privado dentro de `.tmp`; ambos os caminhos estão ignorados pelo Git.

O comando `npm start` lê `.env` por `--env-file-if-exists=.env`. `server/runtime.mjs` lê `process.env.DATABASE_URL`, usa o cliente `postgres` com `prepare:false` e TLS por padrão. A inicialização completa também exige `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `OWNER_EMAIL`.

A combinação de host direto `db.…supabase.co` com porta `6543` não corresponde às modalidades padrão documentadas. No painel do projeto **Central de Sites**, abrir **Connect**, selecionar **Session pooler** e copiar a URI completa, incluindo o usuário próprio dessa modalidade. Session pooler usa host `…pooler.supabase.com` e porta `5432`; conexão direta usa host `db.…supabase.co` e porta `5432`; Transaction pooler usa host de pooler e porta `6543`. Não deduzir região nem corrigir apenas a porta de uma URI misturada. A senha deve estar corretamente codificada para uso em URI.

Fonte: https://supabase.com/docs/guides/database/connecting-to-postgres

Foi preparado o diagnóstico local privado `.tmp/validar-postgresql.mjs`, restrito a transação `READ ONLY`, sem mostrar URI nem mensagens brutas potencialmente sensíveis. Ele verifica schema, tabelas `records` e `admins`, RLS, índice, privilégios efetivos, capacidade de leitura sem retornar registros e acesso potencial a tabelas de outras lojas pela identidade usada. Nenhuma migração ou alteração de permissões é feita.

Execução mais recente: `PENDENTE: DATABASE_URL ausente ou vazia. Nenhuma conexão tentada.` Portanto **POSTGRESQL CONECTADO ainda não pode ser declarado**. Schema real, tabelas, RLS e permissões continuam pendentes de validação. O SQLite e os backups não foram alterados nesta revisão. Sem deploy e sem migração de dados.

## Situação

| Item | Resultado |
| --- | --- |
| Backup local | APROVADO: `.tmp/backups/casa-verde-2026-10-22T22-32-15-248Z`; integridade SQLite `ok`; banco e conta preservados. |
| Conexão PostgreSQL real | PENDENTE DE CONFIGURAÇÃO: `DATABASE_URL` ausente. |
| Schema correto | Backend usa `cv_casaverde` por padrão; existência no servidor ainda não confirmada. |
| Permissões e isolamento entre lojas | PENDENTES: sem conexão não é possível verificar a identidade do backend e seus privilégios efetivos. |
| Leitura e escrita remotas | PENDENTES. Escrita de teste depende também de autorização para o ambiente identificado. |
| Persistência após reinício | PENDENTE no Supabase. |
| Storage | PENDENTE: buckets privados e permissões ainda não consultados no servidor. |
| Funcionalidades afetadas | Nenhuma alteração no código funcional; integração remota ainda não validada. |

## Configuração necessária

Não existe `.env` nesta aplicação. No ambiente do processo também estão ausentes as configurações necessárias. A configuração local encontrada no Hub R2 Sites contém somente URL e chave pública do Supabase; não contém conexão PostgreSQL nem credencial privada de Storage.

Configurar privadamente no `.env` da Casa Verde: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL` e `STORE_SCHEMA=cv_casaverde`. Não enviar credenciais em conversas, relatórios ou Git. Usar credenciais do mesmo projeto e identidade PostgreSQL com privilégios restritos à Casa Verde. O backend já exige TLS por padrão; não definir `DATABASE_SSL=false`.

Depois da configuração: consultar schema, tabelas, índice, RLS, buckets e privilégios efetivos sem recriar estruturas. Qualquer correção de permissões será apresentada para aprovação antes da execução. Não foi executado `001_schema.sql`.

## Validações executadas

- `npm run backup:local`: aprovado.
- `npm run verificar:producao`: executado; configurações ausentes, sem conexão remota. O teste de nome do schema é estático e não comprova isolamento por permissões.
- `npm test`: 18 aprovados, zero falhas, na execução fora do sandbox. A primeira execução restrita ficou parada e foi interrompida.
- `npm run build`: aprovado após a suíte. A primeira execução simultânea disputou `dist` com o teste HTTP; repetida sequencialmente com sucesso.

Os testes de produtos, preços, catálogos, notas fiscais, orçamentos, configurações e privacidade usam dados temporários, SQLite e PostgreSQL embarcado PGlite, conforme cada teste; não comprovam a integração com o Supabase real. O aviso de cadastro público emitido pela suíte pertence ao Auth simulado, não é diagnóstico do projeto Supabase real.

Nenhum dado SQLite foi importado. Nenhuma escrita remota, alteração de permissões, migração ou implantação Vercel foi realizada. Nenhuma credencial foi copiada ou exibida. Arquivo criado nesta tarefa: este relatório; saídas geradas de backup, verificador e build permanecem nos diretórios locais correspondentes.
