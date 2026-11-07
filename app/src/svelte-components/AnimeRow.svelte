<script lang="ts">
  import type { Anime } from '../types';
  import AnimeCard from './AnimeCard.svelte';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

  export let title: string;
  export let animes: Anime[];
  export let onSelectAnime: (anime: Anime) => void;
  export let onQuickPlay: (anime: Anime, ep: number, resumeTime?: number) => void;
  export let isRanked: boolean = false;

  let rowContainer: HTMLDivElement;

  function scroll(direction: 'left' | 'right') {
    if (rowContainer) {
      const scrollAmount = rowContainer.clientWidth * 0.75;
      rowContainer.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  }
</script>

<section class="py-4 relative group/row">
  <div class="flex items-center justify-between mb-3 px-4 sm:px-6 lg:px-8">
    <h2 class="text-lg md:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
      {title}
    </h2>
  </div>

  <div class="relative">
    <button
      on:click={() => scroll('left')}
      class="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 border border-subtle text-white items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-white hover:text-black shadow-xl cursor-pointer"
      aria-label="Scroll left"
    >
      <ChevronLeft class="w-5 h-5" />
    </button>

    <div
      bind:this={rowContainer}
      class="flex gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 no-scrollbar scroll-smooth"
    >
      {#each animes as anime, index (anime.animeId || anime.id)}
        <div class="flex-shrink-0 w-36 sm:w-44 md:w-48">
          <AnimeCard
            {anime}
            onSelect={onSelectAnime}
            {onQuickPlay}
            rank={isRanked ? index + 1 : undefined}
          />
        </div>
      {/each}
    </div>

    <button
      on:click={() => scroll('right')}
      class="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 border border-subtle text-white items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-white hover:text-black shadow-xl cursor-pointer"
      aria-label="Scroll right"
    >
      <ChevronRight class="w-5 h-5" />
    </button>
  </div>
</section>
