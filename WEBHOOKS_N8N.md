# Documentação de Integração - Webhooks N8N

Este documento lista todos os pontos de integração com webhooks N8N no sistema Virtualizze Track.

## 📌 Como Usar

Todos os webhooks estão marcados com o comentário `<WEBHOOK>` no código. Substitua as URLs de exemplo pelas suas URLs do N8N.

---

## 🔐 Autenticação

### Login
- **Arquivo**: `src/lib/stores/auth.svelte.ts`
- **Função**: `login()`
- **Método**: POST
- **URL**: `https://seu-n8n.com/webhook/auth/login`
- **Body**:
\`\`\`json
{
  "email": "string",
  "password": "string"
}
\`\`\`
- **Resposta esperada**:
\`\`\`json
{
  "success": true,
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "phone": "string",
    "role": "funcionario|coordenador|direcao|super_admin",
    "companyId": "string",
    "companyName": "string"
  }
}
\`\`\`

### Reset de Senha
- **Arquivo**: `src/lib/stores/auth.svelte.ts`
- **Função**: `resetPassword()`
- **Método**: POST
- **URL**: `https://seu-n8n.com/webhook/auth/reset-password`
- **Body**:
\`\`\`json
{
  "email": "string"
}
\`\`\`

---

## 📊 Dashboard

### Buscar Dados do Dashboard
- **Arquivo**: `src/routes/dashboard/+page.svelte`
- **Função**: `fetchDashboardData()`
- **Método**: GET
- **URL**: `https://seu-n8n.com/webhook/dashboard/data?period=hoje`
- **Query Params**: `period` (hoje, ontem, 7dias, 15dias, 30dias, personalizado)
- **Resposta esperada**:
\`\`\`json
{
  "totalLeads": 90,
  "tecnicos": 30,
  "bacharelado": 30,
  "superiorGrad": 30,
  "categories": [
    {
      "name": "Técnicos",
      "value": 35,
      "color": "#8b5cf6"
    }
  ],
  "dailyLeads": [
    {
      "date": "01/12",
      "count": 12
    }
  ],
  "recentLeads": [
    {
      "id": 1,
      "name": "João Silva",
      "category": "Técnico",
      "course": "TI",
      "phone": "(11) 99999-9999",
      "seller": "Ana Costa"
    }
  ]
}
\`\`\`

---

## 👥 Leads

### Listar Leads
- **Arquivo**: `src/routes/leads/+page.svelte`
- **Função**: `fetchLeads()`
- **Método**: GET
- **URL**: `https://seu-n8n.com/webhook/leads/list`
- **Resposta esperada**:
\`\`\`json
[
  {
    "id": 1,
    "name": "João Silva",
    "category": "Técnico",
    "course": "TI",
    "phone": "(11) 99999-9999",
    "seller": "Ana Costa",
    "firstContact": "20/11/2024 14:30",
    "email": "joao.silva@email.com",
    "status": "Em andamento",
    "notes": "Interessado em curso noturno"
  }
]
\`\`\`

---

## 👨‍💼 Funcionários

### Listar Funcionários
- **Arquivo**: `src/routes/funcionarios/+page.svelte`
- **Função**: `fetchEmployees()`
- **Método**: GET
- **URL**: `https://seu-n8n.com/webhook/employees/list`
- **Resposta esperada**:
\`\`\`json
[
  {
    "id": 1,
    "name": "Ana Costa",
    "email": "ana.costa@virtualizze.com",
    "phone": "(11) 91111-1111",
    "role": "funcionario|coordenador|direcao"
  }
]
\`\`\`

### Criar Funcionário
- **Arquivo**: `src/routes/funcionarios/+page.svelte`
- **Função**: `handleSubmit()` (quando `!isEditing`)
- **Método**: POST
- **URL**: `https://seu-n8n.com/webhook/employees/create`
- **Body**:
\`\`\`json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "phone": "string",
  "role": "funcionario|coordenador|direcao"
}
\`\`\`

### Editar Funcionário
- **Arquivo**: `src/routes/funcionarios/+page.svelte`
- **Função**: `handleSubmit()` (quando `isEditing`)
- **Método**: POST
- **URL**: `https://seu-n8n.com/webhook/employees/update`
- **Body**:
\`\`\`json
{
  "id": "number",
  "name": "string",
  "email": "string",
  "password": "string (opcional)",
  "phone": "string",
  "role": "funcionario|coordenador|direcao"
}
\`\`\`

### Excluir Funcionário
- **Arquivo**: `src/routes/funcionarios/+page.svelte`
- **Função**: `handleDelete()`
- **Método**: DELETE
- **URL**: `https://seu-n8n.com/webhook/employees/delete/{id}`

---

## 🧑 Perfil

### Atualizar Perfil
- **Arquivo**: `src/routes/perfil/+page.svelte`
- **Função**: `handleUpdateProfile()`
- **Método**: POST
- **URL**: `https://seu-n8n.com/webhook/profile/update`
- **Body**:
\`\`\`json
{
  "userId": "string",
  "email": "string",
  "phone": "string"
}
\`\`\`

### Alterar Senha
- **Arquivo**: `src/routes/perfil/+page.svelte`
- **Função**: `handleChangePassword()`
- **Método**: POST
- **URL**: `https://seu-n8n.com/webhook/profile/change-password`
- **Body**:
\`\`\`json
{
  "userId": "string",
  "currentPassword": "string",
  "newPassword": "string"
}
\`\`\`

---

## 🏢 Super Admin - Empresas

### Criar Empresa
- **Arquivo**: `src/routes/super-admin/+page.svelte`
- **Função**: `handleCompanySubmit()` (quando `!isEditing`)
- **Método**: POST
- **URL**: `https://seu-n8n.com/webhook/companies/create`
- **Body**:
\`\`\`json
{
  "name": "string",
  "cnpj": "string",
  "address": "string",
  "phone": "string"
}
\`\`\`

### Editar Empresa
- **Arquivo**: `src/routes/super-admin/+page.svelte`
- **Função**: `handleCompanySubmit()` (quando `isEditing`)
- **Método**: POST
- **URL**: `https://seu-n8n.com/webhook/companies/update`
- **Body**:
\`\`\`json
{
  "id": "number",
  "name": "string",
  "cnpj": "string",
  "address": "string",
  "phone": "string"
}
\`\`\`

### Excluir Empresa
- **Arquivo**: `src/routes/super-admin/+page.svelte`
- **Função**: `handleDeleteCompany()`
- **Método**: DELETE
- **URL**: `https://seu-n8n.com/webhook/companies/delete/{id}`

