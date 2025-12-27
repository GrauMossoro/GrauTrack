<script lang="ts">
  let { title, value, color = 'bg-red-500' } = $props<{
    title: string;
    value: number | string;
    color?: string;
  }>();
</script>

<!-- Substituindo bg-card por bg-zinc-900 e border-border por border-zinc-800 -->
<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-green-600/50 transition-colors">
  <div class="flex items-center justify-between">
    <div>
      <!-- Substituindo text-muted-foreground por text-zinc-400 -->
      <p class="text-sm text-zinc-400 mb-1">{title}</p>
      <!-- Substituindo text-card-foreground por text-white -->
      <p class="text-3xl font-bold text-white">{value}</p>
    </div>
    <div class="w-12 h-12 rounded-lg {color}"></div>
  </div>
</div>
