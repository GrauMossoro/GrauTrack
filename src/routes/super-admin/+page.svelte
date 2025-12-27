<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';

  const { user, isAuthenticated, isSuperAdmin, logout } = authStore;

  interface Company {
    id: number;
    name: string;
    cnpj?: string;
    address?: string;
    phone?: string;
  }

  interface AdminUser {
    id: number;
    name: string;
    email: string;
    password?: string;
    phone: string;
    role: 'funcionario' | 'coordenador' | 'direcao' | 'franqueadora';
    companyId: number;
    companyName?: string;
  }

  let activeTab = $state('companies');
  let companies: Company[] = $state([]);
  let users: AdminUser[] = $state([]);
  let loading = $state(false);
  let showCreateCompanyModal = $state(false);
  let showEditCompanyModal = $state(false);
  let showUserModal = $state(false);
  let isEditingUser = $state(false);
  let error = $state('');

  let currentCompany: Company = $state({ id: 0, name: '', cnpj: '', address: '', phone: '' });
  let editingCompany: Company = $state({ id: 0, name: '', cnpj: '', address: '', phone: '' });
  let currentUser: AdminUser = $state({
    id: 0,
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'funcionario',
    companyId: 0
  });

  const roleLabels = {
    funcionario: 'Funcionário',
    coordenador: 'Coordenador',
    direcao: 'Direção',
    franqueadora: 'Franqueadora'
  };

  // Function to fetch companies from the API
  async function fetchCompanies() {
    loading = true;
    try {
      const response = await fetch('https://auto.agiussolar.cloud/webhook/listar-empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        companies = Array.isArray(data.companies) ? data.companies.map((company: any) => ({
          id: company?.id || 0,
          name: company?.name || '',
          cnpj: company?.cnpj || '',
          address: company?.address || '',
          phone: company?.phone || ''
        })) : [];
      }
    } catch (err) {
      console.error('Erro ao buscar empresas:', err);
      companies = [];
    } finally {
      loading = false;
    }
  }

  // Function to fetch users from the API
  async function fetchUsers() {
    loading = true;
    try {
      const response = await fetch('https://auto.agiussolar.cloud/webhook/listar-usuarios', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        users = Array.isArray(data) ? data.map((user: any) => {
          // Converter company_id para número, mesmo se vier como string
          const companyIdValue = user?.company_id;
          const companyIdNumber = typeof companyIdValue === 'string'
            ? parseInt(companyIdValue, 10)
            : (typeof companyIdValue === 'number' ? companyIdValue : null);

          const company = companies.find(comp => comp?.id === companyIdNumber);

          return {
            id: user?.id || 0,
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            role: user?.role || 'funcionario',
            companyId: companyIdNumber || 0,
            companyName: company?.name || 'Sem empresa'
          };
        }) : [];
      }
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      users = [];
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (!isAuthenticated) {
      goto('/');
    } else if (!isSuperAdmin) {
      goto('/dashboard');
    } else {
      fetchCompanies().then(() => fetchUsers());
    }
  });

  // Function to open create company modal
  function openCreateCompanyModal() {
    currentCompany = { id: 0, name: '', cnpj: '', address: '', phone: '' };
    error = '';
    showCreateCompanyModal = true;
  }

  // Function to open edit company modal
  function openEditCompanyModal(company: Company) {
    editingCompany = { ...company };
    error = '';
    showEditCompanyModal = true;
  }

  // Function to handle create company
  async function handleCreateCompany() {
    if (!currentCompany?.name) {
      error = 'Nome da empresa é obrigatório';
      return;
    }

    loading = true;

    try {
      const response = await fetch('https://auto.agiussolar.cloud/webhook/criar-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentCompany)
      });

      if (response.ok) {
        await fetchCompanies();
        showCreateCompanyModal = false;
        error = '';
      } else {
        error = 'Erro ao criar empresa';
      }
    } catch (err) {
      console.error('Erro ao criar empresa:', err);
      error = 'Erro ao criar empresa';
    } finally {
      loading = false;
    }
  }

  // Function to handle edit company
  async function handleEditCompany() {
    if (!editingCompany?.name) {
      error = 'Nome da empresa é obrigatório';
      return;
    }

    loading = true;

    try {
      const response = await fetch('https://auto.agiussolar.cloud/webhook/editar-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCompany)
      });

      if (response.ok) {
        await fetchCompanies();
        showEditCompanyModal = false;
        error = '';
      } else {
        error = 'Erro ao editar empresa';
      }
    } catch (err) {
      console.error('Erro ao editar empresa:', err);
      error = 'Erro ao editar empresa';
    } finally {
      loading = false;
    }
  }

  // Function to handle delete company
  async function handleDeleteCompany(id: number) {
    if (!confirm('Tem certeza que deseja excluir esta empresa?')) {
      return;
    }

    const companyToDelete = companies.find(c => c?.id === id);
    if (!companyToDelete) {
      console.error('Empresa não encontrada:', id);
      return;
    }

    loading = true;

    try {
      const response = await fetch('https://auto.agiussolar.cloud/webhook/excluir-empresa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: companyToDelete.id })
      });

      if (response.ok) {
        await fetchCompanies();
      } else {
        console.error('Erro ao excluir empresa');
      }
    } catch (err) {
      console.error('Erro ao excluir empresa:', err);
    } finally {
      loading = false;
    }
  }

  // Function to open create user modal
  function openCreateUserModal() {
    isEditingUser = false;
    currentUser = {
      id: 0,
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'funcionario',
      companyId: companies.length > 0 ? companies[0].id : 0 // Set default to the first company or 0
    };
    error = '';
    showUserModal = true;
  }

  // Function to open edit user modal
  function openEditUserModal(user: AdminUser) {
    isEditingUser = true;
    // Garantir que companyId seja número válido
    const companyIdValue = user.companyId;
    const validCompanyId = typeof companyIdValue === 'string'
      ? parseInt(companyIdValue, 10)
      : (typeof companyIdValue === 'number' ? companyIdValue : 0);

    currentUser = {
      ...user,
      password: '',
      companyId: validCompanyId
    };
    error = '';
    showUserModal = true;
  
  }

  // Function to handle user submit
  async function handleUserSubmit() {
  

    // Validate required fields
    if (!currentUser?.name || !currentUser?.email || !currentUser?.phone) {
      error = 'Preencha todos os campos obrigatórios';
      return;
    }

    const companyId = typeof currentUser?.companyId === 'string'
      ? parseInt(currentUser.companyId, 10)
      : currentUser?.companyId;

    if (!companyId || isNaN(companyId)) {
      error = 'Selecione uma empresa';
      return;
    }

    if (!isEditingUser && !currentUser?.password) {
      error = 'Senha é obrigatória para novos usuários';
      return;
    }

    const WEBHOOK_URL = isEditingUser
      ? 'https://auto.agiussolar.cloud/webhook/editar-usuario'
      : 'https://auto.agiussolar.cloud/webhook/criar-usuario';

    loading = true;
    const userToSend = {
      ...currentUser,
      companyId: companyId
    };

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userToSend)
      });

      if (response.ok) {
        await fetchUsers();
        showUserModal = false;
        error = '';
        // Resetting to empty values, ensuring correct types
        currentUser = {
          id: 0,
          name: '',
          email: '',
          password: '',
          phone: '',
          role: 'funcionario',
          companyId: 0
        };
      } else {
        error = 'Erro ao salvar usuário';
      }
    } catch (err) {
      console.error('Erro ao salvar usuário:', err);
      error = 'Erro ao salvar usuário';
    } finally {
      loading = false;
    }
  }

  // Function to handle delete user
  async function handleDeleteUser(id: number) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
      return;
    }

    const userToDelete = users.find(u => u?.id === id);
    if (!userToDelete) {
      console.error('Usuário não encontrado:', id);
      return;
    }

    loading = true;

    try {
      const response = await fetch('https://auto.agiussolar.cloud/webhook/excluir-usuario', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userToDelete.id, email: userToDelete.email })
      });

      if (response.ok) {
        await fetchUsers();
      } else {
        console.error('Erro ao excluir usuário');
      }
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
    } finally {
      loading = false;
    }
  }

  // Function to handle logout
  function handleLogout() {
    logout();
    goto('/');
  }
