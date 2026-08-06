# Revisão — correção do salvamento de perfil

## Erro corrigido

O botão **Salvar alterações** enviava um `PATCH` para `customer_profiles` sem filtro na URL. O Supabase bloqueou a operação com a mensagem `UPDATE requires a WHERE clause`.

## Correção aplicada

- a atualização agora exige uma sessão válida;
- o `PATCH` usa `user_id=eq.<usuário logado>`;
- o telefone é normalizado antes do envio;
- uma resposta sem registro atualizado gera uma mensagem clara;
- nenhuma alteração de banco é necessária.

## Revisões executadas

- verificação sintática de todos os arquivos TypeScript e TSX;
- conferência de imports locais;
- busca por outras operações `PATCH` e `DELETE` sem filtro;
- integridade do ZIP.
