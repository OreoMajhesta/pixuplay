import React, { useState, useEffect } from 'react';
import { X, Send, Radio, Check, Users } from 'lucide-react';
import { FriendProfile } from '../../types';
import { fetchFriends, sendDirectMessageApi } from '../../services/friendService';

interface ShareNobarToFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  animeTitle: string;
  episode: number;
}

export const ShareNobarToFriendsModal: React.FC<ShareNobarToFriendsModalProps> = ({
  isOpen,
  onClose,
  roomId,
  animeTitle,
  episode,
}) => {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchFriends().then((res) => {
      if (res?.friends) setFriends(res.friends);
      setLoading(false);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendInvite = async (friend: FriendProfile) => {
    if (sendingId || sentMap[friend.id]) return;
    setSendingId(friend.id);

    const res = await sendDirectMessageApi({
      receiverId: friend.id,
      message: `Yuk nonton bareng ${animeTitle} Episode ${episode}!`,
      msgType: 'nobar_invite',
      nobarRoomId: roomId,
      nobarAnimeTitle: animeTitle,
      nobarEpisode: episode,
    });

    if (res.status) {
      setSentMap((prev) => ({ ...prev, [friend.id]: true }));
    }
    setSendingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[500px]">
        {/* Header */}
        <div className="px-4 py-3 bg-neutral-900 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <h3 className="text-sm font-bold text-white">Undang Teman ke Nobar</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Anime room info */}
        <div className="p-3 bg-neutral-900/60 border-b border-white/5 text-xs text-neutral-300 flex items-center justify-between">
          <span className="font-bold text-white truncate max-w-[240px]">{animeTitle}</span>
          <span className="px-2 py-0.5 rounded-md bg-red-600/20 text-red-400 font-bold font-mono">
            Ep {episode}
          </span>
        </div>

        {/* Friend list */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2.5 no-scrollbar">
          {loading ? (
            <div className="py-8 text-center text-xs text-neutral-500">Memuat teman...</div>
          ) : friends.length === 0 ? (
            <div className="py-8 text-center space-y-2 text-neutral-400">
              <Users className="w-8 h-8 opacity-40 mx-auto" />
              <p className="text-xs">Belum ada teman terhubung</p>
              <p className="text-[11px] text-neutral-500">
                Tambah teman terlebih dahulu di menu Teman & Relasi menggunakan Tag ID.
              </p>
            </div>
          ) : (
            friends.map((f) => {
              const isSent = !!sentMap[f.id];
              const isSending = sendingId === f.id;

              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2.5 bg-neutral-800/60 hover:bg-neutral-800 rounded-xl border border-white/5 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-700 flex-shrink-0">
                      {f.avatar ? (
                        <img src={f.avatar} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                          {f.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{f.name}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-black/50 text-neutral-400 rounded">
                          #{f.tagId}
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-400 font-bold">Level {f.level}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSendInvite(f)}
                    disabled={isSent || isSending}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow ${
                      isSent
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {isSent ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Terkirim</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3" />
                        <span>{isSending ? 'Mengirim...' : 'Kirim'}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
