import { useEffect, useState } from 'react';
import { api } from './api.js';

// Settings the admin can change (Admin > Settings). Loaded once per page.
export const DEFAULT_BOOKING_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScu0Rj-afE8XjFxZjLldXBF4JNQ0GywJl329n9rbpgaVySreg/viewform';

let pending = null;
export function loadSite() {
  pending ||= api('/api/site').catch(() => ({}));
  return pending;
}

export function useSite() {
  const [site, setSite] = useState({ bookingUrl: DEFAULT_BOOKING_URL });
  useEffect(() => {
    let live = true;
    loadSite().then((s) => live && setSite((old) => ({ ...old, ...s, bookingUrl: s.bookingUrl || old.bookingUrl })));
    return () => {
      live = false;
    };
  }, []);
  return site;
}
