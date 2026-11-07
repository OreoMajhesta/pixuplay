<script lang="ts">
  import type { Anime } from '../types';
  import AnimeRow from '../svelte-components/AnimeRow.svelte';
  import AnimeCard from '../svelte-components/AnimeCard.svelte';
  import { Clock, Film, Sparkles, Flame, Calendar, Trophy, ChevronLeft, ChevronRight } from 'lucide-svelte';

  export let trending: Anime[] = [];
  export let ongoing: Anime[] = [];
  export let completed: Anime[] = [];
  export let shounen: Anime[] = [];
  export let isekai: Anime[] = [];
  export let classics: Anime[] = [];
  export let onSelectAnime: (anime: Anime) => void;
  export let onQuickPlay: (anime: Anime, ep: number, resumeTime?: number) => void;
</script>

<div class="space-y-4">
  <!-- Trending Row -->
  {#if trending.length > 0}
    <AnimeRow
      title="Trending Sekarang"
      animes={trending}
      {onSelectAnime}
      {onQuickPlay}
      isRanked={true}
    />
  {/if}

  <!-- Ongoing Row -->
  {#if ongoing.length > 0}
    <AnimeRow
      title="Sedang Tayang (Ongoing)"
      animes={ongoing}
      {onSelectAnime}
      {onQuickPlay}
    />
  {/if}

  <!-- Shounen Row -->
  {#if shounen.length > 0}
    <AnimeRow
      title="Aksi & Shounen Terbaik"
      animes={shounen}
      {onSelectAnime}
      {onQuickPlay}
    />
  {/if}

  <!-- Isekai Row -->
  {#if isekai.length > 0}
    <AnimeRow
      title="Dunia Fantasi & Isekai"
      animes={isekai}
      {onSelectAnime}
      {onQuickPlay}
    />
  {/if}

  <!-- Completed Row -->
  {#if completed.length > 0}
    <AnimeRow
      title="Tamat (Binge Watch)"
      animes={completed}
      {onSelectAnime}
      {onQuickPlay}
    />
  {/if}
</div>
