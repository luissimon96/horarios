window.createRouteEngine = function (context) {
  const { D, BYID, R_PE, R_TERM, R_PONTO, R_TROCA, R_COMODA, INTEG, FOLGA, KX, KY, hoje, agora, rtQuero, rtEta, rtV, rtVale, agoraSeg, aPe, minCedo, minAte, metros, noTTU, aoLongo } = context;
function xyShape(s){ if(s._X) return; const P=s.p, n=P.length; s._X=new Float64Array(n); s._Y=new Float64Array(n); let a=1e18,b=-1e18,c=1e18,d=-1e18;
  for(let i=0;i<n;i++){ const x=P[i][1]*KX, y=P[i][0]*KY; s._X[i]=x; s._Y[i]=y; if(x<a)a=x; if(x>b)b=x; if(y<c)c=y; if(y>d)d=y; } s._bb=[a,b,c,d]; if(!s._c) aoLongo(s,P[0][0],P[0][1]); }
// todas as vezes que o trajeto passa a até R metros do ponto plano (x,y): [{d, f}], uma por passada (ida e volta contam separadas)
function passadas(s,x,y,R){ xyShape(s); const bb=s._bb; if(x<bb[0]-R||x>bb[1]+R||y<bb[2]-R||y>bb[3]+R) return [];
  const X=s._X, Y=s._Y, c=s._c, n=X.length, tot=c[n-1]||1, out=[]; let cur=null;
  for(let i=1;i<n;i++){ const x0=X[i-1], y0=Y[i-1], x1=X[i], y1=Y[i];
    if((x0<x-R&&x1<x-R)||(x0>x+R&&x1>x+R)||(y0<y-R&&y1<y-R)||(y0>y+R&&y1>y+R)){ if(cur){ out.push(cur); cur=null; } continue; }
    const ax=x0-x, ay=y0-y, dx=x1-x0, dy=y1-y0, L2=dx*dx+dy*dy; let t=L2?-(ax*dx+ay*dy)/L2:0; t=t<0?0:t>1?1:t; const px=ax+t*dx, py=ay+t*dy, d=Math.sqrt(px*px+py*py);
    if(d<=R){ if(!cur||d<cur.d) cur={d,f:(c[i-1]+t*(c[i]-c[i-1]))/tot}; } else if(cur){ out.push(cur); cur=null; } }
  if(cur) out.push(cur); return out;
}
// sentido(s) em que cada trajeto da linha é usado ('T', 'B' ou os dois)
function sentShape(l){ if(l._ss) return l._ss; l._ss=l.shapes.map(()=>''); Object.keys(l.depV).forEach(dk=>Object.keys(l.depV[dk]).forEach(k=>l.depV[dk][k].forEach(i=>{ if(l._ss[i].indexOf(k)<0) l._ss[i]+=k; }))); return l._ss; }
// pontos de parada por onde um trajeto passa: [[índice do ponto, fração do percurso, lado], …]
// lado 0 = ponto do sentido deste trajeto; 1 = ponto do sentido contrário (do outro lado da rua), usado só context.getWhen() não há outro por perto
function pontosDoTrajeto(l,si){ const s=l.shapes[si]; if(s._st) return s._st; const ss=sentShape(l)[si]; s._st=[];
  D.stops.forEach((p,k)=>{ const o=p.L.find(o=>o.id===l.id); if(!o) return; const term=noTTU(k); const lado=(!term&&o.s&&ss&&ss.indexOf(o.s)<0)?1:0;
    // dentro do Terminal as plataformas ficam a dezenas de metros do traçado: vale um raio maior e não importa o lado
    passadas(s,p._x,p._y,term?R_TERM:R_PONTO).forEach(r=>s._st.push([k,r.f,lado])); });
  // pontas do trajeto: se nenhum ponto ficou perto do início ou do fim, vale o ponto da linha mais próximo (até R_TERM)
  [[0,0],[s.p.length-1,1]].forEach(e=>{ const q=s.p[e[0]], x=q[1]*KX, y=q[0]*KY; if(s._st.some(t=>Math.abs(t[1]-e[1])<0.02)) return; let b=-1, bd=R_TERM;
    D.stops.forEach((p,k)=>{ if(!p.L.some(o=>o.id===l.id)) return; const d=Math.hypot(p._x-x,p._y-y); if(d<bd){ bd=d; b=k; } }); if(b>=0) s._st.push([b,e[1],0]); });
  return s._st; }
// saídas do dia que usam o trajeto, em ordem
function viagensShape(l,si,dk){ const s=l.shapes[si]; s._tr=s._tr||{}; if(!s._tr[dk]){ const r=[], d=l.dep[dk]||{}; Object.keys(d).forEach(k=>d[k].forEach((m,i)=>{ if(l.depV[dk][k][i]===si) r.push(m); })); s._tr[dk]=r.sort((a,b)=>a-b); } return s._tr[dk]; }
// primeira viagem do trajeto que passa na fração f a partir do minuto t0: [saída do ponto inicial, passagem]
// a passagem para EMBARCAR usa o horário cedo; as chegadas (troca, destino) usam o típico: assim a troca só é sugerida com folga real
// com o ônibus localizado (tempo real), a passagem sai de onde ele está: viagem atrasada continua valendo, viagem que já passou sai da conta
function primeira(l,si,dk,f,t0){ const s=l.shapes[si], a=viagensShape(l,si,dk);
  if(dk===hoje()&&!context.getWhen()){ const fal=t0-agora(); rtQuero(l.id,fal<=15?0:fal<=40?1:2); }
  for(let i=0;i<a.length;i++){ let p=a[i]+minCedo(l,s,dk,a[i],f), lv=0; const e=rtEta(rtV(l,si,a[i],dk),f); if(e){ if(e[1]<0) continue; p=e[0]; lv=1; } if(p>=t0) return [a[i],p,lv]; } return null; }
// chegada (típica) da viagem que saiu no minuto m à fração f do trajeto
function chegaEm(l,si,dk,m,f){ const e=rtEta(rtV(l,si,m,dk),f); return (e&&e[1]>=0)?e[2]:m+minAte(l,l.shapes[si],dk,m,f); }
// pontos a até R_PE de P, por trajeto com viagens no dia: {l, si, k, f, d}
function candidatos(P,dk){ const por={};
  D.stops.forEach((p,k)=>{ const d=metros(p[0],p[1],P.lat,P.lon); if(d>R_PE) return;
    p.L.forEach(o=>{ const l=BYID[o.id]; l.shapes.forEach((s,si)=>{ if(!viagensShape(l,si,dk).length) return;
      pontosDoTrajeto(l,si).forEach(q=>{ if(q[0]===k){ const key=l.id+'|'+si; (por[key]=por[key]||[]).push({l,si,k,f:q[1],d,o:d+q[2]*150}); } }); }); }); });
  // de cada trajeto fica o ponto mais perto e, se ele passa duas vezes pela região (ida e volta), o mais perto da outra passada
  const out=[]; Object.keys(por).forEach(key=>{ const a=por[key].sort((x,y)=>x.o-y.o); out.push(a[0]); const b=a.find(x=>Math.abs(x.f-a[0].f)>0.15); if(b) out.push(b); });
  return out; }
// pares de pontos onde dá para trocar do trajeto a para o trajeto b: [ponto em a, fração em a, ponto em b, fração em b, metros a pé]
const _trf={};
function trocas(a,b){ const key=a.l.id+'|'+a.si+'>'+b.l.id+'|'+b.si; if(_trf[key]) return _trf[key];
  const A=pontosDoTrajeto(a.l,a.si), B=pontosDoTrajeto(b.l,b.si), r=[];
  A.forEach(x=>{ const p=D.stops[x[0]]; B.forEach(y=>{ const q=D.stops[y[0]]; const dx=p._x-q._x; if(dx>R_TROCA||dx<-R_TROCA) return; const dy=p._y-q._y; if(dy>R_TROCA||dy<-R_TROCA) return; const d=Math.sqrt(dx*dx+dy*dy); if(d<=R_TROCA) r.push([x[0],x[1],y[0],y[1],d,d+(x[2]+y[2])*40]); }); });
  return _trf[key]=r; }
// opções de viagem para quem sai da partida no minuto t0: sem troca e com uma troca
function rodada(E,S,dk,t0){
  const ops=[]; const len=(l,si)=>{ const s=l.shapes[si]; return s._c[s.p.length-1]; };
  const custo=o=>o.chega+0.5*(o.wo+o.wd+(o.wt||0))+0.25*(o.chega-o.sai)+(o.legs.length>1?(o.ttu?2:10):0); // troca no Terminal vale mais: outra só ganha se chegar bem antes
  E.forEach(e=>S.forEach(x=>{ if(e.l!==x.l||e.si!==x.si||(x.f-e.f)*len(e.l,e.si)<300) return;
    const wo=aPe(e.d), v=primeira(e.l,e.si,dk,e.f,t0+wo); if(!v) return;
    const tD=chegaEm(e.l,e.si,dk,v[0],x.f), wd=aPe(x.d); if(tD<=v[1]) return;
    const o={legs:[{l:e.l,si:e.si,k0:e.k,f0:e.f,k1:x.k,f1:x.f,t0:v[1],t1:tD,m:v[0],lv:v[2]}],wo,wd,dO:e.d,dD:x.d,chega:tD+wd,sai:v[1]-wo}; o.custo=custo(o); ops.push(o); }));
  E.forEach(e=>{ const wo=aPe(e.d), v=primeira(e.l,e.si,dk,e.f,t0+wo); if(!v) return; const sa=e.l.shapes[e.si], la=len(e.l,e.si);
    S.forEach(x=>{ if(x.l===e.l&&x.si===e.si) return; const sb=x.l.shapes[x.si], lb=len(x.l,x.si); // mesma linha, outro trajeto: vale (ponto final, onde o ônibus volta no sentido contrário)
      const c=trocas(e,x).filter(q=>(q[1]-e.f)*la>=300&&(x.f-q[3])*lb>=300); if(!c.length) return;
      // candidatas: a primeira e a última troca possível ao longo do primeiro ônibus, a de menor caminhada e a do Terminal
      const reps=[c.reduce((m,q)=>q[1]<m[1]?q:m), c.reduce((m,q)=>q[1]>m[1]?q:m), c.reduce((m,q)=>q[5]<m[5]?q:m)];
      const t=c.filter(q=>noTTU(q[0])&&noTTU(q[2])); if(t.length) reps.push(t.reduce((m,q)=>q[5]<m[5]?q:m));
      // e as trocas "cômodas" (mesmo ponto ou ponto vizinho, até R_COMODA m): a que desce mais cedo do primeiro ônibus e a que pega o segundo mais adiante.
      // A integração vale em qualquer ponto (90 min entre as validações): context.getWhen() o segundo ônibus é o mesmo, não há por que ir até o terminal da linha e voltar.
      const cm=c.filter(q=>q[4]<=R_COMODA); if(cm.length){ reps.push(cm.reduce((m,q)=>q[1]<m[1]?q:m)); reps.push(cm.reduce((m,q)=>q[3]>m[3]?q:m)); }
      let best=null; reps.forEach((q,i)=>{ if(reps.indexOf(q)!==i) return;
        const tA=chegaEm(e.l,e.si,dk,v[0],q[1]), wt=q[4]>30?aPe(q[4]):0; const w=primeira(x.l,x.si,dk,q[3],tA+wt+FOLGA); if(!w||w[1]-v[1]>INTEG) return;
        const tD=chegaEm(x.l,x.si,dk,w[0],x.f), wd=aPe(x.d); if(tD<=w[1]) return;
        const o={legs:[{l:e.l,si:e.si,k0:e.k,f0:e.f,k1:q[0],f1:q[1],t0:v[1],t1:tA,m:v[0],lv:v[2]},{l:x.l,si:x.si,k0:q[2],f0:q[3],k1:x.k,f1:x.f,t0:w[1],t1:tD,m:w[0],lv:w[2]}],wo,wd,wt,dT:q[4],dO:e.d,dD:x.d,ttu:noTTU(q[0])&&noTTU(q[2]),chega:tD+wd,sai:v[1]-wo};
        // entre trocas que chegam na mesma hora, ganha a de mais folga para o segundo ônibus (de 3 em 3 min, até 21): é a que desce antes e não depende de o primeiro chegar em cima da hora
        o.custo=custo(o); o.pref=o.custo-0.09*Math.floor(Math.min(21,Math.max(0,w[1]-tA-wt))/3); if(!best||o.pref<best.pref) best=o; });
      if(best) ops.push(best); }); });
  ops.sort((a,b)=>a.custo-b.custo);
  // uma opção por linha (sem troca) e uma por segundo ônibus (com troca); as outras primeiras linhas que alcançam o mesmo segundo ônibus viram "ou"
  const dir=ops.filter(o=>o.legs.length===1), out=[], visto={};
  ops.forEach(o=>{ if(o.legs.length===1){ const key='d'+o.legs[0].l.id; if(visto[key]) return; visto[key]=o; out.push(o); return; }
    const A=o.legs[0].l.id, B=o.legs[1].l.id;
    if(dir.some(d=>d.custo<=o.custo+10)) return;                       // há linha sem troca chegando quase junto
    const key='t'+B+'|'+o.legs[1].m, g=visto[key];
    if(g){ if(g.legs[0].l.id!==A&&g.alt.length<3&&!g.alt.some(a=>a.l.id===A)&&o.legs[0].k1===g.legs[0].k1&&Math.abs(o.legs[0].t0-g.legs[0].t0)<=15) g.alt.push({l:o.legs[0].l,t0:o.legs[0].t0});
      // mesma linha, outro carro que passa ANTES no mesmo ponto e já está na rua (ao vivo): chega à mesma hora no destino, mas com mais folga na troca.
      // A opção principal continua sendo a que sai mais tarde; esta aparece junto, para a pessoa não ficar olhando um ônibus chegar sem saber que serve.
      else if(g.legs[0].l.id===A&&o.legs[0].lv&&o.legs[0].k0===g.legs[0].k0&&o.legs[0].t0<g.legs[0].t0&&(!g.antes||o.legs[0].t0<g.antes.t0)) g.antes={l:o.legs[0].l,t0:o.legs[0].t0,t1:o.legs[0].t1,m:o.legs[0].m,si:o.legs[0].si};
      return; }
    o.alt=[]; visto[key]=o; out.push(o); });
  return out;
}
// ônibus ao vivo que servem a viagem sem troca, mas passam num ponto perto da partida até QUASE min antes de a pessoa chegar a pé:
// não viram opção (andando não dá tempo), mas aparecem à parte, para ela saber que aquele carro serve e decidir se corre.
// De cada carro fica o ponto em que ela chega mais perto de alcançá-lo.
const QUASE=5;
function quasePassa(E,S,dk,now,ops){ if(context.getWhen()||dk!==hoje()||!rtVale()) return []; const seg=agoraSeg(), por=new Map();
  const c0=(ops&&ops.length)?Math.min.apply(null,ops.map(o=>o.chega)):Infinity;                      // chegada da melhor opção oferecida
  E.forEach(e=>{ const sh=e.l.shapes[e.si], dir=S.some(x=>x.l===e.l&&x.si===e.si&&(x.f-e.f)*sh._c[sh.p.length-1]>=300);
    context.getRealtime().v.forEach(o=>{ if(o.l!==e.l||o.si!==e.si||!o.ok||o.i<0||seg<o.m||e.f<=o.f+0.004) return;
      const t=rtEta(o,e.f); if(!t||t[1]<0) return; const cheg=now+aPe(e.d), eta=Math.max(t[0],now); if(t[0]>=cheg||cheg-eta>QUASE) return;
      const a=por.get(o); if(a&&cheg-eta>=a.cheg-a.eta) return;
      let tr=null;
      if(!dir){ // viagem com troca: só avisa se, pegando este carro, a pessoa chegaria até a hora da melhor opção oferecida
        const r=rodada([Object.assign({},e,{d:0})],S,dk,t[0]-1).filter(p=>p.legs.length>1&&p.legs[0].m===o.m&&p.legs[0].si===o.si).sort((p,q)=>p.chega-q.chega)[0];
        if(!r||r.chega>c0) return; tr={l:r.legs[1].l,k:r.legs[0].k1,ttu:!!r.ttu}; }
      por.set(o,{o,l:e.l,k:e.k,d:e.d,eta,cheg,tr}); }); });
  return [...por.values()].sort((a,b)=>a.eta-b.eta).slice(0,2); }
function planejar(O,X){
  const dk=context.getWhen()?context.getWhen().dk:hoje(), now=context.getWhen()?context.getWhen().t:agora(), E=candidatos(O,dk), S=candidatos(X,dk);
  if(!E.length) return {ops:[],semPonto:!D.stops.some(p=>metros(p[0],p[1],O.lat,O.lon)<=R_PE),semServ:true};
  let ops=rodada(E,S,dk,now);
  if(ops.length) ops=ops.concat(rodada(E,S,dk,ops[0].sai+1));          // e a opção seguinte, para quem perder a primeira
  // fica o que não é pior nos dois quesitos (sair mais tarde, chegar mais cedo); a melhor linha sem troca fica sempre
  const dir0=ops.find(o=>o.legs.length===1);
  ops=ops.filter(o=>o===dir0||!ops.some(p=>p!==o&&p.sai>=o.sai&&p.chega<=o.chega&&(p.sai>o.sai||p.chega<o.chega||p.custo<o.custo||(p.custo===o.custo&&ops.indexOf(p)<ops.indexOf(o)))));
  ops.sort((a,b)=>a.chega-b.chega||a.custo-b.custo);
  if(ops.length){ const c0=ops[0].chega; ops=ops.filter(o=>o.chega<=c0+60).slice(0,4); }
  return {ops,quase:quasePassa(E,S,dk,now,ops)};
}

  return { pontosDoTrajeto, viagensShape, candidatos, trocas, planejar };
};
