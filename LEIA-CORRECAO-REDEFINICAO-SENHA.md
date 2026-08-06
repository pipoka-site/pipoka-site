# Correção do link de redefinição de senha

## Problema corrigido
O endereço de retorno (`redirect_to`) era enviado dentro do JSON da requisição de recuperação. O endpoint do Supabase Auth espera esse valor na URL da requisição. Por isso, alguns e-mails abriam somente a página inicial da loja.

## Comportamento esperado
O link do e-mail deve abrir:

`https://pipoka-site.vercel.app/conta/redefinir-senha`

A página valida o token recebido, permite criar uma senha nova com no mínimo 8 caracteres, uma letra e um número, e exibe mensagens claras para links inválidos ou expirados.

## Configuração necessária no Supabase
Em Authentication > URL Configuration, mantenha:

- Site URL: `https://pipoka-site.vercel.app`
- Redirect URL: `https://pipoka-site.vercel.app/conta/redefinir-senha`
- Redirect URL adicional: `https://pipoka-site.vercel.app/**`

## Teste
1. Publique esta versão.
2. Abra a tela de login e solicite uma nova recuperação de senha.
3. Use somente o e-mail novo recebido após o deploy; links antigos continuam apontando para o destino gerado anteriormente.
4. Clique no link e confirme que a rota `/conta/redefinir-senha` foi aberta.
