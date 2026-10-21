# Casa Verde — aplicação independente

Esta versão tem loja, painel e login próprios. Não usa hospedagem, login ou banco do ChatGPT.

## Windows: iniciar com dois cliques
1. Extraia o conteúdo do ZIP em `C:\dev\sitecasaverde`. O package.json deve ficar diretamente nessa pasta.
2. Instale Node.js 22.13 ou superior (recomendado: Node.js 24 LTS).
3. Dê dois cliques em **INICIAR-CASA-VERDE.bat**. Deixe a janela aberta.
4. Abra http://localhost:5173 e clique em Administrar loja.
5. No primeiro acesso, crie sua senha (mínimo de 10 caracteres).

O modo local funciona SEM npm install, internet para o backend ou Supabase. O navegador pode precisar de internet para fontes e fotos ilustrativas externas. Fotos de produtos enviados ficam no computador.

**Dados reais locais:** banco SQLite e fotos ficam na pasta `.data`. Faça backup dela inteira; ela não deve ir ao GitHub. Para acessar em outro dispositivo, publique na Vercel com Supabase. Não exponha o servidor local à internet.

O modo local usa um administrador. Na versão Supabase, o proprietário pode autorizar outros e-mails cadastrados no Supabase Auth em Configurações. Não há senha padrão.

## Publicar na Vercel com Supabase
1. Crie ou use um projeto Supabase.
2. Execute `supabase/001_schema.sql` no SQL Editor. O script cria um schema privado específico da loja e buckets privados. Não altera as tabelas do hub existente.
3. Em Supabase Auth, crie o usuário proprietário com e-mail e senha. Use o mesmo e-mail em OWNER_EMAIL. O painel não permite cadastro público de administradores.
4. No GitHub, crie um repositório para esta pasta. Nunca envie `.env`, `.data`, `node_modules` ou credenciais.
5. Importe o repositório na Vercel. Framework: Other. O vercel.json já define build, diretório dist e função API.
6. Nas variáveis da Vercel, configure:
   - DATABASE_URL: conexão PostgreSQL do Supabase, preferencialmente pooler, disponível no botão Connect. Use o usuário e senha de banco da sua conta.
   - SUPABASE_URL: URL do projeto.
   - SUPABASE_ANON_KEY: chave pública usada para autenticação.
   - SUPABASE_SERVICE_ROLE_KEY: chave secreta de servidor, usada somente pelo backend para arquivos privados.
   - OWNER_EMAIL: e-mail do proprietário cadastrado no Auth.
   - STORE_SCHEMA: cv_casaverde (igual ao SQL).
7. Publique. Acesse /login e entre com o usuário do Supabase.

NUNCA coloque as chaves secretas em variáveis com prefixo VITE_ ou NEXT_PUBLIC_. O navegador recebe apenas uma sessão HttpOnly e não recebe a chave administrativa nem a senha do banco. O backend valida a sessão no Supabase Auth a cada chamada protegida. Quando o token expirar, faça login novamente.

Sem credenciais reais, não existe conexão automática à sua conta. O ZIP inclui a implementação e o SQL; provisionamento e teste na sua Vercel/Supabase precisam dessas configurações externas.

## Fotos e notas
Fotos e documentos têm limite de 4 MB por arquivo para compatibilidade com a função Vercel. Comprima documentos maiores. XML é a melhor opção para NF-e. PDF e foto usam leitura assistida no navegador; revise os dados reconhecidos antes de aplicar. Documentos permanecem privados. A quantidade recebida representa entradas de notas, não um estoque completo com baixas por venda.

## Novas lojas e hub R2TI
Você pode reutilizar o projeto por loja. Cada implantação tem STORE_SCHEMA próprio, por exemplo cv_materiais, e OWNER_EMAIL próprio. Copie o SQL e substitua cv_casaverde pelo schema correspondente. Os arquivos recebem o prefixo do schema. Configure o nome, textos, categorias e contatos no painel; a logo está em public/brand/casa-verde.png e as cores no final do CSS de store.html/admin.html.

No hub existente https://r2sites.vercel.app, cadastre o endereço da implantação e o acesso administrativo `<endereço>/admin`. Isso fornece acesso à loja a partir do hub. **A gestão unificada de todas as lojas dentro das telas do hub ainda não está implementada neste repositório**; o hub é um projeto separado. Este pacote funciona por conta própria, com painel completo por loja.

A separação do banco é feita no servidor por schema, não por um filtro de frontend. As tabelas privadas têm RLS ativada e nenhuma permissão para anon/authenticated. A conexão de servidor usa uma credencial privilegiada; trate o proprietário da infraestrutura como administrador das lojas que a compartilham. Para isolamento de credenciais entre clientes, use projetos Supabase separados.

## Estrutura
- store.html/store.js: loja pública aprovada.
- admin.html/admin.js: painel, publicação rápida e CRUD.
- bulk.js: importação de catálogo.
- invoice.js: XML, PDF, OCR e revisão de notas.
- pricing.js: interface de cálculo.
- login.html: acesso e configuração inicial local.
- server/: APIs, autenticação, banco e armazenamento.
- api/index.mjs: entrada da função Vercel.
- public/: logo e bibliotecas locais de PDF/OCR.
- supabase/: estrutura SQL para produção.
- scripts/build.mjs: gera páginas completas em dist.
- tests/: testes locais, PostgreSQL e cálculos.

## Comandos opcionais
- npm install: instala o cliente PostgreSQL e dependências de teste.
- npm start: inicia a loja local.
- npm run build: gera dist.
- npm test: executa verificações automatizadas (após npm install).

O projeto local foi validado com testes de API, login, arquivos, notas, preços e SQL PostgreSQL em PGlite. Não foi realizado deploy em uma conta Vercel/Supabase sua nem teste visual automatizado em navegador Windows. Não há dados de clientes ou credenciais no ZIP.

## Backup e manutenção
Faça backup da pasta .data no modo local e configure backups do banco e Storage no modo hospedado. Não substitua dados locais ao atualizar o código. Antes de importar cadastros reais de outra hospedagem, exporte-os: os registros existentes do site ChatGPT não foram copiados automaticamente para este pacote.
