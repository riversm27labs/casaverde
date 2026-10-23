# Casa Verde — produção, atualização e recuperação

## Situação desta entrega

A aplicação está homologada localmente; **não foi criada uma implantação pública nesta execução**. Há sessão Vercel válida, mas o diretório não está vinculado a um projeto e nenhum destino Casa Verde foi identificado na listagem consultada do escopo atual. O Supabase CLI retornou `Invalid access token`. Não há `.env`, conexão PostgreSQL ou chaves de projeto configuradas no ambiente desta pasta.

Não foi tentada uma publicação estática que deixasse o backend sem banco persistente. Nenhum dado comercial local ou credencial local foi enviado aos provedores.

## 1. Versão e recuperação antes da implantação

O Git já continha todas as alterações de desenvolvimento, inclusive arquivos ainda não rastreados. Nada foi descartado ou sobrescrito por checkout/reset. O ponto de recuperação anterior às alterações de entrega está em:

`C:\dev\sitecasaverde\.tmp\recuperacao\pre-entrega-2026-10-22T21-55-15-965Z`

Contém `codigo/`, `repositorio.bundle`, `alteracoes.patch`, estado do Git, `dados-locais/` e `manifesto.json` com SHA-256. A cópia SQLite inclui o conteúdo do WAL por meio da API de backup, sem copiar um banco aberto de forma inconsistente. Integridade: `ok`. A conta local e seus arquivos foram preservados. A pasta pode conter dados privados: não publicar nem anexar em chamado público.

Copie esse ponto para armazenamento privado fora do computador. Uma cópia apenas no mesmo disco é um ponto de retorno, não proteção contra perda do equipamento.

## 2. Configurar o destino, sem copiar a base local

O proprietário deve identificar a conta/projeto Vercel, o projeto Supabase e o e-mail administrativo. Autentique novamente o Supabase no computador responsável. Não cole tokens ou senhas em conversas, documentação ou Git.

No Supabase de destino, revise e execute `supabase/001_schema.sql`. O script cria o schema `cv_casaverde`, as tabelas privadas `records` e `admins`, mantém RLS e cria os buckets privados `cv-images` e `cv-invoices`. Para outro nome de schema, o SQL e `STORE_SCHEMA` precisam coincidir. Não executar SQL em um projeto não confirmado.

Não importar `.data`, `account.json`, documentos fiscais ou registros locais para a hospedagem sem autorização específica. Uma instalação hospedada pode começar vazia; a autenticação local não deve ser copiada para substituir Supabase Auth.

Criar o usuário do proprietário no Supabase Auth com e-mail real confirmado e senha escolhida de forma privada. Usar o mesmo e-mail em `OWNER_EMAIL`. Desabilitar cadastro público. A aplicação usa a autenticação existente e não possui senha padrão nem cadastro público de administradores.

## 3. Variáveis no servidor

| Variável | Configuração necessária |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL/pooler do projeto escolhido, com permissão no schema da loja |
| `SUPABASE_URL` | URL HTTPS do mesmo projeto |
| `SUPABASE_ANON_KEY` | Chave pública para Supabase Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta exclusivamente no servidor, para Storage privado |
| `OWNER_EMAIL` | E-mail confirmado do proprietário no Auth |
| `STORE_SCHEMA` | `cv_casaverde`, ou o schema expressamente preparado |
| `PRODUCTION_URL` | Opcional para o verificador, somente após existir uma URL real |

Não usar prefixos de navegador para segredos. Não desativar TLS do PostgreSQL em produção. Configurar as variáveis nos ambientes corretos da Vercel; produção e homologação não devem usar tabelas comerciais de teste compartilhadas sem planejamento.

