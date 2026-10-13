import React from 'react';
import { Home, Sparkles, CalendarDays, User } from 'lucide-react';

const TABS = [
  { key: 'home', label: '홈', Icon: Home },
  { key: 'consult', label: '상담', Icon: Sparkles },
  { key: 'history', label: '기록', Icon: CalendarDays },
  { key: 'profile', label: '내 정보', Icon: User },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      <ul className="grid grid-cols-4 px-2 pt-2 pb-2.5">
        {TABS.map(({ key, label, Icon }) => {
          const on = active === key;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onChange(key)}
                aria-current={on ? 'page' : undefined}
                className="w-full flex flex-col items-center gap-1 py-1.5 cursor-pointer"
              >
                <span
                  className={`w-12 h-8 rounded-full flex items-center justify-center transition-colors ${
                    on ? 'bg-brand-100 text-brand-600' : 'text-mute'
                  }`}
                >
                  <Icon className="w-[22px] h-[22px]" strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
                </span>
                <span className={`text-[11px] ${on ? 'font-bold text-brand-700' : 'font-medium text-mute'}`}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
