<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import Sidebar from '$lib/components/layout/sidebar.svelte';
  import { webhook } from '$lib/api';

  const auth = authStore;

  let isAuthenticated = false;
  let userValue: any = null;
  let leads = $state([]);
  let loading = $state(false);
  let searchTerm = $state('');
  let filterCategory = $state('todos');
  let filterCourse = $state('todos');
  let filterSeller = $state('todos');
  let filterDate = $state('todos');
  let selectedLead = $state(null);
  let showDetailModal = $state(false);
  let sidebarCollapsed = $state(false);

  let showNewLeadModal = $state(false);
  let savingLead = $state(false);
  let newLead = $state({
    name: '',
    email: '',
    phone: '',
    category: '',
    course: '',
    seller: '',
    notes: ''
  });

  let categories = ['todos', 'Técnico', 'Profissionalizante', 'Superior', 'Indisponivel'];
  let courses = $state(['todos']);
  let registeredCourses = $state([]);
  let sellers = $state(['todos']);
  let dates = $state(['todos']);

  let isFranqueadoraValue = $state(false);
  let effectiveCompanyIdValue = null;
  let selectedCompanyValue = $state({id: 0, name: ''});

  function normalizeText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  const filteredLeads = () => {
    if (!isAuthenticated) {
      return [];
    }
    const normalizedSearch = normalizeText(searchTerm);
    const matchesSearch = (lead: any) =>
      normalizeText(lead.name || '').includes(normalizedSearch) ||
      normalizeText(lead.email || '').includes(normalizedSearch) ||
      lead.phone?.includes(searchTerm);
    
    // Categoria "Indisponivel" filtra os que NÃO são Técnico, Profissionalizante ou Superior
    const matchesCategory = (lead: any) => {
      if (filterCategory === 'todos') return true;
      if (filterCategory === 'Indisponivel') {
        const validCategories = ['técnico', 'profissionalizante', 'superior'];
        return !validCategories.includes(lead.category?.toLowerCase());
      }
      return lead.category?.toLowerCase() === filterCategory.toLowerCase();
    };
    
    const matchesCourse = (lead: any) => filterCourse === 'todos' || lead.course?.toLowerCase() === filterCourse.toLowerCase();
    const matchesSeller = (lead: any) => filterSeller === 'todos' || lead.seller?.toLowerCase() === filterSeller.toLowerCase();
    
    const matchesDate = (lead: any) => {
      if (filterDate === 'todos') return true;
      const leadDateFormatted = formatDate(lead.firstContact);
      return leadDateFormatted === filterDate;
    };

    return leads.filter((lead: any) => matchesSearch(lead) && matchesCategory(lead) && matchesCourse(lead) && matchesSeller(lead) && matchesDate(lead));
  };

  function formatDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      // Se já está no formato DD/MM/YYYY, retorna direto
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
        return dateString;
      }
      
      // Tentar parse ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss)
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const year = date.getUTCFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('[v0] Error formatting date:', error);
      return dateString;
    }
  }

  onMount(() => {
    const unsubAuth = auth.isAuthenticated.subscribe((value) => {
      isAuthenticated = value;
      if (!value) {
        goto('/');
      }
    });
    
    const unsubUser = auth.user.subscribe((value) => {
      userValue = value;
      canDelete = value?.role === 'franqueadora' || value?.role === 'direcao';
      if (value?.companyId && leads.length === 0 && !loading) {
        fetchCourses();
        fetchLeads();
      }
    });

    const unsubFranqueadora = auth.isFranqueadora.subscribe(value => {
      isFranqueadoraValue = value;
    });
    
    const unsubSelectedCompany = auth.selectedCompany.subscribe(value => {
      selectedCompanyValue = value;
    });
    
    const unsubEffectiveCompany = auth.effectiveCompanyId.subscribe(value => {
      effectiveCompanyIdValue = value;
      // Recarregar dados quando a empresa mudar
      if (value && userValue) {
        fetchLeads();
        fetchCourses();
      }
    });

    if (isAuthenticated) {
      fetchLeads();
    }

    return () => {
      unsubAuth();
      unsubUser();
      unsubFranqueadora();
      unsubSelectedCompany();
      unsubEffectiveCompany();
    };
  });

  async function fetchCourses() {
    const WEBHOOK_URL = webhook('listar-cursos');
    
    const companyId = effectiveCompanyIdValue || userValue?.companyId;
    if (!companyId) {
      return;
    }
    
    try {
      const payload = {
        company_id: companyId
      };

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      registeredCourses = Array.isArray(data.courses) ? data.courses : [];
    } catch (error) {
      console.error('[v0] Error fetching courses:', error);
      registeredCourses = [];
    }
  }

  async function fetchLeads() {
    const WEBHOOK_URL = webhook('leads-list');
    
    // Se effectiveCompanyIdValue for null, buscar todos os leads
    // Caso contrário, usar effectiveCompanyIdValue ou companyId do usuário
    const companyId = effectiveCompanyIdValue ?? userValue?.companyId;
    
    if (!companyId) {
      console.log('[v0] Buscando todos os leads (franqueadora sem empresa selecionada)');
    } else {
      console.log('[v0] Buscando leads da empresa:', companyId);
    }
    
    loading = true;
    
    try {
      const payload = companyId 
        ? { companyId: companyId }
        : { allCompanies: true };

      console.log('[v0] Payload para leads:', payload);

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('[v0] Erro na resposta:', response.status);
        leads = [];
        return;
      }

      const data = await response.json();
      console.log('[v0] Leads recebidos:', data?.length || 0);
      
      leads = Array.isArray(data) ? data : [];
      
      courses = ['todos', ...Array.from(new Set(leads.map(l => l.course).filter(c => c)))];
      sellers = ['todos', ...Array.from(new Set(leads.map(l => l.seller).filter(s => s)))];
      
      const uniqueDays = Array.from(new Set(leads.map(l => {
        if (!l.firstContact) return null;
        const formatted = formatDate(l.firstContact);
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) {
          return null;
        }
        return formatted;
      }).filter(d => d !== null) as string[]));
      
      dates = ['todos', ...uniqueDays.sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('/').map(Number);
        const [dayB, monthB, yearB] = b.split('/').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateB.getTime() - dateA.getTime();
      })];
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[v0] Erro ao buscar leads:', err);
      leads = [];
    } finally {
      loading = false;
    }
  }

  function viewLeadDetails(lead: any) {
    selectedLead = lead;
    showDetailModal = true;
  }

  function openNewLeadModal() {
    newLead = {
      name: '',
      email: '',
      phone: '',
      category: '',
      course: '',
      seller: '',
      notes: ''
    };
    showNewLeadModal = true;
  }

  async function saveNewLead() {
    if (!newLead.name || !newLead.phone) {
      alert('Nome e telefone são obrigatórios!');
      return;
    }

    savingLead = true;

    try {
      const WEBHOOK_URL = webhook('leads-create');
      
      const companyId = effectiveCompanyIdValue || userValue?.companyId;
      
      const payload = {
        companyId: companyId,
        name: newLead.name,
        email: newLead.email,
        phone: newLead.phone,
        category: newLead.category,
        course: newLead.course,
        seller: newLead.seller || userValue?.name,
        notes: newLead.notes,
        firstContact: new Date().toISOString()
      };

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showNewLeadModal = false;
        await fetchLeads();
      } else {
        alert('Erro ao salvar lead. Tente novamente.');
      }
    } catch (error) {
      console.error('[v0] Error saving lead:', error);
      alert('Erro ao salvar lead. Tente novamente.');
    } finally {
      savingLead = false;
    }
  }

  let selectedLeads = $state(new Set());
  let canDelete = $state(false);
  let deleting = $state(false);

  function toggleSelectAll() {
    const currentFiltered = filteredLeads();
    if (selectedLeads.size === currentFiltered.length) {
      selectedLeads = new Set();
    } else {
      selectedLeads = new Set(currentFiltered.map((l: any) => l.id));
    }
  }

  function toggleSelectLead(id: number) {
    const newSet = new Set(selectedLeads);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    selectedLeads = newSet;
  }

  async function deleteLeads(ids: number[]) {
    if (ids.length === 0) return;

    const confirmMessage = ids.length === 1 
      ? 'Tem certeza que deseja excluir este lead?' 
      : `Tem certeza que deseja excluir ${ids.length} leads?`;

    if (!confirm(confirmMessage)) return;

    const companyId = effectiveCompanyIdValue || userValue?.companyId;
    if (!companyId) {
      alert('Erro: Empresa não identificada.');
      return;
    }

    deleting = true;
    const WEBHOOK_URL = webhook('leads-delete');

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST', // Using POST as per typical webhook patterns in this project, or DELETE if supported
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          leadIds: ids
        })
      });

      if (response.ok) {
        // Remove deleted leads from local state
        leads = leads.filter((l: any) => !ids.includes(l.id));
        selectedLeads = new Set();
        if (showDetailModal && selectedLead && ids.includes(selectedLead.id)) {
          showDetailModal = false;
        }
      } else {
        alert('Erro ao excluir leads. Tente novamente.');
      }
    } catch (error) {
      console.error('[v0] Error deleting leads:', error);
      alert('Erro ao excluir leads. Tente novamente.');
    } finally {
      deleting = false;
    }
  }

  function exportToCSV() {
    const headers = ['ID', 'Nome', 'Email', 'Telefone', 'Categoria', 'Curso', 'Vendedor', 'Primeiro Contato', 'Status', 'Observações'];
    const csvData = leads.map(lead => [
      lead.id,
      lead.name,
      lead.email || '',
      lead.phone,
      lead.category,
      lead.course,
      lead.seller,
      lead.firstContact,
      lead.status || '',
      lead.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }
</script>

<div class="flex min-h-screen bg-zinc-950">
  <Sidebar currentPath="/leads" bind:collapsed={sidebarCollapsed} />
  
  <main class="flex-1 p-8 transition-all duration-300" style="margin-left: {sidebarCollapsed ? '5rem' : '16rem'}">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white mb-2">Leads</h1>
        <p class="text-zinc-400">Gerencie todos os seus leads</p>
        
        {#if isFranqueadoraValue && selectedCompanyValue}
          <p class="text-sm text-green-500 mt-2">
            Visualizando dados de: <span class="font-semibold">{selectedCompanyValue.name}</span>
          </p>
        {/if}
      </div>
      <div class="flex gap-3">
        {#if canDelete && selectedLeads.size > 0}
          <button
            onclick={() => deleteLeads(Array.from(selectedLeads))}
            disabled={deleting}
            class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {#if deleting}
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            {/if}
            Excluir ({selectedLeads.size})
          </button>
        {/if}
        <button
          onclick={openNewLeadModal}
          class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          aria-label="Abrir modal para criar novo lead"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Novo Lead
        </button>
        <button
          onclick={exportToCSV}
          class="flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
          aria-label="Exportar leads para CSV"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Exportar
        </button>
      </div>
    </div>

    {#if isFranqueadoraValue && !selectedCompanyValue && leads.length === 0 && !loading}
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="text-center max-w-md">
          <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-600/10 flex items-center justify-center">
            <svg class="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">Selecione uma Unidade</h2>
          <p class="text-zinc-400">
            Para visualizar os leads, selecione uma unidade no menu lateral.
          </p>
        </div>
      </div>
    {:else}
      <div class="bg-zinc-900 border border-green-600/20 rounded-lg p-6 mb-6">
        <div class="flex flex-col gap-4">
          <div class="flex-1">
            <input
              type="text"
              bind:value={searchTerm}
              placeholder="Buscar por nome, email ou telefone..."
              class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
              aria-label="Buscar por nome, email ou telefone"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-sm font-medium text-white mb-2" for="filterDate">Data</label>
              <select
                bind:value={filterDate}
                class="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
                id="filterDate"
              >
                {#each dates as date}
                  <option value={date}>{date === 'todos' ? 'Todas as datas' : date}</option>
                {/each}
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-white mb-2" for="filterCategory">Categoria</label>
              <select
                bind:value={filterCategory}
                class="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
                id="filterCategory"
              >
                {#each categories as category}
                  <option value={category}>{category === 'todos' ? 'Todas' : category}</option>
                {/each}
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-white mb-2" for="filterCourse">Curso</label>
              <select
                bind:value={filterCourse}
                class="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
                id="filterCourse"
              >
                {#each courses as course}
                  <option value={course}>{course === 'todos' ? 'Todos' : course}</option>
                {/each}
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-white mb-2" for="filterSeller">Vendedor</label>
              <select
                bind:value={filterSeller}
                class="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
                id="filterSeller"
              >
                {#each sellers as seller}
                  <option value={seller}>{seller === 'todos' ? 'Todos' : seller}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="text-sm text-zinc-400">
            Mostrando {filteredLeads().length} de {leads.length} leads
          </div>
        </div>
      </div>

      {#if loading}
        <div class="flex items-center justify-center py-12">
          <div class="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      {:else}
        <div class="bg-zinc-900 border border-green-600/20 rounded-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-zinc-700 bg-zinc-800/50">
                  {#if canDelete}
                    <th class="text-left p-4 w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedLeads.size > 0 && selectedLeads.size === filteredLeads().length}
                        onclick={toggleSelectAll}
                        class="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-green-600 focus:ring-green-600"
                      />
                    </th>
                  {/if}
                  <th class="text-left p-4 text-sm font-medium text-zinc-400">ID</th>
                  <th class="text-left p-4 text-sm font-medium text-white">Nome</th>
                  <th class="text-left p-4 text-sm font-medium text-white">Categoria</th>
                  <th class="text-left p-4 text-sm font-medium text-white">Curso</th>
                  <th class="text-left p-4 text-sm font-medium text-zinc-400">Telefone</th>
                  <th class="text-left p-4 text-sm font-medium text-zinc-400">Vendedor</th>
                  <th class="text-left p-4 text-sm font-medium text-zinc-400">Primeiro Contato</th>
                  <th class="text-left p-4 text-sm font-medium text-white">Ações</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredLeads() as lead}
                  <tr class="border-b border-zinc-700 hover:bg-zinc-800/50 hover:border-l-4 hover:border-l-green-600 transition-all">
                    {#if canDelete}
                      <td class="p-4">
                        <input 
                          type="checkbox" 
                          checked={selectedLeads.has(lead.id)}
                          onclick={() => toggleSelectLead(lead.id)}
                          class="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-green-600 focus:ring-green-600"
                        />
                      </td>
                    {/if}
                    <td class="p-4 text-sm text-zinc-400">#{lead.id}</td>
                    <td class="p-4 text-sm text-white font-medium">{lead.name}</td>
                    <td class="p-4 text-sm text-white">{lead.category}</td>
                    <td class="p-4 text-sm text-white">{lead.course}</td>
                    <td class="p-4 text-sm text-zinc-400">{lead.phone}</td>
                    <td class="p-4 text-sm text-zinc-400">{lead.seller}</td>
                    <td class="p-4 text-sm text-zinc-400">{formatDate(lead.firstContact)}</td>
                    <td class="p-4">
                      <button
                        onclick={() => viewLeadDetails(lead)}
                        class="text-green-500 hover:text-green-400 text-sm font-medium"
                        aria-label="Ver detalhes do lead"
                      >
                        Ver detalhes
                      </button>
                      {#if canDelete}
                        <button
                          onclick={() => deleteLeads([lead.id])}
                          class="text-red-500 hover:text-red-400 text-sm font-medium ml-3"
                          title="Excluir"
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    {/if}
  </main>
</div>

<!-- Detail Modal -->
{#if showDetailModal && selectedLead}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-zinc-900 border border-green-600/30 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-2xl font-bold text-white">Detalhes do Lead</h3>
        <button
          onclick={() => (showDetailModal = false)}
          class="text-zinc-400 hover:text-white"
          aria-label="Fechar modal de detalhes"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <span class="text-sm font-medium text-zinc-400 block mb-1">ID</span>
            <p class="text-white">#{selectedLead.id}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-zinc-400 block mb-1">Status</span>
            <span class="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-600/10 text-green-500">
              {selectedLead.status}
            </span>
          </div>
        </div>

        <div>
          <span class="text-sm font-medium text-zinc-400 block mb-1">Nome Completo</span>
          <p class="text-white font-medium">{selectedLead.name}</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <span class="text-sm font-medium text-zinc-400 block mb-1">Email</span>
            <p class="text-white">{selectedLead.email}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-zinc-400 block mb-1">Telefone</span>
            <p class="text-white">{selectedLead.phone}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <span class="text-sm font-medium text-zinc-400 block mb-1">Categoria</span>
            <p class="text-white">{selectedLead.category}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-zinc-400 block mb-1">Curso de Interesse</span>
            <p class="text-white">{selectedLead.course}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <span class="text-sm font-medium text-zinc-400 block mb-1">Vendedor Responsável</span>
            <p class="text-white">{selectedLead.seller}</p>
          </div>
          <div>
            <span class="text-sm font-medium text-zinc-400 block mb-1">Primeiro Contato</span>
            <p class="text-white">{formatDate(selectedLead.firstContact)}</p>
          </div>
        </div>

        <div>
          <span class="text-sm font-medium text-zinc-400 block mb-1">Observações</span>
          <p class="text-white bg-zinc-800 p-3 rounded-lg">{selectedLead.notes}</p>
        </div>
      </div>

      <div class="flex gap-3 mt-6">
        <button
          onclick={() => (showDetailModal = false)}
          class="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
          aria-label="Fechar modal de detalhes"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal para criar novo lead -->
{#if showNewLeadModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-zinc-900 border border-green-600/30 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-2xl font-bold text-white">Novo Lead</h3>
        <button
          onclick={() => (showNewLeadModal = false)}
          class="text-zinc-400 hover:text-white"
          aria-label="Fechar modal de novo lead"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-white mb-2" for="newLeadName">Nome Completo *</label>
          <input
            type="text"
            bind:value={newLead.name}
            placeholder="Nome do lead"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
            id="newLeadName"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-white mb-2" for="newLeadEmail">Email</label>
          <input
            type="email"
            bind:value={newLead.email}
            placeholder="email@exemplo.com"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
            id="newLeadEmail"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-white mb-2" for="newLeadPhone">Telefone *</label>
          <input
            type="tel"
            bind:value={newLead.phone}
            placeholder="(00) 00000-0000"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
            id="newLeadPhone"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-white mb-2" for="newLeadCategory">Categoria</label>
            <select
              bind:value={newLead.category}
              class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
              id="newLeadCategory"
            >
              <option value="">Selecione...</option>
              <option value="Técnico">Técnico</option>
              <option value="Profissionalizante">Profissionalizante</option>
              <option value="Superior">Superior</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-white mb-2" for="newLeadCourse">Curso</label>
            <select
              bind:value={newLead.course}
              class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
              id="newLeadCourse"
            >
              <option value="">Selecione...</option>
              {#each registeredCourses as course}
                <option value={course.name}>{course.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-white mb-2" for="newLeadSeller">Vendedor</label>
          <input
            type="text"
            bind:value={newLead.seller}
            placeholder="Nome do vendedor (opcional)"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
            id="newLeadSeller"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-white mb-2" for="newLeadNotes">Observações</label>
          <textarea
            bind:value={newLead.notes}
            placeholder="Observações sobre o lead..."
            rows="3"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 resize-none"
            id="newLeadNotes"
          ></textarea>
        </div>
      </div>

      <div class="flex gap-3 mt-6">
        <button
          onclick={() => (showNewLeadModal = false)}
          class="flex-1 px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
          aria-label="Cancelar criação de novo lead"
        >
          Cancelar
        </button>
        <button
          onclick={saveNewLead}
          disabled={savingLead}
          class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          aria-label="Salvar novo lead"
        >
          {#if savingLead}
            <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Salvando...
          {:else}
            Salvar
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
