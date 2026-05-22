import type { UnsqitchAPI } from '../../electron/preload';

declare global {
  interface Window {
    unsqitch: UnsqitchAPI;
  }
}
