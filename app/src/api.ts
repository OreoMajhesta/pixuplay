import { Anime, ScheduleDay, StreamData, CommentItem, EpisodeInteractions } from './types';

export function getOrCreateGuestName(): string {
  try {
    let name = localStorage.getItem('pixuplay_nickname');
    const isGuest = name && /^Guest_\d{10}$/.test(name);
    if (!name || !isGuest) {
      let digits = '';
      for (let i = 0; i < 10; i++) {
        digits += Math.floor(Math.random() * 10).toString();
      }
      name = `Guest_${digits}`;
      localStorage.setItem('pixuplay_nickname', name);
    }
    return name;
  } catch {
    return 'Guest_1029384756';
  }
}

export function getOrCreateUserId(): string {
  try {
    let id = localStorage.getItem('pixuplay_user_id');
    if (!id) {
      id = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem('pixuplay_user_id', id);
    }
    return id;
  } catch {
    return 'usr_guest_' + Math.random().toString(36).substring(2, 7);
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return (json.data ?? json) as T;
  } catch (err) {
    console.warn(`[API] Failed to fetch ${url}:`, err);
    return null;
  }
}

export async function getTrendingAnime(): Promise<Anime[]> {
  const data = await fetchJson<Anime[]>('/api/pixuplay/trending');
  return data || [];
}

export async function getOngoingAnime(): Promise<Anime[]> {
  const data = await fetchJson<Anime[]>('/api/pixuplay/ongoing');
  return data || [];
}

export async function getCompletedAnime(): Promise<Anime[]> {
  const data = await fetchJson<Anime[]>('/api/pixuplay/completed');
  return data || [];
}

export async function getShounenAnime(): Promise<Anime[]> {
  const data = await fetchJson<Anime[]>('/api/pixuplay/shounen');
  return data || [];
}

export async function getIsekaiAnime(): Promise<Anime[]> {
  const data = await fetchJson<Anime[]>('/api/pixuplay/isekai');
  return data || [];
}

export async function getClassicsAnime(): Promise<Anime[]> {
  const data = await fetchJson<Anime[]>('/api/pixuplay/classics');
  return data || [];
}

export async function getAnimeByGenre(genreId: string): Promise<Anime[]> {
  const data = await fetchJson<Anime[]>(`/api/pixuplay/genre/${encodeURIComponent(genreId)}`);
  return data || [];
}

export async function getSchedule(): Promise<ScheduleDay[]> {
  const data = await fetchJson<ScheduleDay[]>('/api/pixuplay/schedule');
  return data || [];
}

export async function getAnimeDetail(id: string | number): Promise<Anime | null> {
  const data = await fetchJson<Anime>(`/api/pixuplay/detail/${id}`);
  return data;
}

export async function getStreamData(
  id: string | number,
  ep: number,
  title: string
): Promise<StreamData | null> {
  const url = `/api/pixuplay/stream/${id}/${ep}?title=${encodeURIComponent(title)}`;
  const data = await fetchJson<StreamData>(url);
  if (data && data.servers) {
    data.servers = data.servers.filter((srv) => {
      const name = (srv.name || '').toLowerCase();
      const label = (srv.label || '').toLowerCase();
      const srvUrl = (srv.url || '').toLowerCase();
      if (name.includes('mirror') || label.includes('mirror')) return false;
      if (name.includes('bstation') || label.includes('bstation') || srvUrl.includes('bilibili')) return false;
      if (name.includes('wetv') || label.includes('wetv') || srvUrl.includes('wetv')) return false;
      return true;
    });
  }
  return data;
}

export async function searchAnime(q: string): Promise<Anime[]> {
  if (!q.trim()) return [];
  const data = await fetchJson<Anime[]>(`/api/pixuplay/search?q=${encodeURIComponent(q)}`);
  return data || [];
}

export function formatTitle(val: any): string {
  if (!val) return 'Anime';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.english || val.romaji || val.userPreferred || val.native || 'Anime';
  }
  return String(val);
}

export function getAnimeTitle(anime?: Anime | any | null): string {
  if (!anime) return 'Anime';
  if (typeof anime === 'string') return anime;
  if (anime.title) {
    return formatTitle(anime.title);
  }
  return anime.name || 'Anime';
}

export function getAnimePoster(anime?: Anime | null): string {
  if (!anime) return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80';
  return (
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large ||
    anime.coverImage?.medium ||
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80'
  );
}

export async function getInteractions(
  animeId: string | number,
  episode: number = 1,
  userId?: string
): Promise<EpisodeInteractions | null> {
  const uid = userId || getOrCreateUserId();
  const url = `/api/pixuplay/interactions?animeId=${encodeURIComponent(String(animeId))}&episode=${episode}&userId=${encodeURIComponent(uid)}`;
  return await fetchJson<EpisodeInteractions>(url);
}

export async function postComment(
  animeId: string | number,
  episode: number,
  userName: string,
  userAvatar: string,
  text: string,
  parentId?: number | null,
  replyToUser?: string | null,
  userId?: string
): Promise<CommentItem | null> {
  try {
    const uid = userId || getOrCreateUserId();
    const res = await fetch('/api/pixuplay/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animeId: String(animeId),
        episode,
        userId: uid,
        userName,
        userAvatar,
        text,
        parentId: parentId || null,
        replyToUser: replyToUser || null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.comment || null;
  } catch (err) {
    console.warn('[API] Failed to post comment:', err);
    return null;
  }
}

export async function deleteComment(commentId: number | string, userId?: string): Promise<boolean> {
  try {
    const uid = userId || getOrCreateUserId();
    const token = localStorage.getItem('pixuplay_auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/pixuplay/comments/delete', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        commentId: Number(commentId),
        userId: uid,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return !!data.status;
  } catch (err) {
    console.warn('[API] Failed to delete comment:', err);
    return false;
  }
}

export async function toggleLike(
  animeId: string | number,
  episode: number
): Promise<{ hasLiked: boolean; likesCount: number } | null> {
  try {
    const uid = getOrCreateUserId();
    const res = await fetch('/api/pixuplay/likes/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animeId: String(animeId),
        episode,
        userId: uid,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      hasLiked: !!data.hasLiked,
      likesCount: Number(data.likesCount) || 0,
    };
  } catch (err) {
    console.warn('[API] Failed to toggle like:', err);
    return null;
  }
}
