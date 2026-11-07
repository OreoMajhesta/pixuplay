<script lang="ts">
  import type { Anime } from '../types';
  import { getAnimeTitle, getAnimePoster, formatWatchTime } from '../api';
  import { Play } from 'lucide-svelte';

  export let anime: Anime;
  export let onSelect: (anime: Anime) => void;
  export let onQuickPlay: (anime: Anime, ep: number, resumeTime?: number) => void;
  export let rank: number | undefined = undefined;
  export let latestHistory: { ep: number; currentTime?: number } | undefined = undefined;

  $: title = getAnimeTitle(anime);
  $: poster = getAnimePoster(anime);
  $: isOngoing = anime.status?.toLowerCase().includes('ongoing') || anime.status?.toLowerCase().includes('releasing');
  $: statusLabel = isOngoing ? 'Ongoing' : 'Tamat';
  $: epBadgeText = isOngoing
    ? (anime.episodes ? `Ep ${anime.episodes}` : 'Ongoing')
    : (anime.episodes ? `${anime.episodes} Ep` : 'Full Ep');

  $: genres = (anime.genres || [])
    .slice(0, 2)
    .map((g: any) => (typeof g === 'object' && g !== null ? g.title || g.genreId || 'Anime' : String(g)))
    .join(' • ') || 'Sub Indo';

  function handleCardClick() {
    onSelect(anime);
  }

  function handleQuickPlayClick(e: MouseEvent) {
    e.stopPropagation();
    if (latestHistory) {
      onQuickPlay(anime, latestHistory.ep, latestHistory.currentTime || 0);
    } else {
      onQuickPlay(anime, 1, 0);
    }
  }
</script>

<article
  on:click={handleCardClick}
  class="group/card relative flex flex-col bg-card border border-subtle rounded-md overflow-hidden transition-all duration-200 hover:border-white hover:shadow-2xl cursor-pointer"
>
  <!-- Thumbnail with Lazy Loading -->
  <div class="relative aspect-[3/4] w-full bg-black overflow-hidden">
    <img
      src={poster}
      alt={title}
      loading="lazy"
      decoding="async"
      width="240"
      height="320"
      class="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
    />

    <!-- Quick Play Overlay -->
    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
      <button
        on:click={handleQuickPlayClick}
        class="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center transform scale-90 group-hover/card:scale-100 transition-transform shadow-lg cursor-pointer"
        aria-label="Putar"
      >
        <Play class="w-5 h-5 fill-black ml-0.5" />
      </button>
    </div>

    <!-- Badges -->
    <div class="absolute top-2 left-2 flex items-center gap-1">
      {#if rank !== undefined}
        <span class="text-[10px] font-black px-1.5 py-0.5 bg-amber-400 text-black rounded-xs shadow font-mono">
          #{rank} TOP
        </span>
      {:else}
        <span class="text-[10px] font-black px-1.5 py-0.5 bg-black/80 text-white border border-subtle rounded-xs">
          SUB INDO
        </span>
      {/if}
      <span class="text-[10px] font-bold px-1.5 py-0.5 bg-black/80 text-neutral-300 border border-subtle rounded-xs">
        {epBadgeText}
      </span>
    </div>

    {#if anime.averageScore}
      <div class="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/80 border border-subtle rounded-xs text-[10px] font-bold text-amber-400 font-mono">
        ★ {anime.averageScore / 10}
      </div>
    {/if}

    <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-neutral-300 pointer-events-none">
      <span class="px-1.5 py-0.5 bg-black/70 rounded-xs font-semibold backdrop-blur-xs">
        {statusLabel}
      </span>
    </div>
  </div>

  <!-- Content -->
  <div class="p-3 flex flex-col flex-grow justify-between bg-card">
    <div>
      <h3 class="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover/card:text-red-500 transition-colors" title={title}>
        {title}
      </h3>
      <p class="text-[11px] text-muted line-clamp-1 mt-1">
        {genres}
      </p>
    </div>
  </div>
</article>
