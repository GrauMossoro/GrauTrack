<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import Sidebar from '$lib/components/layout/sidebar.svelte';
  import { WEBHOOK_BASE, webhook } from '$lib/api';
  

  const { user, isAuthenticated, isManager, isFranqueadora, effectiveCompanyId, selectedCompany } = authStore;
  let isAuthenticatedValue = false;
  let isManagerValue = false;
  let isFranqueadoraValue = $state(false);
  let userValue = null;
  let effectiveCompanyIdValue = $state(null);
  let selectedCompanyValue = $state(null);
  let sidebarCollapsed = $state(false);

  interface Employee {
    id: number;
    name: string;
    email: string;
    password?: string;
    phone: string;
    role: 'funcionario' | 'coordenador' | 'direcao';
    company_name?: string;
    company_id?: number;
  }

  let employees: Employee[] = $state([]);
  let searchTerm = $state('');
  let loading = $state(false);
  let showModal = $state(false);
  let isEditing = $state(false);
  let currentEmployee: Employee = $state({
    id: 0,
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'funcionario',
    company_id: undefined
  });
  let error = $state('');
  let companiesValue: { id: number, name: string }[] = $state([]);

  const roleLabels: Record<string, string> = {
    funcionario: 'Funcionário',
    coordenador: 'Coordenador',
    direcao: 'Direção'
  };

  function normalizeText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  let filteredEmployees = $derived.by(() => employees.filter(emp => {
    if (searchTerm.trim()) {
      const normalized = normalizeText(searchTerm);
      return (
        normalizeText(emp.name).includes(normalized) ||
        normalizeText(emp.email).includes(normalized) ||
        emp.phone.includes(searchTerm) ||
        normalizeText(roleLabels[emp.role] || emp.role).includes(normalized)
      );
    }
    return true;
  }))

  let employeesByCompany = $derived.by(() => {
  if (!employees || employees.length === 0) return {};

  const grouped: Record<string, Employee[]> = {};

  for (const emp of employees) {
    const companyName = emp.company_name || 'Sem empresa';
    if (!grouped[companyName]) grouped[companyName] = [];
    grouped[companyName].push(emp);
  }

  return grouped;
});

  let showGrouped = $derived(isFranqueadoraValue && effectiveCompanyIdValue === null);

  onMount(() => {
    const unsubscribeAuth = isAuthenticated.subscribe(value => {
      isAuthenticatedValue = value;
      if (!value) {
        goto('/');
      }
    });

    const unsubscribeManager = isManager.subscribe(value => {
      isManagerValue = value;
      if (isAuthenticatedValue && !value) {
        goto('/dashboard');
      }
    });

    const unsubscribeUser = user.subscribe(value => {
      userValue = value;
    });

    const unsubscribeFranqueadora = isFranqueadora.subscribe(value => {
      isFranqueadoraValue = value;
    });

    const unsubscribeSelectedCompany = selectedCompany.subscribe(value => {
      selectedCompanyValue = value;
    });

    const unsubscribeEffectiveCompanyId = effectiveCompanyId.subscribe(value => {
      const previousValue = effectiveCompanyIdValue;
      effectiveCompanyIdValue = value;
      if (previousValue !== value) {
        console.log('[v0] Empresa mudou, buscando funcionários para:', value);
        fetchEmployees();
      }
    });

    fetchEmployees();
    fetchCompanies();

    return () => {
      unsubscribeAuth();
      unsubscribeManager();
      unsubscribeUser();
      unsubscribeFranqueadora();
      unsubscribeSelectedCompany();
      unsubscribeEffectiveCompanyId();
    };
  });

  async function fetchEmployees() {
    const WEBHOOK_URL = webhook('listar-funcionarios');
    
    const companyId = effectiveCompanyIdValue ?? userValue?.companyId;
    
    loading = true;
    
    try {
      const payload = companyId 
        ? { companyId: companyId }
        : { allCompanies: true };
      
      console.log('[v0] Buscando funcionários com payload:', payload);
      
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error('[v0] Erro na resposta funcionários:', response.status);
        employees = [];
        return;
      }

      const text = await response.text();
      if (!text || text.trim() === '') {
        console.log('[v0] Resposta vazia do webhook');
        employees = [];
        return;
      }

      const data = JSON.parse(text);
      employees = Array.isArray(data) ? data : [];
      console.log('[v0] Funcionários recebidos:', employees.length);
    } catch (err) {
      console.error('[v0] Error fetching employees:', err);
      employees = [];
    } finally {
      loading = false;
    }
  }

  async function fetchCompanies() {
    const WEBHOOK_URL = webhook('listar-empresas');
    
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.error('[v0] Erro na resposta de empresas:', response.status);
        companiesValue = [];
        return;
      }

      const text = await response.text();
      if (!text || text.trim() === '') {
        console.log('[v0] Resposta vazia do webhook de empresas');
        companiesValue = [];
        return;
      }

      const data = JSON.parse(text);
      companiesValue = Array.isArray(data.companies) ? data.companies : [];
      console.log('[v0] Empresas recebidas:', companiesValue.length);
    } catch (err) {
      console.error('[v0] Error fetching companies:', err);
      companiesValue = [];
    }
  }

  function openCreateModal() {
    isEditing = false;
    currentEmployee = {
      id: 0,
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'funcionario',
      company_id: effectiveCompanyIdValue || undefined
    };
    error = '';
    showModal = true;
  }

  function openEditModal(employee: Employee) {
    isEditing = true;
    currentEmployee = { ...employee, password: '' };
    error = '';
    showModal = true;
  }

  async function handleSubmit() {
    if (
      !currentEmployee.name ||
      !currentEmployee.email ||
      !currentEmployee.phone ||
      (!isEditing && !currentEmployee.password)
    ) {
      error = 'Por favor, preencha todos os campos obrigatórios.';
      return;
    }

    if (isFranqueadoraValue && !currentEmployee.company_id) {
      error = 'Por favor, selecione uma empresa.';
      return;
    }

    loading = true;
    error = '';

    try {
      const webhookUrl = isEditing
        ? webhook('editar-funcionario')
        : webhook('criar-funcionario');

      const payload: any = {
        id: currentEmployee.id,
        name: currentEmployee.name,
        email: currentEmployee.email,
        phone: currentEmployee.phone,
        password: currentEmployee.password,
        role: currentEmployee.role,
        companyId: isFranqueadoraValue ? currentEmployee.company_id : effectiveCompanyIdValue
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        await fetchEmployees();
        showModal = false;
      } else {
        error = 'Erro ao salvar funcionário';
      }
    } catch (err) {
      error = 'Erro ao salvar funcionário';
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Tem certeza que deseja excluir este funcionário?')) {
      return;
    }

    const companyId = effectiveCompanyIdValue || userValue?.companyId;
    if (!companyId) {
      console.error('[v0] Não é possível excluir funcionário sem companyId');
      return;
    }

    const WEBHOOK_URL = webhook('excluir-funcionario');
    
    loading = true;
    
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          companyId: companyId
        })
      });
      
      if (response.ok) {
        employees = employees.filter(emp => emp.id !== id);
      }
    } catch (err) {
      console.error('[v0] Error deleting employee:', err);
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen bg-zinc-950">
  <Sidebar currentPath="/funcionarios" bind:collapsed={sidebarCollapsed} />
  
  <main class="flex-1 p-8 transition-all duration-300" style="margin-left: {sidebarCollapsed ? '5rem' : '16rem'}">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white mb-2">Funcionários</h1>
        <p class="text-zinc-400">Gerencie os acessos da equipe</p>
        {#if isFranqueadoraValue && selectedCompanyValue}
          <p class="text-sm text-green-500 mt-1">Visualizando: {selectedCompanyValue.name}</p>
        {:else if isFranqueadoraValue && effectiveCompanyIdValue === null}
          <p class="text-sm text-green-500 mt-1">Visualizando: Todas as Empresas</p>
        {/if}
      </div>
      <button
        onclick={openCreateModal}
        class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        Novo Funcionário
      </button>
    </div>

    <!-- Campo de busca -->
    <div class="mb-6">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          type="text"
          bind:value={searchTerm}
          placeholder="Buscar por nome, email, telefone ou cargo..."
          class="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
        />
      </div>
    </div>

    <!-- Employees Table -->
    {#if loading && employees.length === 0}
      <div class="flex items-center justify-center py-12">
        <div class="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else if showGrouped}
      <!-- Exibir agrupado por empresa -->
      <div class="space-y-6">
        {#each Object.entries(employeesByCompany) as [companyName, companyEmployees]}
          <div class="bg-zinc-900 border border-green-600/20 rounded-lg overflow-hidden">
            <div class="bg-zinc-800/50 px-6 py-3 border-b border-zinc-700">
              <h3 class="text-lg font-semibold text-green-500">{companyName}</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-zinc-800 bg-zinc-800/30">
                    <th class="text-left p-4 text-sm font-medium text-zinc-400">Nome</th>
                    <th class="text-left p-4 text-sm font-medium text-zinc-400">Email</th>
                    <th class="text-left p-4 text-sm font-medium text-zinc-400">Telefone</th>
                    <th class="text-left p-4 text-sm font-medium text-zinc-400">Cargo</th>
                    <th class="text-left p-4 text-sm font-medium text-zinc-400">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {#each companyEmployees as employee}
                    <tr class="border-b border-zinc-800 hover:bg-zinc-800/20 hover:border-l-4 hover:border-l-green-600 transition-all">
                      <td class="p-4 text-sm text-white font-medium">{employee.name}</td>
                      <td class="p-4 text-sm text-zinc-400">{employee.email}</td>
                      <td class="p-4 text-sm text-zinc-400">{employee.phone}</td>
                      <td class="p-4">
                        <span class="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-600/10 text-green-500">
                          {roleLabels[employee.role] || employee.role}
                        </span>
                      </td>
                      <td class="p-4">
                        <div class="flex items-center gap-2">
                          <button
                            onclick={() => openEditModal(employee)}
                            class="text-green-500 hover:text-green-400 text-sm font-medium"
                          >
                            Editar
                          </button>
                          <span class="text-zinc-600">|</span>
                          <button
                            onclick={() => handleDelete(employee.id)}
                            class="text-red-500 hover:text-red-400 text-sm font-medium"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td colspan="5" class="p-8 text-center text-zinc-400">
                        Nenhum funcionário nesta empresa.
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/each}
        
        {#if Object.keys(employeesByCompany).length === 0}
          <div class="bg-zinc-900 border border-green-600/20 rounded-lg p-8 text-center">
            <p class="text-zinc-400">
              {searchTerm ? 'Nenhum funcionário encontrado com os critérios de busca.' : 'Nenhum funcionário cadastrado.'}
            </p>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Exibir lista simples quando empresa específica está selecionada -->
      <div class="bg-zinc-900 border border-green-600/20 rounded-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-zinc-800 bg-zinc-800/30">
                <th class="text-left p-4 text-sm font-medium text-zinc-400">Nome</th>
                <th class="text-left p-4 text-sm font-medium text-zinc-400">Email</th>
                <th class="text-left p-4 text-sm font-medium text-zinc-400">Telefone</th>
                <th class="text-left p-4 text-sm font-medium text-zinc-400">Cargo</th>
                <th class="text-left p-4 text-sm font-medium text-zinc-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredEmployees as employee}
                <tr class="border-b border-zinc-800 hover:bg-zinc-800/20 hover:border-l-4 hover:border-l-green-600 transition-all">
                  <td class="p-4 text-sm text-white font-medium">{employee.name}</td>
                  <td class="p-4 text-sm text-zinc-400">{employee.email}</td>
                  <td class="p-4 text-sm text-zinc-400">{employee.phone}</td>
                  <td class="p-4">
                    <span class="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-600/10 text-green-500">
                      {roleLabels[employee.role] || employee.role}
                    </span>
                  </td>
                  <td class="p-4">
                    <div class="flex items-center gap-2">
                      <button
                        onclick={() => openEditModal(employee)}
                        class="text-green-500 hover:text-green-400 text-sm font-medium"
                      >
                        Editar
                      </button>
                      <span class="text-zinc-600">|</span>
                      <button
                        onclick={() => handleDelete(employee.id)}
                        class="text-red-500 hover:text-red-400 text-sm font-medium"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              {:else}
                <tr>
                  <td colspan="5" class="p-8 text-center text-zinc-400">
                    {searchTerm ? 'Nenhum funcionário encontrado com os critérios de busca.' : 'Nenhum funcionário cadastrado.'}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </main>
</div>

<!-- Create/Edit Modal -->
{#if showModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-zinc-900 border border-green-600/30 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <h3 class="text-2xl font-bold text-white mb-6">
        {isEditing ? 'Editar Funcionário' : 'Novo Funcionário'}
      </h3>

      <div class="space-y-4">
        {#if isFranqueadoraValue && !isEditing}
          <div>
            <label for="company" class="block text-sm font-medium text-white mb-2">Empresa *</label>
            <select
              id="company"
              bind:value={currentEmployee.company_id}
              class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
            >
              <option value={undefined}>Selecione uma empresa</option>
              {#each companiesValue as company}
                <option value={company.id}>{company.name}</option>
              {/each}
            </select>
          </div>
        {/if}

        <div>
          <label for="name" class="block text-sm font-medium text-white mb-2">Nome Completo *</label>
          <input
            id="name"
            type="text"
            bind:value={currentEmployee.name}
            placeholder="João da Silva"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="email" class="block text-sm font-medium text-white mb-2">Email *</label>
          <input
            id="email"
            type="email"
            bind:value={currentEmployee.email}
            placeholder="joao@virtualizze.com"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="phone" class="block text-sm font-medium text-white mb-2">Telefone *</label>
          <input
            id="phone"
            type="tel"
            bind:value={currentEmployee.phone}
            placeholder="(11) 99999-9999"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-white mb-2">
            Senha {isEditing ? '(deixe vazio para manter)' : '*'}
          </label>
          <input
            id="password"
            type="password"
            bind:value={currentEmployee.password}
            placeholder="••••••••"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="role" class="block text-sm font-medium text-white mb-2">Cargo *</label>
          <select
            id="role"
            bind:value={currentEmployee.role}
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          >
            <option value="funcionario">Funcionário</option>
            <option value="coordenador">Coordenador</option>
            <option value="direcao">Direção</option>
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
          onclick={() => (showModal = false)}
          disabled={loading}
          class="flex-1 px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onclick={handleSubmit}
          disabled={loading}
          class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  </div>
{/if}
