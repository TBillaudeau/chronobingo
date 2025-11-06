"use client";
import React from "react";

import dynamic from 'next/dynamic';

const DndProviderWrapper = dynamic(() => import('@/components/DndProviderWrapper'), { ssr: false });

export default function ClientProviders({ children, lang }) {
  // Injecte la prop lang dans le seul enfant (la page)
    const childWithLang = React.Children.map(children, child =>
      React.isValidElement(child) ? React.cloneElement(child, { lang }) : child
    );
  return (
    <DndProviderWrapper>
      {childWithLang}
    </DndProviderWrapper>
  );
}
