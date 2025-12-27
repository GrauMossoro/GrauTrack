<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import Sidebar from '$lib/components/layout/sidebar.svelte';
  import PeriodSelector from '$lib/components/dashboard/period-selector.svelte';
  import StatCard from '$lib/components/dashboard/stat-card.svelte';
  import { WEBHOOK_BASE, webhook } from '$lib/api';

  const { user, selectedCompany } = authStore;

  let sidebarCollapsed = $state(false);
  let selectedPeriod = $state('hoje');
  let loading = $state(false);
  let isLoading = $state(true);
  let currentPage = $state(1);
  const itemsPerPage = 10;

  let isFranqueadoraLocal = $state(false);
  let selectedCompanyLocal = $state<{id: number, name: string} | null>(null);
  let companyIdToUse = $state<number | null>(null);

  let dashboardData = $state({
    totalLeads: 0,
    tecnicos: 0,
    profissionalizante: 0,
    superior: 0,
    outros: 0,
    categories: [] as Array<{name: string, value: number, color: string}>,
    dailyLeads: [] as Array<{date: string, count: number}>,
    topCourses: [] as Array<{name: string, count: number}>,
    recentLeads: [] as Array<{name: string, category: string, course: string, phone: string, data_cadastro: string}>
  });

  let maxDailyLeads = $state(0);
  let maxCourseCount = $state(0);
  let paginatedLeads = $state<Array<{name: string, category: string, course: string, phone: string, data_cadastro: string}>>([]);
  let totalPages = $state(0);

  onMount(() => {
    const unsubUser = user.subscribe((value) => {
      if (!value) {
        goto('/');
        return;
      }
      
      isLoading = false;
      isFranqueadoraLocal = value.role === 'franqueadora';
      
      // Para outros usuários, usar o companyId do usuário
      if (isFranqueadoraLocal) {
        // Franqueadora sem empresa selecionada: carregar todos os dados
        if (!selectedCompanyLocal) {
          companyIdToUse = 0; // 0 significa todos
          fetchDashboardData(selectedPeriod);
        }
      } else {
        companyIdToUse = value.companyId;
        fetchDashboardData(selectedPeriod);
      }
    });

    const unsubCompany = selectedCompany.subscribe((company) => {
      selectedCompanyLocal = company;
      if (isFranqueadoraLocal) {
        if (company) {
          companyIdToUse = company.id;
        } else {
          companyIdToUse = 0; // Todos os dados
        }
        fetchDashboardData(selectedPeriod);
      }
    });

    return () => {
      unsubUser();
      unsubCompany();
    };
  });

  async function fetchDashboardData(period: string) {
    const WEBHOOK_URL = webhook('dashboard');

    loading = true;

    try {
      const getPeriod = {
        periodo: period,
        companyId: companyIdToUse // Pode ser 0 para todos os dados
      };

      console.log('[v0] Buscando dashboard com:', getPeriod);

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPeriod)
      });

      const data = await response.json();

      dashboardData = {
        ...data,
        dailyLeads: (data.dailyLeads || []).filter((d: any) => d.date),
        recentLeads: (data.recentLeads || []).filter((l: any) => l.name),
        topCourses: (data.topCourses || []).filter((c: any) => c.name),
        categories: data.categories || []
      };
      
      currentPage = 1;
      updateDerivedValues();
    } catch (error) {
      console.error('[v0] Error fetching dashboard data:', error);
    } finally {
      loading = false;
    }
  }

  function handlePeriodChange(period: string) {
    selectedPeriod = period;
    fetchDashboardData(period);
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      updateDerivedValues();
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
      updateDerivedValues();
    }
  }

  function goToPage(page: number) {
    currentPage = page;
    updateDerivedValues();
  }

  function updateDerivedValues() {
    maxDailyLeads = dashboardData.dailyLeads.length ? Math.max(...dashboardData.dailyLeads.map(d => d.count || 0)) : 1;
    maxCourseCount = dashboardData.topCourses.length ? Math.max(...dashboardData.topCourses.map(c => c.count || 0)) : 1;
    paginatedLeads = (dashboardData.recentLeads || []).filter(lead => lead.name).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    totalPages = Math.ceil((dashboardData.recentLeads || []).filter(lead => lead.name).length / itemsPerPage);
  }
