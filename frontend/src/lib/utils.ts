import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges the class names.
 * @category Utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
