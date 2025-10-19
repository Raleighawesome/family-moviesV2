'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RemoveWatchButtonProps {
  watchId: number;
  tmdbId: number;
  movieTitle: string;
  watchDate: string;
  isOnlyWatch: boolean; // If true, will also remove rating
}

export function RemoveWatchButton({
  watchId,
  tmdbId,
  movieTitle,
  watchDate,
  isOnlyWatch,
}: RemoveWatchButtonProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const handleRemove = async () => {
    setIsRemoving(true);

    try {
      const response = await fetch(
        `/api/watch/remove?watchId=${watchId}&tmdbId=${tmdbId}&removeRating=${isOnlyWatch}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove watch');
      }

      // Refresh the page to show updated list
      router.refresh();
    } catch (error) {
      console.error('Error removing watch:', error);
      alert('Failed to remove watch. Please try again.');
      setIsRemoving(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600">Remove this watch?</span>
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {isRemoving ? 'Removing...' : 'Yes'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isRemoving}
          className="text-xs px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="text-xs text-red-600 hover:text-red-800 hover:underline"
      title={`Remove watch from ${watchDate}`}
    >
      Remove
    </button>
  );
}
