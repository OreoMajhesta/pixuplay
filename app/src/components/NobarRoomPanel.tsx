import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Copy,
  Check,
  Send,
  Crown,
  LogOut,
  MessageSquare,
  Sparkles,
  Radio,
  ChevronDown,
  ShieldAlert,
} from 'lucide-react';
import { NobarRoomInfo, NobarChatMsg } from '../nobarSync';
import { getOrCreateGuestName } from '../api';

interface NobarRoomPanelProps {
  room: NobarRoomInfo | null;
  role: 'host' | 'guest' | null;
  isConnected: boolean;
  chatMessages: NobarChatMsg[];
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onCreateRoom: (hostName: string) => void;
  onLeaveRoom: () => void;
  floatingEmojis?: Array<{ id: number; emoji: string; x: number }>;
  compact?: boolean;
  defaultUserName?: string;
}

const PRESET_EMOJIS = ['🔥', '😂', '😱', '👏', '❤️', '🎉', '✨', '💀'];

export const NobarRoomPanel: React.FC<NobarRoomPanelProps> = ({
  room,
  role,
  isConnected,
  chatMessages,
  onSendMessage,
  onSendReaction,
  onCreateRoom,
  onLeaveRoom,
  compact = false,
  defaultUserName,
}) => {
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [hostNameInput, setHostNameInput] = useState<string>(() => defaultUserName || getOrCreateGuestName());
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    if (defaultUserName) {
      setHostNameInput(defaultUserName);
    }
  }, [defaultUserName]);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom inside chatContainerRef without triggering window scroll
  useEffect(() => {
    if (!isScrolledUp && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isScrolledUp]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 60;
    setIsScrolledUp(isUp);
  };

  const scrollToBottom = () => {
    setIsScrolledUp(false);
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const shareUrl = room ? `${window.location.origin}/?nobar=${room.id}` : '';

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
    setIsScrolledUp(false);
  };

  // If no room is active yet: Create room banner
  if (!room) {
    return (
      <div className="bg-[#121212] border border-subtle rounded-2xl p-5 space-y-4 text-white">
        <div className="flex items-center gap-2.5 border-b border-subtle pb-3">
          <div className="w-8 h-8 rounded-full bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Live Watch Party (Nobar)</h3>
            <p className="text-[11px] text-neutral-400">Nonton anime bareng teman secara realtime</p>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          Saat Host memutar, menjeda, atau mengganti episode, semua penonton lain akan ikut tersinkronisasi otomatis seperti di bioskop.
        </p>

        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1.5">
              Nama Panggilan Anda (Host):
            </label>
            <input
              type="text"
              value={hostNameInput}
              onChange={(e) => setHostNameInput(e.target.value)}
              placeholder="Contoh: Budi Otaku"
              maxLength={30}
              className="w-full px-3.5 py-2.5 bg-black border border-subtle focus:border-neutral-500 rounded-xl text-xs text-white focus:outline-none"
            />
          </div>

          <button
            onClick={() => onCreateRoom(hostNameInput.trim() || 'Host')}
            className="w-full py-2.5 bg-white text-black font-extrabold text-xs rounded-xl hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98"
          >
            <Users className="w-4 h-4" />
            Mulai Room Nobar Sekarang
          </button>
        </div>
      </div>
    );
  }

  // Active YouTube Live Chat Room View
  return (
    <div className="relative bg-[#0f0f0f] border border-subtle rounded-2xl flex flex-col h-full overflow-hidden text-white shadow-xl">
      {/* Top Header: YouTube Live Style */}
      <div className="px-4 py-3 bg-[#181818] border-b border-subtle flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-red-500 animate-pulse ring-4 ring-red-500/20' : 'bg-amber-500'
              }`}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wide text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-red-500" />
                LIVE CHAT
              </span>
              {role === 'host' ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[9px] font-black rounded-full">
                  <Crown className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> HOST
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-[9px] font-semibold rounded-full border border-subtle">
                  PESERTA
                </span>
              )}
            </div>
            <p className="text-[10px] text-neutral-400 truncate">
              {role === 'host' ? 'Sinkronisasi dikontrol oleh Anda' : `Mengikuti: ${room.hostName}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition-colors cursor-pointer text-[10px] font-semibold flex items-center gap-1 border border-subtle"
            title="Salin Link Room"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{copied ? 'Tersalin' : 'Bagikan'}</span>
          </button>

          <button
            onClick={onLeaveRoom}
            className="p-1.5 rounded-lg hover:bg-red-950/40 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer text-[10px] flex items-center gap-1 border border-subtle"
            title={role === 'host' ? 'Bubarkan Room Nobar' : 'Keluar dari Room Nobar'}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pinned Info Banner */}
      <div className="px-3.5 py-2 bg-neutral-900/90 border-b border-subtle/60 flex items-center justify-between text-[11px] text-neutral-300">
        <div className="flex items-center gap-1.5 truncate">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="truncate">
            <span className="font-bold text-white">{room.animeTitle}</span> (Ep {room.episode})
          </span>
        </div>
        <span className="text-[10px] text-emerald-400 font-mono flex-shrink-0">
          {isConnected ? '● Terhubung' : '○ Offline'}
        </span>
      </div>

      {/* Chat Messages Feed: Clean YouTube Live Style */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3.5 space-y-2.5 text-xs select-text min-h-[220px]"
      >
        {chatMessages.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-[11px] flex flex-col items-center justify-center gap-2">
            <MessageSquare className="w-6 h-6 stroke-1 text-neutral-600" />
            <p>Selamat datang di Live Chat Nobar!</p>
            <p className="text-[10px] text-neutral-600">Pesan yang dikirim akan tampil ke seluruh penonton.</p>
          </div>
        ) : (
          chatMessages.map((msg, i) => {
            const isSystem = msg.sender === 'Sistem';
            return (
              <div
                key={i}
                className={`group flex items-start gap-2.5 rounded-lg transition-colors ${
                  isSystem
                    ? 'p-2 bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400'
                    : 'p-1 hover:bg-white/[0.03]'
                }`}
              >
                {/* User Avatar Circle or Image */}
                {!isSystem && msg.avatar && (
                  <img
                    src={msg.avatar}
                    alt={msg.sender}
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5 border border-neutral-700 shadow-sm"
                    onError={(e) => {
                      (e.target as any).style.display = 'none';
                      const fallback = (e.target as any).nextElementSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                )}
                {!isSystem && (
                  <div
                    style={{ display: msg.avatar ? 'none' : 'flex' }}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                      msg.isHost
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                    }`}
                  >
                    {msg.isHost ? '★' : msg.sender.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1 leading-snug">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`font-bold text-[11px] ${
                        msg.isHost ? 'text-amber-300 font-black' : isSystem ? 'text-neutral-400' : 'text-neutral-300'
                      }`}
                    >
                      {msg.sender}
                    </span>

                    {msg.isHost && (
                      <span className="px-1 py-0.2 bg-amber-500/20 text-amber-300 text-[8px] font-extrabold rounded">
                        HOST
                      </span>
                    )}

                    <span className="text-[9px] text-neutral-600 ml-auto opacity-70 group-hover:opacity-100 transition-opacity">
                      {msg.time}
                    </span>
                  </div>

                  <p className="text-[12px] text-neutral-100 break-words mt-0.5 selection:bg-red-500/40">
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Scrolled Up Notification Pill */}
      {isScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-full text-[10px] font-bold shadow-xl flex items-center gap-1 cursor-pointer transition-all animate-bounce z-20"
        >
          <ChevronDown className="w-3 h-3" /> Pesan Baru di Bawah
        </button>
      )}

      {/* Quick Reaction Emoji Tray (YouTube Live Style) */}
      <div className="px-3 py-1.5 bg-[#141414] border-t border-subtle/80 flex items-center justify-between gap-1">
        {PRESET_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSendReaction(emoji)}
            className="flex-1 py-1 hover:bg-neutral-800 rounded-lg text-base transition-transform active:scale-135 hover:scale-120 cursor-pointer flex items-center justify-center"
            title={`Kirim reaksi ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <form onSubmit={handleSendChat} className="p-2.5 bg-[#181818] border-t border-subtle flex items-center gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Kirim pesan live..."
          maxLength={300}
          className="flex-1 px-3.5 py-2 bg-[#0c0c0c] border border-subtle focus:border-neutral-500 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!chatInput.trim()}
          className="p-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white rounded-xl transition-all cursor-pointer shadow-md disabled:cursor-not-allowed flex items-center justify-center"
          title="Kirim Pesan"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
