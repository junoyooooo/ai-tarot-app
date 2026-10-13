# 타로 카드 이미지 생성기

`chars/` 의 캐릭터 PNG(투명 배경)를 카드 틀·배경과 합쳐 768×1376 카드 이미지를 만듭니다.

```bash
npm i playwright && npx playwright install chromium
node gen.mjs          # 전체 22장 + 뒷면 → cards/*.png
node gen.mjs 3,7      # 특정 카드만
```
결과 PNG를 WebP로 변환해 `frontend/public/tarot/card_{id}.webp` 에 넣으면 됩니다.
카드별 배경색/소품/캐릭터 크기는 `gen.mjs` 의 `C` 객체에서 수정합니다.
