import { chromium } from 'playwright';
import fs from 'fs';
const W=768,H=1376, AX=56, AY=150, AW=656, AH=1130;
const GOLD='#e0b95a', BLUE='#2b3fa0';
function rng(seed){let s=seed*9301+49297;return()=>{s=(s*9301+49297)%233280;return s/233280;};}
const R=(seed)=>rng(seed);
const star4=(x,y,r,c,o=1)=>`<path d="M${x} ${y-r} Q${x} ${y} ${x+r} ${y} Q${x} ${y} ${x} ${y+r} Q${x} ${y} ${x-r} ${y} Q${x} ${y} ${x} ${y-r}Z" fill="${c}" opacity="${o}"/>`;
const L={
 stars:(n,c='#fff3c4',seed=1,y0=AY+30,y1=AY+560)=>{const r=R(seed);let s='';for(let i=0;i<n;i++){const x=AX+30+r()*(AW-60),y=y0+r()*(y1-y0),k=r();s+=k>.6?star4(x,y,8+r()*12,c,.9):`<circle cx="${x}" cy="${y}" r="${2+r()*3}" fill="${c}" opacity=".85"/>`;}return s;},
 sun:(cx,cy,r,rays=14,fill='#ffd45e')=>{let s='';for(let i=0;i<rays;i++){const a=i/rays*Math.PI*2;s+=`<path d="M${cx+Math.cos(a-.09)*r*1.2} ${cy+Math.sin(a-.09)*r*1.2} L${cx+Math.cos(a)*r*1.6} ${cy+Math.sin(a)*r*1.6} L${cx+Math.cos(a+.09)*r*1.2} ${cy+Math.sin(a+.09)*r*1.2}Z" fill="#ffb23c" stroke="${BLUE}" stroke-width="4" stroke-linejoin="round"/>`;}return `<g filter="url(#wob)">${s}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${BLUE}" stroke-width="6"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#hatch)"/></g>`;},
 moon:(cx,cy,r,bg,fill='#fff0b8',cut=.55)=>{const id='m'+Math.round(cx*7+cy*3+r);return `<mask id="${id}"><rect x="${cx-r*2}" y="${cy-r*2}" width="${r*4}" height="${r*4}" fill="#fff"/><circle cx="${cx+r*cut}" cy="${cy-r*.2}" r="${r*.92}" fill="#000"/></mask><g filter="url(#wob)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#f4e3b1" stroke-width="5" mask="url(#${id})"/></g>`;},
 clouds:(list,fill='#fff')=>list.map(([x,y,s])=>`<g filter="url(#wob)" transform="translate(${x} ${y}) scale(${s})"><path d="M-90 0 q-30 0 -30 -26 q0 -26 30 -26 q8 -30 42 -28 q30 -26 62 0 q40 -6 46 30 q4 26 -26 28Z" fill="${fill}" stroke="${BLUE}" stroke-width="5"/><path d="M-90 0 q-30 0 -30 -26 q0 -26 30 -26 q8 -30 42 -28 q30 -26 62 0 q40 -6 46 30 q4 26 -26 28Z" fill="url(#hatch)" opacity=".7"/></g>`).join(''),
 hills:(y,c1,c2)=>`<g filter="url(#wob)"><path d="M${AX} ${y+40} Q${AX+160} ${y-60} ${AX+340} ${y} T${AX+AW} ${y-20} L${AX+AW} ${AY+AH} L${AX} ${AY+AH}Z" fill="${c2}" stroke="${BLUE}" stroke-width="5"/><path d="M${AX} ${y+90} Q${AX+200} ${y+10} ${AX+400} ${y+70} T${AX+AW} ${y+50} L${AX+AW} ${AY+AH} L${AX} ${AY+AH}Z" fill="${c1}" stroke="${BLUE}" stroke-width="5"/><path d="M${AX} ${y+90} Q${AX+200} ${y+10} ${AX+400} ${y+70} T${AX+AW} ${y+50} L${AX+AW} ${AY+AH} L${AX} ${AY+AH}Z" fill="url(#hatch)"/></g>`,
 ground:(y,c)=>`<g filter="url(#wob)"><path d="M${AX} ${y} Q${AX+330} ${y-30} ${AX+AW} ${y} L${AX+AW} ${AY+AH} L${AX} ${AY+AH}Z" fill="${c}" stroke="${BLUE}" stroke-width="5"/><path d="M${AX} ${y} Q${AX+330} ${y-30} ${AX+AW} ${y} L${AX+AW} ${AY+AH} L${AX} ${AY+AH}Z" fill="url(#hatch)"/></g>`,
 mountains:(y,c,snow)=>`<g filter="url(#wob)"><path d="M${AX} ${y} L${AX+150} ${y-230} L${AX+260} ${y-80} L${AX+400} ${y-300} L${AX+560} ${y-90} L${AX+AW} ${y-190} L${AX+AW} ${y+200} L${AX} ${y+200}Z" fill="${c}" stroke="${BLUE}" stroke-width="5" stroke-linejoin="round"/><path d="M${AX} ${y} L${AX+150} ${y-230} L${AX+260} ${y-80} L${AX+400} ${y-300} L${AX+560} ${y-90} L${AX+AW} ${y-190} L${AX+AW} ${y+200} L${AX} ${y+200}Z" fill="url(#hatch)"/>${snow?`<path d="M${AX+110} ${y-150} L${AX+150} ${y-230} L${AX+190} ${y-150} L${AX+150} ${y-170}Z M${AX+355} ${y-210} L${AX+400} ${y-300} L${AX+445} ${y-210} L${AX+400} ${y-232}Z" fill="#fff" stroke="${BLUE}" stroke-width="4"/>`:''}</g>`,
 waves:(y,c,rows=4)=>{let s='';for(let k=0;k<rows;k++){const yy=y+k*46;s+=`<path d="M${AX} ${yy} ${Array.from({length:9},(_,i)=>`q41 -34 82 0`).join(' ')} L${AX+AW} ${AY+AH} L${AX} ${AY+AH}Z" fill="${c[k%c.length]}" stroke="${BLUE}" stroke-width="4"/>`;}return `<g filter="url(#wob)">${s}</g>`;},
 hearts:(n,seed=2)=>{const r=R(seed);let s='';for(let i=0;i<n;i++){const x=AX+50+r()*(AW-100),y=AY+60+r()*520,z=.5+r()*.9;s+=`<path transform="translate(${x} ${y}) scale(${z})" d="M0 14 C-34 -12 -18 -38 0 -20 C18 -38 34 -12 0 14Z" fill="${['#ff8fb0','#ffb3c7','#ff6f91'][i%3]}" stroke="${BLUE}" stroke-width="4"/>`;}return `<g filter="url(#wob)">${s}</g>`;},
 flowers:(n,y0,seed=3)=>{const r=R(seed);let s='';for(let i=0;i<n;i++){const x=AX+30+r()*(AW-60),y=y0+r()*200,c=['#ff8fb0','#ffd45e','#fff','#c79bff'][i%4];s+=`<g transform="translate(${x} ${y})"><circle r="9" cx="0" cy="-14" fill="${c}"/><circle r="9" cx="14" cy="0" fill="${c}"/><circle r="9" cx="0" cy="14" fill="${c}"/><circle r="9" cx="-14" cy="0" fill="${c}"/><circle r="7" fill="#ffb23c" stroke="${BLUE}" stroke-width="2"/></g>`;}return `<g filter="url(#wob)">${s}</g>`;},
 rain:(n,seed=4)=>{const r=R(seed);let s='';for(let i=0;i<n;i++){const x=AX+r()*AW,y=AY+r()*AH;s+=`<path d="M${x} ${y} l-14 36" stroke="#cfe0ff" stroke-width="4" stroke-linecap="round" opacity=".75"/>`;}return s;},
 flames:(y)=>{let s='';for(let i=0;i<7;i++){const x=AX+i*100;s+=`<path d="M${x-30} ${y+120} Q${x-20} ${y+20} ${x+10} ${y-40+(i%2)*40} Q${x+24} ${y+30} ${x+70} ${y+120}Z" fill="${i%2?'#ff9d3b':'#ff5a3c'}" stroke="${BLUE}" stroke-width="4"/>`;}return `<g filter="url(#wob)">${s}<rect x="${AX}" y="${y+100}" width="${AW}" height="${AH}" fill="#7a1d2e" stroke="${BLUE}" stroke-width="4"/></g>`;},
 pillars:(c='#f2e6c9')=>[AX+30,AX+AW-110].map(x=>`<g filter="url(#wob)"><rect x="${x}" y="${AY+130}" width="80" height="760" fill="${c}" stroke="${BLUE}" stroke-width="5"/><rect x="${x-14}" y="${AY+112}" width="108" height="30" fill="${c}" stroke="${BLUE}" stroke-width="5"/><rect x="${x-14}" y="${AY+884}" width="108" height="30" fill="${c}" stroke="${BLUE}" stroke-width="5"/><rect x="${x}" y="${AY+130}" width="80" height="760" fill="url(#hatch)"/></g>`).join(''),
 rings:(cx,cy,cols)=>cols.map((c,i)=>`<circle cx="${cx}" cy="${cy}" r="${300-i*46}" fill="none" stroke="${c}" stroke-width="30" opacity=".55"/>`).join(''),
 rays:(cx,cy,c='#fff7d0',n=16)=>{let s='';for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=a+.1;s+=`<path d="M${cx} ${cy} L${cx+Math.cos(a)*900} ${cy+Math.sin(a)*900} L${cx+Math.cos(b)*900} ${cy+Math.sin(b)*900}Z" fill="${c}" opacity=".35"/>`;}return s;},
 wreath:(cx,cy,rx,ry)=>{let s='';for(let i=0;i<30;i++){const a=i/30*Math.PI*2,x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;s+=`<ellipse transform="translate(${x} ${y}) rotate(${a*180/Math.PI+90})" rx="12" ry="30" fill="${i%2?'#4fb36a':'#7fd08a'}" stroke="${BLUE}" stroke-width="3"/>`;}return `<g filter="url(#wob)">${s}</g>`;},
 sparkles:(n,c,seed=5,y0=AY+60,y1=AY+900)=>{const r=R(seed);let s='';for(let i=0;i<n;i++)s+=star4(AX+40+r()*(AW-80),y0+r()*(y1-y0),12+r()*18,c,.9);return s;},
 petals:(n,seed=6)=>{const r=R(seed);let s='';for(let i=0;i<n;i++){const x=AX+r()*AW,y=AY+r()*AH;s+=`<ellipse cx="${x}" cy="${y}" rx="9" ry="16" transform="rotate(${r()*180} ${x} ${y})" fill="${['#e9d5ff','#c4b5fd','#fff'][i%3]}" opacity=".7"/>`;}return s;},
 rainbow:(cx,cy)=>['#ff7a7a','#ffb23c','#ffe066','#7fd08a','#6ab7ff','#b794f6'].map((c,i)=>`<path d="M${cx-300+i*16} ${cy} a${300-i*16} ${300-i*16} 0 0 1 ${(300-i*16)*2} 0" fill="none" stroke="${c}" stroke-width="16" opacity=".8"/>`).join(''),
 bolt:(x,y,s=1)=>`<path transform="translate(${x} ${y}) scale(${s})" d="M0 0 L-40 90 L-8 90 L-30 170 L50 70 L12 70 L36 0Z" fill="#ffe066" stroke="${BLUE}" stroke-width="5" stroke-linejoin="round"/>`,
};
// id: [numeral, top, bottom, layers(fn(AX..)), char:{h, cx, bottom, shadow}]
const GY=1010;
const C={
0:['0','#bfe3f5','#fdf1d4',()=>L.sun(AX+520,AY+190,70,12)+L.clouds([[AX+170,AY+160,.9],[AX+470,AY+340,.7]])+L.hills(GY-80,'#8fcf86','#b6e0a0'),{h:600,cx:W/2-20,b:GY+90}],
1:['I','#2d2468','#7e5fcb',()=>L.stars(34,'#ffe9a0',11)+L.sparkles(8,'#fff3c4',12,AY+120,AY+800)+L.ground(GY-10,'#4b3a93'),{h:640,cx:W/2,b:GY+80}],
2:['II','#16224f','#3f5bb0',()=>L.stars(30,'#e8eeff',13)+L.moon(W/2,AY+230,110,'#233470','#f6f1ff',.5)+L.waves(GY-30,['#4d6fcc','#3a57ac','#2c4590'],5),{h:650,cx:W/2,b:GY+60}],
3:['III','#ffe0ea','#d5efb4',()=>L.sun(AX+110,AY+160,60,12)+L.clouds([[AX+480,AY+210,.8]])+L.hills(GY-60,'#9fdc86','#c4eaa2')+L.flowers(18,GY-20,14),{h:560,cx:W/2,b:GY+90}],
4:['IV','#ffd0aa','#f29a72',()=>L.mountains(GY-40,'#c97a5d',false)+L.clouds([[AX+150,AY+190,.8],[AX+500,AY+130,.6]],'#fff4e6')+L.ground(GY+10,'#a95a46'),{h:610,cx:W/2,b:GY+120}],
5:['V','#f8efd2','#e8cd90',()=>L.pillars('#f7ecd0')+L.sparkles(10,'#e0b95a',15,AY+80,AY+500)+L.ground(GY+20,'#cba462'),{h:620,cx:W/2,b:GY+110}],
6:['VI','#ffd9e6','#ffb9cf',()=>L.hearts(16,16)+L.hills(GY-40,'#ffd0a8','#ffe0c4'),{h:430,cx:W/2,b:GY+80}],
7:['VII','#c0eaf0','#74c6d2',()=>L.stars(14,'#ffffff',17,AY+30,AY+400)+L.clouds([[AX+160,AY+250,.8],[AX+520,AY+160,.7]])+L.ground(GY+10,'#5aa5b4'),{h:480,cx:W/2,b:GY+100}],
8:['VIII','#ffe8aa','#f7b955',()=>L.rays(AX+540,AY+150,'#fff6cf',18)+L.sun(AX+540,AY+150,64,14)+L.hills(GY-50,'#9ccc65','#c5e08a'),{h:620,cx:W/2,b:GY+90}],
9:['IX','#242a3d','#566384',()=>L.stars(36,'#f3f5ff',19)+L.mountains(GY-20,'#7e8cab',true)+L.ground(GY+30,'#e8eefc'),{h:600,cx:W/2,b:GY+100}],
10:['X','#4a2d8c','#38b3b8',()=>L.rings(W/2,AY+590,['#ffd45e','#ff8fb0','#6ab7ff','#b794f6'])+L.stars(26,'#fff3c4',20)+L.sparkles(8,'#fff',21),{h:560,cx:W/2,b:AY+AH-210}],
11:['XI','#e0edf8','#a8c7e6',()=>L.pillars('#fbfbff')+L.clouds([[W/2,AY+170,.9]])+L.ground(GY+30,'#8eb0d8'),{h:560,cx:W/2,b:GY+120}],
12:['XII','#cdeedc','#7fc7a9',()=>L.sparkles(14,'#fff',22,AY+40,AY+900)+L.hills(GY+40,'#6bb592','#8fd0b0'),{h:600,cx:W/2,b:AY+AH-250,hang:true}],
13:['XIII','#15112b','#3d2f6e',()=>L.stars(26,'#e9d5ff',23)+L.moon(AX+500,AY+190,70,'#1f1a45','#f3e6ff',.5)+L.petals(30,24)+L.ground(GY+20,'#2a2257'),{h:560,cx:W/2,b:GY+100}],
14:['XIV','#d8f2fb','#8fd0e8',()=>L.rainbow(W/2,AY+360)+L.clouds([[AX+130,AY+420,.7],[AX+540,AY+410,.7]])+L.waves(GY-10,['#8fd8f0','#6ac3e6','#4aaed8'],5),{h:580,cx:W/2,b:GY+80}],
15:['XV','#2a0b1c','#a42b3a',()=>L.stars(20,'#ffb3a0',25)+L.flames(GY-80),{h:540,cx:W/2,b:GY+30}],
16:['XVI','#262a45','#6c7096',()=>L.rain(60,26)+L.mountains(GY-10,'#4a4e75',false)+L.ground(GY+30,'#3b3e61'),{h:690,cx:W/2,b:GY+110}],
17:['XVII','#0e2347','#2e7392',()=>L.stars(50,'#fff3c4',27,AY+30,AY+700)+L.sparkles(6,'#9ff0e6',28,AY+80,AY+500)+L.waves(GY-40,['#4fb3c6','#3797b0','#2a7d9a'],5),{h:480,cx:W/2,b:GY+30,float:true}],
18:['XVIII','#272b72','#4a4fa8',()=>L.stars(34,'#fff3c4',29)+L.moon(W/2,AY+250,120,'#303480','#fff0b8',.5)+L.hills(GY-40,'#3b3f94','#4b50ad'),{h:540,cx:W/2,b:GY+100}],
19:['XIX','#fbe6a4','#ffd25e',()=>L.rays(W/2,AY+300,'#fffbe0',22)+L.hills(GY,'#f2a65a','#ffc27a')+L.flowers(12,GY+10,30),{h:540,cx:W/2,b:GY+40,float:true,ch:'sun'}],
20:['XX','#fff0c2','#bcd6f4',()=>L.rays(W/2,AY+500,'#ffffff',20)+L.clouds([[AX+140,AY+120,.9],[AX+520,AY+140,.8],[AX+90,GY-20,1],[AX+560,GY,1]])+L.sparkles(10,'#e0b95a',31,AY+60,AY+700),{h:480,cx:W/2,b:AY+AH-250,float:true}],
21:['XXI','#d6f0d0','#8fcfae',()=>L.rays(W/2,AY+560,'#ffffff',20)+L.sparkles(12,'#fff',32,AY+60,AY+900)+L.wreath(W/2,AY+570,250,330),{h:400,cx:W/2,b:AY+AH-340,float:true}],
};
const defs=`<defs>
<filter id="wob" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="8"/><feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.35  0 0 0 -1.7 1.15"/></filter>
<pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="9" stroke="rgba(20,30,110,.2)" stroke-width="2.2"/></pattern>
<clipPath id="art"><rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" rx="34"/></clipPath>
<clipPath id="card"><rect x="0" y="0" width="${W}" height="${H}" rx="54"/></clipPath>
</defs>`;
function cardSvg(id){
  const [num,top,bot,layers,ch]=C[id];
  const img=`chars/${id}.png`;
  const im=imgSize[id]; const sc=ch.h/im.h; const w=im.w*sc, h=ch.h;
  const x=ch.cx-w/2, y=ch.b-h;
  const shadow=(ch.float||ch.hang)?'':`<ellipse cx="${ch.cx}" cy="${ch.b-6}" rx="${w*.38}" ry="20" fill="rgba(20,20,70,.28)"/>`;
  const glow=(ch.float)?`<ellipse cx="${ch.cx}" cy="${ch.b+40}" rx="${w*.3}" ry="14" fill="rgba(255,255,255,.18)"/>`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}
