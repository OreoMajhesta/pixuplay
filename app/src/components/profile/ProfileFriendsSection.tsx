import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Check, X, Search, Shield, Trash2, Clock, Sparkles, MessageCircle } from 'lucide-react';
import { FriendListData, FriendProfile, UserProfile } from '../../types';
import {
  fetchFriends,
  searchUsers,
  sendFriendRequestApi,
  respondFriendRequestApi,
  removeFriendApi,
} from '../../services/friendService';

interface ProfileFriendsSectionProps {
  currentUser: UserProfile;
  onOpenChatWithFriend?: (friend: FriendProfile) => void;
}

export const ProfileFriendsSection: React.FC<ProfileFriendsSectionProps> = ({
  currentUser,
  onOpenChatWithFriend,
}) => {
  const [data, setData] = useState<FriendListData>({
    friends: [],
    pendingReceived: [],
    pendingSent: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const loadFriends = async () => {
    setLoading(true);
    const res = await fetchFriends();
    if (res) setData(res);
    setLoading(false);
  };

  useEffect(() => {
    loadFriends();
  }, [currentUser.id]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchUsers(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSendRequest = async (target: FriendProfile) => {
    const res = await sendFriendRequestApi(target.tagId);
    setActionMsg({ text: res.message, error: !res.status });
    setTimeout(() => setActionMsg(null), 4000);
    if (res.status) {
      loadFriends();
      setSearchResults((prev) => prev.filter((u) => u.id !== target.id));
    }
  };

  const handleRespond = async (requestId: number, action: 'accept' | 'reject') => {
    const res = await respondFriendRequestApi(requestId, action);
    setActionMsg({ text: res.message, error: !res.status });
    setTimeout(() => setActionMsg(null), 3000);
    if (res.status) loadFriends();
  };

  const handleRemoveFriend = async (friend: FriendProfile) => {
    if (!confirm(`Hapus ${friend.name} dari daftar teman?`)) return;
    const res = await removeFriendApi(friend.id);
    setActionMsg({ text: res.message, error: !res.status });
    setTimeout(() => setActionMsg(null), 3000);
    if (res.status) loadFriends();
  };

  return (
    <div className="bg-card border border-white/5 rounded-2xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>Teman & Relasi</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                {data.friends.length}
              </span>
            </h2>
            <p className="text-xs text-muted">
              Tambah teman dengan Tag ID (misal: #{currentUser.tagId || 1}) untuk nobar bersama
            </p>
          </div>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-bold transition-all ${
            actionMsg.error
              ? 'bg-red-500/10 border border-red-500/30 text-red-300'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      {/* Search & Add Friend Form */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 text-red-400" />
          <span>Cari & Tambah Teman</span>
        </h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik Tag ID (#12) atau Nama Pengguna..."
              className="w-full pl-9 pr-4 py-2.5 bg-neutral-900 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-red-500 transition-colors"
            />
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
          >
            {isSearching ? 'Mencari...' : 'Cari'}
          </button>
        </form>

        {/* Search Results Display */}
        {searchResults.length > 0 && (
          <div className="bg-neutral-900/80 border border-white/10 rounded-xl p-3 space-y-2">
            <div className="text-[11px] font-bold text-neutral-400 px-1">Hasil Pencarian:</div>
            <div className="space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2.5 bg-neutral-800/60 rounded-lg border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-700 flex-shrink-0">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs text-white">
                          {user.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{user.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-black/60 rounded text-neutral-400">
                          #{user.tagId}
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-400 font-bold">Level {user.level}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendRequest(user)}
                    className="px-3 py-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pending Requests Received */}
      {data.pendingReceived.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Permintaan Pertemanan Masuk ({data.pendingReceived.length})</span>
          </h3>
          <div className="space-y-2">
            {data.pendingReceived.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                    {item.friend.avatar ? (
                      <img src={item.friend.avatar} alt={item.friend.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-xs text-white">
                        {item.friend.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{item.friend.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-black/60 rounded text-neutral-400">
                        #{item.friend.tagId}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted">Level {item.friend.level}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRespond(item.id, 'accept')}
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                    title="Terima Pertemanan"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRespond(item.id, 'reject')}
                    className="p-2 bg-neutral-800 hover:bg-red-600/80 text-neutral-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Tolak"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-white" />
          <span>Daftar Teman ({data.friends.length})</span>
        </h3>

        {loading ? (
          <div className="py-6 text-center text-xs text-neutral-500">Memuat teman...</div>
        ) : data.friends.length === 0 ? (
          <div className="py-8 text-center bg-neutral-900/40 border border-white/5 rounded-xl space-y-2">
            <Users className="w-8 h-8 text-neutral-600 mx-auto" />
            <p className="text-xs text-neutral-400 font-medium">Belum memiliki teman</p>
            <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
              Bagikan Tag ID #{currentUser.tagId || 1} Anda ke teman untuk mulai menonton bersama!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between p-3 bg-neutral-900 border border-white/5 hover:border-white/15 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                    {friend.avatar ? (
                      <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-xs text-white">
                        {friend.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-neutral-900" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{friend.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-black/60 rounded text-neutral-400 flex-shrink-0">
                        #{friend.tagId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                      <span className="text-amber-400 font-bold">Lv. {friend.level}</span>
                      <span>•</span>
                      <span>Online</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {onOpenChatWithFriend && (
                    <button
                      onClick={() => onOpenChatWithFriend(friend)}
                      className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="Chat dengan Teman"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-red-400" />
                      <span>Chat</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleRemoveFriend(friend)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                    title="Hapus Teman"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
