"use client";

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { useEffect, useState } from 'react';

// This component ensures that the DndProvider and its backend are only rendered on the client side.
export default function DndProviderWrapper({ children }) {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const onTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouch(onTouch);
  }, []);

  // Use TouchBackend for touch devices, and HTML5Backend for others.
  const backend = isTouch ? TouchBackend : HTML5Backend;

  return <DndProvider backend={backend}>{children}</DndProvider>;
}
