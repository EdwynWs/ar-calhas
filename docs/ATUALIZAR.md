# Como colocar esta atualização no seu GitHub

O ZIP contém o projeto inteiro atualizado. O código foi preparado na branch local `feat/gestao-simples-v2`, a partir do commit `108b1a1204e33e5e235e2bff42b9cc0273d2c05a`. Não foi necessário publicar ou hospedar a aplicação para produzir a entrega.

## Repositório

1. Baixe e extraia o ZIP.
2. Na sua cópia local de `EdwynWs/ar-calhas`, crie uma branch: `git switch -c feat/gestao-simples-v2`.
3. Copie o **conteúdo da pasta `ar-calhas`** do ZIP para a raiz do repositório, substituindo os arquivos de código existentes. Não crie uma pasta `ar-calhas` dentro de outra.
4. Preserve `.git`, `.env`, `data`, `backups`, seus bancos reais e arquivos pessoais. O ZIP não contém banco, `.env`, `node_modules` ou credenciais.
5. Execute `npm ci`, `npm test` e `npm run build`. Para o navegador: `npx playwright install chromium` e `npm run test:e2e`.
6. Confira `git diff`, adicione os arquivos e envie a branch:

```bash
git add .
git commit -m "Simplifica AR Calhas para caderno de caixa privado"
git push -u origin feat/gestao-simples-v2
```

7. Abra uma pull request no GitHub para revisar antes de juntar à branch principal. Há um texto sugerido em `docs/PULL_REQUEST.md`.

Se preferir o upload pelo navegador, envie todos os arquivos e as subpastas de dentro de `ar-calhas` para a raiz. Garanta que `.env.example`, `.gitignore` e `package-lock.json` também foram atualizados. Não envie o ZIP como substituto do código: o GitHub não o extrai automaticamente.

## Instalação que já está funcionando

Pare o processo antigo. Faça backup pelo comando da versão antiga e preserve o caminho `DB_PATH`. Atualize o código, instale dependências e compile. Configure acesso local/privado conforme `ACESSO-PRIVADO.md` antes de reiniciar.

Se o sistema antigo está em um endereço público, retire essa exposição antes de iniciar a versão sem login. Remova proxy público, encaminhamento de porta e serviço de deploy automático que publique a aplicação. A versão nova recusa configurações de escuta abertas e cabeçalhos de proxy.

Na primeira abertura, os dados antigos são mantidos e uma cópia anterior à migração é guardada ao lado do banco. O procedimento não carrega exemplos e não reinicia o dinheiro disponível.