---

## 👤 Super Admin - Usuários

### Criar Usuário
- **Arquivo**: `src/routes/super-admin/+page.svelte`
- **Função**: `handleUserSubmit()` (quando `!isEditing`)
- **Método**: POST
- **URL**: `https://seu-n8n.com/webhook/users/create`
- **Body**:
\`\`\`json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "phone": "string",
  "role": "funcionario|coordenador|direcao",
  "companyId": "number"
}
\`\`\`

### Editar Usuário
- **Arquivo**: `src/routes/super-admin/+page.svelte`
- **Função**: `handleUserSubmit()` (quando `isEditing`)
- **Método**: POST
- **URL**: `https://seu-n8n.com/webhook/users/update`
- **Body**:
\`\`\`json
{
  "id": "number",
  "name": "string",
  "email": "string",
  "password": "string (opcional)",
  "phone": "string",
  "role": "funcionario|coordenador|direcao",
  "companyId": "number"
}
\`\`\`

### Excluir Usuário
- **Arquivo**: `src/routes/super-admin/+page.svelte`
- **Função**: `handleDeleteUser()`
- **Método**: DELETE
- **URL**: `https://seu-n8n.com/webhook/users/delete/{id}`

---

## 📢 Disparos em Massa

### Histórico de Disparos
- **Arquivo**: `src/routes/disparo/+page.svelte`
- **Função**: `fetchBlasts()`
- **Método**: GET
- **URL**: `https://auto.agiussolar.cloud/webhook/leads-blast-history`
- **Resposta esperada**:
```json
[
  {
    "id": 1,
    "name": "Promoção Natal",
    "user": "João Silva",
    "total": 150,
    "success": 145,
    "failure": 5,
    "date": "2023-12-01T10:00:00",
    "status": "approved|pending|cancelled|rejected"
  }
]
```

### Enviar Disparo (Solicitar)
- **Arquivo**: `src/routes/disparo/+page.svelte`
- **Função**: `handleSend()`
- **Método**: POST
- **URL**: `https://auto.agiussolar.cloud/webhook/leads-blast-send`
- **Body**:
```json
{
  "name": "string",
  "message": "string",
  "channelId": "string",
  "useAI": boolean,
  "randomInterval": boolean,
  "companyId": "number",
  "userId": "string"
}
```
- **Nota**: Se o usuário for "funcionario", o backend deve salvar com status "pending". Se for "coordenador" ou superior, pode processar imediatamente ou salvar como "approved".

### Aprovar Disparo
- **Arquivo**: `src/routes/disparo/+page.svelte`
- **Função**: `approveBlast()`
- **Método**: POST
- **URL**: `https://auto.agiussolar.cloud/webhook/leads-blast-approve`
- **Body**:
```json
{
  "blastId": "number",
  "userId": "string" // ID do coordenador que aprovou
}
```

### Cancelar Disparo
- **Arquivo**: `src/routes/disparo/+page.svelte`
- **Função**: `cancelBlast()`
- **Método**: POST
- **URL**: `https://auto.agiussolar.cloud/webhook/leads-blast-cancel`
- **Body**:
```json
{
  "blastId": "number",
  "userId": "string" // ID do coordenador que cancelou
}
```

---

## 🔍 Como Encontrar os Webhooks no Código

Todos os webhooks estão marcados com o comentário:
\`\`\`javascript
// <WEBHOOK> Coloque aqui a URL do webhook N8N para [descrição]
\`\`\`

Use a busca global (`Ctrl+Shift+F` ou `Cmd+Shift+F`) no seu editor e pesquise por `<WEBHOOK>` para encontrar todos os pontos de integração.

---

## 📝 Notas Importantes

1. **Autenticação**: Considere implementar tokens JWT ou API keys para autenticar as requisições aos webhooks.

2. **Tratamento de Erros**: Os webhooks devem retornar códigos HTTP apropriados:
   - 200: Sucesso
   - 400: Erro de validação
   - 401: Não autorizado
   - 404: Não encontrado
   - 500: Erro interno

3. **CORS**: Configure o N8N para aceitar requisições do domínio do seu frontend.

4. **Validação**: Sempre valide os dados no backend (N8N) antes de processar.

5. **Logs**: Implemente logs detalhados no N8N para facilitar debugging.

---

## 🔐 Credenciais de Acesso Padrão

### Super Admin
- Email: `joao@super.com`
- Senha: `Joao@1843`

### Usuário Teste (Coordenador)
- Email: `teste@virtualizze.com`
- Senha: `123456`

---

## 🚀 Próximos Passos

1. Configure os webhooks no N8N seguindo esta documentação
2. Teste cada endpoint individualmente
3. Substitua as URLs de exemplo no código pelos seus webhooks reais
4. Configure autenticação e segurança adequadas
5. Implemente validações e tratamento de erros no N8N
6. Realize testes end-to-end do sistema completo
