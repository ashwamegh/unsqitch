export function useIpc() {
  const api = window.unsqitch;

  if (!api) {
    throw new Error("Unsqitch API not available — preload script may not have loaded");
  }

  return api;
}
