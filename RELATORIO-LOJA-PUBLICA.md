# Reformulação da loja pública — Casa Verde

## Arquitetura e diagnóstico

Projeto existente em `C:\dev\sitecasaverde`, sem alterações preexistentes no Git ao iniciar. HTML/CSS/JavaScript sem framework; Node >=22.13. Backend com SQLite local (`.data`) ou PostgreSQL/Supabase em hospedagem. O build incorpora JavaScript nas páginas e copia `public` para `dist`. Não foram criados banco, autenticação ou painel paralelos.

Produtos, projetos, configurações e solicitações usam a tabela genérica `records`. Autenticação local com senha e cookie HttpOnly; modo hospedado com Supabase Auth e renovação de sessão. O handler remove cabeçalhos de identidade enviados pelo cliente. Administração depende de identidade autorizada no servidor. SQL hospedado mantém schema privado e RLS. Nenhum schema ou política foi alterado.

Catálogo e notas são tratados por `bulk.js`, `invoice.js`, `server/catalog-parser.mjs`, `server/invoice-parser.mjs` e `server/invoice-api.mjs`; preços por `pricing.js` e `server/pricing.mjs`. A vitrine usa exclusivamente `price`, inclusive o resultado comercial salvo pela precificação. Custos, fornecedores, notas e margens não entram nos novos DTOs públicos.

Não há pagamentos, pedidos, autenticação de clientes, cálculo de frete ou estoque com baixas de venda. `quantityReceived` é entrada fiscal, não saldo vendável. Existe disponibilidade textual e fluxo administrativo de solicitações; a implementação reutiliza esse fluxo, sem apresentar orçamento como compra paga.

## Implementação

- Layout creme/verde com logo oficial, cartões, banner ilustrativo, menu móvel, foco acessível, estados vazios/erro/carregamento e movimento reduzido.
- Imagem editorial já utilizada pelo projeto copiada de sua URL Unsplash para `public/brand/gardening-editorial.jpg`, evitando dependência externa do banner. É identificada como ilustrativa e nunca usada como foto de produto. Substituição editorial deve preservar a atribuição/licenciamento aplicável ao ativo original.
- Catálogo real com 12 itens por página, busca por nome/descrição, categorias de produtos publicados, faixa de preço, ordenação crescente/decrescente e destaques/novidades. Consultas parametrizadas, sem enviar todo o catálogo ao navegador. O endpoint legado permanece por compatibilidade.
- Detalhes com galeria, descrição, dimensões, material, disponibilidade, quantidade e link compartilhável `/#produto/ID`. A apresentação é um diálogo acessível via URL, não uma rota HTML separada.
- Carrinho persistido localmente com quantidades inteiras, remoção, subtotal e total. Produtos e preços são consultados novamente no servidor; erros de disponibilidade bloqueiam o envio. Alteração de preço exige nova revisão do carrinho.
- Solicitação comercial com identificação, telefone, interesse, localização, descrição e resumo dos itens; registro no administrativo existente, protocolo completo e status pendente de avaliação. Entrega/pagamento são combinados no atendimento, sem frete ou aprovação fictícios.
- Validação de origem, campos, preço positivo, publicação, disponibilidade, duplicação de itens e quantidades no servidor. Identificador idempotente reutilizado nas tentativas da mesma sessão do formulário; inserção com conflito não sobrescreve registros.
- Contatos, endereço, horários e Instagram vêm das configurações. Nenhum dado oficial foi inventado. Serviços foram mantidos dentro do conteúdo já existente; não foram inventadas modalidades ou preços.

## Arquivos

Modificados: `.gitignore`, `store.html`, `scripts/build.mjs`, `server/api.mjs`.

Criados: `storefront.js`, `public/storefront.css`, `public/brand/gardening-editorial.jpg`, `tests/storefront.test.mjs`, `scripts/test-storefront-browser.mjs`, este relatório.

