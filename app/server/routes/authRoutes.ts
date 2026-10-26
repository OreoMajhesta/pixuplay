import {
  getSessionUser,
  loginWithGoogle,
  logoutUser,
  deleteAccount,
} from "../services/authService";
import {
  getUserSyncData,
  saveUserSyncData,
  recordWatchHeartbeat,
  changeUserName,
  updateUserAvatar,
} from "../services/syncService";
import { jsonResponse, parseJsonBody, isRateLimited } from "../security/rateLimiter";

export async function handleAuthRoutes(req: Request, url: URL, clientIp: string): Promise<Response | null> {
  const { pathname } = url;

  // 1. Google OAuth Login
  if (pathname === "/api/pixuplay/auth/google" && req.method === "POST") {
    if (isRateLimited(`auth_${clientIp}`, 30, 60000)) {
      return jsonResponse({ status: false, message: "Terlalu banyak percobaan masuk. Tunggu 1 menit." }, 429);
    }

    const { data: body, error: bodyError } = await parseJsonBody(req, 1048576);
    if (bodyError || !body || !body.credential) {
      return jsonResponse({ status: false, message: "Token kredensial Google diperlukan" }, 400);
    }

    const result = await loginWithGoogle(body.credential);
    if (!result.success) {
      return jsonResponse({ status: false, message: result.error }, result.status || 400);
    }

    return jsonResponse({ status: true, ...result.data });
  }

  // 2. Current User Profile & Sync Data (/api/pixuplay/user/data or /api/pixuplay/auth/me)
  if ((pathname === "/api/pixuplay/user/data" || pathname === "/api/pixuplay/auth/me") && req.method === "GET") {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: "Sesi tidak ditemukan atau telah berakhir" }, 401);
    }

    const syncData = getUserSyncData(user.id);
    return jsonResponse({
      status: true,
      user,
      ...syncData,
    });
  }

  // 3. Logout
  if (pathname === "/api/pixuplay/auth/logout" && req.method === "POST") {
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      logoutUser(token);
    }
    return jsonResponse({ status: true, message: "Berhasil keluar" });
  }

  // 4. Push Updated History / Watchlist / Favorites to Cloud
  if (pathname === "/api/pixuplay/user/sync" && req.method === "POST") {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: "Akses ditolak" }, 401);
    }

    const { data: body, error: bodyError } = await parseJsonBody(req, 1048576);
    if (bodyError || !body) {
      return jsonResponse({ status: false, message: bodyError || "Data tidak valid" }, 400);
    }

    const result = saveUserSyncData(user.id, body.history, body.favorites, body.watchlist);
    if (!result.success) {
      return jsonResponse({ status: false, message: result.error }, 500);
    }

    return jsonResponse({ status: true, message: "Sinkronisasi berhasil disimpan" });
  }

  // 5. Update Avatar
  if (pathname === "/api/pixuplay/user/avatar" && req.method === "POST") {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: "Akses ditolak" }, 401);
    }

    const { data: body, error: bodyError } = await parseJsonBody(req, 2097152);
    if (bodyError || !body || !body.avatar) {
      return jsonResponse({ status: false, message: "Foto profil diperlukan" }, 400);
    }

    const result = updateUserAvatar(user.id, String(body.avatar));
    if (!result.success) {
      return jsonResponse({ status: false, message: result.error }, 500);
    }

    return jsonResponse({
      status: true,
      avatar: result.avatar,
      message: "Foto profil berhasil diperbarui",
    });
  }

  // 6. Change Display Name
  if (pathname === "/api/pixuplay/user/change-name" && req.method === "POST") {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: "Akses ditolak. Silakan login terlebih dahulu." }, 401);
    }

    const { data: body, error: bodyError } = await parseJsonBody(req, 4096);
    if (bodyError || !body) {
      return jsonResponse({ status: false, message: bodyError || "Data tidak valid" }, 400);
    }

    const result = changeUserName(user.id, body.name);
    if (!result.success) {
      return jsonResponse({ status: false, message: result.error }, result.status || 400);
    }

    user.name = result.name!;
    return jsonResponse({
      status: true,
      message: "Nama tampilan berhasil diperbarui",
      user,
    });
  }

  // 7. Watch Time Heartbeat & EXP
  if (pathname === "/api/pixuplay/user/watch-heartbeat" && req.method === "POST") {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: "Akses ditolak" }, 401);
    }

    const { data: body } = await parseJsonBody(req, 2048);
    const result = recordWatchHeartbeat(user.id, body?.seconds, body?.isRewatch);
    if (!result.success) {
      return jsonResponse({ status: false, message: result.error }, 500);
    }

    return jsonResponse({ status: true, user: result.user });
  }

  // 8. Delete Account
  if (pathname === "/api/pixuplay/user/account" && req.method === "DELETE") {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: "Akses ditolak" }, 401);
    }

    deleteAccount(user.id);
    return jsonResponse({ status: true, message: "Akun berhasil dihapus permanen" });
  }

  return null;
}
