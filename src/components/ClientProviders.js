"use client";

import dynamic from 'next/dynamic';

const DndProviderWrapper = dynamic(() => import('@/components/DndProviderWrapper'), { ssr: false });

export default function ClientProviders({ children }) {
  return (
    <DndProviderWrapper>
      {children}
    </DndProviderWrapper>
  );
}
