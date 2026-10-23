# Simplifica AR Calhas para caderno de caixa privado

A interface anterior exigia que os proprietários navegassem entre várias telas, gráficos e formulários extensos. A nova entrada apresenta “Recebi dinheiro”, “Gastei dinheiro” e “Fazer orçamento”. As operações comuns de dinheiro exigem apenas descrição, valor e Salvar, com pagamento confirmado e data atual por padrão.

A navegação passa a ter quatro áreas: Início, Dinheiro, Orçamentos e Clientes. Os serviços ficam dentro dos orçamentos. Textos cotidianos, fonte base 18–19px, campos grandes e controles textuais substituem ícones isolados e dados excessivos. Datas, pendências e informações opcionais ficam recolhidas.

O acesso por login é removido em favor de acesso local ou por rede privada configurada, com interface de escuta restrita, IP TCP autorizado e validação de Host/Origin em todo o aplicativo. Não publicar na internet. A implantação exige verificar VPN/firewall nos dispositivos reais.

O SQLite original é preservado, com backup consistente anterior à migração. Foram adicionadas recuperação de exclusões e proteção contra salvamentos repetidos. Valores continuam em centavos; orçamento aprovado e contas pendentes não aumentam o saldo.

Verificação: consultar `docs/VALIDACAO.md`. Os testes automatizados não substituem a observação presencial do proprietário usando o sistema.
