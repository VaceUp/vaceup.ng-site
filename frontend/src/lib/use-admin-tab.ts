'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { resolveAdminTab } from './admin-sections';

export function useAdminTab() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [hash, setHash] = useState('');
  useEffect(() => {
    const update = () => setHash(window.location.hash.slice(1));
    update();
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, [query]);
  return resolveAdminTab(searchParams.get('tab') ?? hash);
}