`store.js` antigo permanece preservado, mas o build da loja passa a usar `storefront.js`. Arquivos administrativos, importadores, fórmula de preços, autenticação, configurações privadas e SQL de implantação permanecem inalterados.

## Validação

Baseline: build passou; 10 testes passaram e 1 falhou por ausência de `@electric-sql/pglite`. `npm install` instalou as dependências declaradas, sem mudar dependências principais.

Após a implementação, `npm test`: 13 testes aprovados, incluindo autenticação, renovação de sessão, CSRF, isolamento, privacidade, importação fiscal, precificação, PostgreSQL/PGlite, paginação, filtros, preço alterado, produto sem imagem, rejeição de produto inativo/esgotado/sem preço, quantidades inválidas, valor adulterado, cliente inválido e idempotência. Teste SQL adicional confirma a consulta de publicação/paginação no PostgreSQL.

`npm run build`: aprovado. `node --check storefront.js` e `node --check server/api.mjs`: aprovados. Não há scripts de lint ou TypeScript neste projeto.

Teste Chromium em 1440×1000 e 390×844: busca/limpeza, menu móvel, produto, adicionar, alterar quantidade, total, finalizar solicitação, protocolo pendente, carrinho vazio, remoção, ausência de erros de JavaScript e de rolagem horizontal. Banco temporário e produtos artificiais exclusivos dos testes; nenhum cadastro de demonstração foi adicionado ao banco de trabalho. Capturas locais em `.tmp/visual` (ignoradas pelo Git).

## Execução e rotas

`npm install`, `npm run dev`; abrir `http://localhost:5173`. Build: `npm run build`; testes: `npm test`.

Público: `/`, `/#colecao`, `/#produto/ID`, `/#jardins`, `/#trabalhos`, `/#contato`. Administração: `/admin`, `/login`; APIs administrativas exigem sessão, mesmo que o HTML do painel seja acessível publicamente.

Novas capacidades API: `GET /api/catalog?page=1&q=&category=&min=&max=&sort=menor|maior`, `GET /api/catalog/ID`, `POST /api/quote`, validação reforçada em `POST /api/inquiries`.

Teste visual requer Playwright instalado e Chromium disponível. Executar `node scripts/test-storefront-browser.mjs`, ou definir `PLAYWRIGHT_MODULE` para uma instalação local existente. Nesta máquina foi reutilizada a instalação de `C:\dev\olimpiadasfacil-main-BACKUP\node_modules\playwright`, sem adicionar dependência ao aplicativo.

## Pendências e limites

Não declarar pronto para produção com venda e pagamento automáticos. É necessário aprovar regras de entrega/retirada e escolher/configurar provedor de pagamento, criar gestão transacional de pedidos, estoque de venda/reservas e webhooks verificados. Essas capacidades não existiam e exigem desenho compatível e credenciais externas.

A solicitação confirma somente o recebimento; não reserva estoque nem confirma compra, prazo ou pagamento. Não há acompanhamento público autenticado ou upload de fotos de orçamento; anexos fiscais existentes continuam privados. Os identificadores idempotentes são mantidos durante as tentativas no formulário aberto, não sobrevivem a recarregamento completo.

Supabase/Vercel reais, e-mails, meios de pagamento e dispositivos físicos Android/iOS não foram testados: não há credenciais/dispositivos fornecidos. PostgreSQL foi validado em PGlite, autenticação hospedada pelos testes existentes com provedor simulado. Rever configuração de cadastro público do Supabase antes da publicação; a suíte detecta e alerta sobre configuração insegura simulada.

Não há políticas legais, CNPJ ou condições comerciais aprovadas no cadastro; não foram inventados textos jurídicos. Fontes externas têm fallback local do sistema. O endpoint legado ainda suporta catálogo integral para compatibilidade, embora a nova loja só utilize paginação. As consultas JSON funcionam no banco atual; volumes altos exigirão medição e eventual indexação, não introduzida sem evidência.
