import { UserProfile, HistoryItem, SavedItem } from '../types';

const TOKEN_KEY = 'pixuplay_auth_token';
const USER_KEY = 'pixuplay_auth_user';

export const DEFAULT_GUEST_AVATAR = '';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: UserProfile): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (user.avatar) {
      localStorage.setItem('pixuplay_avatar', user.avatar);
      window.dispatchEvent(new Event('pixuplay_avatar_changed'));
    }
    if (user.name) {
      localStorage.setItem('pixuplay_nickname', user.name);
    }
    window.dispatchEvent(new Event('pixuplay_auth_changed'));
  } catch (e) {
    console.warn('Failed to save session to localStorage', e);
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('pixuplay_history');
    localStorage.removeItem('pixuplay_favorites');
    localStorage.removeItem('pixuplay_watchlist');
    localStorage.removeItem('pixuplay_avatar');
    localStorage.removeItem('pixuplay_nickname');
    window.dispatchEvent(new Event('pixuplay_avatar_changed'));
    window.dispatchEvent(new Event('pixuplay_auth_changed'));
  } catch (e) {
    console.warn('Failed to clear session', e);
  }
}

export interface SyncPayload {
  history: HistoryItem[];
  favorites: SavedItem[];
  watchlist: SavedItem[];
}

export interface LoginResponse {
  status: boolean;
  user: UserProfile;
  token: string;
  syncedData: SyncPayload;
}

export async function loginWithGoogleCredential(
  credential: string,
  localData?: SyncPayload
): Promise<LoginResponse> {
  const res = await fetch('/api/pixuplay/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential,
      localData: localData || null,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Gagal login dengan akun Google');
  }

  setStoredSession(data.token, data.user);
  return data;
}

export async function fetchCurrentUserData(): Promise<{
  user: UserProfile;
  syncedData: SyncPayload;
} | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/pixuplay/user/data', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearStoredSession();
      }
      return null;
    }

    const data = await res.json();
    if (data.status && data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return {
        user: data.user,
        syncedData: {
          history: Array.isArray(data.history) ? data.history : [],
          favorites: Array.isArray(data.favorites) ? data.favorites : [],
          watchlist: Array.isArray(data.watchlist) ? data.watchlist : [],
        },
      };
    }
    return null;
  } catch (e) {
    console.warn('Failed to fetch user data', e);
    return null;
  }
}

export async function syncUserDataToCloud(data: Partial<SyncPayload>): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;

  try {
    const res = await fetch('/api/pixuplay/user/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
      keepalive: true,
    });
    return res.ok;
  } catch (e) {
    console.warn('Sync failed', e);
    return false;
  }
}

export async function updateUserAvatar(avatar: string): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;

  try {
    const res = await fetch('/api/pixuplay/user/avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ avatar }),
    });

    if (res.ok) {
      const u = getStoredUser();
      if (u) {
        u.avatar = avatar;
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      }
      localStorage.setItem('pixuplay_avatar', avatar);
      window.dispatchEvent(new Event('pixuplay_avatar_changed'));
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Failed to update avatar', e);
    return false;
  }
}

export async function updateUserDisplayName(
  name: string
): Promise<{ success: boolean; message?: string; user?: UserProfile }> {
  const token = getStoredToken();
  if (!token) return { success: false, message: 'Harap masuk terlebih dahulu' };

  try {
    const res = await fetch('/api/pixuplay/user/change-name', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();
    if (!res.ok || !data.status) {
      return { success: false, message: data.message || 'Gagal mengubah nama tampilan' };
    }

    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem('pixuplay_nickname', data.user.name);
      window.dispatchEvent(new Event('pixuplay_auth_changed'));
    }
    return { success: true, user: data.user };
  } catch (e: any) {
    return { success: false, message: e.message || 'Koneksi gagal' };
  }
}

export async function sendWatchHeartbeat(
  seconds: number,
  animeId?: string,
  episode?: number,
  isRewatch?: boolean
): Promise<{ watchTimeSeconds: number; exp: number; level: number; levelTitle: string } | null> {
  const token = getStoredToken();
  if (token) {
    try {
      const res = await fetch('/api/pixuplay/user/watch-heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ seconds, animeId, episode, isRewatch }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status && data.user) {
          const u = getStoredUser();
          if (u) {
            u.watchTimeSeconds = data.user.watchTimeSeconds;
            u.exp = data.user.exp;
            u.level = data.user.level;
            u.levelTitle = data.user.levelTitle;
            localStorage.setItem(USER_KEY, JSON.stringify(u));
            window.dispatchEvent(new Event('pixuplay_auth_changed'));
          }
          return data.user;
        }
      }
    } catch {}
  } else {
    // Guest watch accumulation - only track watch seconds, EXP is locked for guest mode
    try {
      const prevSec = parseInt(localStorage.getItem('pixuplay_guest_watch_seconds') || '0', 10);
      const nextSec = prevSec + seconds;
      localStorage.setItem('pixuplay_guest_watch_seconds', String(nextSec));
      window.dispatchEvent(new Event('pixuplay_watch_time_updated'));
    } catch {}
  }
  return null;
}

export async function logoutUser(): Promise<void> {
  const token = getStoredToken();
  if (token) {
    try {
      await fetch('/api/pixuplay/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {}
  }
  clearStoredSession();
}
