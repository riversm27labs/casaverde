# Manual do proprietário — Casa Verde

Esta versão oferece **loja com catálogo, carrinho, solicitações comerciais e orçamentos automáticos de serviços**. A loja não recebe pagamentos automaticamente. Entrega, retirada, pagamento e execução são confirmados no atendimento.

## 1. Entrar no painel

No computador da loja, inicie o sistema e abra `http://localhost:5173/admin`. Para iniciar pelo terminal, use Node.js 24, execute `npm ci` na primeira instalação e depois `npm run dev` em `C:\dev\sitecasaverde`. Mantenha a janela do servidor aberta.

O endereço de login é `http://localhost:5173/login`. **Este computador já tem uma conta local configurada. Use a senha existente.** Não existe senha padrão nesta entrega, e a senha não foi alterada pela homologação. Se não souber a senha, procure o responsável pela configuração; não apague arquivos para tentar criar outra conta.

Em uma instalação local nova e sem conta, a própria tela de login oferece a criação da primeira senha, com pelo menos dez caracteres. Na hospedagem, a conta deverá ser criada pelo responsável no Supabase Auth, com o e-mail oficial do proprietário confirmado. O mesmo e-mail precisa estar configurado em `OWNER_EMAIL`.

A URL pública e a URL do painel hospedado ainda dependem da configuração externa. `localhost` funciona apenas neste computador; o servidor local não deve ser exposto à internet.

## 2. Preencher as informações da empresa

Em **Mais opções → Configurações**, preencha nome da loja, WhatsApp, endereço/região, horários, Instagram e categorias. No WhatsApp, informe `55` seguido do DDD e número. Salve as configurações.

A opção de vitrine demonstrativa pode ser desmarcada para ocultar os oito modelos de todos os visitantes. Os modelos são apenas ilustrações, não possuem preço e não representam estoque.

Regras de entrega/retirada, dados oficiais adicionais e políticas aprovadas devem ser registrados em `FICHA-COMERCIAL-DO-PROPRIETARIO.md`. Nesta versão não há editor próprio de políticas ou cálculo de frete: esses textos precisam ser aprovados pela empresa e encaminhados ao suporte para publicação, sem inventar informações.

## 3. Cadastrar um produto

Abra **Meus produtos → Novo produto**. Preencha nome, categoria, descrição, medidas e material quando existirem. Informe a disponibilidade e envie pelo menos uma foto para publicar. Revise o preço de venda e salve.

Para fotografar pelo celular, existe a opção **Publicar foto**. Atenção: esse atalho publica a imagem imediatamente, com nome provisório e preço sob consulta. Depois complete o cadastro. Não use esse atalho para documentos fiscais ou fotos que não devam ficar públicas.

## 4. Adicionar imagens

Envie JPG, PNG, WebP ou GIF, com até 4 MB por arquivo e até seis fotos por cadastro. Escolha **Usar como capa** na foto principal. Confira se a imagem corresponde ao produto real e se a empresa pode utilizá-la.

As imagens dos produtos ficam separadas dos documentos fiscais. As fotos enviadas e os cadastros precisam estar incluídos no backup.

## 5. Configurar o preço de revenda

Em um produto, clique em **Calcular revenda**. Confira o custo de entrada e informe frete por unidade, embalagem, outras despesas e taxas, quando aplicáveis. Escolha o método existente de margem, acréscimo ou multiplicador.

Calcule, revise o resultado e clique em **Aplicar preço na loja**. O cálculo sozinho não altera o preço publicado. O custo de aquisição e as margens internas não aparecem na loja pública.

Depois de nova entrada fiscal, verifique o aviso de recalcular custo. A entrada de mercadorias não deve ser confundida com controle completo de estoque com baixa automática por venda.

## 6. Publicar, atualizar ou desativar

Em **Meus produtos**, edite o cadastro, marque **Publicar na loja** e salve. Abra a loja para conferir foto, nome, categoria e preço.

Para retirar temporariamente da vitrine, desmarque a publicação. Para informar indisponibilidade, use **Esgotado**. Produtos sem preço válido ou esgotados não permitem solicitação pelo carrinho como uma compra consistente; o cliente pode entrar em contato para avaliação.

