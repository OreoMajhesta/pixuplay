import { writable } from 'svelte/store';
import type { Anime, HistoryItem, SavedItem, UserProfile } from '../types';

export const activeTab = writable<string>('home');
export const currentUser = writable<UserProfile | null>(null);
export const history = writable<HistoryItem[]>([]);
export const watchlist = writable<SavedItem[]>([]);
export const favorites = writable<SavedItem[]>([]);

// Player State
export const isPlayerOpen = writable<boolean>(false);
export const isMinimized = writable<boolean>(false);
export const playingAnime = writable<Anime | null>(null);
export const playingEpisode = writable<number>(1);
export const initialResumeTime = writable<number>(0);
export const playbackIsPlaying = writable<boolean>(true);
export const activeNobarRoomId = writable<string | null>(null);

// Modals State
export const selectedDetailAnime = writable<Anime | null>(null);
export const isSearchOpen = writable<boolean>(false);
export const isWelcomeOpen = writable<boolean>(false);
export const isDonateOpen = writable<boolean>(false);
export const warningState = writable<{
  anime: Anime;
  episode: number;
  genres: string[];
  resumeTime?: number;
} | null>(null);
