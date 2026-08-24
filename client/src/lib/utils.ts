import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'text-gray-400',
    PICKED_UP: 'text-yellow-400',
    IN_TRANSIT: 'text-blue-400',
    OUT_FOR_DELIVERY: 'text-orange-400',
    DELIVERED: 'text-green-400',
    FAILED: 'text-red-400',
  };
  return colors[status] || 'text-gray-400';
}

export function getStatusBgColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    PICKED_UP: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    IN_TRANSIT: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    OUT_FOR_DELIVERY: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    DELIVERED: 'bg-green-500/20 text-green-300 border-green-500/30',
    FAILED: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return colors[status] || 'bg-gray-500/20 text-gray-300';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    PICKED_UP: 'Picked Up',
    IN_TRANSIT: 'In Transit',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    DELIVERED: 'Delivered',
    FAILED: 'Failed',
  };
  return labels[status] || status;
}

export function getNextStatuses(currentStatus: string): string[] {
  const transitions: Record<string, string[]> = {
    PENDING: ['PICKED_UP'],
    PICKED_UP: ['IN_TRANSIT'],
    IN_TRANSIT: ['OUT_FOR_DELIVERY'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
    DELIVERED: [],
    FAILED: [],
  };
  return transitions[currentStatus] || [];
}
