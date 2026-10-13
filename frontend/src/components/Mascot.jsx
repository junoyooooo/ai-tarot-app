import React from 'react';
import { mascotSrc } from '../lib/categories';

export default function Mascot({ id = 0, className = '', style, bounce = false }) {
  return (
    <img
      src={mascotSrc(id)}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={style}
      className={`select-none pointer-events-none object-contain ${bounce ? 'mascot-bounce' : ''} ${className}`}
    />
  );
}
