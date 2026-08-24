'use client';

import { motion } from 'framer-motion';
import { cn, getStatusLabel } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<string, {
  bg: string;
  text: string;
  border: string;
  dot: string;
  pulse: boolean;
}> = {
  PENDING: {
    bg: 'bg-gray-500/15',
    text: 'text-gray-300',
    border: 'border-gray-500/30',
    dot: 'bg-gray-400',
    pulse: true,
  },
  PICKED_UP: {
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-300',
    border: 'border-yellow-500/30',
    dot: 'bg-yellow-400',
    pulse: false,
  },
  IN_TRANSIT: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
    pulse: true,
  },
  OUT_FOR_DELIVERY: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-300',
    border: 'border-orange-500/30',
    dot: 'bg-orange-400',
    pulse: true,
  },
  DELIVERED: {
    bg: 'bg-green-500/15',
    text: 'text-green-300',
    border: 'border-green-500/30',
    dot: 'bg-green-400',
    pulse: false,
  },
  FAILED: {
    bg: 'bg-red-500/15',
    text: 'text-red-300',
    border: 'border-red-500/30',
    dot: 'bg-red-400',
    pulse: false,
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5 gap-1.5',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.PENDING;

  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-medium',
      config.bg,
      config.text,
      config.border,
      sizeClasses[size],
      className
    )}>
      {/* Animated dot */}
      <span className="relative flex-shrink-0">
        <span className={cn('rounded-full inline-block', config.dot, dotSizes[size])} />
        {config.pulse && (
          <motion.span
            className={cn('absolute inset-0 rounded-full opacity-75', config.dot)}
            animate={{ scale: [1, 1.8, 1], opacity: [0.75, 0, 0.75] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </span>

      {/* Status label */}
      {status === 'DELIVERED' ? (
        <span className="flex items-center gap-1">
          {getStatusLabel(status)}
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            ✓
          </motion.span>
        </span>
      ) : (
        getStatusLabel(status)
      )}
    </span>
  );
}
