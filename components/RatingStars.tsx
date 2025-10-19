'use client';

import { useState } from 'react';

interface RatingStarsProps {
  rating: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  maxStars?: number;
}

/**
 * RatingStars - Interactive or read-only star rating component
 *
 * Displays 1-5 or 1-10 stars, optionally interactive with keyboard support
 */
export function RatingStars({
  rating,
  onChange,
  readonly = false,
  size = 'md',
  maxStars = 5,
}: RatingStarsProps) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  const isInteractive = !readonly && onChange;
  const displayRating = hoveredRating ?? rating;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const handleClick = (newRating: number) => {
    if (isInteractive && onChange) {
      onChange(newRating);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, starIndex: number) => {
    if (!isInteractive) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(starIndex);
    } else if (e.key === 'ArrowRight' && starIndex < maxStars) {
      e.preventDefault();
      const nextStar = document.querySelector(
        `[data-star="${starIndex + 1}"]`
      ) as HTMLElement;
      nextStar?.focus();
    } else if (e.key === 'ArrowLeft' && starIndex > 1) {
      e.preventDefault();
      const prevStar = document.querySelector(
        `[data-star="${starIndex - 1}"]`
      ) as HTMLElement;
      prevStar?.focus();
    }
  };

  return (
    <div
      className="flex items-center gap-1"
      role={isInteractive ? 'radiogroup' : 'img'}
      aria-label={`Rating: ${rating} out of ${maxStars} stars`}
    >
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((starIndex) => {
        const isFilled = displayRating >= starIndex;

        return (
          <div
            key={starIndex}
            data-star={starIndex}
            role={isInteractive ? 'radio' : undefined}
            aria-checked={isInteractive ? rating === starIndex : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            className={`
              ${sizeClasses[size]}
              ${isInteractive ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded' : ''}
              transition-colors
            `}
            onClick={() => handleClick(starIndex)}
            onMouseEnter={() => isInteractive && setHoveredRating(starIndex)}
            onMouseLeave={() => isInteractive && setHoveredRating(null)}
            onKeyDown={(e) => handleKeyDown(e, starIndex)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={isFilled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              className={isFilled ? 'text-yellow-400' : 'text-gray-300'}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