</script>

<div class="min-h-screen bg-zinc-950">
  <Sidebar currentPath="/dashboard" bind:collapsed={sidebarCollapsed} />
  
  <main class="transition-all duration-300 {sidebarCollapsed ? 'ml-20' : 'ml-64'} p-8">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white">Dashboard</h1>
        <p class="text-zinc-400 mt-1">Visão geral dos seus leads e métricas</p>
      </div>
    </div>
    
    <!-- Usar variáveis locais em vez de $store -->
    {#if isLoading}
      <div class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-zinc-400">Carregando...</p>
        </div>
      </div>
    {:else}
      <!-- Indicador de empresa selecionada para franqueadora -->
      {#if isFranqueadoraLocal}
        <div class="mb-4 px-4 py-2 rounded-lg inline-flex items-center gap-2 {selectedCompanyLocal ? 'bg-green-600/20 border border-green-600/50' : 'bg-blue-600/20 border border-blue-600/50'}">
          <svg class="w-4 h-4 {selectedCompanyLocal ? 'text-green-500' : 'text-blue-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
          <span class="{selectedCompanyLocal ? 'text-green-500' : 'text-blue-500'} text-sm font-medium">
            {selectedCompanyLocal ? `Visualizando: ${selectedCompanyLocal.name}` : 'Visualizando: Todas as Empresas'}
          </span>
        </div>
      {/if}

      <!-- Period Selector -->
      <div class="mb-8">
        <PeriodSelector {selectedPeriod} onPeriodChange={handlePeriodChange} />
      </div>

      {#if loading}
        <div class="flex items-center justify-center py-12">
          <div class="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      {:else}
        <!-- Stats Cards -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard title="Total de Leads" value={dashboardData.totalLeads} color="bg-red-500" />
          <StatCard title="Técnicos" value={dashboardData.tecnicos} color="bg-green-500" />
          <StatCard title="Profissionalizante" value={dashboardData.profissionalizante} color="bg-blue-500" />
          <StatCard title="Superior" value={dashboardData.superior} color="bg-orange-500" />
          <StatCard title="Anúncio Geral" value={dashboardData.outros} color="bg-purple-500" />
        </div>

        <!-- Daily Leads Chart -->
        <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
          <h3 class="text-lg font-semibold text-white mb-6">Leads Por Dia</h3>
          <div class="h-80 flex items-end justify-between gap-2">
            {#each dashboardData.dailyLeads || [] as day}
              {@const heightPercent = (day.count / maxDailyLeads) * 100}
              <div class="flex-1 flex flex-col items-center gap-2">
                <div class="relative w-full flex flex-col items-center">
                  <span class="text-xs font-medium text-white mb-1">{day.count}</span>
                  <div
                    class="w-full rounded-t transition-all hover:opacity-80 bg-green-600"
                    style="height: {heightPercent * 2.5}px; min-height: 4px;"
                  ></div>
                </div>
                <span class="text-xs text-zinc-400">{day.date}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Categories and Top Courses -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <!-- Pie Chart -->
          <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-white mb-6">Categorias em %</h3>
            <div class="flex items-center justify-center">
              <svg class="w-64 h-64" viewBox="0 0 100 100">
                {#each dashboardData.categories || [] as category, i}
                  {@const total = dashboardData.categories.reduce((sum, c) => sum + c.value, 0)}
                  {@const percentage = total > 0 ? (category.value / total) * 100 : 0}
                  {#if percentage >= 99.9}
                    <circle cx="50" cy="50" r="40" fill={category.color} opacity="0.9" />
                  {:else if percentage > 0}
                    {@const startAngle = dashboardData.categories.slice(0, i).reduce((sum, c) => sum + (c.value / total) * 360, 0)}
                    {@const endAngle = startAngle + (percentage / 100) * 360}
                    {@const largeArc = percentage > 50 ? 1 : 0}
                    {@const startRad = (startAngle - 90) * Math.PI / 180}
                    {@const endRad = (endAngle - 90) * Math.PI / 180}
                    {@const x1 = 50 + 40 * Math.cos(startRad)}
                    {@const y1 = 50 + 40 * Math.sin(startRad)}
                    {@const x2 = 50 + 40 * Math.cos(endRad)}
                    {@const y2 = 50 + 40 * Math.sin(endRad)}
                    <path d="M 50 50 L {x1} {y1} A 40 40 0 {largeArc} 1 {x2} {y2} Z" fill={category.color} opacity="0.9" />
                  {/if}
                {/each}
              </svg>
            </div>
            <div class="flex flex-col gap-2 mt-4">
              {#each dashboardData.categories || [] as category}
                {@const total = dashboardData.categories.reduce((sum, c) => sum + c.value, 0)}
                {@const percentage = total > 0 ? ((category.value / total) * 100).toFixed(1) : '0.0'}
                <div class="flex items-center gap-3">
                  <div class="w-3 h-3 rounded-sm" style="background-color: {category.color}"></div>
                  <span class="text-sm text-zinc-400 flex-1">{category.name}</span>
                  <span class="text-sm font-medium text-white">{percentage}%</span>
                </div>
              {/each}
            </div>
          </div>

          <!-- Top Courses -->
          <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-white mb-6">Top 5 Cursos Mais Procurados</h3>
            <div class="space-y-4">
              {#each dashboardData.topCourses || [] as course, i}
                {@const widthPercent = (course.count / maxCourseCount) * 100}
                {@const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500']}
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-white font-medium truncate flex-1">{course.name}</span>
                    <span class="text-zinc-400 ml-2">{course.count}</span>
                  </div>
                  <div class="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                    <div class="{colors[i % colors.length]} h-full rounded-full transition-all duration-500" style="width: {widthPercent}%"></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Recent Leads Table -->
        <div class="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div class="p-6 border-b border-zinc-800 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-white">Leads Recentes</h3>
            <span class="text-sm text-zinc-400">
              {(dashboardData.recentLeads || []).filter(l => l.name).length} leads no total
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-zinc-800 bg-zinc-800/50">
                  <th class="text-left p-4 text-sm font-medium text-zinc-400">Nome</th>
                  <th class="text-left p-4 text-sm font-medium text-zinc-400">Categoria</th>
                  <th class="text-left p-4 text-sm font-medium text-zinc-400">Curso</th>
                  <th class="text-left p-4 text-sm font-medium text-zinc-400">Telefone</th>
                  <th class="text-left p-4 text-sm font-medium text-zinc-400">Criação</th>
                </tr>
              </thead>
              <tbody>
                {#each paginatedLeads as lead}
                  <tr class="border-b border-zinc-800 transition-all hover:bg-zinc-800/50 hover:border-l-4 hover:border-l-green-600">
                    <td class="p-4 text-sm text-white">{lead.name}</td>
                    <td class="p-4 text-sm text-white">{lead.category}</td>
                    <td class="p-4 text-sm text-white">{lead.course}</td>
                    <td class="p-4 text-sm text-zinc-400">{lead.phone}</td>
                    <td class="p-4 text-sm text-zinc-400">{lead.data_cadastro}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          {#if totalPages > 1}
            <div class="p-4 border-t border-zinc-800 flex items-center justify-between">
              <div class="text-sm text-zinc-400">
                Página {currentPage} de {totalPages}
              </div>
              <div class="flex items-center gap-2">
                <button
                  onclick={previousPage}
                  disabled={currentPage === 1}
                  class="px-3 py-1.5 text-sm rounded-md border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <button
                  onclick={nextPage}
                  disabled={currentPage === totalPages}
                  class="px-3 py-1.5 text-sm rounded-md border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </main>
</div>
