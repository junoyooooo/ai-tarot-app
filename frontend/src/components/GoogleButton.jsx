import React, { useEffect, useRef, useState } from 'react';
import { mountGoogleButton } from '../lib/auth';

/** 구글이 그려 주는 로그인 버튼. 로그인에 성공하면 onDone. */
export default function GoogleButton({ clientId, onDone, dark = false }) {
  const ref = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!ref.current || !clientId) return;
    mountGoogleButton(ref.current, clientId, { onDone, onError: setError, width: ref.current.offsetWidth || 280 });
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div ref={ref} className="flex justify-center min-h-[44px]" />
      {error && <p className={`mt-1.5 text-center text-[12px] ${dark ? 'text-[#ffc2b8]' : 'text-[#c0392b]'} break-keep`}>{error}</p>}
    </div>
  );
}
