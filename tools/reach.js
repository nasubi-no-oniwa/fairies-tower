require('../js/engine.js'); const FT=globalThis.FT;
const lv={h:60,br:[[59,1,19]]};
for (const [sp,b] of [[3,0],[0,0],[3,10],[0,10]]) {
  // 地面で跳んで、そのまま押し続ける
  const r=new FT.Run(lv,new Map(),{sp,b}); let top=99;
  while(!r.over && r.t<2000){ r.step(4); top=Math.min(top,r.p.y+0.9); }
  // 惰性：ゲージ0直前に離す
  console.log('sp',sp,'b',b,'押し続け 力尽きた高さ', (59-top).toFixed(2), r.dead);
}
// 屍からつかまって→飛ぶ（屍の上に立って跳ぶ）
const cor=new Map([[FT.ckey(40,40*4),{n:1,s:2}]]);
