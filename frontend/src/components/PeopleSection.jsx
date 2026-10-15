import React, { useState } from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import { MAX_PEOPLE, getActiveId, getExtraPeople, setActive, addPerson, removePerson, seedPersonProfile } from '../lib/people';
import { validateBirthdate } from '../lib/storage';
import { track } from '../lib/analytics';

function lookOf(id) {
  try {
    const v = JSON.parse(window.localStorage.getItem(id === 'me' ? 'tarot.v1.look' : `tarot.v1.p_${id}.look`) || '{}');
    return { main: Number.isInteger(v.main) ? v.main : 0, equipped: v.equipped || {} };
  } catch {
    return { main: 0, equipped: {} };
  }
}

/** 내 정보 안의 "누구의 타로를 볼까요?" — 가족·친구 프로필(기기 안에만 저장) */
function myNameStored() {
  try {
    return JSON.parse(window.localStorage.getItem('tarot.v1.profile') || '{}').name || '나';
  } catch {
    return '나';
  }
}

export default function PeopleSection() {
  const active = getActiveId();
  const people = [{ id: 'me', name: `${myNameStored()}` }, ...getExtraPeople()];
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', birthdate: '' });
  const [error, setError] = useState('');
  const [del, setDel] = useState(null);

  const pick = (id) => {
    if (id === active) return;
    setActive(id);
    window.location.reload(); // 기록·도감·오늘의 카드가 그 사람 것으로 바뀌어요
  };

  const add = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('이름이나 별명을 입력해 주세요.');
    const be = validateBirthdate(form.birthdate);
    if (be) return setError(be);
    const id = addPerson(form);
    if (!id) return setError(`사람은 최대 ${MAX_PEOPLE}명까지 추가할 수 있어요.`);
    seedPersonProfile(id, form);
    track('person_add');
    setActive(id);
    window.location.reload();
  };

  return (
    <section className="mt-6" aria-label="사람 선택">
      <h2 className="text-[19px] font-extrabold text-ink">누구의 타로를 볼까요?</h2>
      <p className="mt-1 text-[12.5px] text-mute break-keep">가족·친구를 추가하면 그 사람의 기록과 카드가 따로 쌓여요. 코인과 별가루는 함께 써요.</p>
      <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {people.map((p) => {
          const lk = lookOf(p.id);
          const on = p.id === active;
          return (
            <li key={p.id} className="shrink-0 w-[84px] text-center">
              <button
                type="button"
                onClick={() => pick(p.id)}
                aria-pressed={on}
                className={`relative w-[72px] h-[72px] mx-auto rounded-full bg-white flex items-end justify-center pb-2 cursor-pointer ${on ? 'ring-2 ring-brand-500' : 'ring-1 ring-line'}`}
              >
                <Avatar id={lk.main} outfit={lk.equipped} className="h-[52px]" />
                {on && (
                  <span className="absolute -right-0.5 -top-0.5 w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" aria-hidden="true" />
                  </span>
                )}
              </button>
              <p className="mt-1.5 text-[12.5px] font-bold text-ink truncate">{p.name}</p>
              {p.id !== 'me' &&
                (del === p.id ? (
                  <button type="button" onClick={() => { removePerson(p.id); window.location.reload(); }} className="mt-0.5 text-[11px] font-bold text-[#c0392b] cursor-pointer">
                    기록도 삭제
                  </button>
                ) : (
                  <button type="button" onClick={() => setDel(p.id)} aria-label={`${p.name} 삭제`} className="mt-0.5 text-mute cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5 inline" aria-hidden="true" />
                  </button>
                ))}
            </li>
          );
        })}
        {people.length < MAX_PEOPLE && (
          <li className="shrink-0 w-[84px] text-center">
            <button type="button" onClick={() => setAdding(true)} className="w-[72px] h-[72px] mx-auto rounded-full bg-brand-50 text-brand-700 flex items-center justify-center cursor-pointer" aria-label="사람 추가">
              <Plus className="w-6 h-6" aria-hidden="true" />
            </button>
            <p className="mt-1.5 text-[12.5px] font-bold text-brand-700">추가</p>
          </li>
        )}
      </ul>
      {adding && (
        <form onSubmit={add} className="mt-2 rounded-2xl bg-brand-50 p-4 space-y-2.5">
          <input value={form.name} maxLength={12} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="이름 또는 별명 (예: 엄마)" className="w-full rounded-xl border border-line px-3 py-2.5 text-[15px]" />
          <input value={form.birthdate} inputMode="numeric" maxLength={8} onChange={(e) => setForm({ ...form, birthdate: e.target.value.replace(/\D/g, '') })} placeholder="생년월일 8자리 (예: 19980521)" className="w-full rounded-xl border border-line px-3 py-2.5 text-[15px]" />
          {error && <p className="text-[12.5px] text-[#c0392b]">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAdding(false); setError(''); }} className="btn-soft flex-1 py-2.5 rounded-xl text-[14px] cursor-pointer">취소</button>
            <button type="submit" className="btn-primary flex-1 py-2.5 rounded-xl text-[14px] cursor-pointer">추가하기</button>
          </div>
          <p className="text-[11.5px] text-mute break-keep">입력한 정보는 이 기기 안에만 저장돼요.</p>
        </form>
      )}
    </section>
  );
}
