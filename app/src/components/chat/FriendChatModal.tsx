import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Radio, Play, Check, Clock, User } from 'lucide-react';
import { DirectMessageItem, FriendProfile, UserProfile } from '../../types';
import { fetchDirectMessages, sendDirectMessageApi } from '../../services/friendService';

interface FriendChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  friend: FriendProfile | null;
  onJoinNobarRoom?: (roomId: string) => void;
  activeNobarRoomId?: string | null;
  activeNobarAnimeTitle?: string;
  activeNobarEpisode?: number;
}

export const FriendChatModal: React.FC<FriendChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  friend,
  onJoinNobarRoom,
  activeNobarRoomId,
  activeNobarAnimeTitle,
  activeNobarEpisode,
}) => {
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<any>(null);

  const loadMessages = async () => {
    if (!friend) return;
    const res = await fetchDirectMessages(friend.id);
    setMessages(res);
  };

  useEffect(() => {
    if (!isOpen || !friend) return;
    setLoading(true);
    loadMessages().finally(() => setLoading(false));

    // Polling every 3 seconds for new chats
    pollTimerRef.current = setInterval(loadMessages, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, friend?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!isOpen || !friend) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    const textToSend = inputText.trim();
    setInputText('');

    const res = await sendDirectMessageApi({
      receiverId: friend.id,
      message: textToSend,
      msgType: 'text',
    });

    if (res.status && res.messageItem) {
      setMessages((prev) => [...prev, res.messageItem!]);
    }
    setSending(false);
  };

  const handleSendNobarInvite = async () => {
    if (!activeNobarRoomId || sending) return;
    setSending(true);

    const res = await sendDirectMessageApi({
      receiverId: friend.id,
      message: `Yuk nonton bareng ${activeNobarAnimeTitle || 'Anime'} Ep ${activeNobarEpisode || 1}!`,
      msgType: 'nobar_invite',
      nobarRoomId: activeNobarRoomId,
      nobarAnimeTitle: activeNobarAnimeTitle,
      nobarEpisode: activeNobarEpisode,
    });

    if (res.status && res.messageItem) {
      setMessages((prev) => [...prev, res.messageItem!]);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-lg h-[560px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-neutral-900 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
              {friend.avatar ? (
                <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                  {friend.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-neutral-900" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">{friend.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-black/60 rounded text-neutral-400">
                  #{friend.tagId}
                </span>
              </div>
              <div className="text-[10px] text-amber-400 font-bold">Level {friend.level}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Nobar Invite Button if user has active room */}
            {activeNobarRoomId && (
              <button
                onClick={handleSendNobarInvite}
                disabled={sending}
                className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Kirim Undangan Nobar"
              >
                <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span className="hidden sm:inline">Ajak Nobar</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0d0d0d] no-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-neutral-500">
              Memuat percakapan...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-neutral-500">
              <Clock className="w-8 h-8 opacity-40" />
              <p className="text-xs">Belum ada pesan. Sapa {friend.name} sekarang!</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.senderId === currentUser.id;

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                >
                  {/* Nobar Room Invite Card */}
                  {m.msgType === 'nobar_invite' && m.nobarRoomId ? (
                    <div
                      className={`max-w-[85%] sm:max-w-xs rounded-2xl p-3 border shadow-lg ${
                        isMe
                          ? 'bg-red-950/40 border-red-500/40 text-white'
                          : 'bg-neutral-900 border-white/15 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white flex-shrink-0">
                          <Radio className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                            Undangan Nobar
                          </div>
                          <div className="text-xs font-black truncate">{m.nobarAnimeTitle || 'Anime'}</div>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-300 mb-3">{m.message}</p>
                      {onJoinNobarRoom && (
                        <button
                          onClick={() => {
                            onJoinNobarRoom(m.nobarRoomId!);
                            onClose();
                          }}
                          className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow transition-all active:scale-98"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Gabung Room Nobar</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Standard Chat Bubble */
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-sm ${
                        isMe
                          ? 'bg-red-600 text-white rounded-tr-xs'
                          : 'bg-neutral-800 border border-white/5 text-neutral-100 rounded-tl-xs'
                      }`}
                    >
                      {m.message}
                    </div>
                  )}

                  <span className="text-[9px] text-neutral-500 px-1 font-mono">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-neutral-900 border-t border-white/10 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Ketik pesan ke ${friend.name}...`}
            className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-red-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shadow"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
