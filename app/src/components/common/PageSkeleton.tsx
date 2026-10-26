import React from 'react';

export const PageSkeleton: React.FC = () => {
  return (
    <div className="w-full min-h-[70vh] px-4 md:px-8 py-8 animate-pulse space-y-8 max-w-7xl mx-auto">
      {/* Banner / Header Skeleton */}
      <div className="w-full h-64 md:h-96 bg-white/[0.03] border border-white/5 rounded-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      </div>

      {/* Row of content skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-48 bg-white/10 rounded-full" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] bg-white/[0.03] border border-white/5 rounded-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
