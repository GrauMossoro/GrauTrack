<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import Sidebar from '$lib/components/layout/sidebar.svelte';

  const { user, isAuthenticated, isFranqueadora, effectiveCompanyId, selectedCompany, isManager } = authStore;

  let isAuthenticatedValue = false;
  let sidebarCollapsed = $state(false);
  
  let isFranqueadoraValue = $state(false);
  let isManagerValue = $state(false);
  let selectedCompanyValue = $state(null);
  let effectiveCompanyIdValue = $state(null);
  let userValue = $state(null);

  // Plan Usage State
  let planUsage = $state({ disparos_used: 0, disparo_limit: 0, planName: '' });
  let loadingUsage = $state(false);

  // Tabs
  let activeTab = $state('lista'); // 'lista' | 'disparar'

  // Lista State
  let blasts = $state([]);
  let loadingHistory = $state(false);
  let openMenuId = $state(null as number | null);
  let menuPosition = $state({ x: 0, y: 0 });
  let showBlastModal = $state(false);
  let blastModalData = $state<any>(null);

  // Connections State
  let connections = $state([]);
  let loadingConnections = $state(false);
  // Allowed channels (números disponíveis para disparo)
  let allowedChannels = $state<any[]>([]);

  // Disparar State
  let blastForm = $state({
    name: '',
    message: '',
    image: null as File | null,
    useAI: false,
    randomInterval: false,
    channel: '',
    leadSegment: 'all' // 'all' | 'filtered' (future)
  });
  let sending = $state(false);
  let sendingProgress = $state({ sent: 0, total: 0, status: 'idle' }); // idle, sending, completed
  let imagePreview = $state('');
  let showConfirmModal = $state(false);
  let isForceSend = $state(false);
  // Uploaded spreadsheet numbers
  let uploadedNumbers = $state<string[]>([]);
  let uploading = $state(false);
  // Raw uploaded file to be sent to backend if client can't parse
  let uploadedFile = $state(null);
  

  async function handleSpreadsheetFile(file: File) {
    // reuse existing logic from handleSpreadsheetSelect but accepts File directly
    const name = file.name.toLowerCase();
    uploading = true;
    try {
      // Always preserve the raw file to send to backend
      uploadedFile = file;
      uploadedNumbers = [];
      if (file.type.startsWith('text') || name.endsWith('.csv') || name.endsWith('.txt')) {
        const text = await file.text();
        const candidates = text.split(/[\r\n]+/).flatMap(line => line.split(/[;,]+/));
        const nums = candidates
          .map(s => (s || '').replace(/[^0-9+]/g, ''))
          .map(s => s.replace(/^\+/, ''))
          .map(s => s.replace(/^0+/, ''))
          .filter(s => s.length >= 8 && s.length <= 15);
        uploadedNumbers = Array.from(new Set(nums));
        if (uploadedNumbers.length === 0) uploadedFile = file;
      } else {
        uploadedFile = file;
        try {
          const buffer = await file.arrayBuffer();
          const text = new TextDecoder('utf-8').decode(buffer);
          const nums = Array.from(text.matchAll(/\+?[0-9][0-9\s\-().]{6,20}[0-9]/g)).map(m => m[0].replace(/[^0-9]/g, '')).map(s => s.replace(/^0+/, '')).filter(s => s.length >= 8 && s.length <= 15);
          uploadedNumbers = Array.from(new Set(nums));
        } catch (inner) {
          // ignore
        }
      }
    } catch (error) {
      console.error('[Disparo] Erro ao processar planilha:', error);
      alert('Erro ao processar arquivo.');
      uploadedNumbers = [];
      uploadedFile = null;
    } finally {
      uploading = false;
    }
  }

  onMount(() => {
    const unsubAuth = isAuthenticated.subscribe((value) => {
      isAuthenticatedValue = value;
      if (!value) {
        goto('/');
      }
    });
    
    const unsubFranqueadora = isFranqueadora.subscribe(value => {
      isFranqueadoraValue = value;
    });
    
    const unsubSelectedCompany = selectedCompany.subscribe(value => {
      selectedCompanyValue = value;
    });

    const unsubEffectiveCompany = effectiveCompanyId.subscribe(value => {
      effectiveCompanyIdValue = value;
      if (value) {
        fetchBlasts();
        fetchPlanUsage();
        fetchConnections();
        // Chamar fetchAllowedChannels somente se já tivermos o usuário carregado
        if (userValue) fetchAllowedChannels();
      }
    });

    const unsubUser = user.subscribe(value => {
      userValue = value;
      // Se já tivermos companyId, carregar canais assim que o usuário estiver disponível
      if (effectiveCompanyIdValue) fetchAllowedChannels();
    });

    if (isAuthenticatedValue) {
      fetchBlasts();
      fetchPlanUsage();
      fetchConnections();
      // fetchAllowedChannels será chamado automaticamente quando ambos os valores estiverem definidos
    }

    const unsubManager = isManager.subscribe(value => {
      isManagerValue = value;
    });

    return () => {
      unsubAuth();
      unsubFranqueadora();
      unsubSelectedCompany();
      unsubEffectiveCompany();
      unsubUser();
      unsubManager();
    };
  });

  async function fetchPlanUsage() {
    // TODO: Replace with actual webhook
    // const WEBHOOK_URL = 'https://auto.agiussolar.cloud/webhook/leads-blast-usage';
    
    loadingUsage = true;
    try {
      // Mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Simulating different plans based on company ID (mock)
      // Matching structure of 'companies' table
      const mockUsage = {
        disparos_used: 12500,
        disparo_limit: 30000,
        planName: 'Basic' // This might come from a join or separate query
      };
      
      planUsage = mockUsage;
    } catch (error) {
      console.error('[v0] Error fetching plan usage:', error);
    } finally {
      loadingUsage = false;
    }
  }

  async function fetchBlasts() {
    const WEBHOOK_URL = 'https://auto.agiussolar.cloud/webhook/listar-disparos-pendentes';

    loadingHistory = true;
    try {
      const uid = userValue?.id ?? userValue?.userId ?? userValue?.userid ?? userValue?.user_id ?? null;
      const payload = { companyId: effectiveCompanyIdValue, userId: uid, userRole: userValue?.role };

      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json().catch(() => null);

      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.lista)) {
        list = data.lista;
      } else if (data && Array.isArray(data.disparos)) {
        list = data.disparos;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      }

      // Normalize items to UI shape
      blasts = list.map((item: any) => ({
        id: item.id ?? item.disparoId ?? item._id ?? Date.now(),
        name: item.name ?? item.nome ?? item.campaignName ?? item.title ?? 'Lista',
        user: item.user ?? item.usuario ?? item.userName ?? (item.createdBy || (item.user && item.user.name)) ?? 'Usuário',        total: item.total ?? item.total_numbers ?? item.total_sent ?? 0,
        success: item.success ?? item.success_count ?? item.sentSuccess ?? 0,
        failure: item.failure ?? item.failure_count ?? item.failed ?? 0,
        date: item.date ?? item.created_at ?? item.createdAt ?? new Date().toISOString(),
        status: item.status ?? item.estado ?? item.situacao ?? 'approved'
      }));
    } catch (error) {
      console.error('[v0] Error fetching blasts:', error);
      blasts = [];
    } finally {
      loadingHistory = false;
    }
  }

  async function fetchConnections() {
    // TODO: Replace with actual webhook
    const WEBHOOK_URL = 'https://auto.agiussolar.cloud/webhook/listar-conexoes';
    
    loadingConnections = true;
    try {
      // Mock data for now if webhook fails or is not ready
      // In production:
      /*
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: effectiveCompanyIdValue })
      });
      const data = await response.json();
      connections = data;
      */

      // Mock
      await new Promise(resolve => setTimeout(resolve, 500));
      connections = [
        { id: 1, name: 'Suporte Comercial', number: '5511999999999', status: 'connected' },
        { id: 2, name: 'Atendimento', number: '5511888888888', status: 'disconnected' }
      ];

    } catch (error) {
      console.error('[Disparo] Error fetching connections:', error);
    } finally {
      loadingConnections = false;
    }
  }

  async function fetchAllowedChannels() {
    loadingConnections = true;
    try {
      const uid = userValue?.id ?? userValue?.userId ?? userValue?.userid ?? userValue?.user_id ?? null;
      const payload = {
        companyId: effectiveCompanyIdValue,
        userId: uid
      };

      if (!uid) {
        console.warn('[Disparo] userId ausente ao chamar numeros-disparos, enviando null. userValue=', userValue);
      }

      const response = await fetch('https://auto.agiussolar.cloud/webhook/numeros-disparos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.lista)) {
        list = data.lista;
      } else if (data && Array.isArray(data.numeros)) {
        list = data.numeros;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      }

      // Normalize items to have { numero, nomeConexao, status }
      allowedChannels = list.map((item: any) => ({
        numero: item.numero || item.number || item.phone,
        nomeConexao: item.nomeConexao || item.name || item.label || '',
        status: (item.status || item.status_conexao || item.connected) ? (String(item.status || item.status_conexao || item.connected)) : 'connected'
      }));

    } catch (error) {
      console.error('[Disparo] Error fetching allowed channels:', error);
      allowedChannels = [];
    } finally {
      loadingConnections = false;
    }
  }

  function handleImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      blastForm.image = input.files[0];
      imagePreview = URL.createObjectURL(input.files[0]);
    }
  }

  async function handleSpreadsheetSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const name = file.name.toLowerCase();
    uploading = true;
    try {
      // Always preserve the raw file to send to backend
      uploadedFile = file;
      uploadedNumbers = [];
      // If it's a text-like file or CSV by extension, parse client-side
      if (file.type.startsWith('text') || name.endsWith('.csv') || name.endsWith('.txt')) {
        const text = await file.text();
        // Split by lines and common separators; extract number-like sequences
        const candidates = text.split(/[\r\n]+/).flatMap(line => line.split(/[;,]+/));
        const nums = candidates
          .map(s => (s || '').replace(/[^0-9+]/g, ''))
          .map(s => s.replace(/^\+/, ''))
          .map(s => s.replace(/^0+/, ''))
          .filter(s => s.length >= 8 && s.length <= 15);
        uploadedNumbers = Array.from(new Set(nums));
      } else {
        // For binary spreadsheets (xlsx, xls, ods, etc), keep the file to send to backend
        // Try best-effort decode to text to extract numbers (may or may not work)
        try {
          const buffer = await file.arrayBuffer();
          const text = new TextDecoder('utf-8').decode(buffer);
          const nums = Array.from(text.matchAll(/\+?[0-9][0-9\s\-().]{6,20}[0-9]/g)).map(m => m[0].replace(/[^0-9]/g, ''))
            .map(s => s.replace(/^0+/, ''))
            .filter(s => s.length >= 8 && s.length <= 15);
          uploadedNumbers = Array.from(new Set(nums));
        } catch (inner) {
          // ignore
        }
      }
    } catch (error) {
      console.error('[Disparo] Erro ao processar planilha:', error);
      alert('Erro ao processar arquivo.');
      uploadedNumbers = [];
      uploadedFile = null;
    } finally {
      uploading = false;
      // reset input value to allow re-upload same file
      if (input) input.value = '';
    }
  }

  function handleSend(force = false) {
    // 1. Validate Spreadsheet
    if (uploadedNumbers.length === 0 && !uploadedFile) {
      alert('Por favor, faça upload de uma planilha de números.');
      return;
    }

    // 2. Validate Content (Message OR Image)
    if (!blastForm.message && !blastForm.image) {
      alert('Por favor, digite uma mensagem ou selecione uma imagem.');
      return;
    }

    // 3. Validate Company/User
    if (!effectiveCompanyIdValue && !userValue?.companyId) {
      alert('Erro: Empresa não identificada.');
      return;
    }

    // 4. Validate Plan
    if (planUsage.disparo_limit > 0 && planUsage.disparos_used >= planUsage.disparo_limit) {
      alert('Limite de disparos do plano atingido!');
      return;
    }

    isForceSend = force;
    showConfirmModal = true;
  }

  async function executeSend() {
    showConfirmModal = false;
    const force = isForceSend;

    console.debug('[Disparo] executeSend called', { effectiveCompanyIdValue, userValue, blastForm, uploadedNumbers, uploadedFile });
    
    // Determine whether this send requires approval (user is funcionario and not forcing)
    const requiresApproval = (userValue?.role === 'funcionario') && !force;

    sending = true;
    sendingProgress = { sent: 0, total: 0, status: 'sending' };

    const WEBHOOK_URL = 'https://auto.agiussolar.cloud/webhook/novo-disparo';

    try {
      // Build payload
      const uid = userValue?.id ?? userValue?.userId ?? userValue?.userid ?? userValue?.user_id ?? null;
      
      // Find connection name from selected channel
      const selectedConnection = allowedChannels.find(ch => ch.numero === blastForm.channel);
      const channelName = selectedConnection?.nomeConexao || '';

      if (uploadedFile) {
        // Send FormData with file + metadata
        const form = new FormData();
        form.append('file', uploadedFile);
        form.append('name', blastForm.name || '');
        form.append('message', blastForm.message || '');
        form.append('channel', blastForm.channel || '');
        form.append('channelName', channelName);
        form.append('companyId', String(effectiveCompanyIdValue));
        form.append('userId', uid ? String(uid) : '');
        form.append('userRole', userValue?.role || '');
        form.append('userName', userValue?.name || '');
        if (uploadedNumbers.length > 0) form.append('numbers', JSON.stringify(uploadedNumbers));
        if (blastForm.image) form.append('image', blastForm.image);

        console.debug('[Disparo] Sending FormData to', WEBHOOK_URL, { companyId: effectiveCompanyIdValue, userId: uid, keys: Array.from(form.keys()) });
        const resp = await fetch(WEBHOOK_URL, {
          method: 'POST',
          body: form
        });

        console.debug('[Disparo] Response status', resp.status, resp.statusText);
        const result = await resp.json().catch(() => ({}));
        if (resp.ok) {
          sendingProgress = { sent: 1, total: 1, status: 'completed' };
          // add to history — mark pending if requires approval
          const newBlast = { id: Date.now(), name: blastForm.name, user: userValue?.name || 'Usuário', total: result.total || 0, success: result.success || 0, failure: result.failure || 0, date: new Date().toISOString(), status: (requiresApproval ? 'pending' : 'approved') };
          blasts = [newBlast, ...blasts];
          if (requiresApproval) {
            openFeedback && openFeedback('info', 'Enviado', 'Disparo enviado para aprovação do coordenador.');
            alert('Disparo enviado para aprovação do coordenador.');
          } else {
            openFeedback && openFeedback('success', 'Sucesso', 'Disparo criado com sucesso.');
          }
        } else {
          console.error('[Disparo] erro novo-disparo', result);
          alert('Erro ao criar disparo: ' + (result?.message || resp.statusText));
        }
      } else {
        // Send JSON payload (numbers array or empty => backend decides)
        const payload = {
          name: blastForm.name,
          message: blastForm.message,
          channel: blastForm.channel,
          channelName: channelName,
          companyId: effectiveCompanyIdValue,
          userId: uid,
          userRole: userValue?.role || '',
          numbers: uploadedNumbers // may be []
        };

        if (blastForm.image) {
          // If image exists but no file to upload, convert to blob via fetch of preview URL when possible
          try {
            const imageFile = blastForm.image;
            const form = new FormData();
            form.append('image', imageFile);
            form.append('payload', JSON.stringify(payload));
            console.debug('[Disparo] Sending image FormData to', WEBHOOK_URL, { payload });
            const resp = await fetch(WEBHOOK_URL, { method: 'POST', body: form });
            console.debug('[Disparo] Response status', resp.status, resp.statusText);
            const result = await resp.json().catch(() => ({}));
            if (resp.ok) {
              sendingProgress = { sent: 1, total: 1, status: 'completed' };
              const newBlast = { id: Date.now(), name: blastForm.name, user: userValue?.name || 'Usuário', total: result.total || 0, success: result.success || 0, failure: result.failure || 0, date: new Date().toISOString(), status: (requiresApproval ? 'pending' : 'approved') };
              blasts = [newBlast, ...blasts];
              if (requiresApproval) {
                openFeedback && openFeedback('info', 'Enviado', 'Disparo enviado para aprovação do coordenador.');
                alert('Disparo enviado para aprovação do coordenador.');
              } else {
                openFeedback && openFeedback('success', 'Sucesso', 'Disparo criado com sucesso.');
              }
            } else {
              alert('Erro ao criar disparo.');
            }
          } catch (err) {
            console.error(err);
            alert('Erro ao enviar imagem.');
          }
        } else {
          console.debug('[Disparo] Sending JSON payload to', WEBHOOK_URL, { payload });
          const resp = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          console.debug('[Disparo] Response status', resp.status, resp.statusText);
          const result = await resp.json().catch(() => ({}));
          if (resp.ok) {
            sendingProgress = { sent: 1, total: 1, status: 'completed' };
            const newBlast = { id: Date.now(), name: blastForm.name, user: userValue?.name || 'Usuário', total: result.total || uploadedNumbers.length || 0, success: result.success || 0, failure: result.failure || 0, date: new Date().toISOString(), status: (requiresApproval ? 'pending' : 'approved') };
            blasts = [newBlast, ...blasts];
            if (requiresApproval) {
              openFeedback && openFeedback('info', 'Enviado', 'Disparo enviado para aprovação do coordenador.');
              alert('Disparo enviado para aprovação do coordenador.');
            } else {
              openFeedback && openFeedback('success', 'Sucesso', 'Disparo criado com sucesso.');
            }
          } else {
            console.error('[Disparo] erro novo-disparo', result);
            alert('Erro ao criar disparo: ' + (result?.message || resp.statusText));
          }
        }
      }

      // Reset form on success
      blastForm = { name: '', message: '', image: null, useAI: false, randomInterval: false, channel: '', leadSegment: 'all' };
      imagePreview = '';
      uploadedNumbers = [];
      uploadedFile = null;
      activeTab = 'lista';
    } catch (error) {
      console.error('[Disparo] Error sending blast:', error);
      alert('Erro ao enviar disparo.');
    } finally {
      sending = false;
    }
  }

  async function approveBlast(blastId: number) {
    if (!confirm('Deseja aprovar este disparo?')) return;
    
    const WEBHOOK_URL = 'https://auto.agiussolar.cloud/webhook/autorizar-disparos';
    
    try {
      const uid = userValue?.id ?? userValue?.userId ?? userValue?.userid ?? userValue?.user_id ?? null;
      const payload = {
        companyId: effectiveCompanyIdValue,
        userId: uid,
        id: blastId,
        userRole: userValue?.role ?? '',
        autorizacao: 'aprovado'
      };

      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await resp.json().catch(() => ({}));

      if (resp.ok) {
        // Update local state
        blasts = blasts.map(b => {
          if (b.id === blastId) {
            return { ...b, status: 'approved' };
          }
          return b;
        });
        alert('Disparo aprovado com sucesso!');
        // Refresh list to get updated data
        fetchBlasts();
      } else {
        console.error('[Disparo] Erro ao aprovar:', result);
        alert('Erro ao aprovar disparo: ' + (result?.message || resp.statusText));
      }
    } catch (error) {
      console.error('[Disparo] Error approving blast:', error);
      alert('Erro ao aprovar disparo.');
    }
  }

  async function cancelBlast(blastId: number) {
    if (!confirm('Deseja reprovar este disparo?')) return;
    
    const WEBHOOK_URL = 'https://auto.agiussolar.cloud/webhook/autorizar-disparos';
    
    try {
      const uid = userValue?.id ?? userValue?.userId ?? userValue?.userid ?? userValue?.user_id ?? null;
      const payload = {
        companyId: effectiveCompanyIdValue,
        userId: uid,
        id: blastId,
        userRole: userValue?.role ?? '',
        autorizacao: 'rejeitado'
      };

      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await resp.json().catch(() => ({}));

      if (resp.ok) {
        // Update local state
        blasts = blasts.map(b => {
          if (b.id === blastId) {
            return { ...b, status: 'cancelled' };
          }
          return b;
        });
        alert('Disparo reprovado com sucesso!');
        // Refresh list to get updated data
        fetchBlasts();
      } else {
        console.error('[Disparo] Erro ao reprovar:', result);
        alert('Erro ao reprovar disparo: ' + (result?.message || resp.statusText));
      }
    } catch (error) {
      console.error('[Disparo] Error canceling blast:', error);
      alert('Erro ao reprovar disparo.');
    }
  }

  async function viewBlastDetails(blastId: number) {
    showBlastModal = false;
    blastModalData = null;
    const WEBHOOK_URL = 'https://auto.agiussolar.cloud/webhook/visualizar-disparo';
    try {
      const uid = userValue?.id ?? userValue?.userId ?? userValue?.userid ?? userValue?.user_id ?? null;
      const payload = { id: blastId, userId: uid, userRole: userValue?.role ?? '', companyId: effectiveCompanyIdValue };

      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json().catch(() => null);

      if (!data) {
        alert('Erro ao carregar visualização do disparo.');
        return;
      }

      // Normalize expected fields: message/text and image (base64)
      const message = data.message ?? data.mensagem ?? data.text ?? data.body ?? '';
      let imageBase64 = data.image ?? data.imagem ?? data.image_base64 ?? data.base64 ?? null;

      let imageDataUrl = null;
      if (imageBase64) {
        // If already a data URL, use as-is
        if (String(imageBase64).startsWith('data:')) {
          imageDataUrl = imageBase64;
        } else {
          // Try to guess mime from base64 header
          const prefix = String(imageBase64).slice(0,5);
          const mime = prefix.startsWith('/9j/') ? 'image/jpeg' : (prefix.startsWith('iVBOR') ? 'image/png' : 'image/png');
          imageDataUrl = `data:${mime};base64,${imageBase64}`;
        }
      }

      blastModalData = { message, imageDataUrl, raw: data };
      showBlastModal = true;
    } catch (error) {
      console.error('[Disparo] Error viewing blast:', error);
      alert('Erro ao carregar visualização do disparo.');
    }
  }

  function closeBlastModal() {
    showBlastModal = false;
    blastModalData = null;
  }

  function downloadList(blastId: number) {
    alert(`Baixando lista do disparo ${blastId}...`);
  }

  function toggleMenu(event: MouseEvent, id: number) {
    event.stopPropagation();
    if (openMenuId === id) {
      openMenuId = null;
    } else {
      const button = event.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      
      const menuWidth = 192; // 192px = w-48 (12rem)
      const padding = 8;
      
      // Calculate horizontal position
      let x = rect.right - menuWidth;
      
      // Check if menu would overflow right edge
      if (x + menuWidth > window.innerWidth - padding) {
        x = window.innerWidth - menuWidth - padding;
      }
      
      // Check if menu would overflow left edge
      if (x < padding) {
        x = padding;
      }
      
      // Always position below button
      let y = rect.bottom + padding;
      
      menuPosition = { x, y };
      openMenuId = id;
    }
  }

  function closeMenu() {
    openMenuId = null;
  }

  async function startBlast(blastId: number) {
    if (!confirm('Deseja iniciar este disparo agora?')) return;
    
    const WEBHOOK_URL = 'https://auto.agiussolar.cloud/webhook/iniciar-disparo';
    
    try {
      const uid = userValue?.id ?? userValue?.userId ?? userValue?.userid ?? userValue?.user_id ?? null;
      const payload = {
        companyId: effectiveCompanyIdValue,
        userId: uid,
        id: blastId,
        userRole: userValue?.role ?? ''
      };

      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await resp.json().catch(() => ({}));

      if (resp.ok) {
        alert('Disparo iniciado com sucesso!');
        // Refresh list to get updated data
        fetchBlasts();
      } else {
        console.error('[Disparo] Erro ao iniciar:', result);
        alert('Erro ao iniciar disparo: ' + (result?.message || resp.statusText));
      }
    } catch (error) {
      console.error('[Disparo] Error starting blast:', error);
      alert('Erro ao iniciar disparo.');
    }
  }
