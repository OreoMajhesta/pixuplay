import React, { useState, useRef } from 'react';
import { Camera, Upload, Check } from 'lucide-react';
import { UserProfile } from '../../types';

export const AVATAR_PRESETS = [
  {
    id: 'anime-1',
    name: 'Shadow Hunter',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=160&auto=format&fit=crop&q=80',
  },
  {
    id: 'anime-2',
    name: 'Cyber Spirit',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=160&auto=format&fit=crop&q=80',
  },
  {
    id: 'anime-3',
    name: 'Neon Katana',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=160&auto=format&fit=crop&q=80',
  },
  {
    id: 'anime-4',
    name: 'Astral Mage',
    url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=160&auto=format&fit=crop&q=80',
  },
  {
    id: 'anime-5',
    name: 'Mecha Pilot',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160&auto=format&fit=crop&q=80',
  },
];

interface ProfileAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  currentAvatar: string;
  onSelectAvatar: (url: string) => void;
  onError: (msg: string) => void;
}

export const ProfileAvatarModal: React.FC<ProfileAvatarModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentAvatar,
  onSelectAvatar,
  onError,
}) => {
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !currentUser) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError('File harus berupa gambar (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onError('Ukuran file maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawUrl = event.target?.result as string;
      if (!rawUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 240;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onSelectAvatar(rawUrl);
          return;
        }
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        const compressed = canvas.toDataURL('image/webp', 0.85);
        onSelectAvatar(compressed);
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    onSelectAvatar(customUrlInput.trim());
    setCustomUrlInput('');
  };

  return (
    <div className="bg-card border border-white/20 rounded-2xl p-5 space-y-4 animate-scale-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Camera className="w-4 h-4" /> Ganti Foto Profil Avatar
        </h3>
        <button
          onClick={onClose}
          className="text-xs text-neutral-400 hover:text-white cursor-pointer"
        >
          Tutup
        </button>
      </div>

      {/* Option 1: File Upload */}
      <div className="p-3.5 bg-neutral-900/80 border border-white/5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="w-9 h-9 rounded-lg bg-surface border border-white/5 flex items-center justify-center flex-shrink-0">
            <Upload className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Unggah Foto Sendiri</div>
            <div className="text-[11px] text-neutral-400">Mendukung format JPG, PNG, atau WebP (Maks 5MB)</div>
          </div>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5" />
          Pilih File
        </button>
      </div>

      {/* Option 2: Presets */}
      <div>
        <div className="text-xs font-semibold text-neutral-300 mb-2">Atau Pilih Avatar Karakter:</div>
        <div className="grid grid-cols-5 gap-3 sm:gap-4">
          {AVATAR_PRESETS.map((preset) => {
            const isSelected = (currentUser.avatar || currentAvatar) === preset.url;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectAvatar(preset.url)}
                className={`relative group aspect-square rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-white ring-4 ring-white/40 scale-105'
                    : 'border-neutral-700 hover:border-white hover:scale-105'
                }`}
                title={preset.name}
              >
                <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                {isSelected && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Option 3: Custom URL */}
      <form onSubmit={handleApplyCustomUrl} className="flex gap-2 pt-2 border-t border-white/5">
        <input
          type="url"
          placeholder="Atau tempel URL gambar custom (https://...)"
          value={customUrlInput}
          onChange={(e) => setCustomUrlInput(e.target.value)}
          className="flex-1 bg-surface border border-white/10 px-3 py-1.5 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white"
        />
        <button
          type="submit"
          className="px-4 py-1.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 cursor-pointer"
        >
          Terapkan
        </button>
      </form>
    </div>
  );
};
