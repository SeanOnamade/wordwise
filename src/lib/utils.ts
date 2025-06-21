import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isMacOS(): boolean {
  if (typeof window === 'undefined') return false;
  return window.navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}
