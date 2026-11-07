import { jsonResponse, parseJsonBody, isRateLimited } from '../security/rateLimiter';
import { getSessionUser } from '../services/authService';
import {
  searchUserForFriend,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  getFriendList,
  sendDirectMessage,
  getDirectMessages,
} from '../services/friendService';

export async function handleFriendRoutes(req: Request, url: URL, clientIp: string): Promise<Response | null> {
  const pathname = url.pathname;

  // 1. Get friend list and pending requests
  if (pathname === '/api/pixuplay/friends' && req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: 'Harap masuk terlebih dahulu' }, 401);
    }
    const data = getFriendList(user.id);
    return jsonResponse({ status: true, data });
  }

  // 2. Search users to add as friend
  if (pathname === '/api/pixuplay/friends/search' && req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: 'Harap masuk terlebih dahulu' }, 401);
    }
    const q = url.searchParams.get('q') || '';
    if (!q.trim()) {
      return jsonResponse({ status: true, data: [] });
    }
    const results = searchUserForFriend(q, user.id);
    return jsonResponse({ status: true, data: results });
  }

  // 3. Send friend request
  if (pathname === '/api/pixuplay/friends/request' && req.method === 'POST') {
    if (isRateLimited(`friend_req_${clientIp}`, 15, 60000)) {
      return jsonResponse({ status: false, message: 'Terlalu banyak permintaan pertemanan. Tunggu sebentar.' }, 429);
    }
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: 'Harap masuk terlebih dahulu' }, 401);
    }
    const { data: body, error: bodyError } = await parseJsonBody(req, 4096);
    if (bodyError || !body?.targetTagOrId) {
      return jsonResponse({ status: false, message: bodyError || 'Target Tag ID atau User ID diperlukan' }, 400);
    }

    const result = sendFriendRequest(user.id, body.targetTagOrId);
    return jsonResponse(result, result.status ? 200 : 400);
  }

  // 4. Respond (accept / reject)
  if (pathname === '/api/pixuplay/friends/respond' && req.method === 'POST') {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: 'Harap masuk terlebih dahulu' }, 401);
    }
    const { data: body, error: bodyError } = await parseJsonBody(req, 4096);
    if (bodyError || !body?.requestId || !body?.action) {
      return jsonResponse({ status: false, message: bodyError || 'requestId dan action (accept/reject) diperlukan' }, 400);
    }

    const result = respondFriendRequest(user.id, Number(body.requestId), body.action);
    return jsonResponse(result, result.status ? 200 : 400);
  }

  // 5. Remove friend
  if (pathname === '/api/pixuplay/friends/remove' && req.method === 'POST') {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: 'Harap masuk terlebih dahulu' }, 401);
    }
    const { data: body, error: bodyError } = await parseJsonBody(req, 4096);
    if (bodyError || !body?.friendId) {
      return jsonResponse({ status: false, message: bodyError || 'friendId diperlukan' }, 400);
    }

    const result = removeFriend(user.id, String(body.friendId));
    return jsonResponse(result);
  }

  // 6. Direct Chat Messages (Get Chat History)
  if (pathname === '/api/pixuplay/friends/messages' && req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: 'Harap masuk terlebih dahulu' }, 401);
    }
    const friendId = url.searchParams.get('friendId');
    if (!friendId) {
      return jsonResponse({ status: false, message: 'friendId diperlukan' }, 400);
    }
    const messages = getDirectMessages(user.id, friendId);
    return jsonResponse({ status: true, data: messages });
  }

  // 7. Send Direct Chat Message or Nobar Room Invite
  if (pathname === '/api/pixuplay/friends/messages/send' && req.method === 'POST') {
    if (isRateLimited(`friend_dm_${clientIp}`, 40, 60000)) {
      return jsonResponse({ status: false, message: 'Terlalu banyak mengirim pesan. Mohon tunggu.' }, 429);
    }
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: 'Harap masuk terlebih dahulu' }, 401);
    }
    const { data: body, error: bodyError } = await parseJsonBody(req, 8192);
    if (bodyError || !body?.receiverId) {
      return jsonResponse({ status: false, message: bodyError || 'receiverId diperlukan' }, 400);
    }

    const result = sendDirectMessage(
      user.id,
      String(body.receiverId),
      String(body.message || ''),
      body.msgType === 'nobar_invite' ? 'nobar_invite' : 'text',
      body.nobarRoomId ? String(body.nobarRoomId) : undefined,
      body.nobarAnimeTitle ? String(body.nobarAnimeTitle) : undefined,
      body.nobarEpisode ? Number(body.nobarEpisode) : undefined
    );
    return jsonResponse(result, result.status ? 200 : 400);
  }

  return null;
}
