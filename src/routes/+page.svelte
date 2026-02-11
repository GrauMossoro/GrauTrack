<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { authStore } from '$lib/stores/auth.svelte'
  import { get } from 'svelte/store'

  const { user, isAuthenticated, isSuperAdmin, isFranqueadora, login, resetPassword } = authStore

  onMount(() => {
    if (get(isAuthenticated)) {
      if (get(isSuperAdmin)) {
        goto('/super-admin')
      } else {
        goto('/dashboard')
      }
    }
  })

  let email = $state('')
  let password = $state('')
  let showResetPassword = $state(false)
  let resetEmail = $state('')
  let error = $state('')
  let loading = $state(false)
  let resetSuccess = $state(false)

  async function handleLogin(event) {
    event.preventDefault()
    if (!email || !password) {
      error = 'Preencha todos os campos'
      return
    }

    loading = true
    error = ''

    const result = await login(email, password)

    loading = false

    if (result.success) {
      if (get(isSuperAdmin)) {
        goto('/super-admin')
      } else {
        goto('/dashboard')
      }
    } else {
      error = result.error || 'Erro ao fazer login'
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    if (!resetEmail) {
      error = 'Digite seu email'
      return
    }

    loading = true
    error = ''

    const result = await resetPassword(resetEmail)

    loading = false

    if (result.success) {
      resetSuccess = true
      setTimeout(() => {
        showResetPassword = false
        resetSuccess = false
        resetEmail = ''
      }, 3000)
    } else {
      error = result.error || 'Erro ao enviar email'
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-5">
      <img src="/header.png" alt="Logo tipo Grau Educacional" style="width: 100px; margin: auto;">
    </div>

    <div class="bg-zinc-900 border border-green-600/30 rounded-lg p-8 shadow-lg">
      {#if !showResetPassword}
        <form onsubmit={handleLogin}>
          <div class="space-y-6">
            <div>
              <h2 class="text-2xl font-semibold text-white">Entrar</h2>
              <p class="text-zinc-400 mt-1">Acesse sua conta</p>
            </div>

            <div class="space-y-4">
              <div>
                <label for="email" class="block text-sm font-medium text-white mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  bind:value={email}
                  placeholder="seu@email.com"
                  class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
                />
              </div>

              <div>
                <label for="password" class="block text-sm font-medium text-white mb-2">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  bind:value={password}
                  placeholder="••••••••"
                  class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
                />
              </div>
            </div>

            {#if error}
              <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p class="text-sm text-red-500">{error}</p>
              </div>
            {/if}

            <button
              type="submit"
              disabled={loading}
              class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <button
              type="button"
              onclick={() => (showResetPassword = true)}
              class="w-full text-sm text-zinc-400 hover:text-green-500 transition-colors"
            >
              Esqueceu sua senha?
            </button>
          </div>
        </form>
      {:else}
        <form onsubmit={handleResetPassword}>
          <div class="space-y-6">
            <div>
              <button
                type="button"
                onclick={() => {
                  showResetPassword = false
                  error = ''
                  resetSuccess = false
                }}
                class="text-zinc-400 hover:text-green-500 mb-4 flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
                Voltar
              </button>
              <h2 class="text-2xl font-semibold text-white">Recuperar Senha</h2>
              <p class="text-zinc-400 mt-1">
                Digite seu email para receber instruções
              </p>
            </div>

            <div>
              <label for="reset-email" class="block text-sm font-medium text-white mb-2">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                bind:value={resetEmail}
                placeholder="seu@email.com"
                class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
              />
            </div>

            {#if error}
              <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p class="text-sm text-red-500">{error}</p>
              </div>
            {/if}

            {#if resetSuccess}
              <div class="bg-green-600/10 border border-green-600/20 rounded-lg p-3">
                <p class="text-sm text-green-500">Se existir um acesso com esse endereço de e-mail, em breve chegará o email de recuperação!</p>
              </div>
            {/if}

            <button
              type="submit"
              disabled={loading}
              class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando...' : 'Enviar Email de Recuperação'}
            </button>
          </div>
        </form>
      {/if}
    </div>

    <p class="text-center text-xs text-zinc-500 mt-8">
      &copy; {new Date().getFullYear()} Virtualizze Track. Todos os direitos reservados.
    </p>
  </div>
</div>

