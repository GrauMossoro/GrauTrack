<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import Sidebar from '$lib/components/layout/sidebar.svelte';
  import { webhook } from '$lib/api';

  const { user, isAuthenticated, effectiveCompanyId } = authStore;

  let isAuthenticatedValue = false;
  let sidebarCollapsed = $state(false);
  let userValue = $state<any>(null);
  let effectiveCompanyIdValue = $state<number | null>(null);

  let connectionForm = $state({
    name: '',
    number: ''
  });
  let loading = $state(false);
  let showQrModal = $state(false);
  let qrCodeUrl = $state('');
  let connectionId = $state<string | number | null>(null);
  let pollingInterval: any = null;

  // New state for connections list
  let connections = $state<any[]>([]);
  let loadingConnections = $state(false);
  let openMenuIndex = $state<number | null>(null); // To track which hamburger menu is open
  let pollingTarget: any = null; // Target for status polling

  onMount(() => {
    const unsubAuth = isAuthenticated.subscribe((value) => {
      isAuthenticatedValue = value;
      if (value === false) {
        goto('/');
      }
    });

    const unsubUser = user.subscribe(value => {
      userValue = value;
    });

    const unsubEffectiveCompany = effectiveCompanyId.subscribe(value => {
      effectiveCompanyIdValue = value;
    });

    // Fetch connections on mount
    fetchConnections();

    // Close menu when clicking outside
    document.addEventListener('click', handleClickOutside);

    return () => {
      unsubAuth();
      unsubUser();
      unsubEffectiveCompany();
      stopPolling();
      document.removeEventListener('click', handleClickOutside);
    };
  });

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    pollingTarget = null;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.connection-menu-button') && !target.closest('.connection-menu-dropdown')) {
      openMenuIndex = null;
    }

    // Close mass blast dropdown when clicking outside
    if (!target.closest('.massblast-button') && !target.closest('.massblast-dropdown')) {
      massBlastDropdownOpen = false;
    }
  }

  async function fetchConnections() {
    loadingConnections = true;
    try {

      const payload = {
        companyId: effectiveCompanyIdValue,
        userId: userValue?.id,
        userRole: userValue?.role
      };

      const response = await fetch(webhook('listar-numeros'), {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data && data.listaConexao) {
        connections = data.listaConexao;

        // Após carregar conexões, buscar números permitidos para disparo
        try {
          const dispPayload = {
            companyId: effectiveCompanyIdValue,
            userId: userValue?.id,
            userRole: userValue?.role
          };

          const respDisp = await fetch(webhook('numeros-disparos'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dispPayload)
          });

          const dispData = await respDisp.json();

          // dispData pode ser um array ou um objeto com chave (tentar suportar ambos)
          let allowedList: any[] = [];
          if (Array.isArray(dispData)) {
            allowedList = dispData;
          } else if (dispData && Array.isArray(dispData.lista)) {
            allowedList = dispData.lista;
          } else if (dispData && Array.isArray(dispData.numeros)) {
            allowedList = dispData.numeros;
          }

          const allowedSet = new Set(allowedList.map((x: any) => String(x.numero)));

          // Inicializar selectedMassBlast apenas com as conexões atuais que estão permitidas
          selectedMassBlast = connections.filter((c: any) => allowedSet.has(String(c.numero)));

          // Construir mapa de estados ativos a partir da lista retornada
          const map: Record<string, boolean> = {};
          for (const c of connections) {
            map[c.numero] = allowedSet.has(String(c.numero));
          }
          activeMassBlast = map;
        } catch (e) {
          console.error('[Conexões] Erro ao carregar números de disparo:', e);
          // manter comportamento padrão sem seleção
          selectedMassBlast = [];
          activeMassBlast = {};
        }
      }
    } catch (error) {
      console.error('[Conexões] Error fetching connections:', error);
    } finally {
      loadingConnections = false;
    }
  }

  async function checkConnectionStatus() {
    if (!pollingTarget) return;

    // Use GET with query parameters as "body" in GET is not standard/supported in fetch
    // However, user requested "body". If strictly implied, it should be POST.
    // Given previous endpoints were POST for actions, I will use POST here for safety with body.
    // If the backend specifically demands GET with body, this might fail in browser.
    // I'll assume POST is acceptable or the user meant "pass params".
    // For now: POST.
    const WEBHOOK_STATUS_URL = webhook('status-intancia');

    try {
      const payload = {
        nomeConexao: pollingTarget.nomeConexao,
        companyId: pollingTarget.companyId,
        numero: pollingTarget.numero
      };

      // Trying POST because fetch does not support body in GET
      const response = await fetch(WEBHOOK_STATUS_URL, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.success && data.message === 'conectado') {
        stopPolling();
        showQrModal = false;
        alert('WhatsApp conectado com sucesso!');
        connectionForm = { name: '', number: '' };
        fetchConnections(); // Refresh list
      }
    } catch (error) {
      console.error('[Conexões] Error checking status:', error);
    }
  }

  async function handleConnect() {
    if (!connectionForm.name || !connectionForm.number) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    if (!effectiveCompanyIdValue && !userValue?.companyId) {
      alert('Erro: Empresa não identificada.');
      return;
    }

    loading = true;
    const WEBHOOK_URL = webhook('criar-conexao');

    // Allow multiple numbers separated by comma / semicolon / newline
    const rawNumbers = (connectionForm.number || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const sanitizedNumbers = rawNumbers.map(n => n.replace(/\D/g, ''));

    let firstQrShown = false;
    const results: { numero: string; ok: boolean; data?: any }[] = [];

    try {
      for (const numero of sanitizedNumbers) {
        const payload = {
          name: connectionForm.name,
          number: numero,
          userId: userValue?.id,
          userName: userValue?.name,
          companyId: effectiveCompanyIdValue || userValue?.companyId
        };

        try {
          const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          results.push({ numero, ok: response.ok, data });

          if (response.ok && data.qrCode && !firstQrShown) {
            qrCodeUrl = data.qrCode;
            connectionId = data.id;
            showQrModal = true;

            pollingTarget = {
              nomeConexao: connectionForm.name,
              companyId: payload.companyId,
              numero: numero
            };

            if (pollingInterval) clearInterval(pollingInterval);
            pollingInterval = setInterval(checkConnectionStatus, 3000);
            firstQrShown = true;
          }
        } catch (innerError) {
          console.error('[Conexões] Error creating connection (one of multiple):', innerError);
          results.push({ numero, ok: false });
        }
      }

      // After attempting all, refresh list
      fetchConnections();

      const failed = results.filter(r => !r.ok).map(r => r.numero);
      if (failed.length > 0) {
        openFeedback('error', 'Alguns falharam', `Falha ao cadastrar: ${failed.join(', ')}`);
      } else if (!firstQrShown) {
        openFeedback('success', 'Sucesso', 'Número(s) cadastrados com sucesso.');
      }
    } catch (error) {
      console.error('[Conexões] Error creating connections:', error);
      alert('Erro ao conectar com o servidor.');
    } finally {
      loading = false;
    }
  }

  function closeQrModal() {
    showQrModal = false;
    stopPolling();
  }

  function toggleMenu(index: number, event: MouseEvent) {
    event.stopPropagation();
    if (openMenuIndex === index) {
      openMenuIndex = null;
    } else {
      openMenuIndex = index;
    }
  }

  // Modal State
  let showConfirmModal = $state(false);
  let confirmConfig = $state({ title: '', message: '', onConfirm: () => {} });

  let showFeedbackModal = $state(false);
  let feedbackConfig = $state({ type: 'success', title: '', message: '' });

  function openConfirm(title: string, message: string, onConfirm: () => void) {
    confirmConfig = { title, message, onConfirm };
    showConfirmModal = true;
  }

  function closeConfirm() {
    showConfirmModal = false;
  }

  function openFeedback(type: 'success' | 'error', title: string, message: string) {
    feedbackConfig = { type, title, message };
    showFeedbackModal = true;
  }

  function closeFeedback() {
    showFeedbackModal = false;
  }

  async function handleAction(action: 'connect' | 'disconnect' | 'delete', connection: any) {
    if (action === 'delete') {
      openConfirm(
        'Apagar Conexão',
        `Tem certeza que deseja apagar a conexão "${connection.nomeConexao}"?`,
        async () => {
          closeConfirm();
          try {
            loadingConnections = true;

            const payload = {
              nomeConexao: connection.nomeConexao,
              companyId: effectiveCompanyIdValue || userValue?.companyId,
              numero: connection.numero
            };

            const response = await fetch(webhook('deletar-numero'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok && data && data.success) {
              openFeedback('success', 'Sucesso', 'Conexão apagada com sucesso!');
              fetchConnections();
            } else {
              openFeedback('error', 'Erro', 'Falha ao apagar conexão: ' + (data?.message || 'Resposta inválida'));
            }
          } catch (error) {
            console.error('Erro ao apagar conexão:', error);
            openFeedback('error', 'Erro', 'Erro ao conectar com o servidor.');
          } finally {
            loadingConnections = false;
          }
        }
      );
    } else if (action === 'disconnect') {
      openConfirm(
        'Desconectar',
        `Tem certeza que deseja desconectar "${connection.nomeConexao}"?`,
        async () => {
          closeConfirm();
          try {
            loadingConnections = true;
            const payload = {
              companyId: effectiveCompanyIdValue || userValue?.companyId,
              userId: userValue?.id,
              numero: connection.numero
            };

            const response = await fetch(webhook('desconectar-numero'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
              openFeedback('success', 'Sucesso', 'Conexão desconectada com sucesso!');
              fetchConnections(); // Refresh list to update status
            } else {
              openFeedback('error', 'Erro', 'Erro ao desconectar: ' + (data.message || 'Erro desconhecido'));
            }
          } catch (error) {
            console.error('Erro ao desconectar:', error);
            openFeedback('error', 'Erro', 'Erro ao conectar com o servidor.');
          } finally {
            loadingConnections = false;
          }
        }
      );

    } else if (action === 'connect') {
      try {
        loadingConnections = true; // Use loading state to feedback user
        const response = await fetch(webhook('conectar-instancia'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nomeConexao: connection.nomeConexao })
        });
        
        const data = await response.json();
        
        if (data.success && data.qrCode) {
          qrCodeUrl = data.qrCode;
          showQrModal = true;
          
          // Setup polling target
          const currentCompanyId = effectiveCompanyIdValue || userValue?.companyId;

          pollingTarget = {
             nomeConexao: connection.nomeConexao,
             companyId: currentCompanyId, 
             numero: connection.numero
          };
          
          if (pollingInterval) clearInterval(pollingInterval);
          pollingInterval = setInterval(checkConnectionStatus, 3000);

        } else {
          openFeedback('error', 'Erro', 'Erro ao obter QR Code: ' + (data.message || 'Resposta inválida'));
        }
      } catch (error) {
        console.error('Erro ao conectar:', error);
        openFeedback('error', 'Erro', 'Erro ao conectar com o servidor.');
      } finally {
        loadingConnections = false;
      }
    }
    openMenuIndex = null;
  }
  // Mass Blast State
  // Selected connections shown in the list (starts empty)
  let selectedMassBlast = $state<any[]>([]);
  // Map numero -> boolean to control checkbox state
  let activeMassBlast = $state<Record<string, boolean>>({});
  // Dropdown open state
  let massBlastDropdownOpen = $state(false);

  function toggleMassBlastDropdown(e: Event) {
    e.stopPropagation();
    massBlastDropdownOpen = !massBlastDropdownOpen;
  }

  function toggleMassBlastOption(conn: any) {
    const exists = selectedMassBlast.find(c => c.numero === conn.numero);
    if (exists) {
      // remove
      selectedMassBlast = selectedMassBlast.filter(c => c.numero !== conn.numero);
      activeMassBlast = { ...activeMassBlast, [conn.numero]: false };
      handleMassBlastToggle(conn, false);
    } else {
      // add
      selectedMassBlast = [...selectedMassBlast, conn];
      activeMassBlast = { ...activeMassBlast, [conn.numero]: true };
      handleMassBlastToggle(conn, true);
    }
  }

  // Unified toggle function: accepts either an Event (from checkbox) or a boolean (programmatic)
  async function handleMassBlastToggle(connection: any, eventOrChecked: Event | boolean) {
    const isChecked = typeof eventOrChecked === 'boolean'
      ? eventOrChecked
      : ((eventOrChecked.target as HTMLInputElement).checked);

    // Optimistic local state update
    activeMassBlast = { ...activeMassBlast, [connection.numero]: isChecked };

    try {
      const payload = {
        nomeConexao: connection.nomeConexao,
        companyId: effectiveCompanyIdValue || userValue?.companyId,
        userId: userValue?.id,
        userRole: userValue?.role,
        numero: connection.numero,
        ativar: isChecked,
        status: isChecked // retrocompatibilidade: enviar também 'status'
      };

      const response = await fetch(webhook('ativar-disparo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data) {
        // Revert optimistic change
        activeMassBlast = { ...activeMassBlast, [connection.numero]: !isChecked };
        openFeedback('error', 'Erro', 'Falha ao atualizar status de disparo.');
      } else {
        console.log('Status de disparo atualizado:', data);
      }
    } catch (error) {
      console.error('Erro ao ativar disparo:', error);
      activeMassBlast = { ...activeMassBlast, [connection.numero]: !isChecked };
      openFeedback('error', 'Erro', 'Erro de conexão.');
    }
  }
</script>

<div class="flex min-h-screen bg-zinc-950">
  <Sidebar currentPath="/conexoes" bind:collapsed={sidebarCollapsed} />
  
  <main class="flex-1 p-8 transition-all duration-300" style="margin-left: {sidebarCollapsed ? '5rem' : '16rem'}">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2">Conectar WhatsApp</h1>
      <p class="text-zinc-400">Gerencie suas conexões de WhatsApp para disparos</p>
    </div>

    <!-- Forms Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto mb-12">
      
      <!-- Connection Form (Box 1) -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-8 h-fit">
        <h2 class="text-xl font-semibold text-white mb-6">Cadastrar Novo Número</h2>
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-white mb-2" for="connName">Nome da Conexão</label>
            <input
              type="text"
              id="connName"
              bind:value={connectionForm.name}
              placeholder="Ex: Suporte Comercial"
              class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-white mb-2" for="connNumber">Número (com DDD)</label>
            <input
              type="text"
              id="connNumber"
              bind:value={connectionForm.number}
              placeholder="Ex: 5511999999999"
              class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
            />
            <p class="text-xs text-zinc-500 mt-1">Digite apenas números, incluindo o código do país (55).</p>
          </div>

           <button
            onclick={handleConnect}
            disabled={loading}
            class="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {#if loading}
              <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processando...
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Cadastrar Número
            {/if}
          </button>
        </div>
      </div>

      <!-- Mass Blast Config (Box 2) -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-8 h-fit flex flex-col">
        <h2 class="text-xl font-semibold text-white mb-6">Configuração de Disparo</h2>
        <p class="text-sm text-zinc-400 mb-4">Selecione os números que serão utilizados para o envio de mensagens em massa.</p>
        
        <!-- Dropdown select to choose numbers for mass blast -->
        <div class="mb-4 relative">
          <label class="block text-sm font-medium text-zinc-400 mb-2">Selecione números para disparo</label>
          <div class="relative">
            <button
              type="button"
              class="massblast-button w-full text-left bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 flex items-center justify-between text-white"
              onclick={toggleMassBlastDropdown}
            >
              <span class="text-sm">
                {#if selectedMassBlast.length === 0}
                  Selecionar números...
                {:else}
                  {selectedMassBlast.length} selecionado(s)
                {/if}
              </span>
              <svg class="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {#if massBlastDropdownOpen}
              <div class="massblast-dropdown absolute z-40 mt-2 w-full max-h-64 overflow-auto bg-zinc-900 border border-zinc-800 rounded-lg p-2 shadow-lg">
                {#if connections.length === 0}
                  <div class="text-sm text-zinc-500 p-2">Nenhuma conexão disponível.</div>
                {:else}
                  {#each connections as conn}
                    <div
                      class="flex items-center justify-between p-2 rounded hover:bg-zinc-800/40 cursor-pointer"
                      onclick={() => toggleMassBlastOption(conn)}
                    >
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs">
                          {conn.nomeConexao?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div class="flex flex-col text-sm">
                          <span class="text-zinc-200">{conn.nomeConexao}</span>
                          <span class="text-xs text-zinc-500">{conn.numero}</span>
                        </div>
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- List of selected numbers -->
        <div class="flex-1 overflow-y-auto max-h-[300px] border border-zinc-800 rounded-lg bg-zinc-950/50 p-2 space-y-1 custom-scrollbar">
          {#if selectedMassBlast.length === 0}
            <div class="text-center py-8 text-zinc-500 text-sm">Nenhum número selecionado.</div>
          {:else}
            {#each selectedMassBlast as conn}
              <label class="flex items-center justify-between p-3 rounded-md hover:bg-zinc-800/50 cursor-pointer transition-colors group">
                <div class="flex items-center gap-3">
                   <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs">
                     {conn.nomeConexao?.charAt(0).toUpperCase() || '?'}
                   </div>
                   <div class="flex flex-col">
                     <span class="text-sm font-medium text-zinc-200 group-hover:text-white">{conn.nomeConexao}</span>
                     <span class="text-xs text-zinc-500">{conn.numero}</span>
                   </div>
                </div>
                
                <div class="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    value="" 
                    class="sr-only peer"
                    checked={!!activeMassBlast[conn.numero]}
                    onchange={(e) => { e.stopPropagation(); handleMassBlastToggle(conn, e); }}
                  >
                  <div class="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                </div>
              </label>
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <!-- Connections List -->
    <div class="max-w-7xl mx-auto">
      <h2 class="text-xl font-semibold text-white mb-6 flex items-center justify-between">
        Números Cadastrados - {connections.length}
        {#if loadingConnections}
          <div class="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        {/if}
      </h2>

      {#if connections.length === 0 && !loadingConnections}
        <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <div class="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-white mb-2">Nenhuma conexão encontrada</h3>
          <p class="text-zinc-400">Crie uma nova conexão acima para começar.</p>
        </div>
      {:else}
        <div class="grid gap-4">
          {#each connections as conn, index}
            <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors hover:border-zinc-700">
              <div class="flex items-start gap-4">
                <div class="w-12 h-12 bg-green-900/20 rounded-lg flex items-center justify-center flex-shrink-0 text-green-500">
                  <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                     <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-white">{conn.nomeConexao || 'Conexão sem nome'}</h3>
                  <div class="text-sm text-zinc-400 flex flex-col sm:flex-row sm:gap-4">
                     <span>{conn.nomeWhatsApp || 'WhatsApp'}</span>
                     <span class="hidden sm:inline text-zinc-700">•</span>
                     <span>{conn.numero}</span>
                  </div>
                  <div class="text-xs text-zinc-600 mt-1">
                    Cadastrado em: {conn.cadastroEm || '-'}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                {#if conn.status?.toLowerCase() === 'conectado'}
                  <span class="px-3 py-1 bg-green-900/30 text-green-400 text-xs font-medium rounded-full border border-green-900/50 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    Conectado
                  </span>
                {:else}
                  <span class="px-3 py-1 bg-red-900/30 text-red-400 text-xs font-medium rounded-full border border-red-900/50 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    Desconectado
                  </span>
                {/if}

                <!-- Menu Container with dynamic z-index to appear above siblings -->
                <div class="relative" style="z-index: {openMenuIndex === index ? 20 : 0}">
                  <button
                    type="button"
                    class="connection-menu-button p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                    onclick={(e) => toggleMenu(index, e)}
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                    </svg>
                  </button>

                  {#if openMenuIndex === index}
                    <div class="connection-menu-dropdown absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 py-1">
                      {#if conn.status?.toLowerCase() === 'conectado'}
                         <button
                          type="button"
                          class="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                          onclick={() => handleAction('disconnect', conn)}
                        >
                          Desconectar
                        </button>
                      {:else}
                         <button
                          type="button"
                          class="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                          onclick={() => handleAction('connect', conn)}
                        >
                          Conectar
                        </button>
                      {/if}
                      
                      <button
                        type="button"
                        class="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 transition-colors"
                        onclick={() => handleAction('delete', conn)}
                      >
                        Apagar
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </main>

  <!-- QR Code Modal -->
  {#if showQrModal}
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full relative shadow-2xl">
        <button 
          onclick={closeQrModal}
          class="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <div class="text-center">
          <h2 class="text-2xl font-bold text-white mb-2">Escaneie o QR Code</h2>
          <p class="text-zinc-400 mb-6">Abra o WhatsApp no seu celular > Configurações > Aparelhos conectados > Conectar aparelho</p>
          
          <div class="bg-white p-4 rounded-lg inline-block mb-6">
            {#if qrCodeUrl.startsWith('http')}
              <img src={qrCodeUrl} alt="QR Code" class="w-64 h-64 object-contain" />
            {:else}
              <!-- Assuming base64 if not http -->
              <img src={`data:image/png;base64,${qrCodeUrl}`} alt="QR Code" class="w-64 h-64 object-contain" />
            {/if}
          </div>

          <div class="flex items-center justify-center gap-2 text-green-500 animate-pulse">
            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
            <span class="text-sm font-medium">Aguardando leitura...</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Confirm Modal -->
  {#if showConfirmModal}
    <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
        <h3 class="text-xl font-bold text-white mb-2">{confirmConfig.title}</h3>
        <p class="text-zinc-400 mb-6">{confirmConfig.message}</p>
        <div class="flex justify-end gap-3">
          <button 
            onclick={closeConfirm}
            class="px-4 py-2 text-zinc-300 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button 
            onclick={confirmConfig.onConfirm}
            class="px-4 py-2 bg-red-600/20 text-red-500 hover:bg-red-600/30 font-medium rounded-lg transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Feedback Modal -->
  {#if showFeedbackModal}
    <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200 text-center">
        {#if feedbackConfig.type === 'success'}
          <div class="w-12 h-12 bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        {:else}
          <div class="w-12 h-12 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
        {/if}
        
        <h3 class="text-xl font-bold text-white mb-2">{feedbackConfig.title}</h3>
        <p class="text-zinc-400 mb-6">{feedbackConfig.message}</p>
        
        <button 
          onclick={closeFeedback}
          class="w-full px-4 py-2 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  {/if}
</div>
