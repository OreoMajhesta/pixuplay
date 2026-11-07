export interface AnimeTitle {
  english: string;
  romaji?: string;
  userPreferred?: string;
  native?: string;
}

export interface AnimeCover {
  extraLarge: string;
  large?: string;
  medium?: string;
}

export interface EpisodeItem {
  title: string | number;
  episodeId: string;
  url?: string;
}

export interface Anime {
  id: string | number;
  animeId?: string;
  title: AnimeTitle;
  coverImage: AnimeCover;
  bannerImage?: string;
  description?: string;
  episodes?: number | string;
  averageScore?: number;
  genres?: string[];
  status?: string;
  countryOfOrigin?: string;
  latestReleaseDate?: string;
  releaseDay?: string;
  episodeList?: EpisodeItem[];
}

export interface StreamQuality {
  quality: string;
  label: string;
  url: string;
}

export interface StreamServer {
  name: string;
  label: string;
  region?: string;
  quality?: string;
  maxQuality?: string;
  maxQualityLabel?: string;
  type: 'direct' | 'embed' | 'external';
  url: string;
  qualities?: StreamQuality[];
}

export interface StreamData {
  title: string;
  episode: number;
  servers: StreamServer[];
}

export interface HistoryItem {
  id: string | number;
  animeId?: string;
  title: string | AnimeTitle;
  poster: string;
  ep: number;
  watchedAt: string;
  genres?: string[];
  status?: string;
  currentTime?: number;
  duration?: number;
  progressPercent?: number;
  totalEpisodes?: number | string;
  description?: string;
}

export interface SavedItem {
  id: string | number;
  animeId?: string;
  title: string | AnimeTitle;
  poster: string;
  episodes?: number | string;
  score?: number;
  genres?: string[];
  description?: string;
}

export interface ScheduleItem {
  title: string;
  animeId: string;
  otakudesuUrl?: string;
  poster?: string;
}

export interface ScheduleDay {
  title: string;
  animeList: ScheduleItem[];
}

export interface CommentItem {
  id?: number | string;
  userId?: string;
  parentId?: number | null;
  replyToUser?: string | null;
  user: string;
  avatar?: string;
  text: string;
  time: string;
  createdAt?: string;
  replies?: CommentItem[];
}

export interface EpisodeInteractions {
  likesCount: number;
  hasLiked: boolean;
  comments: CommentItem[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  tagId?: number;
  watchTimeSeconds?: number;
  exp?: number;
  level?: number;
  levelTitle?: string;
}

export interface FriendProfile {
  id: string;
  name: string;
  avatar: string;
  tagId: number;
  level: number;
  exp: number;
  watchTimeSeconds?: number;
  unreadCount?: number;
}

export interface FriendItem {
  id: number;
  friend: FriendProfile;
  status: 'pending' | 'accepted' | 'rejected';
  isSender: boolean;
  createdAt: string;
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
  isNobarActive?: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface FriendListData {
  friends: FriendProfile[];
  pendingReceived: FriendItem[];
  pendingSent: FriendItem[];
}
