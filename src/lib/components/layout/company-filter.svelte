<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  
  const { user, isFranqueadora, companies, selectedCompany, fetchCompanies, selectCompany } = authStore;
  
  let showDropdown = $state(false);
  let searchTerm = $state('');
  let companiesList: Array<{id: number, name: string}> = [];
  
  const filteredCompanies = companiesList.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  onMount(() => {
    const unsubFranqueadora = isFranqueadora.subscribe((value) => {
      if (value) {
        fetchCompanies();
      }
    });
    
    const unsubCompanies = companies.subscribe((value) => {
      companiesList = value || [];
    });
    
    return () => {
      unsubFranqueadora();
      unsubCompanies();
    };
  });
  
  function handleSelectCompany(company: { id: number; name: string } | null) {
    selectCompany(company);
    showDropdown = false;
    searchTerm = '';
  }
  
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.company-filter-dropdown')) {
      showDropdown = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

{#if $isFranqueadora}
  <div class="company-filter-dropdown relative">
    <button
      type="button"
      onclick={() => showDropdown = !showDropdown}
      class="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700 transition-colors min-w-[200px]"
    >
      <!-- Ícone de empresa -->
      <svg class="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
      </svg>
      <span class="flex-1 text-left text-sm truncate">
        {$selectedCompany ? $selectedCompany.name : 'Selecionar Empresa'}
      </span>
      <!-- Ícone de seta -->
      <svg class="w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform {showDropdown ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
    
    {#if showDropdown}
      <div class="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
        <!-- Campo de busca -->
        <div class="p-2 border-b border-zinc-700">
          <input
            type="text"
            placeholder="Buscar empresa..."
            bind:value={searchTerm}
            class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-green-600"
          />
        </div>
        
        <!-- Lista de empresas -->
        <div class="max-h-60 overflow-y-auto">
          <!-- Opção para limpar seleção -->
          {#if $selectedCompany}
            <button
              type="button"
              onclick={() => handleSelectCompany(null)}
              class="w-full px-4 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Limpar seleção
            </button>
          {/if}
          
          {#each filteredCompanies as company}
            <button
              type="button"
              onclick={() => handleSelectCompany(company)}
              class="w-full px-4 py-2 text-left text-sm hover:bg-zinc-800 transition-colors flex items-center justify-between {$selectedCompany?.id === company.id ? 'bg-green-600/20 text-green-500' : 'text-white'}"
            >
              <span class="truncate">{company.name}</span>
              {#if $selectedCompany?.id === company.id}
                <svg class="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              {/if}
            </button>
          {:else}
            <div class="px-4 py-3 text-sm text-zinc-500 text-center">
              {searchTerm ? 'Nenhuma empresa encontrada' : 'Carregando empresas...'}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
