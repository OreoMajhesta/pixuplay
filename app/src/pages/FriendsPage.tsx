import React, { useState } from 'react';
import { UserProfile, FriendProfile } from '../types';
import { ProfileFriendsSection } from '../components/profile/ProfileFriendsSection';
import { FriendChatModal } from '../components/chat/FriendChatModal';
import { Users, ArrowLeft } from 'lucide-react';

interface FriendsPageProps {
  currentUser: UserProfile | null;
  onNavigateTab: (tab: string) => void;
  onOpenLogin: () => void;
  onJoinNobarRoom?: (roomId: string) => void;
  activeNobarRoomId?: string | null;
  activeNobarAnimeTitle?: string;
  activeNobarEpisode?: number;
}

export const FriendsPage: React.FC<FriendsPageProps> = ({
  currentUser,
  onNavigateTab,
  onOpenLogin,
  onJoinNobarRoom,
  activeNobarRoomId,
  activeNobarAnimeTitle,
  activeNobarEpisode,
}) => {
  const [activeChatFriend, setActiveChatFriend] = useState<FriendProfile | null>(null);

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-5 animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto shadow-lg">
          <Users className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Masuk untuk Mengakses Teman
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto">
            Fitur pertemanan memungkinkan Anda mencari teman via Tag ID (#ID), mengirim permintaan, dan nobar bersama.
          </p>
        </div>
        <button
          onClick={onOpenLogin}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
        >
          Masuk dengan Akun Google
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Top Navigation Back */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <button
          onClick={() => onNavigateTab('profil')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Pengaturan Profil</span>
        </button>
        <span className="text-xs font-mono font-bold text-neutral-400">
          Tag Anda: #{currentUser.tagId || 1}
        </span>
      </div>

      {/* Main Friends Management Section */}
      <ProfileFriendsSection
        currentUser={currentUser}
        onOpenChatWithFriend={(friend) => setActiveChatFriend(friend)}
      />

      {/* Direct Chat / Nobar Invite Modal */}
      <FriendChatModal
        isOpen={!!activeChatFriend}
        onClose={() => setActiveChatFriend(null)}
        currentUser={currentUser}
        friend={activeChatFriend}
        onJoinNobarRoom={onJoinNobarRoom}
        activeNobarRoomId={activeNobarRoomId}
        activeNobarAnimeTitle={activeNobarAnimeTitle}
        activeNobarEpisode={activeNobarEpisode}
      />
    </div>
  );
};
