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
  let effectiveCompanyIdValue = null;
  let selectedCompanyValue = $state(null);
  let sidebarCollapsed = $state(false);

  // Webhooks
  const GET_COURSES_WEBHOOK = webhook('listar-cursos');
  const CREATE_COURSE_WEBHOOK = webhook('criar-curso');
  const UPDATE_COURSE_WEBHOOK = webhook('editar-curso');
  const DELETE_COURSE_WEBHOOK = webhook('excluir-curso');
  const GET_CLASSES_WEBHOOK = webhook('listar-turmas');
  const CREATE_CLASS_WEBHOOK = webhook('criar-turma');
  const UPDATE_CLASS_WEBHOOK = webhook('editar-turma');
  const DELETE_CLASS_WEBHOOK = webhook('excluir-turma');

  interface Course {
    id: number;
    name: string;
    category: string;
    duration: string;
  }

  interface Class {
    id: number;
    class_name: string;
    course_id: number;
    days_of_week: string;
    schedule: string;
    start_date: string;
    is_active: boolean;
  }

  let activeTab = $state('courses');
  let courses: Course[] = $state([]);
  let classes: Class[] = $state([]);
  let isLoading = $state(false);
  
  let showCourseModal = $state(false);
  let showClassModal = $state(false);
  let editingCourse: Course | null = $state(null);
  let editingClass: Class | null = $state(null);
  
  let courseForm = $state({ name: '', category: 'Técnico', duration: '' });
  let classForm = $state({ class_name: '', course_id: 0, days_of_week: '', schedule: '', start_date: '', is_active: true });

  const categories = ['Técnico', 'Profissionalizante', 'Superior'];

  onMount(() => {
    const unsubAuth = isAuthenticated.subscribe(value => {
      isAuthenticatedValue = value;
      if (!value) goto('/');
    });

    const unsubManager = isManager.subscribe(value => {
      isManagerValue = value;
    });

    const unsubUser = user.subscribe(value => {
      userValue = value;
    });

    const unsubFranqueadora = isFranqueadora.subscribe(value => {
      isFranqueadoraValue = value;
    });

    const unsubEffectiveCompany = effectiveCompanyId.subscribe(value => {
      effectiveCompanyIdValue = value;
      if (value) {
        loadCourses();
        loadClasses();
      }
    });

    const unsubSelectedCompany = selectedCompany.subscribe(value => {
      selectedCompanyValue = value;
      // Recarregar dados quando franqueadora selecionar outra empresa
      if (isFranqueadoraValue && value) {
        loadCourses();
        loadClasses();
      }
    });

    return () => {
      unsubAuth();
      unsubManager();
      unsubUser();
      unsubFranqueadora();
      unsubEffectiveCompany();
      unsubSelectedCompany();
    };
  });

  async function loadCourses() {
    const companyId = effectiveCompanyIdValue || userValue?.companyId;
    if (!companyId) return;
    
    isLoading = true;
    try {
      const response = await fetch(GET_COURSES_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId })
      });
      const data = await response.json();
      if (data.success) {
        courses = data.courses || [];
      }
    } catch (err) {
      console.error('[v0] Erro ao carregar cursos:', err);
    } finally {
      isLoading = false;
    }
  }

  async function loadClasses() {
    const companyId = effectiveCompanyIdValue || userValue?.companyId;
    if (!companyId) return;
    
    isLoading = true;
    try {
      const response = await fetch(GET_CLASSES_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId })
      });
      const data = await response.json();
      if (data.success) {
        classes = data.classes || [];
      }
    } catch (err) {
      console.error('[v0] Erro ao carregar turmas:', err);
    } finally {
      isLoading = false;
    }
  }

  async function saveCourse() {
    const companyId = effectiveCompanyIdValue || userValue?.companyId;
    if (!companyId) return;
    
    isLoading = true;
    try {
      const webhook = editingCourse ? UPDATE_COURSE_WEBHOOK : CREATE_COURSE_WEBHOOK;
      const payload = editingCourse
        ? { ...courseForm, id: editingCourse.id, company_id: companyId }
        : { ...courseForm, company_id: companyId };

      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        await loadCourses();
        closeCourseModal();
      }
    } catch (err) {
      console.error('[v0] Erro ao salvar curso:', err);
    } finally {
      isLoading = false;
    }
  }

  async function saveClass() {
    const companyId = effectiveCompanyIdValue || userValue?.companyId;
    if (!companyId) return;
    
    isLoading = true;
    try {
      const webhook = editingClass ? UPDATE_CLASS_WEBHOOK : CREATE_CLASS_WEBHOOK;
      const payload = editingClass
        ? { ...classForm, id: editingClass.id, company_id: companyId }
        : { ...classForm, company_id: companyId };

      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        await loadClasses();
        closeClassModal();
      }
    } catch (err) {
      console.error('[v0] Erro ao salvar turma:', err);
    } finally {
      isLoading = false;
    }
  }

  function openCourseModal(course?: Course) {
    if (course) {
      editingCourse = course;
      courseForm = { name: course.name, category: course.category, duration: course.duration };
    } else {
      editingCourse = null;
      courseForm = { name: '', category: 'Técnico', duration: '' };
    }
    showCourseModal = true;
  }

  function closeCourseModal() {
    showCourseModal = false;
    editingCourse = null;
    courseForm = { name: '', category: 'Técnico', duration: '' };
  }

  function openClassModal(cls?: Class) {
    if (cls) {
      editingClass = cls;
      classForm = {
        class_name: cls.class_name,
        course_id: cls.course_id,
        days_of_week: cls.days_of_week,
        schedule: cls.schedule,
        start_date: cls.start_date,
        is_active: cls.is_active
      };
    } else {
      editingClass = null;
      classForm = { class_name: '', course_id: 0, days_of_week: '', schedule: '', start_date: '', is_active: true };
    }
    showClassModal = true;
  }

  function closeClassModal() {
    showClassModal = false;
    editingClass = null;
    classForm = { class_name: '', course_id: 0, days_of_week: '', schedule: '', start_date: '', is_active: true };
  }

  async function deleteCourse(courseId: number) {
    if (!confirm('Tem certeza que deseja excluir este curso?')) return;
    
    const companyId = effectiveCompanyIdValue || userValue?.companyId;
    if (!companyId) return;

    try {
      const response = await fetch(DELETE_COURSE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: courseId, company_id: companyId })
      });

      const data = await response.json();
      if (data.success) {
        await loadCourses();
      }
    } catch (err) {
      console.error('[v0] Erro ao excluir curso:', err);
    }
  }

  async function deleteClass(classId: number) {
    if (!confirm('Tem certeza que deseja excluir esta turma?')) return;

    const companyId = effectiveCompanyIdValue || userValue?.companyId;
    if (!companyId) return;

    try {
      const response = await fetch(DELETE_CLASS_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: classId, company_id: companyId })
      });

      const data = await response.json();
      if (data.success) {
        await loadClasses();
      }
    } catch (err) {
      console.error('[v0] Erro ao excluir turma:', err);
    }
  }

  function getCourseName(courseId: number): string {
    const course = courses.find(c => c.id === courseId);
    return course ? course.name : 'Curso não encontrado';
  }
