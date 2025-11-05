"use client";

import React from 'react';
import { useDrag, useDrop } from 'react-dnd';

const ItemTypes = {
  SONG: 'song',
};

export const DraggableSong = ({ song, index, moveSong, children }) => {
  const ref = React.useRef(null);

  const [, drop] = useDrop({
    accept: ItemTypes.SONG,
    hover(item, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) {
        return;
      }
      moveSong(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.SONG,
    item: { type: ItemTypes.SONG, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }}>
      {children}
    </div>
  );
};
