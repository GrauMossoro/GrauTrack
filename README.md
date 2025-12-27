# Virtualizze Track

Sistema de Gestão de Leads desenvolvido com SvelteKit, focado em tracking e análise de leads educacionais.

## 🚀 Características

- **Autenticação Multi-nível**: Sistema com 4 níveis de acesso (Funcionário, Coordenador, Direção, Super Admin)
- **Dashboard Interativo**: Visualização de métricas com gráficos e filtros de período
- **Gestão de Leads**: Lista completa com busca avançada e exportação para CSV
- **Gestão de Funcionários**: CRUD completo para equipe (apenas gerentes)
- **Painel Super Admin**: Gerenciamento de empresas/unidades e usuários
- **Design Moderno**: Interface dark com tema verde, totalmente responsiva

## 🎨 Design

- Tema dark com verde como cor primária
- Interface moderna e futurista
- Totalmente responsivo (mobile-first)
- Componentes shadcn/ui para Svelte

## 🔐 Níveis de Acesso

### Super Admin
- Gerencia empresas/unidades
- Cria e atribui usuários às empresas
- Acesso total ao sistema

**Credenciais**: `joao@super.com` / `Joao@1843`

### Direção / Coordenador
- Acessa dashboard e leads
- Gerencia funcionários da sua unidade
- Atualiza próprio perfil

**Credenciais de Teste**: `teste@virtualizze.com` / `123456`

### Funcionário
- Acessa dashboard e leads
- Atualiza próprio perfil
- Visualiza disparo em massa (em desenvolvimento)

## 📊 Funcionalidades por Tela

### Login
- Autenticação por email e senha
- Recuperação de senha
- Redirecionamento baseado em nível de acesso

### Dashboard
- Cards com métricas principais
- Filtros de período (hoje, ontem, 7/15/30 dias, personalizado)
- Gráfico de pizza com categorias
- Gráfico de barras com leads por dia
- Tabela de leads recentes

### Leads
- Lista completa com paginação
- Busca por nome, email, telefone
- Filtros por categoria, curso, vendedor
- Modal com detalhes completos
- Exportação para CSV

### Funcionários (Gerentes)
- Lista de funcionários
- Criar novo funcionário
- Editar dados existentes
- Excluir funcionário
- Definir cargo e permissões

### Perfil
- Visualizar nome e cargo (somente leitura)
- Editar email e telefone
- Alterar senha
- Informações da unidade

### Super Admin
- Aba de Empresas: CRUD completo
- Aba de Usuários: CRUD completo
- Atribuição de usuários às empresas
- Gerenciamento centralizado

### Disparo em Massa
- Tela com status "Em Desenvolvimento"
- Preparada para implementação futura

## 🔗 Integração N8N

O sistema está preparado para integração com webhooks N8N. Todos os pontos de integração estão marcados com o comentário `<WEBHOOK>` no código.

Consulte o arquivo `WEBHOOKS_N8N.md` para documentação completa de todos os endpoints necessários.

### Como Configurar

1. Crie os workflows no N8N seguindo a documentação
2. Obtenha as URLs dos webhooks
3. Substitua as URLs comentadas no código
4. Configure autenticação e CORS no N8N
5. Teste as integrações

## 🛠️ Tecnologias

- **SvelteKit**: Framework principal
- **Svelte 5**: Com runes para reatividade
- **TailwindCSS v4**: Estilização
- **shadcn-svelte**: Componentes UI
- **N8N**: Backend e automações (via webhooks)

## 📁 Estrutura de Arquivos

\`\`\`
src/
├── lib/
│   ├── components/
│   │   ├── layout/
│   │   │   └── sidebar.svelte
│   │   └── dashboard/
│   │       ├── period-selector.svelte
│   │       └── stat-card.svelte
│   └── stores/
│       └── auth.svelte.ts
├── routes/
│   ├── +page.svelte (Login)
│   ├── dashboard/
│   │   └── +page.svelte
│   ├── leads/
│   │   └── +page.svelte
│   ├── funcionarios/
│   │   └── +page.svelte
│   ├── perfil/
│   │   └── +page.svelte
│   ├── disparo/
│   │   └── +page.svelte
│   └── super-admin/
│       └── +page.svelte
└── app.css
\`\`\`

## 🚀 Desenvolvimento

### Instalação

\`\`\`bash
npm install
\`\`\`

### Servidor de Desenvolvimento

\`\`\`bash
npm run dev

# ou abrir no navegador automaticamente
npm run dev -- --open
\`\`\`

### Build de Produção

\`\`\`bash
npm run build
\`\`\`

### Preview da Build

\`\`\`bash
npm run preview
\`\`\`

## 🔍 Encontrando Webhooks

Use a busca global do editor (`Ctrl+Shift+F`) e procure por `<WEBHOOK>` para encontrar todos os pontos de integração que precisam das URLs do N8N.

## 📝 Dados Mockados

O sistema vem com dados de exemplo para demonstração. Ao integrar com N8N, esses dados serão substituídos pelos dados reais do seu workflow.

## 🎯 Roadmap

- [ ] Integração completa com N8N
- [ ] Sistema de notificações em tempo real
- [ ] Funcionalidade de Disparo em Massa
- [ ] Relatórios avançados em PDF
- [ ] Sistema de tags para leads
- [ ] Histórico de interações
- [ ] Dashboard customizável

## 📄 Licença

Sistema desenvolvido para Virtualizze Track.

---

**Desenvolvido com ❤️ usando SvelteKit e TailwindCSS**
