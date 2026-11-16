'use client';
import { useEffect } from 'react';
import { trackVisit } from '@/lib/activity-actions';

/** Opening the page marks the corresponding daily mission as completed. */
export function PageVisitTracker({ kind }: { kind: Parameters<typeof trackVisit>[0] }) {
  useEffect(() => {
    void trackVisit(kind);
  }, [kind]);
  return null;
}

