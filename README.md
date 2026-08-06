# PIPOKÁ 7.0

Projeto Next.js para o site e painel administrativo da PIPOKÁ.

## Publicação

1. Envie **o conteúdo desta pasta** para a raiz de um repositório novo no GitHub.
2. Importe o repositório na Vercel.
3. Configure as variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_WHATSAPP_NUMBER`
4. No Supabase, abra o SQL Editor e execute `supabase/update-v70.sql` inteiro.
5. Faça o deploy.

## Rotas

- Loja: `/`
- Cardápio: `/cardapio`
- Contato: `/contato`
- Checkout: `/checkout`
- Login administrativo: `/admin/login`
- Painel administrativo: `/admin`

## Recursos desta versão

- Produtos separados, status Ativo/Indisponível/Oculto e ordenação por arrastar.
- Galeria de até 10 imagens, capa, ordem, zoom e posição horizontal/vertical.
- Carrossel automático por produto.
- Variações reutilizáveis e vínculo rápido no produto.
- Compra rápida a partir de produtos já cadastrados.
- Promoções e contatos editáveis no painel.
- Cupons com valor mínimo e opção de entrega grátis.
- Modo fechado com mensagem editável.
- Pedidos no Supabase, aviso visual e sonoro no painel.


## Atualização de segurança v1.3

Execute `supabase/update-security-v1.3.sql` e depois autorize o e-mail administrativo conforme `SECURITY-V1.3.md`. O checkout desta versão cria pedidos exclusivamente pela função segura `create_order_secure`.