</script>

<div class="min-h-screen bg-zinc-950">
  <!-- Header -->
  <!-- Header com borda verde -->
  <header class="bg-card border-b border-green-600/30">
    <div class="px-8 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <!-- Ícone com verde -->
        <div class="w-10 h-10 rounded-lg bg-green-600/10 border border-green-600/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div>
          <h1 class="font-bold text-foreground">Virtualizze Track</h1>
          <p class="text-xs text-muted-foreground">Super Admin</p>
        </div>
      </div>
      <button
        onclick={handleLogout}
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        Sair
      </button>
    </div>
  </header>

  <main class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-foreground mb-2">Painel Super Admin</h1>
      <p class="text-muted-foreground">Gerencie empresas e usuários do sistema</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 border-b border-border">
      <!-- Tabs com verde -->
      <button
        onclick={() => activeTab = 'companies'}
        class="px-6 py-3 text-sm font-medium transition-colors border-b-2 {activeTab === 'companies'
          ? 'border-green-600 text-green-500'
          : 'border-transparent text-muted-foreground hover:text-foreground'}"
      >
        Empresas ({companies.length})
      </button>
      <button
        onclick={() => activeTab = 'users'}
        class="px-6 py-3 text-sm font-medium transition-colors border-b-2 {activeTab === 'users'
          ? 'border-green-600 text-green-500'
          : 'border-transparent text-muted-foreground hover:text-foreground'}"
      >
        Usuários ({users.length})
      </button>
    </div>

    <!-- Companies Tab -->
    {#if activeTab === 'companies'}
      <div>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-foreground">Empresas / Unidades</h2>
          <!-- Botão verde -->
          <button
            onclick={openCreateCompanyModal}
            class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Nova Empresa
          </button>
        </div>

        <!-- Tabela com borda verde -->
        <div class="bg-card border border-green-600/20 rounded-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-border bg-muted/30">
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">ID</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">Nome</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">CNPJ</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">Endereço</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">Telefone</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {#each companies as company}
                  <!-- Hover com borda verde -->
                  <tr class="border-b border-border hover:bg-muted/20 hover:border-l-4 hover:border-l-green-600 transition-all">
                    <td class="p-4 text-sm text-muted-foreground font-mono">{company?.id}</td>
                    <td class="p-4 text-sm text-foreground font-medium">{company?.name}</td>
                    <td class="p-4 text-sm text-muted-foreground">{company?.cnpj || '-'}</td>
                    <td class="p-4 text-sm text-muted-foreground">{company?.address || '-'}</td>
                    <td class="p-4 text-sm text-muted-foreground">{company?.phone || '-'}</td>
                    <td class="p-4">
                      <div class="flex items-center gap-2">
                        <!-- Links verdes -->
                        <button
                          onclick={() => openEditCompanyModal(company)}
                          class="text-green-500 hover:text-green-400 text-sm font-medium"
                        >
                          Editar
                        </button>
                        <span class="text-border">|</span>
                        <button
                          onclick={() => handleDeleteCompany(company?.id)}
                          class="text-destructive hover:text-destructive/80 text-sm font-medium"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}

    <!-- Users Tab -->
    {#if activeTab === 'users'}
      <div>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-foreground">Usuários</h2>
          <button
            onclick={openCreateUserModal}
            class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Novo Usuário
          </button>
        </div>

        <div class="bg-card border border-green-600/20 rounded-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-border bg-muted/30">
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">ID</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">Nome</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">Telefone</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">Cargo</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">Empresa</th>
                  <th class="text-left p-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {#each users as user}
                  <tr class="border-b border-border hover:bg-muted/20 hover:border-l-4 hover:border-l-green-600 transition-all">
                    <td class="p-4 text-sm text-muted-foreground font-mono">{user.id}</td>
                    <td class="p-4 text-sm text-foreground font-medium">{user.name}</td>
                    <td class="p-4 text-sm text-muted-foreground">{user.email}</td>
                    <td class="p-4 text-sm text-muted-foreground">{user.phone}</td>
                    <td class="p-4">
                      <!-- Badge verde -->
                      <span class="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-600/10 text-green-500">
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td class="p-4 text-sm text-muted-foreground">{user.companyName || '-'}</td>
                    <td class="p-4">
                      <div class="flex items-center gap-2">
                        <button
                          onclick={() => openEditUserModal(user)}
                          class="text-green-500 hover:text-green-400 text-sm font-medium"
                        >
                          Editar
                        </button>
                        <span class="text-border">|</span>
                        <button
                          onclick={() => handleDeleteUser(user.id)}
                          class="text-destructive hover:text-destructive/80 text-sm font-medium"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>

<!-- Create Company Modal -->
{#if showCreateCompanyModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <!-- Modal com fundo sólido bg-zinc-900 -->
    <div class="bg-zinc-900 border border-green-600/30 rounded-lg p-6 w-full max-w-lg">
      <h3 class="text-2xl font-bold text-white mb-6">Nova Empresa</h3>

      <div class="space-y-4">
        <div>
          <label for="company-name" class="block text-sm font-medium text-white mb-2">Nome *</label>
          <input
            id="company-name"
            type="text"
            bind:value={currentCompany.name}
            placeholder="Nome da empresa"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="company-cnpj" class="block text-sm font-medium text-white mb-2">CNPJ</label>
          <input
            id="company-cnpj"
            type="text"
            bind:value={currentCompany.cnpj}
            placeholder="00.000.000/0000-00"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="company-address" class="block text-sm font-medium text-white mb-2">Endereço</label>
          <input
            id="company-address"
            type="text"
            bind:value={currentCompany.address}
            placeholder="Endereço completo"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="company-phone" class="block text-sm font-medium text-white mb-2">Telefone</label>
          <input
            id="company-phone"
            type="tel"
            bind:value={currentCompany.phone}
            placeholder="(11) 99999-9999"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        {#if error}
          <div class="bg-red-900/30 border border-red-600/20 rounded-lg p-3">
            <p class="text-sm text-red-400">{error}</p>
          </div>
        {/if}
      </div>

      <div class="flex gap-3 mt-6">
        <button
          onclick={() => (showCreateCompanyModal = false)}
          disabled={loading}
          class="flex-1 px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onclick={handleCreateCompany}
          disabled={loading}
          class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Company Modal -->
{#if showEditCompanyModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <!-- Modal com fundo sólido bg-zinc-900 -->
    <div class="bg-zinc-900 border border-green-600/30 rounded-lg p-6 w-full max-w-lg">
      <h3 class="text-2xl font-bold text-white mb-6">Editar Empresa</h3>

      <div class="space-y-4">
        <div>
          <label for="edit-company-name" class="block text-sm font-medium text-white mb-2">Nome *</label>
          <input
            id="edit-company-name"
            type="text"
            bind:value={editingCompany.name}
            placeholder="Nome da empresa"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="edit-company-cnpj" class="block text-sm font-medium text-white mb-2">CNPJ</label>
          <input
            id="edit-company-cnpj"
            type="text"
            bind:value={editingCompany.cnpj}
            placeholder="00.000.000/0000-00"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="edit-company-address" class="block text-sm font-medium text-white mb-2">Endereço</label>
          <input
            id="edit-company-address"
            type="text"
            bind:value={editingCompany.address}
            placeholder="Endereço completo"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="edit-company-phone" class="block text-sm font-medium text-white mb-2">Telefone</label>
          <input
            id="edit-company-phone"
            type="tel"
            bind:value={editingCompany.phone}
            placeholder="(11) 99999-9999"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        {#if error}
          <div class="bg-red-900/30 border border-red-600/20 rounded-lg p-3">
            <p class="text-sm text-red-400">{error}</p>
          </div>
        {/if}
      </div>

      <div class="flex gap-3 mt-6">
        <button
          onclick={() => (showEditCompanyModal = false)}
          disabled={loading}
          class="flex-1 px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onclick={handleEditCompany}
          disabled={loading}
          class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- User Modal -->
{#if showUserModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <!-- Modal com fundo sólido bg-zinc-900 -->
    <div class="bg-zinc-900 border border-green-600/30 rounded-lg p-6 w-full max-w-lg">
      <h3 class="text-2xl font-bold text-white mb-6">
        {isEditingUser ? 'Editar Usuário' : 'Novo Usuário'}
      </h3>

      <div class="space-y-4">
        <div>
          <label for="user-name" class="block text-sm font-medium text-white mb-2">Nome *</label>
          <input
            id="user-name"
            type="text"
            bind:value={currentUser.name}
            placeholder="Nome completo"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="user-email" class="block text-sm font-medium text-white mb-2">Email *</label>
          <input
            id="user-email"
            type="email"
            bind:value={currentUser.email}
            placeholder="email@exemplo.com"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="user-phone" class="block text-sm font-medium text-white mb-2">Telefone *</label>
          <input
            id="user-phone"
            type="tel"
            bind:value={currentUser.phone}
            placeholder="(11) 99999-9999"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="user-password" class="block text-sm font-medium text-white mb-2">
            Senha {isEditingUser ? '(deixe vazio para manter)' : '*'}
          </label>
          <input
            id="user-password"
            type="password"
            bind:value={currentUser.password}
            placeholder="••••••••"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="user-role" class="block text-sm font-medium text-white mb-2">Cargo *</label>
          <select
            id="user-role"
            bind:value={currentUser.role}
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          >
            <option value="funcionario">Funcionário</option>
            <option value="coordenador">Coordenador</option>
            <option value="direcao">Direção</option>
            <option value="franqueadora">Franqueadora</option>
          </select>
        </div>

        <div>
          <label for="user-company" class="block text-sm font-medium text-white mb-2">Empresa *</label>
          <select
            id="user-company"
            bind:value={currentUser.companyId}
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          >
            <option value="">Selecione uma empresa</option>
            {#each companies as company}
              <option value={company.id}>{company.name}</option>
            {/each}
          </select>
        </div>

        {#if error}
          <div class="bg-red-900/30 border border-red-600/20 rounded-lg p-3">
            <p class="text-sm text-red-400">{error}</p>
          </div>
        {/if}
      </div>

      <div class="flex gap-3 mt-6">
        <button
          onclick={() => (showUserModal = false)}
          disabled={loading}
          class="flex-1 px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onclick={handleUserSubmit}
          disabled={loading}
          class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  </div>
{/if}
