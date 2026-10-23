# Casa Verde — checklist de homologação e entrega

Data: 22/10/2026. Versão: 1.0.0. Escopo congelado: **LOJA COM CATÁLOGO, CARRINHO, SOLICITAÇÕES COMERCIAIS E ORÇAMENTOS AUTOMÁTICOS DE SERVIÇOS**.

Não há pagamento automático, frete automático, reserva transacional de estoque ou envio automático de WhatsApp. Esses itens são evolução futura, não fazem parte da aprovação desta versão.

## Resultado geral

**APROVADO para operação/homologação local e preparado para configurar a hospedagem. PENDENTE DE CONFIGURAÇÃO para publicação pública.** Não foi declarada produção homologada, porque não existe implantação de destino confirmada nem conexão com Supabase de produção disponível.

| Item | Situação | Evidência e limite |
| --- | --- | --- |
| Leitura dos três relatórios e presença dos módulos | APROVADO | Loja, demonstração e orçamentos existentes confirmados; não reconstruídos |
| Preservação do Git e alterações preexistentes | APROVADO | Sem reset/checkout destrutivo; árvore de trabalho e arquivos não rastreados preservados no ponto de recuperação |
| Ponto de recuperação antes dos ajustes de implantação | APROVADO | Código, bundle Git, patch, SQLite consistente, conta e arquivos; manifesto e integridade `ok` |
| Suíte automatizada e build | APROVADO | 18 testes aprovados; build, sintaxe dos scripts e verificação de diff executados |
| Login pelo formulário | APROVADO | Chromium em ambiente local isolado, sem injetar cookie para contornar a tela de login |
| Conta local existente do proprietário | APROVADO quanto à preservação | Já configurada; arquivo mantido. A senha legítima não foi solicitada nem substituída |
| Confirmação pelo próprio proprietário com sua senha | PENDENTE DE CONFIGURAÇÃO | Proprietário deve acessar `/login` com a credencial que já possui; nenhum login efetivo em nome dele foi alegado |
| Cadastro, foto, categoria, publicação e preço comercial | APROVADO | API e Chromium locais com dados de teste identificados em diretórios temporários |
| Importação de catálogo | APROVADO | CSV processado pelo navegador e salvo pela API; duplicidade e atualização de preço também verificadas |
| Importação de nota fiscal | APROVADO | XML reconhecido, revisado e confirmado no navegador; custo e documento permanecem privados |
| Fórmula de revenda e administrativo preexistente | APROVADO | Regressões passaram; código de importadores, autenticação e fórmula preservado |
| Busca, categorias, carrinho e solicitação | APROVADO | Chromium 1440, 390 e 320 px; sem pagamento simulado |
| Demonstrações | APROVADO | Oito modelos locais, sem venda/preço, controles individual/global e prioridade aos produtos reais |
| Orçamentos de serviços | APROVADO | Rascunho, publicação controlada em base de teste, cálculo no servidor, protocolo, snapshots, revisão e aprovação manual |
| PDF e privacidade | APROVADO localmente | Download real, conteúdo e logo validados; acesso sem token recusado |
| Persistência após reinício/rebuild local | APROVADO | Produtos, imagem, senha, sessão, tabela, revisões e PDF verificados depois de encerrar e reiniciar o processo |
| Backup e restauração isolada | APROVADO | Backup real local executado; teste de cópia em WAL, hashes e restauração em pasta nova |
| Node.js e pacote de implantação | APROVADO na preparação | Node 24.x fixado, lockfile preservado; configurações Vercel/PDF existentes inspecionadas |
| Banco e isolamento PostgreSQL | APROVADO apenas em inspeção/PGlite | Não equivale à confirmação de permissões no projeto Supabase real |
| Sessão da Vercel | APROVADO como autenticação de ferramenta | `vercel whoami` confirmou sessão; isso não significa aplicação implantada |
| Projeto Vercel e URL pública | PENDENTE DE CONFIGURAÇÃO | Pasta sem `.vercel/project.json`; destino Casa Verde não identificado na listagem consultada |
| Supabase CLI | PENDENTE DE CONFIGURAÇÃO | Consulta remota retornou `Invalid access token`; é necessário autenticar/identificar o projeto correto |
| Banco/Storage/Auth de produção | PENDENTE DE CONFIGURAÇÃO | Faltam `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `OWNER_EMAIL` |
| HTTPS e domínio | PENDENTE DE CONFIGURAÇÃO | Nenhum domínio ou URL hospedada foi informado/confirmado |
| Cadastro do proprietário no Auth hospedado | PENDENTE DE CONFIGURAÇÃO | Faltam e-mail oficial, projeto e acesso seguro ao provedor; sem senha fixa ou conta inventada |
| Tabela comercial real | PENDENTE DE CONFIGURAÇÃO | Nenhuma versão publicada na base real; manter rascunho até aprovação do proprietário |
| Dados oficiais e políticas | PENDENTE DE CONFIGURAÇÃO | Ficha comercial preparada; contatos, modalidades, textos e suporte precisam da aprovação da empresa |
| Teste autenticado na hospedagem e após reimplantação | PENDENTE DE CONFIGURAÇÃO | Não executado, pois não há implantação/banco de destino configurados |
| Acesso em aparelhos físicos | PENDENTE DE CONFIGURAÇÃO | Responsividade foi testada em Chromium; não foi alegado teste em iPhone/Android físicos |
| Problema técnico reprodutível ainda sem correção nos testes locais | BLOQUEADO: nenhum identificado | Não há bloqueio técnico local aberto. Pendências externas permanecem explicitamente não homologadas |

## Endereços e infraestrutura

- Loja local: `http://localhost:5173/`.
- Painel local: `http://localhost:5173/admin`.
- Login local: `http://localhost:5173/login`.
- Orçamentos públicos locais: `http://localhost:5173/#orcamento-servicos`.
- URL pública hospedada: **não implantada/não confirmada**.
- URL administrativa hospedada: **não disponível**; será a URL confirmada seguida de `/admin`.
- Banco em uso neste computador: SQLite em `.data/casa-verde.sqlite`.
- Conta local: existente e preservada. Arquivos enviados: `.data/files`, quando houver.
- Produção planejada já suportada pelo código: Vercel + PostgreSQL/Supabase Auth + buckets privados `cv-images` e `cv-invoices`. **Não configurada nesta pasta.**

