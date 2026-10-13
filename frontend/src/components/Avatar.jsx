import React, { useId } from 'react';
import { mascotSrc } from '../lib/categories';
import { ANCHORS } from '../lib/mascotAnchors';
import { ITEM_ART } from '../lib/items';

/**
 * 마스코트 + 착용한 아이템. 한 장의 SVG 라서 크기를 바꾸거나 이미지로 저장해도 위치가 그대로예요.
 * outfit: { hat, glasses, clothes, shoes } (아이템 id)
 */
export default function Avatar({ id = 0, outfit, className = '', bounce = false, style }) {
  const a = ANCHORS[id] || ANCHORS[0];
  const uid = useId().replace(/:/g, '');
  const o = outfit || {};
  const hat = !a.noHat && o.hat && ITEM_ART[o.hat];
  const glasses = !a.noGlasses && o.glasses && ITEM_ART[o.glasses];
  const clothes = o.clothes && ITEM_ART[o.clothes];
  const shoes = !a.noShoes && o.shoes && ITEM_ART[o.shoes];
  const [ex, ey, es] = a.eyes;
  const [hx, hy, hw] = a.hat;
  const [nx, ny, nw] = a.neck;
  const [lx, rx, fy, fw] = a.feet;
  const bodyH = Math.max(40, fy - ny);

  return (
    <svg
      viewBox={`0 0 ${a.w} ${a.h}`}
      className={`select-none pointer-events-none ${bounce ? 'mascot-bounce' : ''} ${className}`}
      style={{ aspectRatio: `${a.w} / ${a.h}`, overflow: 'visible', ...style }}
      aria-hidden="true"
    >
      <defs>
        {/* 크레용으로 그린 듯 살짝 흔들리는 선 */}
        <filter id={`wob${uid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" />
        </filter>
      </defs>
      {clothes?.back && (
        <g filter={`url(#wob${uid})`} transform={`translate(${nx} ${ny}) scale(${nw / 100})`}>
          {clothes.back({ h: (bodyH / (nw / 100)) })}
        </g>
      )}
      <image href={mascotSrc(id)} x="0" y="0" width={a.w} height={a.h} />
      {shoes &&
        [lx, rx].map((x, i) => (
          <g key={i} filter={`url(#wob${uid})`} transform={`translate(${x} ${fy}) scale(${fw / 100})`}>
            {shoes.front()}
          </g>
        ))}
      {clothes?.front && (
        <g filter={`url(#wob${uid})`} transform={`translate(${nx} ${ny}) scale(${nw / 100})`}>
          {clothes.front()}
        </g>
      )}
      {glasses && (
        <g filter={`url(#wob${uid})`} transform={`translate(${ex} ${ey}) scale(${es / 60})`}>
          {glasses.front()}
        </g>
      )}
      {hat && (
        <g filter={`url(#wob${uid})`} transform={`translate(${hx} ${hy}) scale(${hw / 100})`}>
          {hat.front()}
        </g>
      )}
    </svg>
  );
}
