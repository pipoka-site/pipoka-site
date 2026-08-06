# Checklist da revisão de produção

- [x] Perfil do cliente atualizado somente pelo próprio user_id.
- [x] Campos sensíveis e imutáveis não podem ser alterados pelo formulário do cliente.
- [x] Endereços vinculados ao usuário autenticado.
- [x] Clientes cadastrados listados no ADM mesmo sem pedidos.
- [x] ADM pode editar nome, telefone e endereço.
- [x] ADM pode ativar ou desativar conta sem apagar pedidos.
- [x] Conta desativada é bloqueada no login e em sessões existentes.
- [x] Senhas não são lidas, exibidas ou armazenadas pelo painel.
- [x] Funções administrativas exigem private.is_admin().
- [x] Sintaxe TS/TSX validada por transpile em todos os arquivos.
- [x] Busca por service_role e segredos no frontend sem ocorrências.
- [ ] Build completo local: bloqueado pelo registry deste ambiente, que não fornece @types/node.
- [ ] Testes reais de Auth/RLS: executar após aplicar o SQL no Supabase e publicar na Vercel.
