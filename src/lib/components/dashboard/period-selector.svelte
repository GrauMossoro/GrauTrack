<script lang="ts">
  type Period = 'hoje' | 'ontem' | '7dias' | '15dias' | '30dias' | 'personalizado';

  let { selectedPeriod = $bindable('hoje'), onPeriodChange } = $props<{
    selectedPeriod: Period;
    onPeriodChange?: (period: Period) => void;
  }>();

  let showCustomModal = $state(false);
  let customStartDate = $state('');
  let customEndDate = $state('');

  const periods: { value: Period; label: string }[] = [
    { value: 'hoje', label: 'Hoje' },
    { value: 'ontem', label: 'Ontem' },
    { value: '7dias', label: '7 dias' },
    { value: '15dias', label: '15 dias' },
    { value: '30dias', label: '30 dias' },
    { value: 'personalizado', label: 'Personalizado' }
  ];

  function handlePeriodClick(period: Period) {
    if (period === 'personalizado') {
      showCustomModal = true;
    } else {
      selectedPeriod = period;
      onPeriodChange?.(period);
    }
  }

  function applyCustomPeriod() {
    if (customStartDate && customEndDate) {
      selectedPeriod = 'personalizado';
      showCustomModal = false;
      onPeriodChange?.('personalizado');
    }
  }
</script>

<div class="flex flex-wrap gap-2">
  {#each periods as period}
    <!-- Botão período selecionado com verde direto -->
    <button
      onclick={() => handlePeriodClick(period.value)}
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {selectedPeriod === period.value
        ? 'bg-green-600 text-white'
        : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'}"
    >
      {period.label}
    </button>
  {/each}
</div>

{#if showCustomModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <!-- Modal com fundo sólido escuro -->
    <div class="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md">
      <h3 class="text-lg font-semibold text-white mb-4">Período Personalizado</h3>
      
      <div class="space-y-4">
        <div>
          <label for="startDate" class="block text-sm font-medium text-white mb-2">Data Inicial</label>
          <!-- Input com foco verde direto -->
          <input
            id="startDate"
            type="date"
            bind:value={customStartDate}
            class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
          />
        </div>
        
        <div>
          <label for="endDate" class="block text-sm font-medium text-white mb-2">Data Final</label>
          <input
            id="endDate"
            type="date"
            bind:value={customEndDate}
            class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
          />
        </div>
      </div>

      <div class="flex gap-3 mt-6">
        <!-- Botão Cancelar cinza -->
        <button
          onclick={() => (showCustomModal = false)}
          class="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
        >
          Cancelar
        </button>
        <!-- Botão Aplicar verde vibrante -->
        <button
          onclick={applyCustomPeriod}
          class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Aplicar
        </button>
      </div>
    </div>
  </div>
{/if}
