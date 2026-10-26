export interface NobarChatMsg {
  sender: string;
  avatar?: string;
  text: string;
  time: string;
  isHost?: boolean;
}

export interface NobarRoomInfo {
  id: string;
  animeId: string;
  animeTitle: string;
  episode: number;
  serverUrl: string;
  serverType: string;
  hostId: string;
  hostName: string;
  currentTime: number;
  isPlaying: boolean;
  chat: NobarChatMsg[];
}

export interface NobarSyncEvent {
  currentTime: number;
  isPlaying: boolean;
  episode?: number;
  serverUrl?: string;
  animeId?: string;
  animeTitle?: string;
  hostName?: string;
  timestamp: number;
}

export async function createNobarRoom(
  animeId: string | number,
  animeTitle: string,
  episode: number,
  serverUrl: string,
  hostName: string = 'Host'
): Promise<{ roomId: string; hostId: string; room: NobarRoomInfo } | null> {
  try {
    const res = await fetch('/api/pixuplay/nobar/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animeId: String(animeId),
        animeTitle,
        episode,
        serverUrl,
        hostName,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Failed to create Nobar room:', err);
    return null;
  }
}

export async function getNobarRoom(roomId: string): Promise<NobarRoomInfo | null> {
  try {
    const res = await fetch(`/api/pixuplay/nobar/room/${roomId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.room || null;
  } catch (err) {
    console.error('Failed to get Nobar room:', err);
    return null;
  }
}

export class NobarClient {
  private ws: WebSocket | null = null;
  private roomId: string;
  private role: 'host' | 'guest';
  private userName: string;
  private userId: string;
  private isDestroyed = false;
  private reconnectTimer: any = null;

  public onSync?: (event: NobarSyncEvent) => void;
  public onChat?: (msg: NobarChatMsg) => void;
  public onReaction?: (emoji: string) => void;
  public onUserJoined?: (name: string) => void;
  public onUserLeft?: (name: string) => void;
  public onRoomState?: (room: NobarRoomInfo) => void;
  public onRoomDisbanded?: (message: string) => void;
  public onStatusChange?: (connected: boolean) => void;
  private userAvatar?: string;

  constructor(roomId: string, role: 'host' | 'guest', userName: string, userAvatar?: string) {
    this.roomId = roomId;
    this.role = role;
    this.userName = userName;
    this.userAvatar = userAvatar;
    this.userId = Math.random().toString(36).substring(2, 9);
    this.connect();
  }

  private connect() {
    if (this.isDestroyed) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // If running on dev port 20006 with vite, proxy handles /ws
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/nobar?roomId=${encodeURIComponent(
        this.roomId
      )}&userId=${encodeURIComponent(this.userId)}&role=${this.role}&name=${encodeURIComponent(
        this.userName
      )}&avatar=${encodeURIComponent(this.userAvatar || '')}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.onStatusChange?.(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'sync') {
            this.onSync?.(msg);
          } else if (msg.type === 'chat') {
            this.onChat?.(msg);
          } else if (msg.type === 'reaction') {
            this.onReaction?.(msg.emoji);
          } else if (msg.type === 'user_joined') {
            this.onUserJoined?.(msg.name);
          } else if (msg.type === 'user_left') {
            this.onUserLeft?.(msg.name);
          } else if (msg.type === 'room_state') {
            this.onRoomState?.(msg.room);
          } else if (msg.type === 'room_disbanded') {
            this.onRoomDisbanded?.(msg.message || 'Room nobar telah dibubarkan oleh host.');
          }
        } catch (e) {
          console.warn('Nobar message error:', e);
        }
      };

      this.ws.onclose = () => {
        this.onStatusChange?.(false);
        if (!this.isDestroyed) {
          this.reconnectTimer = setTimeout(() => this.connect(), 2500);
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      console.warn('Nobar connection failed, will retry:', e);
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    }
  }

  public sendSync(
    currentTime: number,
    isPlaying: boolean,
    episode?: number,
    serverUrl?: string,
    animeId?: string,
    animeTitle?: string
  ) {
    if (this.role !== 'host') return; // only host can broadcast master sync
    const payload = {
      type: 'sync',
      roomId: this.roomId,
      currentTime,
      isPlaying,
      episode,
      serverUrl,
      animeId,
      animeTitle,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }

    // Also send HTTP fallback in background (non-blocking)
    fetch(`/api/pixuplay/nobar/room/${this.roomId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  public sendDisband() {
    if (this.role !== 'host') return;
    const payload = {
      type: 'disband',
      roomId: this.roomId,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }

    fetch(`/api/pixuplay/nobar/room/${this.roomId}/disband`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  public sendChat(text: string, avatar?: string) {
    const payload = {
      type: 'chat',
      roomId: this.roomId,
      text,
      sender: this.userName,
      avatar: avatar || this.userAvatar || '',
      isHost: this.role === 'host',
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      // HTTP fallback
      fetch(`/api/pixuplay/nobar/room/${this.roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  }

  public sendReaction(emoji: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'reaction', emoji, roomId: this.roomId }));
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
  }
}
