# Acesso privado sem login

Este arquivo é para Edwyn / responsável pela instalação, não para os proprietários operarem o sistema.

## Padrão: apenas no computador onde o programa roda

Sem `.env`, o programa escuta somente `127.0.0.1:4000`. O navegador desse computador abre `http://127.0.0.1:4000` ou `http://localhost:4000`. Outras máquinas não conseguem conectar à interface de loopback. Não há tela de login nem autenticação por cookie.

O acesso continua dependendo de quem pode usar esse computador. Proteja a conta do sistema operacional e a sessão do dispositivo.

## Dois aparelhos autorizados: rede privada / VPN

Para computador e celular, a opção indicada nesta entrega é uma VPN privada com identidade de dispositivos, como Tailscale ou WireGuard, administrada por quem fará a implantação. A instalação/configuração da VPN e do firewall ocorre fora deste código.

1. Instale a VPN no servidor e somente nos aparelhos autorizados dos dois proprietários.
2. Configure as regras da VPN para permitir aos dois aparelhos apenas o acesso necessário ao servidor, na porta 4000. Não mantenha uma permissão geral para todos os membros da rede.
3. Use no servidor o IP privado da interface VPN, e no aplicativo os IPs individuais dos aparelhos. Não utilize sub-redes completas.
4. No firewall, autorize TCP 4000 apenas pela interface VPN e pelos IPs dos aparelhos. Negue a porta nas interfaces públicas. Mantenha a regra de administração/SSH existente para não se trancar fora do servidor.
5. Não configure encaminhamento de porta no roteador, Nginx público, Tailscale Funnel, proxy público, túnel público ou serviço serverless para esta versão.
6. Teste nos aparelhos autorizados e, separadamente, em um aparelho não autorizado e fora da VPN.

Exemplo ilustrativo — substitua todos os IPs pelos reais:

```dotenv
NODE_ENV=production
PORT=4000
DB_PATH=/var/lib/ar-calhas/ar-calhas.sqlite
ACCESS_MODE=private
BIND_HOST=100.80.1.2
ALLOWED_CLIENT_IPS=100.80.1.3,100.80.1.4
ALLOWED_ORIGINS=http://100.80.1.2:4000
```

Os usuários abrem o mesmo endereço privado `http://100.80.1.2:4000`. Com VPN, o tráfego percorre o túnel cifrado. Este Node entrega HTTP e não termina TLS. Não faça a mesma exposição HTTP pela internet.

Para uma instalação **somente na LAN da empresa**, use IPs privados reservados no DHCP (por exemplo 192.168.x.x), rede confiável separada de visitantes e firewall restrito aos dois aparelhos. Um IP de LAN não identifica uma pessoa de maneira criptográfica; em rede compartilhada/não confiável, utilize a VPN e suas regras de dispositivos. Não libere a rede Wi-Fi inteira.

## Bloqueios implementados

- O modo local recusa qualquer `BIND_HOST` diferente de `127.0.0.1` / `::1`.
- O modo privado exige um IP específico RFC1918, ULA IPv6 ou 100.64.0.0/10 (comum em VPN), lista não vazia de IPs individuais e origens exatas.
- `0.0.0.0`, `::`, IP público, curingas e intervalos CIDR não são aceitos para disponibilizar o serviço sem login.
- Cada requisição é validada pelo endereço TCP real do aparelho (`socket.remoteAddress`). `X-Forwarded-For`, `Forwarded` e cabeçalhos conhecidos de proxy são recusados. Não ative `trust proxy`.
- HTML, JavaScript, imagens, saúde da aplicação, exportação e todas as rotas da API passam pela mesma barreira de rede.
- Host deve corresponder aos endereços configurados. Origens diferentes são recusadas; `Sec-Fetch-Site: cross-site` também é recusado.
- Escritas exigem origem permitida, JSON e o cabeçalho adicional de proteção de requisição. Esse cabeçalho **não é senha nem controle de acesso**; o controle principal é a interface restrita + IP TCP autorizado + firewall/VPN.
- Não há CORS liberado para outros sites. Os endpoints antigos de login, senha, perfil e logout retornam 404.
- Dados, backup e histórico de exclusões são acessíveis a qualquer dispositivo autorizado. Não há níveis de permissão individuais.

O aplicativo valida sua configuração e as conexões que recebe. Ele não consegue inspecionar ou certificar as regras do roteador, a identidade atribuída pela VPN ou um proxy externo mal configurado. O responsável precisa concluir a configuração de rede e testar sua eficácia antes de liberar o endereço aos clientes.

## Implantação preservando o banco

1. Pare o serviço antigo. Guarde `.env` e o banco que já está em uso; não copie um banco de demonstração por cima.
2. Faça um backup consistente (`npm run backup`) na instalação antiga. Conserve uma cópia fora do servidor.
3. Substitua somente o código, execute `npm ci` e `npm run build`.
4. Preserve `DB_PATH`; remova variáveis de acesso antigo que não se aplicam (`COOKIE_SECURE`, `ADMIN_*`). Configure o acesso local/privado acima.
5. Inicie com `npm start`. Na primeira abertura de um banco v1, um segundo backup é criado automaticamente em `migration-backups`, ao lado do banco, antes das novas tabelas. Se esse backup falhar, a abertura não prossegue.
6. Teste antes de colocar em uso: dispositivo autorizado abre Início; não autorizado não consegue ler nem a página nem `/api/data` nem `/api/export`.

PM2 pode iniciar `npm start`, a partir da pasta correta do projeto. Use apenas uma instância. O servidor não deve estar atrás de um proxy reverso nesta entrega.

## Docker

O compose fornecido utiliza `network_mode: host`, para Linux, preservando o IP do cliente. O padrão continua ligado apenas ao loopback. Edite as variáveis antes de usar modo privado. Não substitua por publicação de porta em `0.0.0.0` ou NAT de container: isso prejudica a restrição por IP real.

```bash
docker compose build
docker compose up -d
docker compose exec ar-calhas node server/backup.js
```

Para uso local em Windows, execute Node diretamente. Docker Desktop e redes de containers têm comportamento diferente; a receita de host network deste pacote é direcionada a Linux.

Os volumes existentes devem ser preservados. Nunca use `docker compose down -v` em uma instalação que contenha dados do cliente.
