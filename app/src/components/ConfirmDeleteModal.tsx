import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  itemTitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = 'Konfirmasi Hapus',
  message = 'Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.',
  itemTitle,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  isDestructive = true,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm bg-card border border-subtle hover:border-neutral-700 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 animate-scale-in text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
            {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="min-w-0 pr-6">
            <h3 className="text-sm sm:text-base font-bold text-white truncate">{title}</h3>
            <p className="text-[11px] text-neutral-400">Tindakan permanen</p>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-1.5 text-xs text-neutral-300 leading-relaxed">
          <p>{message}</p>
          {itemTitle && (
            <div className="p-2.5 bg-neutral-900 border border-subtle rounded-lg text-[11px] text-neutral-200 font-medium truncate">
              "{itemTitle}"
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-subtle font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-lg shadow-red-950/40 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
