import { FriendListData, FriendProfile } from '../types';
import { getStoredToken } from './authService';

export async function fetchFriends(): Promise<FriendListData | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/pixuplay/friends', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (e) {
    console.warn('Failed to fetch friends', e);
    return null;
  }
}

export async function searchUsers(query: string): Promise<FriendProfile[]> {
  const token = getStoredToken();
  if (!token || !query.trim()) return [];

  try {
    const res = await fetch(`/api/pixuplay/friends/search?q=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.warn('Failed to search users', e);
    return [];
  }
}

export async function sendFriendRequestApi(targetTagOrId: string | number): Promise<{ status: boolean; message: string }> {
  const token = getStoredToken();
  if (!token) return { status: false, message: 'Harap login terlebih dahulu' };

  try {
    const res = await fetch('/api/pixuplay/friends/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetTagOrId }),
    });
    const json = await res.json();
    return json;
  } catch (e: any) {
    return { status: false, message: e?.message || 'Gagal mengirim permintaan pertemanan' };
  }
}

export async function respondFriendRequestApi(requestId: number, action: 'accept' | 'reject'): Promise<{ status: boolean; message: string }> {
  const token = getStoredToken();
  if (!token) return { status: false, message: 'Harap login terlebih dahulu' };

  try {
    const res = await fetch('/api/pixuplay/friends/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ requestId, action }),
    });
    const json = await res.json();
    return json;
  } catch (e: any) {
    return { status: false, message: e?.message || 'Gagal memproses permintaan' };
  }
}

export async function removeFriendApi(friendId: string): Promise<{ status: boolean; message: string }> {
  const token = getStoredToken();
  if (!token) return { status: false, message: 'Harap login terlebih dahulu' };

  try {
    const res = await fetch('/api/pixuplay/friends/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ friendId }),
    });
    const json = await res.json();
    return json;
  } catch (e: any) {
    return { status: false, message: e?.message || 'Gagal menghapus teman' };
  }
}
