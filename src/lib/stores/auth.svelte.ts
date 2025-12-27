import { writable, derived } from "svelte/store"
import { webhook } from '$lib/api'

type UserRole = "funcionario" | "coordenador" | "direcao" | "super_admin" | "franqueadora"

interface User {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  companyId: number
  companyName?: string
}

interface Company {
  id: number
  name: string
}

function createAuthStore() {
  const user = writable<User | null>(null)
  const selectedCompany = writable<Company | null>(null)
  const companies = writable<Company[]>([])

  // Restaurar sessão do localStorage ao inicializar
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("user")
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored)
        if (parsedUser && parsedUser.id && parsedUser.companyId) {
          user.set(parsedUser)
        } else {
          localStorage.removeItem("user")
        }
      } catch (error) {
        console.error("[v0] Erro ao restaurar usuário:", error)
        localStorage.removeItem("user")
      }
    }

    const storedCompany = localStorage.getItem("selectedCompany")
    if (storedCompany) {
      try {
        selectedCompany.set(JSON.parse(storedCompany))
      } catch (error) {
        localStorage.removeItem("selectedCompany")
      }
    }
  }

  const isAuthenticated = derived(user, ($user) => $user !== null)
  const isSuperAdmin = derived(user, ($user) => $user?.role === "super_admin")
  const isFranqueadora = derived(user, ($user) => $user?.role === "franqueadora")
  const isManager = derived(
    user,
    ($user) =>
      $user?.role === "coordenador" ||
      $user?.role === "direcao" ||
      $user?.role === "super_admin" ||
      $user?.role === "franqueadora",
  )

  const effectiveCompanyId = derived([user, selectedCompany], ([$user, $selectedCompany]) => {
    if ($user?.role === "franqueadora") {
      // Se selecionou empresa, retorna o ID dela
      // Se não selecionou, retorna null (interpretado como "todos os dados")
      return $selectedCompany ? $selectedCompany.id : null
    }
    return $user?.companyId || null
  })

  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const WEBHOOK_URL = webhook('login')

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()

      if (data.success === true) {
        const rawCompanyId = data.user.company_id || data.user.companyId
        const companyId = Number.parseInt(String(rawCompanyId), 10)

        if (isNaN(companyId) && data.user.role !== "super_admin" && data.user.role !== "franqueadora") {
          console.error("[v0] companyId inválido na resposta do login:", rawCompanyId)
          return { success: false, error: "Dados de empresa inválidos" }
        }

        const userData: User = {
          id: String(data.user.id),
          name: String(data.user.name),
          email: String(data.user.email),
          phone: String(data.user.phone),
          role: String(data.user.role) as UserRole,
          companyId: companyId,
          companyName: data.user.companyName || data.json?.companyName,
        }

        localStorage.setItem("user", JSON.stringify(userData))
        user.set(userData)

        return { success: true }
      }

      return { success: false, error: "Credenciais inválidas" }
    } catch (error) {
      console.error("[v0] Erro no login:", error)
      return { success: false, error: "Erro ao conectar com o servidor" }
    }
  }

  async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    const WEBHOOK_URL = webhook('reset-password')

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      return { success: true }
    } catch (error) {
      return { success: false, error: "Erro ao enviar email de recuperação" }
    }
  }

  async function fetchCompanies(): Promise<void> {
    // <WEBHOOK> URL do webhook para listar empresas
    const WEBHOOK_URL = webhook('listar-empresas')

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      if (Array.isArray(data)) {
        companies.set(data)
      } else if (data.companies && Array.isArray(data.companies)) {
        companies.set(data.companies)
      }
    } catch (error) {
      console.error("[v0] Erro ao buscar empresas:", error)
    }
  }

  function selectCompany(company: Company | null) {
    selectedCompany.set(company)
    if (company) {
      localStorage.setItem("selectedCompany", JSON.stringify(company))
    } else {
      localStorage.removeItem("selectedCompany")
    }
  }

  function logout() {
    user.set(null)
    selectedCompany.set(null)
    companies.set([])
    localStorage.removeItem("user")
    localStorage.removeItem("selectedCompany")
  }

  function updateUser(userData: Partial<User>) {
    user.update((current) => {
      if (current) {
        const updated = { ...current, ...userData }
        localStorage.setItem("user", JSON.stringify(updated))
        return updated
      }
      return null
    })
  }

  return {
    user,
    isAuthenticated,
    isSuperAdmin,
    isFranqueadora,
    isManager,
    selectedCompany,
    companies,
    effectiveCompanyId,
    login,
    resetPassword,
    logout,
    updateUser,
    fetchCompanies,
    selectCompany,
  }
}

export const authStore = createAuthStore()
