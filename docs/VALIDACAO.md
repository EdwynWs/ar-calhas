# Verificação da entrega — versão 2.0

Entrega revisada em 23/10/2026. Base: `108b1a1204e33e5e235e2bff42b9cc0273d2c05a`, do repositório `EdwynWs/ar-calhas`. Nenhuma publicação ou alteração remota foi feita.

## Resultado técnico

- `npm ci`: instalação concluída com o arquivo de versões travadas.
- `npm test`: **15 testes aprovados, zero falhas** (inclui o teste principal e seus 12 subtestes).
- `npm run build`: compilação de produção concluída.
- `npm run test:e2e`: **27 testes aprovados, zero falhas, zero ignorados e zero tentativas repetidas**; nove cenários em três tamanhos de tela.
- `git diff --check`: sem erros de espaços ou marcadores de conflito.

Ambiente: Node.js 24, Chromium pelo Playwright 1.56.1. Telas emuladas: computador 1440 × 1000, tablet 820 × 1180 e celular 393 × 851. A execução de navegador foi concluída em 22/10/2026; a revisão final e repetição dos testes de servidor foram concluídas em 23/10/2026. Não foram usados dados reais do cliente.

## Cenários de aceitação automatizados

| Operação                       | O que foi verificado                                                                                                                                 | Resultado             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Registrar um gasto             | Botão Gastei dinheiro; somente dois campos iniciais; Salvar; confirmação; valor permanece ao recarregar                                              | Passou nas três telas |
| Registrar um recebimento       | Botão Recebi dinheiro; valor brasileiro; recebido hoje por padrão                                                                                    | Passou nas três telas |
| Procurar cliente               | Cadastro, busca por nome sem acento e por telefone, edição                                                                                           | Passou nas três telas |
| Encontrar e imprimir orçamento | Criar com cliente no próprio formulário, procurar, abrir impressão, gerar PDF A4 sem a navegação                                                     | Passou nas três telas |
| Voltar ao início               | Navegação visível; retorno; proteção quando existem alterações não salvas                                                                            | Passou nas três telas |
| Palavras e controles claros    | Textos nos botões; ausência dos termos proibidos testados; fonte base de pelo menos 18px; tamanho dos alvos visíveis; sem transbordamento horizontal | Passou nas três telas |

Outros cenários cobrem erro de valor, perda de resposta da rede com nova tentativa sem duplicação, pendências antigas fora do saldo, quitação, aprovação sem duplicar cobrança, serviço dentro do orçamento, cancelamento da exclusão, recuperação e navegação por teclado. A compreensão das palavras por uma pessoa real não pode ser comprovada por essas verificações.

Foram inspecionadas imagens das telas e o orçamento impresso em PDF. O exemplo de impressão coube em uma página A4 legível; isso não comprova o funcionamento de uma impressora física nem de todo orçamento possível.

## Dados e dinheiro

Os testes criam um banco de teste com o esquema anterior e com clientes, dinheiro, orçamentos, etapas antigas, compromissos, configurações, usuários e sessões. Após a migração, comparam todas as linhas dessas tabelas e abrem a cópia anterior à atualização para conferir os mesmos dados.

Também verificam centavos inteiros, valores e datas inválidos, soma pela data efetiva, pendências fora do saldo, totais recalculados no servidor, conta única por orçamento, bloqueio de mudanças incompatíveis com vínculos e recuperação de registros excluídos. O banco real da AR Calhas não foi acessado: faça backup e confira a atualização em uma cópia antes de usá-la no atendimento.

## Acesso sem login

Os testes verificam recusa de escuta aberta, exigência de configuração privada explícita, endereços individuais permitidos, bloqueio de pares TCP não autorizados, cabeçalhos de proxy, Host e Origin indevidos, inclusive no HTML, nos arquivos estáticos e na exportação. Também verificam a exigência de origem e cabeçalho próprio nas alterações de dados.

Não foi possível testar a VPN, o firewall, o roteador ou os aparelhos reais dos proprietários. Antes da instalação definitiva, faça os testes de aparelho permitido, aparelho não autorizado e conexão externa descritos em `ACESSO-PRIVADO.md`. Sem login, um aparelho autorizado tem acesso aos dados e às alterações; a restrição da rede é indispensável.

## Teste presencial obrigatório — ainda pendente

Use uma instalação separada com dados fictícios. Entregue o aparelho ao proprietário, sem explicar quais botões usar, e peça uma tarefa de cada vez:

1. “Você pagou R$ 85,50 em parafusos. Anote isso.”
2. “O João pagou R$ 600 pelo serviço. Anote isso.”
3. “Encontre o telefone do cliente João.”
4. “Encontre o orçamento do João e imprima.”
5. “Volte para a primeira tela.”
6. “Leia os botões e explique com suas palavras o que cada um faz.”

Registre se cada tarefa foi concluída sem ajuda, onde houve hesitação, se foi necessário rolar a tela e quais palavras não ficaram claras. Não diga que passou se precisou apontar um botão ou explicar um termo. Repita também o registro com “Ainda não paguei” e peça para recuperar uma anotação excluída por engano.

Se houver dificuldade, ajuste somente o necessário e repita a tarefa com ele. Os testes automáticos não substituem esse encontro nem garantem, sozinhos, facilidade de uso para o proprietário.
