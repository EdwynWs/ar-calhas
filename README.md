# AR Calhas — Caderno de caixa 2.0

Atualização do repositório `EdwynWs/ar-calhas`, baseada no commit `108b1a1204e33e5e235e2bff42b9cc0273d2c05a`. A interface foi reorganizada para o proprietário que tem pouca experiência com tecnologia. O banco SQLite e as regras financeiras do projeto original foram preservados.

## O que o usuário vê

Somente quatro áreas: **Início**, **Dinheiro**, **Orçamentos** e **Clientes**.

Na entrada há apenas três ações grandes:

- **Recebi dinheiro**
- **Gastei dinheiro**
- **Fazer orçamento**

Para anotar dinheiro: escolher um dos dois primeiros botões, preencher **O que foi?** e **Quanto?**, e clicar em **Salvar**. O programa já considera o valor pago/recebido no dia atual. Data diferente, dinheiro ainda pendente e informações opcionais ficam recolhidas.

As páginas usam fonte base de 18–19px, campos grandes, texto nos botões, contraste alto e nenhuma animação ou gráfico. No celular, as quatro áreas ficam visíveis em dois pares de botões. Os formulários são páginas únicas, sem caixas de diálogo empilhadas.

## Executar no próprio computador

Requisito: **Node.js 24+**. Abra o terminal na pasta deste README:

```bash
npm ci
npm run build
npm start
```

Abra **http://127.0.0.1:4000**. Não há conta, senha ou comando de criação de administrador. Um banco vazio é criado automaticamente se ainda não existir no caminho configurado.

**A versão sem login usa somente acesso local ou rede privada restrita.** Por padrão só o próprio computador acessa. Não publique este projeto como aplicação aberta na internet. Para os aparelhos dos proprietários, siga [ACESSO-PRIVADO.md](docs/ACESSO-PRIVADO.md).

### Atualizar uma instalação que já tem dados

Leia [ATUALIZAR.md](docs/ATUALIZAR.md). Preserve `.env`, `data/`, `backups/` e qualquer arquivo definido por `DB_PATH`. Não use `--demo` no banco do cliente.

Ao abrir um banco v1, o programa faz uma cópia SQLite consistente antes da migração e acrescenta apenas as tabelas para recuperar exclusões e impedir salvamentos repetidos. Não apaga linhas, valores, contas, clientes, orçamentos, etapas, compromissos, usuários ou sessões históricos. Os dados antigos de autenticação ficam inativos; suas rotas HTTP deixaram de existir.

### Desenvolvimento

Em dois terminais:

```bash
npm run server
```

```bash
npm run dev
```

Use `http://127.0.0.1:5173`. No desenvolvimento, use `NODE_ENV=development` e o modo local no `.env`, para permitir a origem 5173. O Vite e a API ficam ligados ao loopback. Acesso real de clientes deve usar o build servido pelo Node, com as restrições de rede descritas no guia.

### Demonstração separada

`npm run setup -- --demo` continua disponível **somente para um banco vazio separado**, escolhido por `DB_PATH`. Não é necessário para iniciar o sistema. Os exemplos não são inseridos automaticamente. Um banco antigo com usuários ou registros não aceita essa opção.

## Operação e regras preservadas

### Dinheiro

- Dinheiro disponível = saldo inicial já existente + valores efetivamente recebidos − valores efetivamente pagos.
- Valores são guardados como centavos inteiros. A entrada aceita `350,50`, `350.50` e `1.350,50`.
- O mês é contado pela data efetiva do pagamento/recebimento. Pendências ficam fora do dinheiro disponível.
- “Falta receber ou pagar” reúne todas as pendências, inclusive as de meses anteriores. Um aviso identifica quando passou do dia combinado.
- “Já recebi” / “Já paguei” usa a data atual. Para outro dia, use Editar.
- A descrição e os valores anteriores continuam editáveis, com as proteções de vínculo do projeto original.
- Um salvamento repetido com a mesma chave não cria outro registro. Isso também cobre nova tentativa após perda da resposta da rede.
- A cópia para Excel fica em “Guardar uma cópia desta lista”. O CSV contém apenas a lista exibida.
- O saldo inicial antigo é preservado. Ajustes administrativos do saldo continuam sendo responsabilidade da implantação; não há painel avançado para o proprietário.

### Orçamentos e serviços

