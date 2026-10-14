// 사업자 정보 (결제 대행사 심사·전자상거래법 표기용). Vercel 환경변수로 채우면 코드 수정 없이 반영돼요.
// 비어 있는 항목은 화면에 '준비 중'으로 표시됩니다.
const env = import.meta.env;

export const BUSINESS = [
  ['상호', env.VITE_BIZ_NAME],
  ['대표자', env.VITE_BIZ_REP],
  ['사업자등록번호', env.VITE_BIZ_REG_NO],
  ['통신판매업 신고번호', env.VITE_BIZ_ECOMM_NO],
  ['사업장 주소', env.VITE_BIZ_ADDRESS],
  ['고객 문의 이메일', env.VITE_BIZ_EMAIL],
  ['고객 문의 전화', env.VITE_BIZ_PHONE],
];

export const SERVICE_NAME = '토닥토닥 별빛타로';