## Evidências e limpeza

`npm test`, `npm run build`, testes Chromium de loja, importações e serviços foram executados novamente. As bases de teste são temporárias, recebem cadastros identificados e são removidas ao final. Os artefatos de evidência ficam em `.tmp/visual`, incluindo capturas e PDFs explicitamente de teste. Nenhum registro real foi apagado e nenhuma tabela fictícia foi publicada na base real.

Foi acrescentado um teste que verifica a recusa de iniciar armazenamento SQLite temporário quando o ambiente informa Vercel sem PostgreSQL configurado. O aviso de cadastro público inseguro mostrado por um teste de Auth pertence ao provedor simulado desse teste; não é uma afirmação sobre um Supabase real configurado nesta entrega.

O verificador de produção identificou as configurações faltantes sem imprimir valores privados. Relatório: `.tmp/homologacao/verificacao-producao.json`. Testes locais de persistência e PGlite não foram apresentados como testes na hospedagem.

## Procedimentos entregues

- **Manual de operação:** `MANUAL-DO-PROPRIETARIO.md`.
- **Dados e decisões da empresa:** `FICHA-COMERCIAL-DO-PROPRIETARIO.md`.
- **Produção, atualização, backup e recuperação:** `GUIA-DE-PRODUCAO-E-RECUPERACAO.md`.
- **Backup operacional:** `npm run backup:local`.
- **Verificação de configuração hospedada:** `npm run verificar:producao`.

O ponto anterior às alterações está em `.tmp/recuperacao/pre-entrega-2026-10-22T21-55-15-965Z`; o backup operacional validado em `.tmp/backups/casa-verde-2026-10-22T22-00-11-507Z`. Ambos devem ter cópia privada fora do computador.

## Primeiro acesso e liberação pelo proprietário

1. Abrir `/login` local e usar a senha existente. Não apagar `.data` para recriar acesso.
2. Conferir informações oficiais em Configurações e completar a ficha comercial.
3. Manter serviços em rascunho até revisar preços, regiões e condições.
4. Identificar o destino Vercel/Supabase, configurar variáveis de forma privada e preparar a conta Auth hospedada.
5. Realizar o roteiro de homologação **na hospedagem real**, incluindo persistência após nova implantação e HTTPS.
6. Registrar aprovação do proprietário antes de tratar a versão como liberada publicamente.

## Alterações desta homologação

Nenhum layout, catálogo demonstrativo ou motor comercial foi refeito. Ajustes limitados à preparação e operação: Node 24.x, proteção de arquivos privados para Git/Vercel, comandos de backup e verificação de produção, regressão de recuperação/guard de produção, ampliação dos roteiros de testes para reinício e importações e documentação de entrega. Dependências comerciais existentes não foram trocadas; nenhum novo pacote de execução foi instalado.

O manifesto `VERSAO-ENTREGA.json` registra a versão, hashes, resultado de testes e pendência de produção. Foram comparados 257 arquivos de aplicação/recursos com o ponto de recuperação, sem alteração; a conta local e as contagens da base real também permaneceram iguais. A árvore Git permanece sem novo commit automático para não misturar ou substituir o trabalho anterior do proprietário.
