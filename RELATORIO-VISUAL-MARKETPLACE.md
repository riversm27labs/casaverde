# Correção visual: Casa Verde como loja virtual

Esta revisão substitui a composição institucional da home pela estrutura comercial solicitada. O projeto continua em `C:\dev\sitecasaverde`, com HTML/CSS/JavaScript existentes e o mesmo build Node. Este documento complementa o relatório anterior e substitui suas descrições visuais da home.

## Estrutura implementada

1. Barra discreta com nome da loja e informações configuradas; sem inventar contatos.
2. Cabeçalho branco com logo oficial, busca central funcional, atendimento e carrinho com ícone/contador. Conta de cliente omitida porque não há autenticação pública de clientes.
3. Menu horizontal de categorias reais e versão móvel expansível.
4. Banner compacto com chamada para o catálogo. Quando disponível, apresenta foto de produto publicado e elegível; quando não há produtos, usa a marca oficial. A imagem editorial de ferramentas foi retirada da home.
5. Categorias visuais clicáveis com fotos disponíveis no catálogo ou placeholder discreto.
6. Grade comercial branca com imagem, categoria, nome, preço de revenda, disponibilidade, botão direto de adicionar ao carrinho e link de detalhes.
7. Departamentos de vasos, plantas e jardinagem/acessórios derivados das categorias existentes. Ausentes quando não há produtos correspondentes; não foram criadas categorias para preencher a tela.
8. Serviços com acesso ao formulário e seleção automática do interesse.
9. Conteúdo institucional secundário, após os produtos e serviços.
10. Contato e rodapé com navegação, explicação da solicitação, informações reais configuradas e acesso administrativo.

Paleta aplicada: `#F7F3E9`, `#174B35`, `#28734A`, cartões brancos, bordas discretas e microinterações leves. Removido o CSS inline antigo e a dependência de fontes externas da home. Placeholders vetoriais incorporados na interface para produtos sem imagem ou imagens com falha, evitando depender do tipo MIME de SVG no servidor local.

## Integração e preservação

A loja usa o endpoint existente `GET /api/catalog` com seus parâmetros de paginação/filtros; detalhes em `/api/catalog/ID`, validação de preços em `/api/quote` e solicitações em `/api/inquiries`. Mantidas revalidação de preço/disponibilidade, quantidades inteiras, totais e envio idempotente já implementados.

Nenhum arquivo de backend ou persistência foi alterado nesta revisão. Hashes de `admin.html`, `admin.js`, `bulk.js`, `invoice.js`, `pricing.js`, `server/api.mjs`, `server/auth.mjs`, `server/runtime.mjs` e `server/pricing.mjs` foram comparados antes/depois e permaneceram iguais.

O processo que já estava na porta 5173 executava a versão antiga da API em memória. A captura real revelou ausência dos campos de paginação. Foi identificado e reiniciado somente o processo Node `server/local.mjs` da loja, preservando `.data`. A página real foi validada novamente após o reinício.

## Comparação visual

Antes: hero com altura mínima de 650 px, título de até 82 px, fotografia editorial como protagonista, busca abaixo do banner e serviços com grande destaque.

Depois: busca no cabeçalho, menu comercial, banner de aproximadamente 242 px no desktop e 187 px no celular de 390 px, categorias e vitrine logo em seguida. A vitrine começa aproximadamente em 661 px no desktop e 641 px no celular com o catálogo real vazio. O título principal é de 34 px no desktop e 24 px no celular. Serviços e instituição passam a ser conteúdo secundário.

Capturas anteriores preservadas em `.tmp/marketplace-before/`. Capturas reais novas em `.tmp/visual/marketplace-real-1440.png`, `marketplace-real-390.png` e `marketplace-real-320.png`; capturas da primeira tela usam o prefixo `marketplace-real-fold-`. Métricas em `.tmp/visual/marketplace-metrics.json`.

**O catálogo local real contém zero produtos publicados.** A página informa essa situação, sem adicionar produtos fictícios ao banco real. As capturas `marketplace-fixture-*` mostram a composição das vitrines usando apenas produtos de teste em banco temporário, removido ao término. Não são evidência de produtos disponíveis na Casa Verde.

## Validação

- `npm test`: 13 testes aprovados, incluindo regressões de autenticação, importação fiscal, privacidade, precificação, PostgreSQL, carrinho e solicitação.
- `npm run build`: aprovado.
- Chromium/Playwright: 1440×1000, 390×844 e 320×740. Busca, limpeza, categorias, ordenação de apresentação, departamentos, menu móvel, botão direto de adicionar, detalhes, quantidades, subtotais, total, remoção, bloqueio de esgotado e envio de solicitação com protocolo.
- Conferência de banner abaixo de 270 px, início da vitrine desktop antes de 850 px, ausência de rolagem horizontal e de exceções JavaScript.
- Captura do servidor real: sem imagens quebradas, sem exceções JavaScript e sem transbordamento nas três larguras.
- Verificação de fallback de imagem quebrada e mensagem/recarregamento após falha de rede no navegador.
- `node --check storefront.js` e `git diff --check`: executados. O projeto não possui comando de lint ou TypeScript.

## Arquivos desta revisão

Modificados:

- `store.html` — nova estrutura comercial, cabeçalho, filtros, serviços, rodapé e carrinho.
- `public/storefront.css` — substituição do visual institucional pelo layout de loja.
- `storefront.js` — cartões comerciais, compra direta, categorias, departamentos e tratamento de falhas, preservando a integração existente.
- `scripts/test-storefront-browser.mjs` — regressão visual/funcional em três larguras e banco temporário.

Criados:

- `scripts/capture-storefront.mjs` — captura da loja real e métricas sem alterar dados.
- `RELATORIO-VISUAL-MARKETPLACE.md` — este relatório.

Os demais arquivos que já apareciam alterados no Git pertencem à etapa anterior; foram preservados nesta revisão.

## Execução e limites

`npm run dev` em `C:\dev\sitecasaverde`; abrir `http://localhost:5173`. Administração em `/admin`, login em `/login`. Validar com `npm test` e `npm run build`.

Playwright requer uma instalação disponível. Nesta máquina: definir `PLAYWRIGHT_MODULE=C:\dev\olimpiadasfacil-main-BACKUP\node_modules\playwright` e executar `node scripts/test-storefront-browser.mjs`. Para capturar o servidor real em execução: `node scripts/capture-storefront.mjs`.

Sem pagamento online, reserva transacional de estoque ou frete automático: o carrinho envia solicitação comercial pendente. Isso é explícito na vitrine, no carrinho e no formulário. As fotos e os produtos reais devem ser publicados pelo administrativo existente para preencher as vitrines. Nenhum telefone, endereço ou política comercial foi inventado.
