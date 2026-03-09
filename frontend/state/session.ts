let guestSession = false;

const listeners = new Set<() => void>();

export const isGuestSession = () => guestSession;

export const setGuestSession = (value: boolean) => {
  guestSession = value;
  listeners.forEach((listener) => listener());
};

export const subscribeGuestSession = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
