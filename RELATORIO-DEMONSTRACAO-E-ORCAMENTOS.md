# Casa Verde — vitrine demonstrativa e orçamentos de serviços

## Resultado na aplicação

A loja em `http://localhost:5173/` apresenta quatro vasos decorativos e quatro plantas ornamentais demonstrativos. Os itens reais continuam vindo do catálogo administrativo e têm prioridade. A demonstração não possui preço ou estoque e não permite compra.

O módulo público fica em `/#orcamento-servicos`. O painel existente ganhou a aba **Orçamentos de Serviços**, sem criar uma segunda administração. As regras e os orçamentos usam a tabela `records` já existente, sem alteração de schema ou de RLS.

**Na base real local não foram publicados preços de serviços.** Não há tabela comercial ativa nem valores inventados. Até a empresa cadastrar e publicar suas regras, o formulário recebe solicitações de avaliação técnica, com protocolo e PDF sem total fabricado. Os valores vistos nas capturas de cálculo pertencem exclusivamente aos testes em banco temporário.

## Etapa 1: modelos demonstrativos

Modelos: Vaso Canelado Marfim, Vaso Terracota Natural, Vaso Cilíndrico Sálvia, Vaso Orgânico Areia, Costela-de-adão, Zamioculca, Espada-de-são-jorge e Jiboia Verde.

As oito imagens foram geradas individualmente pela ferramenta integrada `image_gen`, seguindo a skill `imagegen`, para catálogo ilustrativo: objetos centralizados, fundo creme, iluminação suave, sem marcas ou textos. Não foram utilizadas fotografias de terceiros nem representações como produto real disponível.

Arquivos finais em `public/demo/*.png`; catálogo separado em `public/demo/catalog.json`; ferramenta, finalidade e conjunto de prompts em `public/demo/provenance.json`. Cada cartão e cada detalhe informa **DEMONSTRAÇÃO — NÃO DISPONÍVEL PARA COMPRA**. Não há preços fictícios.

Há um controle individual “Exibir vitrine demonstrativa”, persistido no navegador, e um controle global em **Configurações**, persistido no banco. O controle global prevalece. Produtos reais são apresentados primeiro; a demonstração fica em seção separada quando existem resultados reais.

Validação da etapa antes de avançar: 13 testes existentes aprovados, build aprovado, Chromium desktop e celular, oito imagens carregadas, detalhes sem botão de compra, ocultação persistente após recarregar e catálogo real comparado antes/depois sem alterações. A suíte final também verifica quantidade de modelos, quatro por categoria, arquivos PNG locais de pelo menos 512 px e documentação da origem.

## Etapa 2: motor e administração

Configuração por formulários, sem editar código:

- Serviços, descrição, publicação e exigência de vistoria.
- Preço-base, preço por m², faixas de área e mínimo do serviço.
- Materiais e adicionais, unidade, quantidade fixa ou multiplicada pela área.
- Multiplicadores de básico/intermediário/premium e de frequência.
- Regiões com deslocamento e descontos expressamente autorizados.
- Validade, condições de pagamento e observações.

Campos em branco não são tratados como zero. É preciso informar explicitamente zero quando a empresa realmente não cobra um componente. Serviços sem regras suficientes seguem para avaliação. Os preços em rascunho não entram no cálculo público.

Ao publicar, uma versão imutável é criada. Cada orçamento guarda o identificador e uma cópia integral das regras usadas, preços, quantidades, itens, validade, condições, cliente e histórico. Publicar uma tabela nova não modifica os valores dos orçamentos antigos. Uma revisão gera outro registro e preserva o original.

Fórmula documentada na administração: `(base + área × preço por m²) × nível × frequência`, respeitando o mínimo da execução; depois materiais, adicionais e deslocamento. Desconto autorizado incide no subtotal. A faixa define o preço por m² para a área total, não uma cobrança progressiva. Área acima da última faixa cadastrada exige avaliação. Valores são arredondados em centavos e há limite para cálculo automático de projetos muito grandes.