## 7. Importar catálogos

Abra **Importar catálogo** e utilize os formatos oferecidos na tela. Revise todos os nomes, preços, categorias e imagens reconhecidos antes de confirmar a importação. Para CSV, use uma primeira linha com colunas como `Nome`, `Preço` e `Categoria`.

Itens sem foto ou sem preço comercial podem precisar de complementação antes de serem publicados. Confira os avisos de duplicidade. Faça primeiro uma pequena importação de teste identificada, se o arquivo tiver muitas páginas.

## 8. Importar notas fiscais

Abra **Notas fiscais**, envie preferencialmente o XML da NF-e e clique para ler os itens. PDF e foto dependem de reconhecimento assistido e exigem revisão. Os arquivos têm limite de 4 MB cada.

Confira referência/chave da nota, fornecedor, código, quantidade e custo unitário. Confirme somente os itens corretos. Uma mesma referência não deve ser reaplicada como uma nova entrada. Depois calcule os preços de revenda; o valor da nota é custo, não preço final de venda.

As notas permanecem privadas. Não envie uma nota fiscal pela opção pública **Publicar foto**.

## 9. Consultar solicitações comerciais

Abra **Pedidos**. Veja nome, telefone, mensagem, itens e referência recebida. Atualize o andamento conforme o atendimento. O botão do WhatsApp abre uma conversa para você revisar e enviar; não envia mensagens sozinho.

O recebimento de uma solicitação não confirma pagamento nem reserva mercadorias automaticamente.

## 10. Configurar orçamentos automáticos

Abra **Orçamentos de Serviços**. Configure apenas serviços e valores aprovados pela empresa:

1. Informe preço-base, preço por m² ou faixas, mínimo e eventual necessidade de vistoria.
2. Configure os multiplicadores de básico, intermediário e premium.
3. Cadastre materiais, adicionais, frequência, regiões e deslocamento.
4. Cadastre apenas descontos autorizados.
5. Defina validade, condições de pagamento e observações.
6. Clique em **Salvar rascunho** e revise. O rascunho não é usado no cálculo público.
7. Clique em **Publicar tabela comercial** somente depois de aprovar os valores.

Campo vazio não significa zero. Se um componente for gratuito, informe explicitamente zero. Sem regras suficientes, o cliente recebe solicitação de avaliação técnica, sem preço inventado. **A tabela real permanece sem publicação nesta entrega.**

A fórmula e o significado das faixas estão explicados no painel. Cada publicação gera uma versão; os orçamentos anteriores preservam as regras usadas.

## 11. Consultar protocolos, baixar PDF e revisar

O cliente recebe o protocolo e o botão de PDF após confirmar a solicitação de serviço. Na aba **Orçamentos de Serviços**, consulte os registros recebidos, os itens, as condições e o histórico. Use **Baixar PDF** para obter o documento.

Revise antes de alterar para **aprovado pela empresa**. Um orçamento sem total ou vencido precisa ser revisto com uma tabela válida. **Gerar revisão com tabela atual** cria outro registro e preserva o original.

O link do PDF dá acesso ao documento privado. Compartilhe somente com quem deve recebê-lo. A aprovação administrativa não realiza cobrança, agendamento ou execução automática.

## 12. Backup e suporte

No modo local, execute `npm run backup:local`. Guarde a pasta indicada em armazenamento privado, também fora deste computador. Ela contém banco, credencial local e arquivos enviados. Não a envie ao GitHub, à Vercel ou a pessoas não autorizadas.

Para atualização ou restauração, siga `GUIA-DE-PRODUCAO-E-RECUPERACAO.md`. Não substitua `.data` por uma pasta de outro computador nem por dados de teste.

Se precisar de suporte, envie ao responsável técnico: descrição do problema, tela/rota, horário, protocolo e uma captura sem informações privadas desnecessárias. Não envie senha, chaves ou nota fiscal por um canal público. O contato oficial de suporte ainda deve ser definido pelo proprietário; nenhum número foi inventado.
