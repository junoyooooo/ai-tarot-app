import React from 'react';
import ReactMarkdown from 'react-markdown';
import Mascot from './Mascot';
import { SECTION_STYLES } from '../lib/categories';

/* 글자가 한 자씩 나오는 동안 열린 채로 남는 **굵게** 표시를 임시로 정리 */
export function closeOpenMarkdown(text) {
  let t = text;
  if (/(^|[^*])\*$/.test(t)) t = t.slice(0, -1);
  const count = (t.match(/\*\*/g) || []).length;
  if (count % 2 === 0) return t;
  if (t.endsWith('**')) return t.slice(0, -2);
  return `${t}**`;
}

const md = {
  p: ({ node, ...props }) => <p className="text-[15px] leading-[1.9] text-ink/90 mb-3 last:mb-0 break-keep" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-bold text-ink" {...props} />,
  em: ({ node, ...props }) => <em className="not-italic text-ink" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="my-3 rounded-2xl bg-white/70 px-4 py-3 text-mute [&>p]:mb-0 [&>p]:text-[14px] [&>p]:text-mute"
      {...props}
    />
  ),
  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-3 space-y-1 text-ink/90" {...props} />,
  li: ({ node, ...props }) => <li className="leading-relaxed text-[15px]" {...props} />,
};

const HEADING_RE = /^\s*(?:\S+\s+)?\[([^\]]+)\]\s*(.*)$/;

function parseSections(text) {
  const parts = text.split(/^### /m);
  const intro = parts.shift() || '';
  const sections = parts.map((raw) => {
    const nl = raw.indexOf('\n');
    const head = (nl === -1 ? raw : raw.slice(0, nl)).trim();
    const body = nl === -1 ? '' : raw.slice(nl + 1).trim();
    const m = HEADING_RE.exec(head);
    if (m) return { kind: 'card', tag: m[1], title: m[2], body };
    return { kind: 'note', tag: '오늘의 조언', title: head.replace(/^\S+\s+/, '') || head, body };
  });
  return { intro: intro.trim(), sections };
}

export default function ReadingView({ reading, isComplete, cards = [], footer = null }) {
  const { intro, sections } = parseSections(reading);
  const lastIdx = sections.length - 1;

  return (
    <div className="space-y-3">
      {intro && (
        <div className="px-1 pb-1">
          <ReactMarkdown components={md}>{sections.length === 0 && !isComplete ? closeOpenMarkdown(intro) : intro}</ReactMarkdown>
        </div>
      )}

      {sections.map((s, i) => {
        const style = SECTION_STYLES[Math.min(i, SECTION_STYLES.length - 1)];
        const card = s.kind === 'card' ? cards[i] : null;
        const body = !isComplete && i === lastIdx ? closeOpenMarkdown(s.body) : s.body;
        return (
          <section key={i} className={`relative rounded-[28px] ${style.bg} p-5 pr-5 animate-fade-in-up overflow-hidden`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`inline-block text-[12px] font-extrabold ${style.accent} bg-white/75 rounded-full px-3 py-1`}>
                  {s.tag}
                </span>
                <h3 className="mt-2.5 text-[17px] font-extrabold leading-snug text-ink break-keep">{s.title}</h3>
              </div>
              {card && <Mascot id={card.id} className="w-16 h-16 shrink-0 -mt-1" />}
            </div>
            <div className="mt-3">
              {body ? <ReactMarkdown components={md}>{body}</ReactMarkdown> : <p className="text-sm text-mute">…</p>}
            </div>
          </section>
        );
      })}

      {footer}

      {sections.length === 0 && !intro && <div className="py-12 text-center text-mute text-sm">답변을 준비하고 있어요…</div>}
    </div>
  );
}