</script>

<div class="flex min-h-screen bg-zinc-950">
  <Sidebar currentPath="/cursos" bind:collapsed={sidebarCollapsed} />
  
  <main class="flex-1 p-8 transition-all duration-300" style="margin-left: {sidebarCollapsed ? '5rem' : '16rem'}">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white mb-2">Cursos e Turmas</h1>
        <p class="text-zinc-400">Gerencie os cursos e turmas da instituição</p>
        {#if isFranqueadoraValue && selectedCompanyValue}
          <p class="text-sm text-green-500 mt-1">Visualizando: {selectedCompanyValue.name}</p>
        {/if}
      </div>
      <button
        onclick={() => activeTab === 'courses' ? openCourseModal() : openClassModal()}
        class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        aria-label={activeTab === 'courses' ? 'Novo Curso' : 'Nova Turma'}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        {activeTab === 'courses' ? 'Novo Curso' : 'Nova Turma'}
      </button>
    </div>

    <!-- Aviso para franqueadora sem empresa selecionada -->
    {#if isFranqueadoraValue && !selectedCompanyValue}
      <div class="bg-yellow-900/30 border border-yellow-600/30 rounded-lg p-4 mb-6">
        <p class="text-yellow-400">Selecione uma unidade no menu lateral para visualizar os cursos e turmas.</p>
      </div>
    {:else}
      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button
          onclick={() => activeTab = 'courses'}
          class="px-4 py-2 rounded-lg font-medium transition-colors {activeTab === 'courses' ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}"
          aria-label="Cursos"
        >
          Cursos
        </button>
        <button
          onclick={() => activeTab = 'classes'}
          class="px-4 py-2 rounded-lg font-medium transition-colors {activeTab === 'classes' ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}"
          aria-label="Turmas"
        >
          Turmas
        </button>
      </div>

      {#if isLoading}
        <div class="flex items-center justify-center py-12">
          <div class="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      {:else if activeTab === 'courses'}
        <!-- Courses Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each courses as course}
            <div class="bg-zinc-900 border border-green-600/20 rounded-lg p-4 hover:border-green-600/40 transition-colors">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"/>
                  </svg>
                  <h3 class="font-semibold text-white">{course.name}</h3>
                </div>
                <div class="flex gap-1">
                  <button onclick={() => openCourseModal(course)} class="p-1 text-zinc-400 hover:text-green-500 transition-colors" aria-label="Editar Curso">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                    </svg>
                  </button>
                  <button onclick={() => deleteCourse(course.id)} class="p-1 text-zinc-400 hover:text-red-500 transition-colors" aria-label="Excluir Curso">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="space-y-1 text-sm">
                <p class="text-zinc-400">Categoria: <span class="text-zinc-300">{course.category}</span></p>
                <p class="text-zinc-400">Duração: <span class="text-zinc-300">{course.duration}</span></p>
              </div>
            </div>
          {/each}
        </div>
        {#if courses.length === 0}
          <div class="text-center py-12">
            <p class="text-zinc-500">Nenhum curso cadastrado</p>
          </div>
        {/if}
      {:else}
        <!-- Classes Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each classes as cls}
            <div class="bg-zinc-900 border border-green-600/20 rounded-lg p-4 hover:border-green-600/40 transition-colors">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <h3 class="font-semibold text-white">{cls.class_name}</h3>
                </div>
                <div class="flex gap-1">
                  <button onclick={() => openClassModal(cls)} class="p-1 text-zinc-400 hover:text-green-500 transition-colors" aria-label="Editar Turma">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                    </svg>
                  </button>
                  <button onclick={() => deleteClass(cls.id)} class="p-1 text-zinc-400 hover:text-red-500 transition-colors" aria-label="Excluir Turma">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="space-y-1 text-sm">
                <p class="text-zinc-400">Curso: <span class="text-zinc-300">{getCourseName(cls.course_id)}</span></p>
                <p class="text-zinc-400">Dias: <span class="text-zinc-300">{cls.days_of_week}</span></p>
                <p class="text-zinc-400">Horário: <span class="text-zinc-300">{cls.schedule}</span></p>
                <p class="text-zinc-400">Início: <span class="text-zinc-300">{cls.start_date}</span></p>
                <span class="inline-flex px-2 py-1 rounded text-xs {cls.is_active ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}">
                  {cls.is_active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </div>
          {/each}
        </div>
        {#if classes.length === 0}
          <div class="text-center py-12">
            <p class="text-zinc-500">Nenhuma turma cadastrada</p>
          </div>
        {/if}
      {/if}
    {/if}
  </main>
</div>

<!-- Course Modal -->
{#if showCourseModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-zinc-900 border border-green-600/30 rounded-lg p-6 w-full max-w-lg">
      <h3 class="text-2xl font-bold text-white mb-6">
        {editingCourse ? 'Editar Curso' : 'Novo Curso'}
      </h3>
      <div class="space-y-4">
        <div>
          <label for="courseName" class="block text-sm font-medium text-white mb-2">Nome do Curso *</label>
          <input
            id="courseName"
            type="text"
            bind:value={courseForm.name}
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div>
          <label for="courseCategory" class="block text-sm font-medium text-white mb-2">Categoria *</label>
          <select
            id="courseCategory"
            bind:value={courseForm.category}
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            {#each categories as category}
              <option value={category}>{category}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="courseDuration" class="block text-sm font-medium text-white mb-2">Duração *</label>
          <input
            id="courseDuration"
            type="text"
            bind:value={courseForm.duration}
            placeholder="Ex: 12 meses"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
      </div>
      <div class="flex gap-3 mt-6">
        <button onclick={closeCourseModal} class="flex-1 px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600">
          Cancelar
        </button>
        <button onclick={saveCourse} disabled={isLoading} class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
          {isLoading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Class Modal -->
{#if showClassModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-zinc-900 border border-green-600/30 rounded-lg p-6 w-full max-w-lg">
      <h3 class="text-2xl font-bold text-white mb-6">
        {editingClass ? 'Editar Turma' : 'Nova Turma'}
      </h3>
      <div class="space-y-4">
        <div>
          <label for="className" class="block text-sm font-medium text-white mb-2">Nome da Turma *</label>
          <input
            id="className"
            type="text"
            bind:value={classForm.class_name}
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div>
          <label for="classCourse" class="block text-sm font-medium text-white mb-2">Curso *</label>
          <select
            id="classCourse"
            bind:value={classForm.course_id}
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            <option value={0}>Selecione um curso</option>
            {#each courses as course}
              <option value={course.id}>{course.name}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="classDays" class="block text-sm font-medium text-white mb-2">Dias da Semana *</label>
          <input
            id="classDays"
            type="text"
            bind:value={classForm.days_of_week}
            placeholder="Ex: Segunda e Quarta"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div>
          <label for="classSchedule" class="block text-sm font-medium text-white mb-2">Horário *</label>
          <input
            id="classSchedule"
            type="text"
            bind:value={classForm.schedule}
            placeholder="Ex: 19:00 - 22:00"
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div>
          <label for="classStartDate" class="block text-sm font-medium text-white mb-2">Data de Início *</label>
          <input
            id="classStartDate"
            type="date"
            bind:value={classForm.start_date}
            class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div class="flex items-center gap-2">
          <input
            id="classActive"
            type="checkbox"
            bind:checked={classForm.is_active}
            class="w-4 h-4 rounded border-zinc-600 text-green-600 focus:ring-green-600"
          />
          <label for="classActive" class="text-sm text-white">Turma Ativa</label>
        </div>
      </div>
      <div class="flex gap-3 mt-6">
        <button onclick={closeClassModal} class="flex-1 px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600">
          Cancelar
        </button>
        <button onclick={saveClass} disabled={isLoading} class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
          {isLoading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  </div>
{/if}