O runtime está fixado em Node.js `24.x`, a mesma família usada nesta homologação. Essa família é suportada pela Vercel e pode ser selecionada por `engines.node`. [Documentação oficial](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## 4. Verificação antes de publicar

Com os valores configurados em ambiente privado, executar:

```powershell
npm ci
npm test
npm run build
npm run verificar:producao
```

O último comando não cria tabelas, usuários, buckets ou registros. Verifica presença de configurações, runtime, recursos do PDF, conexão PostgreSQL quando disponível, schema/RLS, privacidade dos buckets e existência do proprietário confirmado. Não imprime valores de segredos. O relatório fica em `.tmp/homologacao/verificacao-producao.json`.

Há retorno de pendência enquanto faltarem configurações ou a homologação hospedada autenticada. Isso não significa que o fluxo local falhou. A checagem de um endpoint público por HTTPS também não aprova, sozinha, login, upload ou persistência.

O build existente gera `dist` e empacota `api/index.mjs`. `vercel.json` já mantém a API e inclui a logo e os recursos de fonte do PDFKit. A configuração `includeFiles` é o mecanismo oficial para incluir esses arquivos na função Node. [Documentação oficial](https://vercel.com/docs/project-configuration/vercel-json#functions).

`.vercelignore` exclui dados locais, backups, variáveis privadas, caches e dependências locais da origem enviada. Não trocar o deploy por um upload isolado de `dist`, pois isso perderia o backend.

Vincular a pasta ao projeto confirmado por meio do painel/CLI Vercel. Selecionar o projeto certo, revisar variáveis e criar primeiro a implantação de homologação. Publicar em produção somente após os testes hospedados e aprovação comercial.

## 5. Roteiro no ambiente realmente hospedado

Usar uma implantação de homologação com banco/schema isolado e dados identificados `HOMOLOGAÇÃO`. Registrar IDs criados. Não alterar uma tabela comercial de produção para testar preços fictícios.

1. Abrir a URL HTTPS e confirmar catálogo e demonstrações.
2. Entrar pelo formulário do proprietário/testador autorizado; confirmar APIs privadas sem sessão recusadas.
3. Cadastrar produto identificado, enviar foto, escolher categoria, calcular preço e publicar.
4. Abrir em janela sem sessão; conferir preço comercial, imagem, busca e carrinho.
5. Atualizar o preço e confirmar atualização pública e revalidação na solicitação.
6. Importar pequeno CSV de teste e XML fiscal de teste pelo painel, revisar e confirmar. Conferir que custos/documentos não se tornaram públicos.
7. Na base de homologação, salvar e publicar tabela identificada de serviços. Emitir orçamento, conferir itens, protocolo, PDF e registro administrativo.
8. Recusar acesso ao documento sem token ou sem autorização adequada.
9. Reimplantar a mesma versão sem substituir banco/Storage. Conferir imagem enviada, produtos, login, tabela, orçamento e PDF novamente.
10. Testar desktop e celular; confirmar domínio e certificado.
11. Remover somente os registros/objetos de teste pelos IDs anotados. Se o isolamento for um projeto/schema dedicado, conservar ou descartar apenas esse ambiente conforme autorização do responsável.

**Nenhum desses passos é declarado aprovado em produção nesta entrega.** Não há URL hospedada confirmada, credenciais de banco ou conta Auth de destino disponíveis. Os testes executados foram locais/isolados.

## 6. Domínio e HTTPS

O proprietário deve confirmar o domínio e acesso ao DNS. Adicionar o domínio ao projeto certo, aplicar os registros apresentados pelo próprio provedor e validar HTTPS. Não presumir endereço, titularidade ou certificado. A URL administrativa será a URL real seguida de `/admin`; login em `/login`.

## 7. Backup local operacional

Executar:

```powershell
npm run backup:local
```

O comando cria uma pasta nova em `.tmp/backups/`, com SQLite consistente, `account.json`, arquivos enviados e manifesto de integridade. Não sobrepõe uma pasta existente. Enquanto o backup acontece, evite novos uploads/importações para manter os objetos e o banco no mesmo momento comercial.

Depois copie a pasta para armazenamento privado externo e registre a data. O backup da credencial local é sensível. O JSON exportado pelo painel não substitui esse backup: ele não contém todos os arquivos nem todo o histórico técnico dos novos módulos.

Um backup real foi executado nesta entrega em:

`C:\dev\sitecasaverde\.tmp\backups\casa-verde-2026-10-22T22-00-11-507Z`

O teste automatizado de recuperação usa outro diretório temporário: cria banco em WAL, conta e foto de teste, gera backup, confere hashes e restaura em uma terceira pasta vazia. O diretório de teste é removido ao final. A base real não é restaurada por cima dela mesma.

## 8. Recuperação local

1. Parar o servidor antes de trocar diretório de dados.
2. Fazer uma cópia de segurança do estado atual, mesmo se estiver com problema.
3. Conferir manifesto e integridade da cópia escolhida.
4. Restaurar primeiro em uma **pasta nova e vazia**, incluindo banco, credencial e arquivos. Não misturar contas, `.sqlite`, WAL ou fotos de cópias diferentes.
5. Executar o código correspondente à cópia, com `DATA_DIR` apontando para a restauração e uma porta de teste. Não definir `DATABASE_URL` nesse teste local.
6. Conferir login com a senha legítima, catálogo, fotos, documentos e protocolos.
7. Somente depois da conferência, o responsável escolhe o diretório que entrará em operação. Preservar a pasta anterior até aprovação.

Para recuperar código, usar `codigo/` do ponto de retorno numa pasta separada; `repositorio.bundle` contém o histórico Git e `alteracoes.patch` documenta alterações rastreadas. Não usar `git reset --hard` para tentar recuperar dados comerciais: eles não pertencem ao Git.

## 9. Backup e recuperação hospedados

Configurar backups do PostgreSQL no projeto/plano contratado e cópia privada dos objetos `cv-images` e `cv-invoices`, respeitando o prefixo de schema da loja. Manter uma cópia de código, configuração de infraestrutura e procedimento de recuperação do Auth; os segredos devem ficar no cofre privado do responsável.

**O backup do banco Supabase não inclui os arquivos do Storage.** Ele inclui metadados, por isso fotos e documentos precisam de cópia própria. [Documentação oficial](https://supabase.com/docs/guides/platform/backups).

Para exportação lógica, o técnico pode usar Supabase CLI/`pg_dump` com conexão privada já configurada. Não colocar senha na linha de comando nem no Git. Uma exportação apenas de `cv_casaverde` não é um backup completo do Auth ou dos buckets.

Testar a recuperação em projeto/schema isolado, restaurar arquivos e validar referências antes de redirecionar a aplicação. Não reverter o banco em produção somente para voltar uma versão visual: uma restauração pode remover solicitações recebidas depois da cópia.

## 10. Atualização da versão

1. Guardar backup e ponto de recuperação.
2. Instalar dependências com `npm ci` e executar testes/build em cópia de homologação.
3. Localmente, atualizar apenas o código, preservando `.data` e configurações privadas; reiniciar o servidor.
4. Na Vercel, criar nova implantação do código mantendo PostgreSQL, buckets, schema e variáveis do projeto confirmado.
5. Executar o roteiro público/administrativo e de persistência. Se houver falha de código, voltar à implantação anterior; não apagar dados.
6. Registrar versão, responsável e resultado da conferência.

Não foram introduzidos pagamentos, frete automático, reserva transacional de estoque ou envio automático de WhatsApp nesta entrega.
