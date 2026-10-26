import React, { useState } from 'react';
import { MessageSquare, Lock, LogIn, Send, Trash2, Reply } from 'lucide-react';
import { CommentItem, UserProfile } from '../../types';
import { ConfirmDeleteModal } from '../ConfirmDeleteModal';
import { getOrCreateUserId } from '../../api';

interface WatchDiscussionProps {
  comments: CommentItem[];
  currentUser: UserProfile | null;
  onOpenLogin?: () => void;
  onSubmitComment: (text: string) => Promise<boolean>;
  onReplyComment: (parentId: number | string, replyToUser: string, text: string) => Promise<boolean>;
  onDeleteComment: (commentId: number | string) => Promise<boolean>;
  mobileActiveTab: string;
}

export const WatchDiscussion: React.FC<WatchDiscussionProps> = ({
  comments,
  currentUser,
  onOpenLogin,
  onSubmitComment,
  onReplyComment,
  onDeleteComment,
  mobileActiveTab,
}) => {
  const [commentText, setCommentText] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<{ id: number | string; user: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    commentId?: number | string;
    itemTitle?: string;
  }>({ isOpen: false });

  const currentUid = currentUser?.id || getOrCreateUserId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const ok = await onSubmitComment(commentText.trim());
    if (ok) {
      setCommentText('');
    }
    setIsSubmitting(false);
  };

  const handleReplySubmit = async (e: React.FormEvent, parentId: number | string, replyToUser: string) => {
    e.preventDefault();
    if (!replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const ok = await onReplyComment(parentId, replyToUser, replyText.trim());
    if (ok) {
      setReplyText('');
      setReplyingTo(null);
    }
    setIsSubmitting(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalState.commentId) return;
    await onDeleteComment(deleteModalState.commentId);
    setDeleteModalState({ isOpen: false });
  };

  return (
    <>
      <div className={`space-y-4 pt-2 ${mobileActiveTab !== 'comments' ? 'hidden lg:block' : ''}`}>
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-white" />
              <h3 className="text-sm font-bold text-white">
                Komentar ({comments.length})
              </h3>
            </div>
            <span className="text-[11px] text-neutral-400">
              {currentUser ? (
                <span className="text-blue-400 font-semibold">{currentUser.name}</span>
              ) : (
                'Mode Tamu'
              )}
            </span>
          </div>

          {/* Input New Comment - Requires Login */}
          {!currentUser ? (
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 border border-neutral-700 flex-shrink-0">
                  <Lock className="w-4 h-4 text-neutral-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Masuk untuk Berkomentar</h4>
                  <p className="text-[11px] text-neutral-400">
                    Masuk dengan akun Google untuk berdiskusi dengan komunitas penonton Pixuplay.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenLogin && onOpenLogin()}
                className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shadow"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-600" />
                <span>Masuk Sekarang</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-700 flex-shrink-0 mt-0.5">
                  <img
                    src={
                      currentUser.avatar ||
                      'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=120&auto=format&fit=crop&q=80'
                    }
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Tulis pendapat atau tanggapanmu tentang episode ini..."
                    rows={2}
                    maxLength={1000}
                    className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 focus:border-white rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none resize-none transition-colors"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-500">
                      {commentText.length}/1000 karakter
                    </span>
                    <button
                      type="submit"
                      disabled={!commentText.trim() || isSubmitting}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/40"
                    >
                      <Send className="w-3 h-3" />
                      <span>Kirim</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Comments List */}
          <div className="space-y-3 pt-2">
            {comments.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-xs">
                Belum ada komentar untuk episode ini. Jadilah yang pertama berkomentar!
              </div>
            ) : (
              comments.map((item) => {
                const isOwn = Boolean(
                  item.userId &&
                    (item.userId === currentUid ||
                      (currentUser?.id && String(item.userId) === String(currentUser.id)))
                );
                const isReplyingThis = replyingTo?.id === item.id;

                return (
                  <div key={item.id} className="p-3 bg-black/60 rounded-xl border border-white/5 space-y-2 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.avatar ? (
                          <img
                            src={item.avatar}
                            alt={item.user}
                            className="w-6 h-6 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-neutral-800 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                            {item.user.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-bold text-white">{item.user}</span>
                        <span className="text-[10px] text-neutral-500">{item.time}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (!currentUser && onOpenLogin) {
                              onOpenLogin();
                              return;
                            }
                            setReplyingTo({ id: item.id, user: item.user });
                            setReplyText('');
                          }}
                          className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Reply className="w-3 h-3" /> Balas
                        </button>

                        {isOwn && (
                          <button
                            onClick={() =>
                              setDeleteModalState({
                                isOpen: true,
                                commentId: item.id,
                                itemTitle: item.text.slice(0, 60) + '...',
                              })
                            }
                            className="text-[11px] text-neutral-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
                            title="Hapus Komentar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-neutral-200 pl-8 leading-relaxed break-words">{item.text}</p>

                    {/* Threaded Replies */}
                    {item.replies && item.replies.length > 0 && (
                      <div className="pl-8 pt-2 space-y-2 border-l border-white/10 ml-3 mt-2">
                        {item.replies.map((reply) => {
                          const isReplyOwn = Boolean(
                            reply.userId &&
                              (reply.userId === currentUid ||
                                (currentUser?.id && String(reply.userId) === String(currentUser.id)))
                          );
                          return (
                            <div key={reply.id} className="p-2.5 bg-neutral-900/60 rounded-lg space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {reply.avatar ? (
                                    <img
                                      src={reply.avatar}
                                      alt={reply.user}
                                      className="w-5 h-5 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-neutral-800 text-white font-bold text-[9px] flex items-center justify-center flex-shrink-0">
                                      {reply.user.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span className="text-[11px] font-bold text-white">{reply.user}</span>
                                  {reply.replyToUser && (
                                    <span className="text-[10px] text-neutral-400">
                                      ke @{reply.replyToUser}
                                    </span>
                                  )}
                                  <span className="text-[9px] text-neutral-500 ml-1">{reply.time}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      if (!currentUser && onOpenLogin) {
                                        onOpenLogin();
                                        return;
                                      }
                                      setReplyingTo({ id: item.id, user: reply.user });
                                      setReplyText('');
                                    }}
                                    className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                                  >
                                    <Reply className="w-2.5 h-2.5" /> Balas
                                  </button>
                                  {isReplyOwn && (
                                    <button
                                      onClick={() =>
                                        setDeleteModalState({
                                          isOpen: true,
                                          commentId: reply.id,
                                          itemTitle: reply.text.slice(0, 60) + '...',
                                        })
                                      }
                                      className="text-[10px] text-neutral-500 hover:text-red-400 p-1 cursor-pointer"
                                      title="Hapus Balasan"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-neutral-200 pl-7 break-words">{reply.text}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Inline Reply Form */}
                    {isReplyingThis && (
                      <form
                        onSubmit={(e) => handleReplySubmit(e, item.id, replyingTo.user)}
                        className="mt-3 pl-8 pt-2 space-y-2 border-l-2 border-neutral-700 animate-fade-in"
                      >
                        <div className="flex items-center justify-between text-xs text-neutral-400">
                          <span>
                            Membalas <span className="text-white font-semibold">@{replyingTo.user}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText('');
                            }}
                            className="text-[11px] text-neutral-500 hover:text-white px-2 py-0.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>

                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full overflow-hidden border border-neutral-700 flex-shrink-0 mt-1">
                            <img
                              src={
                                currentUser?.avatar ||
                                'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=120&auto=format&fit=crop&q=80'
                              }
                              alt={currentUser?.name || 'User'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <textarea
                              autoFocus
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder={`Tulis balasan untuk @${replyingTo.user}...`}
                              rows={2}
                              maxLength={500}
                              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 focus:border-white rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none resize-none transition-colors"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyText('');
                                }}
                                className="px-3 py-1 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="submit"
                                disabled={!replyText.trim() || isSubmitting}
                                className="px-3.5 py-1 bg-white text-black font-bold text-xs rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow"
                              >
                                <Send className="w-3 h-3" />
                                <span>Balas</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        title="Hapus Komentar?"
        message="Apakah kamu yakin ingin menghapus komentar ini secara permanen?"
        itemTitle={deleteModalState.itemTitle}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalState({ isOpen: false })}
      />
    </>
  );
};
