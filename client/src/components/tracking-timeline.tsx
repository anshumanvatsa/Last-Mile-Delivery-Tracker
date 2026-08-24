'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn, getStatusBgColor, getStatusLabel, formatDateTime } from '@/lib/utils';
import {
  Package, Truck, Navigation, Home, CheckCircle2, XCircle, Clock
} from 'lucide-react';

interface TrackingEvent {
  id: string;
  status: string;
  actorRole?: string;
  actor?: { name: string };
  note?: string;
  createdAt: string;
}

interface TrackingTimelineProps {
  events: TrackingEvent[];
  className?: string;
}

const statusIcons: Record<string, React.ElementType> = {
  PENDING: Clock,
  PICKED_UP: Package,
  IN_TRANSIT: Truck,
  OUT_FOR_DELIVERY: Navigation,
  DELIVERED: CheckCircle2,
  FAILED: XCircle,
};

const statusIconColors: Record<string, string> = {
  PENDING: 'text-gray-400 bg-gray-500/20 border-gray-500/40',
  PICKED_UP: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/40',
  IN_TRANSIT: 'text-blue-400 bg-blue-500/20 border-blue-500/40',
  OUT_FOR_DELIVERY: 'text-orange-400 bg-orange-500/20 border-orange-500/40',
  DELIVERED: 'text-green-400 bg-green-500/20 border-green-500/40',
  FAILED: 'text-red-400 bg-red-500/20 border-red-500/40',
};

export function TrackingTimeline({ events, className }: TrackingTimelineProps) {
  return (
    <div className={cn('space-y-0', className)}>
      <AnimatePresence>
        {events.map((event, index) => {
          const Icon = statusIcons[event.status] || Package;
          const iconStyle = statusIconColors[event.status] || statusIconColors.PENDING;
          const isLast = index === events.length - 1;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="relative flex gap-4"
            >
              {/* Connector line */}
              {!isLast && (
                <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-white/10 to-transparent" />
              )}

              {/* Icon */}
              <div className={cn(
                'relative z-10 flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center mt-0.5',
                iconStyle
              )}>
                <Icon size={16} />
              </div>

              {/* Content */}
              <div className="flex-1 pb-8">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                      getStatusBgColor(event.status)
                    )}>
                      {getStatusLabel(event.status)}
                    </span>
                    {event.actor && (
                      <p className="mt-1 text-sm text-white/60">
                        {event.actor.name}
                        {event.actorRole && (
                          <span className="ml-1 text-white/40">· {event.actorRole}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <time className="text-xs text-white/40 whitespace-nowrap">
                    {formatDateTime(event.createdAt)}
                  </time>
                </div>
                {event.note && (
                  <p className="mt-2 text-sm text-white/70 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                    {event.note}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
