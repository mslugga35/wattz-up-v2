/**
 * App group layout
 * Wraps all app routes with providers
 */

import { Toaster } from '@/components/ui/sonner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