- Escolha o cliente ou cadastre nome/telefone dentro do mesmo formulário.
- Preencha serviço, medida/quantidade, unidade e preço. Desconto, datas e anotações ficam em opções adicionais.
- Os totais são recalculados no servidor; o front-end não define o valor final sozinho.
- “Imprimir / Salvar PDF” abre a impressão do navegador. Escolha “Salvar como PDF”, papel A4, escala 100%, e desative cabeçalhos/rodapés do navegador se desejar.
- Aprovar o orçamento **não** soma dinheiro nem cria uma conta automaticamente. Dentro do orçamento aprovado há “Quer anotar esse valor para receber?”. A confirmação cria uma única conta pendente com vencimento.
- A conta vinculada impede alterações divergentes de valor, cliente e tipo. O orçamento com conta também não permite alterar valor/cliente/aprovação sem tratar o vínculo.
- Não há parcelas ou pagamento parcial automático. Para entrada e saldo separados, use duas anotações manuais e não gere adicionalmente a conta integral desse orçamento.
- O serviço é acompanhado dentro do orçamento: A fazer, Em andamento e Concluído. As etapas antigas Produção e Instalação aparecem como Em andamento; o valor original gravado só muda quando uma ação explícita é realizada.
- A data do serviço pode ser alterada sem mudar valor ou etapa.
- Compromissos antigos ficam disponíveis para consulta em Orçamentos, sem agenda principal separada e sem apagá-los.

### Clientes e exclusões

- Nome, telefone e endereço são os campos iniciais. CPF/CNPJ, e-mail e anotações ficam opcionais.
- A busca aceita parte do nome (inclusive sem acento) ou telefone com/sem pontuação.
- WhatsApp é um link manual, exibido somente para telefone brasileiro com comprimento válido. Não envia mensagens automaticamente nem confirma que o número tem WhatsApp.
- Excluir exige confirmação e guarda uma cópia recuperável. É possível “Desfazer exclusão” ou abrir “Recuperar algo que excluí” na área correspondente. Clientes/orçamentos ligados a outros dados não são excluídos inadvertidamente.
- O histórico de exclusões não substitui backups. Recuperações conflitantes são recusadas com explicação.
- Ao sair de um formulário alterado, o programa pergunta se deseja perder o que não salvou. Em erro de salvamento, mantém os campos preenchidos.

## Estrutura

```text
src/App.jsx               Navegação e carregamento
src/components/Common.jsx Controles simples e mensagens
src/pages/                Início, Dinheiro, Clientes, Orçamentos e detalhe
src/forms/                Formulários separados por finalidade
src/styles.css            Responsividade, legibilidade e impressão
src/utils.js              Datas, dinheiro, comunicação e CSV
server/app.js             Validações e regras de negócio
server/private-access.js  Restrição de rede, Host, Origin e requisições
server/db.js              Banco compatível e migração com backup
server/backup.js          Cópia consistente
server/index.js           Inicialização restrita
server/setup.js           Inicialização e exemplos opcionais
```

Foram removidos do front-end: login, perfil, avatar, sair, senha, gráficos, metas, agenda principal, relatórios separados, configurações avançadas e quadro de serviços separado. As dependências Framer Motion, Recharts e Lucide foram retiradas porque deixaram de ser necessárias. React, Vite e Express permanecem.

## Backup

```bash
npm run backup
```

O comando usa o `DB_PATH` atual e cria uma cópia consistente em `backups/`. Mantenha cópias fora da máquina. O arquivo contém dados pessoais e o histórico antigo de acesso; mantenha-o privado.

Para restaurar: pare o serviço, guarde o banco atual e eventuais arquivos `-wal` / `-shm` em outra pasta e copie o backup para o `DB_PATH`. Não deixe arquivos WAL/SHM de outra versão no destino. Reinicie e confira os valores. Não copie apenas o `.sqlite` de um banco ativo; use o comando de backup.

## Testes

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

O Playwright inicia um servidor de teste no loopback, com um banco temporário próprio. Não lê o `.env` nem toca no banco do cliente. Testa computador, tablet e celular, mouse e teclado, telas com capacidade de toque emulada, dois campos iniciais, cálculos, falha de rede, impressão, navegação, textos, tamanhos e recuperação de exclusão.

Veja [VALIDACAO.md](docs/VALIDACAO.md) para os resultados registrados na entrega e o roteiro do teste presencial. A automação verifica comportamento e critérios objetivos; **não prova que o proprietário de 65 anos entende tudo sozinho**. A validação presencial com ele continua necessária.