O navegador envia identificadores e quantidades. O servidor seleciona as regras publicadas e calcula os valores; preços e percentuais enviados pelo cliente não são utilizados. A versão apresentada é conferida na emissão. Há chave idempotente, proteção de origem, validação de dados/quantidades, limite de solicitações e proteção contra revisões concorrentes.

Na administração: consulta paginada, itens e condições, histórico, aprovação manual, revisão e mudança de status. Não é possível aprovar um orçamento sem total calculado ou vencido. Aprovação não confirma pagamento, execução ou agendamento.

## PDF, protocolo e WhatsApp

PDF real gerado no servidor com PDFKit, logo oficial, número, emissão, cliente, contato, serviço, área, nível, frequência, localização, itens, valores, total estimado, validade, condições, observações, necessidade de vistoria e status. Complementos sem preço são identificados como sujeitos a avaliação. Há paginação para documentos longos.

Cada documento é protegido por token aleatório de 256 bits; conhecer apenas o número/identificador não dá acesso. Respostas privadas usam `no-store`. O administrador acessa o documento pela área autenticada e recebe o link protegido.

O botão de WhatsApp abre o resumo formatado com protocolo. Usa o número oficial cadastrado; se ausente, abre o seletor de destinatário do próprio WhatsApp, informando a ausência de contato oficial. Nenhuma mensagem é enviada automaticamente e nenhum envio é anunciado como realizado.

## Testes e evidências

`npm test`: **16 testes aprovados** na validação final. Incluem os testes anteriores de autenticação, importação fiscal, catálogo, precificação, PostgreSQL e privacidade, além dos novos cenários de imagens, regras, mínimos, faixas, materiais, descontos, adulteração de preço, avaliação sem tabela, publicação, concorrência, protocolo, idempotência, snapshots, revisão, aprovação, token privado e PDF.

O PDF foi validado pelo cabeçalho, presença de imagem e extração dos fluxos de texto, incluindo nome e total esperado; o download também foi executado no Chromium. O adaptador da Vercel foi testado preservando o token do PDF.

`npm run build`, verificações de sintaxe JavaScript e `git diff --check`: aprovados. Não há scripts de lint ou TypeScript no projeto.

Playwright/Chromium:

- Demonstração real local: desktop 1440 px e celular 390 px, persistência do controle e integridade dos produtos reais.
- Loja/carrinho anterior: 1440, 390 e 320 px, busca, categorias, preço, quantidades, remoção, protocolo e tratamento de rede.
- Serviços em banco temporário: desktop e celular; configuração por formulários no painel, salvar rascunho, recarregar, publicar, gerar orçamento, conferir valor, registrar, baixar PDF, validar WhatsApp, consultar na administração, aprovar e emitir revisão.
- Administração móvel: sem transbordamento horizontal. Capturas reais em três larguras: oito demonstrações, nenhuma imagem quebrada e nenhuma exceção JavaScript.

Capturas e documentos locais de teste:

- `.tmp/visual/etapa1-demo-1440.png` e `etapa1-demo-390.png`.
- `.tmp/visual/marketplace-real-1440.png`, `marketplace-real-390.png` e `marketplace-real-320.png`.
- `.tmp/visual/etapa2-admin-desktop.png` e `etapa2-admin-mobile.png`.
- `.tmp/visual/etapa2-modulo-1440.png` e `etapa2-modulo-390.png`.
- `.tmp/visual/etapa2-real-sem-tabela-1440.png` e `etapa2-real-sem-tabela-390.png` — estado real sem tabela publicada, sem emissão de solicitação fictícia.
- `.tmp/visual/orcamento-teste-1440.pdf` e `orcamento-teste-390.pdf` — documentos de teste, sem validade comercial.

## Preservação e correções

Importadores de catálogo e notas, parsers fiscais, fórmula de revenda, autenticação e implementação de persistência foram mantidos. A administração recebeu apenas a nova aba e o controle global da demonstração. As rotas novas passam pela mesma autorização do painel.