</script>

<svelte:window onclick={closeMenu} />

<div class="flex min-h-screen bg-zinc-950">
  <Sidebar currentPath="/disparo" bind:collapsed={sidebarCollapsed} />
  
  <main class="flex-1 p-8 transition-all duration-300" style="margin-left: {sidebarCollapsed ? '5rem' : '16rem'}">
    <!-- Header -->
    <div class="mb-8 flex items-end justify-between">
      <div>
        <h1 class="text-3xl font-bold text-white mb-2">Disparo em Massa</h1>
        <p class="text-zinc-400">Envie mensagens para múltiplos leads</p>
        
        {#if isFranqueadoraValue && selectedCompanyValue}
          <p class="text-sm text-green-500 mt-2">
            Visualizando dados de: <span class="font-semibold">{selectedCompanyValue.name}</span>
          </p>
        {/if}
      </div>

      <!-- Plan Usage Counter -->
      {#if (!isFranqueadoraValue || selectedCompanyValue) && planUsage.disparo_limit > 0}
        <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-4 min-w-[250px]">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-zinc-400">Plano {planUsage.planName}</span>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full {planUsage.disparos_used >= planUsage.disparo_limit ? 'bg-red-900/30 text-red-500' : 'bg-green-900/30 text-green-500'}">
              {Math.round((planUsage.disparos_used / planUsage.disparo_limit) * 100)}%
            </span>
          </div>
          <div class="flex items-end gap-1 mb-2">
            <span class="text-2xl font-bold text-white">{planUsage.disparos_used.toLocaleString()}</span>
            <span class="text-sm text-zinc-500 mb-1">/ {planUsage.disparo_limit.toLocaleString()} disparos</span>
          </div>
          <div class="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div 
              class="h-full transition-all duration-500 {planUsage.disparos_used >= planUsage.disparo_limit ? 'bg-red-600' : 'bg-green-600'}"
              style="width: {Math.min((planUsage.disparos_used / planUsage.disparo_limit) * 100, 100)}%"
            ></div>
          </div>
        </div>
      {/if}
    </div>

    {#if isFranqueadoraValue && !selectedCompanyValue}
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="text-center max-w-md">
          <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-600/10 flex items-center justify-center">
            <svg class="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">Selecione uma Unidade</h2>
          <p class="text-zinc-400">
            Para visualizar os dados de disparo, selecione uma unidade no menu lateral.
          </p>
        </div>
      </div>
    {:else if sending}
      <!-- Sending / In Progress View -->
      <div class="flex flex-col items-center justify-center min-h-[500px] bg-zinc-900 border border-green-600/20 rounded-lg p-8">
        <div class="relative w-32 h-32 mb-8">
          <div class="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
          <div class="absolute inset-0 border-4 border-green-500 rounded-full border-t-transparent animate-spin"></div>
          <div class="absolute inset-0 flex items-center justify-center text-white font-bold text-xl">
            {Math.round((sendingProgress.sent / sendingProgress.total) * 100)}%
          </div>
        </div>
        
        <h2 class="text-2xl font-bold text-white mb-2">
          {sendingProgress.status === 'completed' ? 'Disparo Concluído!' : 'Enviando Mensagens...'}
        </h2>
        <p class="text-zinc-400 mb-6">
          {sendingProgress.sent} de {sendingProgress.total} mensagens enviadas
        </p>

        {#if sendingProgress.status === 'completed'}
          <div class="text-green-500 flex items-center gap-2">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>Sucesso! Redirecionando...</span>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Tabs Navigation -->
      <div class="flex gap-4 border-b border-zinc-800 mb-6">
        <button
          onclick={() => activeTab = 'lista'}
          class="px-4 py-2 text-sm font-medium transition-colors relative {activeTab === 'lista' ? 'text-green-500' : 'text-zinc-400 hover:text-white'}"
        >
          Histórico de Disparos
          {#if activeTab === 'lista'}
            <div class="absolute bottom-0 left-0 w-full h-0.5 bg-green-500"></div>
          {/if}
        </button>
        <button
          onclick={() => activeTab = 'disparar'}
          class="px-4 py-2 text-sm font-medium transition-colors relative {activeTab === 'disparar' ? 'text-green-500' : 'text-zinc-400 hover:text-white'}"
        >
          Novo Disparo
          {#if activeTab === 'disparar'}
            <div class="absolute bottom-0 left-0 w-full h-0.5 bg-green-500"></div>
          {/if}
        </button>
      </div>

      <!-- Tab Content -->
      {#if activeTab === 'lista'}
        <!-- Lista Tab -->
        <div class="bg-zinc-900 border border-green-600/20 rounded-lg overflow-hidden">
          {#if loadingHistory}
            <div class="flex items-center justify-center py-12">
              <div class="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-zinc-800 bg-zinc-800/30">
                    <th class="text-left p-4 text-sm font-medium text-zinc-400">ID</th>
                    <th class="text-left p-4 text-sm font-medium text-white">Nome da Lista</th>
                    <th class="text-left p-4 text-sm font-medium text-zinc-400">Usuário</th>
                    <th class="text-left p-4 text-sm font-medium text-zinc-400">Data</th>
                    <th class="text-center p-4 text-sm font-medium text-zinc-400">Status</th>
                    <th class="text-center p-4 text-sm font-medium text-zinc-400">Total</th>
                    <th class="text-center p-4 text-sm font-medium text-green-500">Sucesso</th>
                    <th class="text-center p-4 text-sm font-medium text-red-500">Falha</th>
                    <th class="text-right p-4 text-sm font-medium text-white">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {#each blasts as blast}
                    <tr class="border-b border-zinc-800 hover:bg-zinc-800/20 transition-all">
                      <td class="p-4 text-sm text-zinc-400">#{blast.id}</td>
                      <td class="p-4 text-sm text-white font-medium">{blast.name}</td>
                      <td class="p-4 text-sm text-zinc-400">{blast.user}</td>
                      <td class="p-4 text-sm text-zinc-400">{new Date(blast.date).toLocaleDateString()}</td>
                      <td class="p-4 text-center">
                        {#if blast.status === 'pending'}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pendente
                          </span>
                        {:else if blast.status === 'rejeitado'}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Rejeitado
                          </span>
                        {:else}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Aprovado
                          </span>
                        {/if}
                      </td>
                      <td class="p-4 text-sm text-zinc-400 text-center">{blast.total}</td>
                      <td class="p-4 text-sm text-green-500 text-center font-medium">{blast.success}</td>
                      <td class="p-4 text-sm text-red-500 text-center font-medium">{blast.failure}</td>
                      <td class="p-4 text-right">
                        <button 
                          onclick={(e) => toggleMenu(e, blast.id)}
                          class="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
                          data-blast-id={blast.id}
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td colspan="8" class="p-8 text-center text-zinc-400">
                        Nenhum disparo realizado.
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

      {:else}
        <!-- Disparar Tab -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Form -->
          <div class="bg-zinc-900 border border-green-600/20 rounded-lg p-6 space-y-6">
            <div>
              <label class="block text-sm font-medium text-white mb-2" for="blastName">Nome da Campanha</label>
              <input
                type="text"
                id="blastName"
                bind:value={blastForm.name}
                placeholder="Ex: Promoção de Natal"
                class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-white mb-2" for="blastImage">Imagem (Opcional)</label>
              <div class="relative">
                <input
                  type="file"
                  id="blastImage"
                  accept="image/*"
                  onchange={handleImageSelect}
                  class="hidden"
                />
                <label
                  for="blastImage"
                  class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-green-600 hover:bg-zinc-800/50 transition-all"
                >
                  {#if imagePreview}
                    <img src={imagePreview} alt="Preview" class="h-full object-contain" />
                  {:else}
                    <svg class="w-8 h-8 text-zinc-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span class="text-sm text-zinc-500">Clique para selecionar uma imagem</span>
                  {/if}
                </label>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-white mb-2" for="blastMessage">Mensagem</label>
              <textarea
                id="blastMessage"
                bind:value={blastForm.message}
                rows="6"
                placeholder="Digite sua mensagem aqui..."
                class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 resize-none"
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-white mb-2" for="blastSheet">Planilha de Números</label>
              <div class="relative">
                <input type="file" id="blastSheet" accept="*/*" class="hidden" onchange={(e) => { const input = e.target as HTMLInputElement; if (input.files && input.files[0]) handleSpreadsheetFile(input.files[0]); }} />
                <label for="blastSheet" class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-green-600 hover:bg-zinc-800/50 transition-all p-4">
                  <div class="flex items-center gap-3">
                    <svg class="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m10 12V4M3 20h18"/>
                    </svg>
                    <div class="text-sm text-zinc-400">Arraste e solte sua planilha ou clique para selecionar</div>
                  </div>
                </label>
              </div>

              {#if uploading}
                <div class="text-xs text-zinc-400 mt-2">Processando...</div>
              {/if}

              {#if uploadedNumbers.length > 0}
                <div class="mt-2 bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-zinc-300">
                  <div class="font-medium mb-1">Preview (até 5)</div>
                  <ul class="list-disc pl-4">
                    {#each uploadedNumbers.slice(0,5) as n}
                      <li>{n}</li>
                    {/each}
                  </ul>
                  {#if uploadedNumbers.length > 5}
                    <div class="mt-1 text-zinc-500">... e mais {uploadedNumbers.length - 5}</div>
                  {/if}
                  <div class="mt-2 text-right">
                    <button onclick={() => uploadedNumbers = []} class="text-xs text-red-400 hover:text-red-300">Remover</button>
                  </div>
                </div>
              {:else if uploadedFile}
                <div class="mt-2 bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-zinc-300">
                  <div class="font-medium mb-1">Arquivo carregado</div>
                  <div class="text-zinc-200">{uploadedFile.name}</div>
                  <div class="text-zinc-500 text-xs mt-1">Este arquivo será enviado ao backend para extração dos números.</div>
                  <div class="mt-2 text-right">
                    <button onclick={() => { uploadedFile = null; uploadedNumbers = []; }} class="text-xs text-red-400 hover:text-red-300">Remover</button>
                  </div>
                </div>
              {/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-white mb-2" for="blastChannel">Canal de Envio</label>
              <select
                id="blastChannel"
                bind:value={blastForm.channel}
                class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
              >
                <option value="">Selecione um canal...</option>
                {#each allowedChannels as chan}
                  <option value={chan.numero} disabled={chan.status && chan.status.toLowerCase() !== 'connected' && chan.status.toLowerCase() !== 'conectado'}>
                    {chan.nomeConexao} ({chan.numero}) {chan.status ? `- ${chan.status}` : ''}
                  </option>
                {/each}
                {#if allowedChannels.length === 0}
                  <option value="" disabled>Nenhum canal de envio disponível</option>
                {/if}
              </select>
              <div class="mt-2 text-right">
                <a href="/conexoes" class="text-xs text-green-500 hover:text-green-400">Gerenciar Conexões &rarr;</a>
              </div>
            </div>

            <button
              onclick={() => handleSend(false)}
              class="w-full py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-900/20"
            >
              Iniciar Disparo
            </button>
            <button
              onclick={() => handleSend(true)}
              class="w-full mt-2 py-2 bg-transparent border border-zinc-700 text-zinc-300 rounded-lg hover:border-green-600 hover:text-white transition-colors"
              title="Forçar envio mesmo se usuário for funcionário (apenas para testes)"
            >
              Forçar Envio (teste)
            </button>
          </div>

          <!-- Preview -->
          <div class="hidden lg:block">
            <div class="sticky top-8">
              <h3 class="text-lg font-medium text-white mb-4">Pré-visualização</h3>
              <div class="bg-[#E5DDD5] rounded-lg p-4 max-w-sm mx-auto shadow-xl min-h-[400px] relative">
                <!-- Message Bubble -->
                <div class="bg-white rounded-lg p-2 shadow-sm max-w-[85%] mb-2">
                  {#if imagePreview}
                    <img src={imagePreview} alt="Preview" class="w-full rounded-lg mb-2" />
                  {/if}
                  <p class="text-sm text-gray-800 whitespace-pre-wrap">{blastForm.message || 'Sua mensagem aparecerá aqui...'}</p>
                  <div class="text-[10px] text-gray-500 text-right mt-1">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/if}
    <!-- Dropdown Menu (rendered at document level to avoid overflow issues) -->
    {#if openMenuId !== null}
      {#each blasts as blast}
        {#if blast.id === openMenuId}
          <div 
            class="fixed w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[100] max-h-[calc(100vh-16px)] overflow-auto"
            style="left: {menuPosition.x}px; top: {menuPosition.y}px;"
            onclick={(e) => e.stopPropagation()}
          >
            <div class="py-1">
              <button
                onclick={() => { viewBlastDetails(blast.id); closeMenu(); }}
                class="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                Visualizar
              </button>
              
              <button
                onclick={() => { downloadList(blast.id); closeMenu(); }}
                class="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Baixar Lista
              </button>

              {#if blast.status === 'aprovado'}
                <div class="border-t border-zinc-800 my-1"></div>
                <button
                  onclick={() => { startBlast(blast.id); closeMenu(); }}
                  class="w-full text-left px-4 py-2 text-sm text-green-500 hover:bg-zinc-800 hover:text-green-400 flex items-center gap-2 font-medium"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Iniciar Disparo
                </button>
              {/if}

              {#if blast.status === 'pending' && isManagerValue}
                <div class="border-t border-zinc-800 my-1"></div>
                <button
                  onclick={() => { approveBlast(blast.id); closeMenu(); }}
                  class="w-full text-left px-4 py-2 text-sm text-green-500 hover:bg-zinc-800 hover:text-green-400 flex items-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  Aprovar
                </button>
                <button
                  onclick={() => { cancelBlast(blast.id); closeMenu(); }}
                  class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-zinc-800 hover:text-red-400 flex items-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  Reprovar
                </button>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    {/if}

    {#if showBlastModal && blastModalData}
      <!-- Blast Details Modal -->
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick={closeBlastModal}></div>
        
        <div class="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-zinc-800">
            <h3 class="text-lg font-bold text-white">Detalhes do Disparo</h3>
            <button onclick={closeBlastModal} class="text-zinc-400 hover:text-white transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto">
            {#if blastModalData.imageDataUrl}
              <div class="mb-6 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800">
                <img src={blastModalData.imageDataUrl} alt="Blast content" class="w-full h-auto object-contain max-h-[300px]" />
              </div>
            {/if}

            <div class="space-y-2">
              <label class="block text-sm font-medium text-zinc-400">Mensagem:</label>
              <div class="p-4 bg-zinc-800/50 rounded-lg border border-zinc-800">
                <p class="text-white whitespace-pre-wrap leading-relaxed">
                  {blastModalData.message || 'Nenhuma mensagem de texto.'}
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-zinc-800 flex justify-end">
            <button
              onclick={closeBlastModal}
              class="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors font-medium border border-zinc-700"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    {/if}
    {#if showConfirmModal}
      <!-- Confirmation Modal -->
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick={() => showConfirmModal = false}></div>
        
        <div class="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6">
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-white mb-2">Confirmar Disparo?</h3>
            <p class="text-zinc-400 text-sm">
              Você está prestes a enviar mensagens para 
              <span class="text-white font-medium">{uploadedNumbers.length > 0 ? uploadedNumbers.length : 'uma lista de'} contatos</span>.
            </p>
          </div>

          <div class="space-y-3">
            <button
              onclick={executeSend}
              class="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
            >
              Confirmar e Enviar
            </button>
            <button
              onclick={() => showConfirmModal = false}
              class="w-full py-3 bg-zinc-800 text-zinc-300 font-medium rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>
