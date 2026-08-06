# Correção consolidada — vinculação de clientes

Execute no Supabase, após os SQLs anteriores da Sprint 4:

`supabase/update-sprint-4-vinculacao-clientes.sql`

## O que esta correção resolve

- cria ou recupera o perfil de toda sessão autenticada;
- salva o endereço do cadastro como padrão para novos cadastros;
- mantém dados pendentes do cadastro até a confirmação do e-mail e primeiro login;
- exibe o primeiro nome na área do cliente;
- faz o checkout aguardar a sessão e carregar perfil/endereço;
- lista no ADM os clientes cadastrados mesmo sem pedidos;
- inclui contas antigas e administradores que também usam a área do cliente;
- mantém pedidos vinculados por `customer_id` ou telefone normalizado.

## Conta de teste criada antes desta correção

Os dados que a versão anterior deixou de gravar não podem ser reconstruídos se não estiverem nos metadados do Auth. A conta será recuperada e aparecerá no ADM, mas talvez seja necessário preencher nome, celular e endereço uma única vez em **Minha conta**. Novos cadastros passam a salvar tudo automaticamente.
