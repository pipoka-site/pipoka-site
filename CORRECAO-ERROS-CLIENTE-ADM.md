# Correção consolidada — Cliente e ADM

## Erros corrigidos

- `Cannot read properties of null (reading reset)` ao salvar endereço.
- Página de recuperação de senha tratando links inválidos/expirados sem expor erro técnico.
- Áreas Administradores, Auditoria e Sistema que ficavam em branco no painel.
- Migration de clientes agora remove a assinatura antiga de `list_customer_accounts()` antes de recriar a função.

## Testes recomendados

1. Editar e salvar um endereço existente.
2. Adicionar um novo endereço e marcá-lo como padrão.
3. Solicitar recuperação de senha e abrir o link mais recente.
4. Abrir Administradores, Auditoria e Sistema no ADM.
5. Editar um cliente cadastrado e desativar/reativar a conta.
