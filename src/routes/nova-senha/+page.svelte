<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { onMount } from 'svelte'

  let token = ''
  let newPassword = $state('')
  let confirmPassword = $state('')
  let error = $state('')
  let loading = $state(false)
  let validatingToken = $state(true)
  let tokenValid = $state(false)
  let success = $state(false)
  
  // Configuração do webhook - pode ser movido para variáveis de ambiente
  let VALIDATE_TOKEN_WEBHOOK = $state('https://auto.agiussolar.cloud/webhook/verificar-token')
  let RESET_PASSWORD_WEBHOOK = $state('https://auto.agiussolar.cloud/webhook/nova-senha')

  onMount(() => {
    // Pega o token da URL
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')
    
    if (!urlToken) {
      error = 'Token não encontrado na URL'
      validatingToken = false
      return
    }
    
    token = urlToken
    validateToken()
  })

  async function validateToken() {
    if (!VALIDATE_TOKEN_WEBHOOK) {
      error = 'Configure a URL do webhook de validação'
      validatingToken = false
      return
    }

    try {
      const response = await fetch(VALIDATE_TOKEN_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (response.ok && data.valid) {
        tokenValid = true
      } else {
        error = data.message || 'Token inválido ou expirado'
      }
    } catch (err) {
      error = 'Erro ao validar token. Tente novamente.'
      console.error('[v0] Erro ao validar token:', err)
    } finally {
      validatingToken = false
    }
  }

  async function handleResetPassword(event: Event) {
    event.preventDefault()
    
    if (!newPassword || !confirmPassword) {
      error = 'Preencha todos os campos'
      return
    }

    if (newPassword.length < 6) {
      error = 'A senha deve ter no mínimo 6 caracteres'
      return
    }

    if (newPassword !== confirmPassword) {
      error = 'As senhas não coincidem'
      return
    }

    if (!RESET_PASSWORD_WEBHOOK) {
      error = 'Configure a URL do webhook de reset de senha'
      return
    }

    loading = true
    error = ''

    try {
      const response = await fetch(RESET_PASSWORD_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        success = true
        setTimeout(() => {
          goto('/')
        }, 3000)
      } else {
        error = data.message || 'Erro ao redefinir senha'
      }
    } catch (err) {
      error = 'Erro ao redefinir senha. Tente novamente.'
      console.error('[v0] Erro ao redefinir senha:', err)
    } finally {
      loading = false
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-white tracking-tight">Virtualizze Track</h1>
      <p class="text-zinc-400 mt-2">Sistema de Gestão de Leads</p>
    </div>

    <div class="bg-zinc-900 border border-zinc-700 rounded-lg p-8 shadow-lg">
      {#if validatingToken}
        <div class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p class="text-zinc-400 mt-4">Validando token...</p>
        </div>
      {:else if !tokenValid}
        <div class="space-y-6">
          <div>
            <h2 class="text-2xl font-semibold text-white">Link Inválido</h2>
            <p class="text-zinc-400 mt-1">
              O link de recuperação está inválido ou expirado
            </p>
          </div>

          {#if error}
            <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p class="text-sm text-red-500">{error}</p>
            </div>
          {/if}

          <button
            type="button"
            onclick={() => goto('/')}
            class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Voltar ao Login
          </button>
        </div>
      {:else if success}
        <div class="space-y-6">
          <div class="text-center">
            <div class="mx-auto w-12 h-12 bg-green-600/10 rounded-full flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 class="text-2xl font-semibold text-white">Senha Redefinida!</h2>
            <p class="text-zinc-400 mt-2">
              Sua senha foi alterada com sucesso. Você será redirecionado para o login...
            </p>
          </div>
        </div>
      {:else}
        <form onsubmit={handleResetPassword}>
          <div class="space-y-6">
            <div>
              <h2 class="text-2xl font-semibold text-white">Nova Senha</h2>
              <p class="text-zinc-400 mt-1">
                Digite sua nova senha
              </p>
            </div>

            <div class="space-y-4">
              <div>
                <label for="new-password" class="block text-sm font-medium text-white mb-2">
                  Nova Senha
                </label>
                <input
                  id="new-password"
                  type="password"
                  bind:value={newPassword}
                  placeholder="••••••••"
                  class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
                />
              </div>

              <div>
                <label for="confirm-password" class="block text-sm font-medium text-white mb-2">
                  Confirmar Senha
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  bind:value={confirmPassword}
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
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>

            <button
              type="button"
              onclick={() => goto('/')}
              class="w-full text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Voltar ao Login
            </button>
          </div>
        </form>
      {/if}
    </div>

    <!-- Configuração dos Webhooks (opcional - pode ser movido para variáveis de ambiente) -->
    {#if import.meta.env.DEV}
      <div class="mt-4 p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
        <p class="text-xs font-medium text-white mb-2">Configuração (Dev Mode)</p>
        <div class="space-y-2">
          <input
            type="text"
            value={VALIDATE_TOKEN_WEBHOOK}
            oninput={(e) => VALIDATE_TOKEN_WEBHOOK = e.target.value}
            placeholder="URL do webhook de validação"
            class="w-full px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-white"
          />
          <input
            type="text"
            value={RESET_PASSWORD_WEBHOOK}
            oninput={(e) => RESET_PASSWORD_WEBHOOK = e.target.value}
            placeholder="URL do webhook de reset"
            class="w-full px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-white"
          />
        </div>
      </div>
    {/if}

    <p class="text-center text-xs text-zinc-500 mt-8">
      &copy; {new Date().getFullYear()} Virtualizze Track. Todos os direitos reservados.
    </p>
  </div>
</div>
