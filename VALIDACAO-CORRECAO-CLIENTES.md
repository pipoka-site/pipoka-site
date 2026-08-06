# Validação da correção de clientes

- [x] Sintaxe TS/TSX verificada por transpile do TypeScript.
- [x] Perfil é garantido por RPC autenticada.
- [x] Endereço pendente fica preservado no navegador até o primeiro login.
- [x] Checkout diferencia sessão carregando, sessão ausente e perfil incompleto.
- [x] Checkout exige nome, telefone e endereço para entrega.
- [x] ADM carrega perfis cadastrados sem depender de pedidos.
- [x] Clientes com pedidos antigos continuam aparecendo.
- [x] RLS existente continua limitando cada cliente aos próprios dados.
- [x] Funções administrativas exigem `private.is_admin()`.
- [x] Projeto continua abaixo de 100 arquivos para upload pelo GitHub Web.

## Testes manuais após deploy

1. Executar `update-sprint-4-vinculacao-clientes.sql`.
2. Sair e entrar novamente na conta do cliente.
3. Confirmar nome no topo e cliente no ADM.
4. Completar uma única vez os dados que faltarem na conta antiga.
5. Criar uma conta nova e confirmar endereço automático.
6. Finalizar um pedido logado e confirmar vínculo no ADM.
