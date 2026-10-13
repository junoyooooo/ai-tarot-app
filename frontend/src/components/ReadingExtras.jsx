import React from 'react';
import AdviceCard from './AdviceCard';
import FollowUp from './FollowUp';

/** 풀이가 다 열린 뒤에 보이는 추가 기능(조언 카드, 더 물어보기). 서버에 저장된 리딩에서만 동작한다. */
export default function ReadingExtras({ readingId, advice, followups, onAdvice, onFollowups }) {
  if (!readingId) return null;
  return (
    <div className="mt-4 space-y-3">
      <AdviceCard readingId={readingId} advice={advice} onDone={onAdvice} />
      <FollowUp readingId={readingId} items={followups || []} onChange={onFollowups} />
    </div>
  );
}