<g clip-path="url(#card)"><rect width="${W}" height="${H}" fill="#0d0c1d"/>
<rect x="8" y="8" width="${W-16}" height="${H-16}" rx="48" fill="none" stroke="${GOLD}" stroke-width="7"/>
<rect x="26" y="26" width="${W-52}" height="${H-52}" rx="36" fill="none" stroke="${GOLD}" stroke-opacity=".4" stroke-width="2"/>
<text x="${W/2}" y="108" text-anchor="middle" font-family="'DejaVu Serif','Liberation Serif',serif" font-size="58" letter-spacing="6" fill="#f4e3b1">${num}</text>
${[-90,90].map(d=>`<path d="M${W/2+d} 92 h${d>0?60:-60}" stroke="${GOLD}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`).join('')}
<g clip-path="url(#art)"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs>
<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#sky)"/>
<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#hatch)" opacity=".5"/>
${layers()}
${shadow}${glow}
<image href="${img}" x="${x}" y="${y}" width="${w}" height="${h}"/>

<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" filter="url(#grain)" opacity=".45" style="mix-blend-mode:multiply"/>
</g>
<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" rx="34" fill="none" stroke="${GOLD}" stroke-width="5"/>
<g transform="translate(${W/2} ${H-62})" fill="${GOLD}">${star4(0,0,16,GOLD)}<circle cx="-46" cy="0" r="4"/><circle cx="46" cy="0" r="4"/><circle cx="-76" cy="0" r="2.5" opacity=".6"/><circle cx="76" cy="0" r="2.5" opacity=".6"/></g>
</g></svg>`;
}
function backSvg(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}
<g clip-path="url(#card)"><rect width="${W}" height="${H}" fill="#0d0c1d"/>
<rect x="8" y="8" width="${W-16}" height="${H-16}" rx="48" fill="none" stroke="${GOLD}" stroke-width="7"/>
<rect x="26" y="26" width="${W-52}" height="${H-52}" rx="36" fill="none" stroke="${GOLD}" stroke-opacity=".4" stroke-width="2"/>
<rect x="60" y="60" width="${W-120}" height="${H-120}" rx="26" fill="#1a1740"/><rect x="60" y="60" width="${W-120}" height="${H-120}" rx="26" fill="url(#hatch)" opacity=".7"/>
${L.stars(46,'#f4e3b1',41,90,H-110)}
<g transform="translate(${W/2} ${H/2})"><circle r="190" fill="none" stroke="${GOLD}" stroke-width="5" opacity=".6"/><circle r="160" fill="none" stroke="${GOLD}" stroke-width="2" opacity=".5"/>
<g filter="url(#wob)"><circle cx="-10" cy="-10" r="110" fill="#fff0b8" stroke="#f4e3b1" stroke-width="5"/><circle cx="34" cy="-30" r="100" fill="#1a1740"/></g>${star4(70,60,34,'#fff3c4')}${star4(-120,-120,20,GOLD)}${star4(120,-110,14,GOLD)}</g>
<rect x="60" y="60" width="${W-120}" height="${H-120}" rx="26" filter="url(#grain)" opacity=".35" style="mix-blend-mode:multiply"/>
</g></svg>`;
}
import { execSync } from 'child_process';
const imgSize={};
for(let i=0;i<22;i++){const o=execSync(`python3 -c "from PIL import Image;im=Image.open('chars/${i}.png');print(im.size[0],im.size[1])"`).toString().trim().split(' ');imgSize[i]={w:+o[0],h:+o[1]};}
fs.mkdirSync('cards',{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:W,height:H}});
const only=process.argv[2]?process.argv[2].split(',').map(x=>x==='back'?x:+x):[...Array(22).keys(),'back'];
for(const id of only){
  const svg=id==='back'?backSvg():cardSvg(id);
  fs.writeFileSync('card_tmp.html',`<!doctype html><body style="margin:0;background:transparent">${svg}</body>`);
  await p.goto('file://'+process.cwd()+'/card_tmp.html'); await p.waitForTimeout(250);
  await p.screenshot({path:`cards/${id}.png`,omitBackground:true,clip:{x:0,y:0,width:W,height:H}});
}
await b.close(); console.log('ok');
