import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="flex flex-col bg-slate-900/60 rounded-2xl border border-slate-800/60 overflow-hidden animate-pulse">
      {/* Video Thumbnail Placeholder */}
      <div className="aspect-video w-full bg-slate-800/80" />

      {/* Text Lines */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          <div className="h-4 bg-slate-800 rounded-md w-11/12" />
          <div className="h-4 bg-slate-800 rounded-md w-3/4" />
          <div className="h-3 bg-slate-800/60 rounded-md w-1/2 pt-1" />
        </div>

        <div className="pt-3 mt-4 border-t border-slate-800/60 flex items-center justify-between">
          <div className="h-7 bg-slate-800 rounded-lg w-24" />
          <div className="h-7 w-7 bg-slate-800 rounded-lg" />
        </div>
      </div>
    </div>
  );
};
