import { db } from '../db/connection';
import { calculateLevelData } from '../security/crypto';

export interface FriendProfile {
  id: string;
  name: string;
  avatar: string;
  tagId: number;
  level: number;
  exp: number;
  status?: string;
  watchTimeSeconds?: number;
}

export interface FriendItem {
  id: number;
  friend: FriendProfile;
  status: 'pending' | 'accepted' | 'rejected';
  isSender: boolean;
  createdAt: string;
}

// Format public user profile (safe, no emails)
function mapPublicProfile(row: any): FriendProfile {
  const levelInfo = calculateLevelData(row.exp || 0);
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar || '',
    tagId: row.tag_id || 1,
    level: levelInfo.level,
    exp: row.exp || 0,
    watchTimeSeconds: row.watch_time_seconds || 0,
  };
}

// 1. Search user by Tag ID or Name
export function searchUserForFriend(query: string, currentUserId: string): FriendProfile[] {
  const cleanQuery = query.trim().replace(/^#/, '');
  if (!cleanQuery) return [];

  const tagNum = parseInt(cleanQuery, 10);
  let rows: any[] = [];

  if (!isNaN(tagNum)) {
    rows = db
      .query(`SELECT id, name, avatar, tag_id, exp, watch_time_seconds FROM users WHERE tag_id = ? AND id != ? LIMIT 5`)
      .all(tagNum, currentUserId) as any[];
  } else {
    rows = db
      .query(
        `SELECT id, name, avatar, tag_id, exp, watch_time_seconds FROM users WHERE LOWER(name) LIKE LOWER(?) AND id != ? LIMIT 10`
      )
      .all(`%${cleanQuery}%`, currentUserId) as any[];
  }

  return rows.map(mapPublicProfile);
}

// 2. Send Friend Request
export function sendFriendRequest(
  userId: string,
  targetTagOrId: string | number
): { status: boolean; message: string } {
  let targetUser: any = null;
  const tagNum = typeof targetTagOrId === 'number' ? targetTagOrId : parseInt(String(targetTagOrId).replace(/^#/, ''), 10);

  if (!isNaN(tagNum)) {
    targetUser = db.query(`SELECT id, name FROM users WHERE tag_id = ?`).get(tagNum);
  } else {
    targetUser = db.query(`SELECT id, name FROM users WHERE id = ?`).get(String(targetTagOrId));
  }

  if (!targetUser) {
    return { status: false, message: 'Pengguna dengan Tag ID tersebut tidak ditemukan' };
  }

  if (targetUser.id === userId) {
    return { status: false, message: 'Anda tidak dapat berteman dengan diri sendiri' };
  }

  // Check existing relationship
  const existing = db
    .query(
      `SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`
    )
    .get(userId, targetUser.id, targetUser.id, userId) as any;

  if (existing) {
    if (existing.status === 'accepted') {
      return { status: false, message: 'Anda sudah berteman dengan pengguna ini' };
    }
    if (existing.status === 'pending') {
      if (existing.user_id === userId) {
        return { status: false, message: 'Permintaan pertemanan sudah dikirim sebelumnya' };
      } else {
        // Automatically accept if opposite request already pending
        db.query(`UPDATE friendships SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
          existing.id
        );
        return { status: true, message: `Permintaan diterima! Anda kini berteman dengan ${targetUser.name}` };
      }
    }
  }

  // Insert pending request
  try {
    db.query(`INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'pending')`).run(
      userId,
      targetUser.id
    );
    return { status: true, message: `Permintaan pertemanan berhasil dikirim ke ${targetUser.name}` };
  } catch (err: any) {
    return { status: false, message: err?.message || 'Gagal mengirim permintaan pertemanan' };
  }
}

// 3. Respond to Request (Accept / Reject)
export function respondFriendRequest(
  userId: string,
  requestId: number,
  action: 'accept' | 'reject'
): { status: boolean; message: string } {
  const reqRow = db.query(`SELECT * FROM friendships WHERE id = ? AND friend_id = ?`).get(requestId, userId) as any;
  if (!reqRow) {
    return { status: false, message: 'Permintaan pertemanan tidak ditemukan atau bukan untuk Anda' };
  }

  if (action === 'accept') {
    db.query(`UPDATE friendships SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(requestId);
    return { status: true, message: 'Permintaan pertemanan diterima!' };
  } else {
    db.query(`DELETE FROM friendships WHERE id = ?`).run(requestId);
    return { status: true, message: 'Permintaan pertemanan ditolak' };
  }
}

// 4. Remove Friend
export function removeFriend(userId: string, friendId: string): { status: boolean; message: string } {
  db.query(
    `DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`
  ).run(userId, friendId, friendId, userId);
  return { status: true, message: 'Teman berhasil dihapus dari daftar pertemanan' };
}

// 5. Get Friend List & Pending Requests
export function getFriendList(userId: string): {
  friends: FriendProfile[];
  pendingReceived: FriendItem[];
  pendingSent: FriendItem[];
} {
  // Accepted friends
  const acceptedRows = db
    .query(
      `
      SELECT f.id, f.created_at,
             u.id as u_id, u.name, u.avatar, u.tag_id, u.exp, u.watch_time_seconds
      FROM friendships f
      JOIN users u ON (CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END) = u.id
      WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
      ORDER BY f.updated_at DESC
    `
    )
    .all(userId, userId, userId) as any[];

  const friends = acceptedRows.map((r) =>
    mapPublicProfile({
      id: r.u_id,
      name: r.name,
      avatar: r.avatar,
      tag_id: r.tag_id,
      exp: r.exp,
      watch_time_seconds: r.watch_time_seconds,
    })
  );

  // Pending requests received by me
  const receivedRows = db
    .query(
      `
      SELECT f.id, f.created_at,
             u.id as u_id, u.name, u.avatar, u.tag_id, u.exp, u.watch_time_seconds
      FROM friendships f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `
    )
    .all(userId) as any[];

  const pendingReceived: FriendItem[] = receivedRows.map((r) => ({
    id: r.id,
    friend: mapPublicProfile({
      id: r.u_id,
      name: r.name,
      avatar: r.avatar,
      tag_id: r.tag_id,
      exp: r.exp,
      watch_time_seconds: r.watch_time_seconds,
    }),
    status: 'pending',
    isSender: false,
    createdAt: r.created_at,
  }));

  // Pending requests sent by me
  const sentRows = db
    .query(
      `
      SELECT f.id, f.created_at,
             u.id as u_id, u.name, u.avatar, u.tag_id, u.exp, u.watch_time_seconds
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `
    )
    .all(userId) as any[];

  const pendingSent: FriendItem[] = sentRows.map((r) => ({
    id: r.id,
    friend: mapPublicProfile({
      id: r.u_id,
      name: r.name,
      avatar: r.avatar,
      tag_id: r.tag_id,
      exp: r.exp,
      watch_time_seconds: r.watch_time_seconds,
    }),
    status: 'pending',
    isSender: true,
    createdAt: r.created_at,
  }));

  return { friends, pendingReceived, pendingSent };
}

export interface DirectMessageItem {
  id: number;
  senderId: string;
  receiverId: string;
  message: string;
  msgType: 'text' | 'nobar_invite';
  nobarRoomId?: string;
  nobarAnimeTitle?: string;
  nobarEpisode?: number;
  isRead: boolean;
  createdAt: string;
}

// 6. Direct Chat & Nobar Invite functions
export function sendDirectMessage(
  senderId: string,
  receiverId: string,
  message: string,
  msgType: 'text' | 'nobar_invite' = 'text',
  nobarRoomId?: string,
  nobarAnimeTitle?: string,
  nobarEpisode?: number
): { status: boolean; message: string; messageItem?: DirectMessageItem } {
  // Check if they are friends
  const friendship = db
    .query(
      `SELECT status FROM friendships WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'`
    )
    .get(senderId, receiverId, receiverId, senderId);

  if (!friendship) {
    return { status: false, message: 'Anda hanya dapat mengirim pesan ke pengguna yang sudah berteman' };
  }

  const cleanText = message.trim().slice(0, 500);
  if (!cleanText && msgType !== 'nobar_invite') {
    return { status: false, message: 'Pesan tidak boleh kosong' };
  }

  const stmt = db.prepare(`
    INSERT INTO direct_messages (sender_id, receiver_id, message, msg_type, nobar_room_id, nobar_anime_title, nobar_episode)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const res = stmt.run(
    senderId,
    receiverId,
    cleanText || (msgType === 'nobar_invite' ? `Mengundang Anda ke Room Nobar ${nobarAnimeTitle || ''}` : ''),
    msgType,
    nobarRoomId || null,
    nobarAnimeTitle || null,
    nobarEpisode || null
  );

  const insertedId = Number(res.lastInsertRowid);
  const row = db.query(`SELECT * FROM direct_messages WHERE id = ?`).get(insertedId) as any;

  return {
    status: true,
    message: 'Pesan terkirim',
    messageItem: {
      id: row.id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      message: row.message,
      msgType: row.msg_type,
      nobarRoomId: row.nobar_room_id || undefined,
      nobarAnimeTitle: row.nobar_anime_title || undefined,
      nobarEpisode: row.nobar_episode || undefined,
      isRead: !!row.is_read,
      createdAt: row.created_at,
    },
  };
}

export function getDirectMessages(
  userId: string,
  friendId: string,
  limit: number = 50
): DirectMessageItem[] {
  // Mark received messages as read
  db.query(`UPDATE direct_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`).run(
    friendId,
    userId
  );

  const rows = db
    .query(
      `
    SELECT * FROM direct_messages
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
    LIMIT ?
  `
    )
    .all(userId, friendId, friendId, userId, limit) as any[];

  return rows.map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    receiverId: r.receiver_id,
    message: r.message,
    msgType: r.msg_type,
    nobarRoomId: r.nobar_room_id || undefined,
    nobarAnimeTitle: r.nobar_anime_title || undefined,
    nobarEpisode: r.nobar_episode || undefined,
    isRead: !!r.is_read,
    createdAt: r.created_at,
  }));
}

