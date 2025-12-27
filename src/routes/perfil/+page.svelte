<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import Sidebar from '$lib/components/layout/sidebar.svelte';
  import { webhook } from '$lib/api';

  let isAuthenticated = false;
  let user = $state(null);
  let sidebarCollapsed = $state(false);

  let loading = $state(false);
  let error = $state('');
  let success = $state('');

  let formData = $state({
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const roleLabels: Record<string, string> = {
    funcionario: 'Funcionário',
    coordenador: 'Coordenador',
    direcao: 'Direção',
    super_admin: 'Super Administrador',
    franqueadora: 'Franqueadora'
  };

  onMount(() => {
    const unsubscribeAuth = authStore.isAuthenticated.subscribe(value => {
      isAuthenticated = value;
      if (!value) {
        goto('/');
      }
    });

    const unsubscribeUser = authStore.user.subscribe(value => {
      user = value;
      if (value) {
        formData.email = value.email || '';
        formData.phone = value.phone || '';
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUser();
    };
  });

  async function handleUpdateProfile() {
    if (!formData.email || !formData.phone) {
      error = 'Email e telefone são obrigatórios';
      return;
    }

    if (!user?.companyId) {
      error = 'Erro: ID da empresa não encontrado';
      return;
    }

    const WEBHOOK_URL = webhook('perfil-atualizar');
    
    loading = true;
    error = '';
    success = '';

    try {
      const companyId = user.companyId;
      const userId = user.id;
      
      
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          companyId: companyId,
          email: formData.email,
          phone: formData.phone
        })
      });

      if (response.ok) {
        authStore.updateUser({
          email: formData.email,
          phone: formData.phone
        });

        success = 'Perfil atualizado com sucesso!';
        setTimeout(() => (success = ''), 3000);
      } else {
        error = 'Erro ao atualizar perfil';
      }
    } catch (err) {
      console.error('[v0] Error updating profile:', err);
      error = 'Erro ao atualizar perfil';
    } finally {
      loading = false;
    }
  }

  async function handleChangePassword() {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      error = 'Preencha todos os campos de senha';
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      error = 'As senhas não coincidem';
      return;
    }

    if (formData.newPassword.length < 6) {
      error = 'A nova senha deve ter pelo menos 6 caracteres';
      return;
    }

    if (!user?.companyId) {
      error = 'Erro: ID da empresa não encontrado';
      return;
    }

    const WEBHOOK_URL = webhook('alterar-senha-perfil');
    
    loading = true;
    error = '';
    success = '';

    try {
      const companyId = user.companyId;
      const userId = user.id;
      
      
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          companyId: companyId,
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      });

      if (response.ok) {
        success = 'Senha alterada com sucesso!';
        formData.currentPassword = '';
        formData.newPassword = '';
        formData.confirmPassword = '';
        setTimeout(() => (success = ''), 3000);
      } else {
        error = 'Erro ao alterar senha. Verifique a senha atual.';
      }
    } catch (err) {
      console.error('[v0] Error changing password:', err);
      error = 'Erro ao alterar senha. Verifique a senha atual.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen bg-zinc-950">
  <!-- Adicionando bind:collapsed -->
  <Sidebar currentPath="/perfil" bind:collapsed={sidebarCollapsed} />
  
  <!-- Adicionando margin-left dinâmico -->
  <main class="flex-1 p-8 max-w-4xl transition-all duration-300" style="margin-left: {sidebarCollapsed ? '5rem' : '16rem'}">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2">Perfil</h1>
      <p class="text-zinc-400">Gerencie suas informações pessoais</p>
    </div>

    {#if error}
      <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
        <p class="text-sm text-red-500">{error}</p>
      </div>
    {/if}

    {#if success}
      <div class="bg-green-600/10 border border-green-600/20 rounded-lg p-4 mb-6">
        <p class="text-sm text-green-500">{success}</p>
      </div>
    {/if}

    <!-- User Info (Read-only) -->
    <div class="bg-zinc-900 border border-green-600/20 rounded-lg p-6 mb-6">
      <h2 class="text-xl font-semibold text-white mb-4">Informações da Conta</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="name" class="block text-sm font-medium text-zinc-400 mb-1">Nome</label>
          <p class="text-white font-medium" id="name">{user?.name || 'Carregando...'}</p>
        </div>
        <div>
          <label for="role" class="block text-sm font-medium text-zinc-400 mb-1">Setor</label>
          <span class="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-600/10 text-green-500" id="role">
            {roleLabels[user?.role || 'funcionario']}
          </span>
        </div>
        {#if user?.companyName}
          <div class="md:col-span-2">
            <label for="companyName" class="block text-sm font-medium text-zinc-400 mb-1">Empresa</label>
            <p class="text-white" id="companyName">{user.companyName}</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Update Profile -->
    <div class="bg-zinc-900 border border-green-600/20 rounded-lg p-6 mb-6">
      <h2 class="text-xl font-semibold text-white mb-4">Atualizar Dados</h2>
      <div class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-white mb-2">Email</label>
          <input
            id="email"
            type="email"
            bind:value={formData.email}
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="phone" class="block text-sm font-medium text-white mb-2">Telefone</label>
          <input
            id="phone"
            type="tel"
            bind:value={formData.phone}
            placeholder="(11) 99999-9999"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <button
          onclick={handleUpdateProfile}
          disabled={loading}
          class="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>

    <!-- Change Password -->
    <div class="bg-zinc-900 border border-green-600/20 rounded-lg p-6">
      <h2 class="text-xl font-semibold text-white mb-4">Alterar Senha</h2>
      <div class="space-y-4">
        <div>
          <label for="currentPassword" class="block text-sm font-medium text-white mb-2">Senha Atual</label>
          <input
            id="currentPassword"
            type="password"
            bind:value={formData.currentPassword}
            placeholder="••••••••"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="newPassword" class="block text-sm font-medium text-white mb-2">Nova Senha</label>
          <input
            id="newPassword"
            type="password"
            bind:value={formData.newPassword}
            placeholder="••••••••"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-white mb-2">Confirmar Nova Senha</label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={formData.confirmPassword}
            placeholder="••••••••"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
          />
        </div>

        <button
          onclick={handleChangePassword}
          disabled={loading}
          class="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Alterando...' : 'Alterar Senha'}
        </button>
      </div>
    </div>
  </main>
</div>