Corrigido o build para inserir scripts por callback: o texto `R$` seguido de aspas podia ser interpretado como substituição especial de `String.replace`, corrompendo o JavaScript gerado. Adicionada regressão que compila o script administrativo produzido.

Corrigido o adaptador Vercel para preservar os parâmetros da consulta, removendo apenas `route`. Antes ele descartava paginação, filtros e tokens de acesso. A configuração de empacotamento inclui logo e recursos de fonte do PDFKit. A hospedagem real não foi implantada nem testada com credenciais externas.

## Arquivos desta execução

Criados: `demo-showcase.js`, `service-admin.js`, `service-storefront.js`, `server/service-pricing.mjs`, `server/service-api.mjs`, `server/service-pdf.mjs`, `public/service-quotes.css`, `public/demo/catalog.json`, `public/demo/provenance.json`, oito PNG em `public/demo/`, `tests/demo-assets.test.mjs`, `tests/service-quotes.test.mjs`, `scripts/test-demo-browser.mjs`, `scripts/test-services-browser.mjs` e este relatório.

Modificados: `storefront.js`, `store.html`, `public/storefront.css`, `admin.js`, `server/api.mjs`, `api/index.mjs`, `scripts/build.mjs`, `package.json`, `package-lock.json`, `vercel.json`, `tests/http.test.mjs` e `scripts/test-storefront-browser.mjs`.

Arquivos previamente alterados de outras etapas foram preservados. Não foram alterados `.env`, schema SQL ou credenciais. A dependência nova é PDFKit, usada exclusivamente no servidor para os documentos.

## Como usar

1. Executar `npm install` e `npm run dev`; abrir `http://localhost:5173/`.
2. Entrar em `/admin` com a autenticação existente e abrir **Orçamentos de Serviços**.
3. Configurar os serviços que serão calculados, multiplicadores, regiões, frequência, validade e condições. Preencher explicitamente os componentes gratuitos com zero.
4. Salvar rascunho, revisar e clicar em **Publicar tabela comercial**. Nenhuma tabela de teste foi publicada na base real.
5. O cliente acessa `/#orcamento-servicos`, informa as escolhas e dados, confirma a solicitação e recebe PDF e protocolo.
6. Consultar os registros na mesma aba administrativa para avaliação, aprovação e revisões.
7. Para desativar os modelos para todos, desmarcar a vitrine demonstrativa em **Configurações** e salvar.

APIs públicas: `/api/service-catalog`, `POST /api/service-preview`, `POST /api/service-quotes`, `/api/service-quotes/ID?token=...` e `/api/service-quotes/ID/pdf?token=...`. APIs administrativas protegidas: `/api/service-config` e `/api/service-quote-admin`.

Scripts de navegador exigem Playwright/Chromium disponíveis. Nesta máquina foi reutilizado `C:\dev\olimpiadasfacil-main-BACKUP\node_modules\playwright`, definido em `PLAYWRIGHT_MODULE`, sem adicioná-lo às dependências da aplicação.

## Pendências comerciais e limites

Falta a empresa preencher e publicar a tabela comercial real. Não é uma falha técnica: a ativação depende de valores, regiões, condições e políticas aprovadas pela Casa Verde. O módulo já permite essa configuração sem código. Até lá, o cliente recebe avaliação técnica sem total inventado.

Não há integração de envio automático de WhatsApp, pagamento ou agenda de execução. Os botões não simulam essas ações. O contato oficial precisa ser cadastrado para direcionar o WhatsApp diretamente à loja.

Testes hospedados no Supabase/Vercel reais e em aparelhos físicos não foram executados. A regressão PostgreSQL usa PGlite e a interface foi testada em Chromium com viewports móveis. As imagens originais geradas são PNG de alta resolução e usam carregamento progressivo; permanecem disponíveis localmente, com seus prompts documentados.
