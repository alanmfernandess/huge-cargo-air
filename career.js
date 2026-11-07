/* HCA Career v2.0 — OFP snapshots, mission lifecycle, observational debrief and isolated financial ledger. */
(function(){
'use strict';
const byId=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=(x,def=0)=>Number.isFinite(Number(x))?Number(x):def;
const has=x=>x!==null&&x!==undefined&&x!=='';
const format=(v,dp=0)=>Number.isFinite(v)?v.toLocaleString('pt-BR',{minimumFractionDigits:dp,maximumFractionDigits:dp}):'—';
const usd=v=>(v<0?'−':'')+'US$ '+format(Math.abs(v));
const tonnes=v=>Number.isFinite(v)?format(v,1)+' t':'—';
const clone=o=>JSON.parse(JSON.stringify(o));
let draft=null;
let selected=null;
let statusMessage='';
function getCareer(){
 if(!state.career||!Array.isArray(state.career.missions)){
   state.career={version:2,missions:[],nextId:1};
 }
 if(!Number.isInteger(state.career.nextId))state.career.nextId=state.career.missions.length+1;
 return state.career;
}
function past(id){return getCareer().missions.find(m=>m.id===id)||null;}
function position(id){
 let pos='PANC';
 for(const m of getCareer().missions){
   if(m.aircraft===id && m.status==='completed')pos=m.ofp.destination;
 }
 return pos;
}
function activeFor(id){return getCareer().missions.find(m=>m.aircraft===id&&m.status==='planned');}
function sum(ms,k){return ms.reduce((s,x)=>s+number(x[k]),0);}
function summary(){
 const ms=getCareer().missions.filter(m=>m.status==='completed');
 const open=getCareer().missions.filter(m=>m.status==='planned');
 const rev=sum(ms,'revenue'), expenses=sum(ms,'expense'), payable=sum(ms,'payable');
 const received=sum(ms.filter(m=>m.received),'revenue');
 const paid=sum(ms.filter(m=>m.paid),'payable');
 const hours=sum(ms,'hours'), inventory=sum(ms,'inventoryUsed');
 return {completed:ms.length,open:open.length,revenue:rev,expense:expenses,profit:rev-expenses,cashDelta:received-paid,receivables:rev-received,payables:payable-paid,stockConsumed:inventory,hours,cycles:ms.length,missions:ms,openMissions:open};
}
function stats(){
 const a=summary();
 return '<div class="hca-stats">'+
 card('MISSÕES',format(a.completed),'Concluídas','✓')+
 card('RESULTADO',usd(a.profit),'Receita − custos estimados','◒')+
 card('CAIXA Δ',usd(a.cashDelta),'Liquidações registradas','↗')+
 card('PENDENTES',format(a.open),'Missões em aberto','✈')+'</div>';
}
function card(label,value,sub,icon){
 return '<div class="hca-stat"><div class="hca-stat-top"><span>'+esc(label)+'</span><span aria-hidden="true">'+esc(icon)+'</span></div><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></div>';
}
function planes(){
 return '<div class="hca-plane-list">'+state.fleet.map(a=>{
   const pos=position(a.id), busy=activeFor(a.id);
   const flights=summary().missions.filter(m=>m.aircraft===a.id);
   const bh=sum(flights,'hours');
   return '<div class="hca-plane"><div class="hca-plane-name"><span class="hca-plane-icon">✈</span><b>'+esc(a.id)+'</b><span>'+esc(pos)+'</span></div>'+
     '<div class="hca-plane-meta"><strong>'+format(bh,1)+' h</strong><span class="hca-dot '+(busy?'hca-dot-busy':'')+'"></span><span>'+(busy?'Em missão':'Disponível*')+'</span></div></div>';
 }).join('')+'</div><div class="hca-note">* Disponibilidade de carreira: somente bloqueio por missão aberta; não valida manutenção ou AFM.</div>';
}
function routeViz(o){
 const route=esc(o.origin)+' → '+esc(o.destination);
 return '<div class="hca-routeviz"><div class="hca-end"><strong>'+esc(o.origin)+'</strong><span>ORIGEM</span></div>'+
 '<div class="hca-routepath"><span>✈</span><div class="hca-route-line"></div><small>'+format(o.routeNM)+' NM</small></div>'+
 '<div class="hca-end"><strong>'+esc(o.destination)+'</strong><span>DESTINO</span></div></div>';
}
function ofpKey(s){return [s.generated,s.origin,s.destination,s.route,s.registration,s.routeNM].join('|');}
function openFromOFP(ofp){
 if(!ofp){statusMessage='Importe um OFP no SimBrief antes de criar a missão.';active='simbrief';window.render();return;}
 const codes=new Set(['PANC',...state.routes.map(r=>r.code)]);
 if(!codes.has(ofp.origin)||!codes.has(ofp.destination)){
    statusMessage='Esta fase da carreira aceita apenas aeroportos cadastrados do Alasca.';
    active='career';draft=null;window.render();return;
 }
 draft=clone(ofp);
 selected=null;
 statusMessage='OFP importado. Configure a missão antes de aceitar o contrato.';
 active='career';
 window.render();
}
function estimate(o,aircraft){
 const m=state.model;
 const dist=number(o.routeNM);
 const hours=Math.max(.1,dist/Math.max(100,number(m.airspeed,420))+number(m.stageHours,.5));
 const fuelKg=has(o.tripFuelT)?Number(o.tripFuelT)*1000:hours*number(m.fuelGPH)*number(m.density);
 const fuelGallons=fuelKg/Math.max(0.1,number(m.density,3.04));
 const fuelCost=fuelGallons*number(m.fuelPrice);
 const parts=hours*number(m.partsBH);
 const other=hours*(number(m.flightCrewBH)+number(m.mntLaborBH))+number(m.cycleCost)+number(m.feesRT)/2;
 return {hours,fuelKg,fuelGallons,fuelCost,parts,other,expense:fuelCost+parts+other};
}
function jobForm(){
 if(!draft)return '<div class="hca-empty"><div class="hca-empty-icon">⌁</div><strong>Nenhum OFP para vincular</strong><span>Importe uma rota no SimBrief e selecione “Criar missão”.</span><button class="hca-primary" data-goto="simbrief">Abrir SimBrief</button></div>';
 const d=draft, matched=state.routes.find(r=>r.code===d.destination&&d.origin==='PANC');
 const unit=number(matched?.outRate,0);
 const defaultRevenue=Math.round((number(d.payloadT)*1000*unit)+(number(matched?.charterFee)));
 const est=estimate(d);const over=number(d.towT)>number(state.model.mtow)||number(d.zfwT)>number(state.model.mzfw)||number(d.ldwT)>number(state.model.mlw);
 return '<div class="hca-section"><div class="hca-title-row"><h3>Nova missão</h3><span class="hca-chip">OFP congelado ao aceitar</span></div>'+
 '<div class="hca-panel">'+routeViz(d)+
 '<div class="hca-mini-grid"><div><small>PAYLOAD OFP</small><strong>'+tonnes(d.payloadT)+'</strong></div><div><small>FUEL TRIP</small><strong>'+tonnes(d.tripFuelT)+'</strong></div><div><small>CUSTO PREVISTO</small><strong>'+usd(est.expense)+'</strong></div></div>'+
 (over?'<div class="hca-warning">Massas do OFP excedem limites estruturais de referência. Reavalie antes de prosseguir.</div>':'')+
 '<form id="careerCreateForm" class="hca-form"><label>Aeronave<select id="careerAircraft" required>'+state.fleet.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.id)+' · '+esc(position(a.id))+(activeFor(a.id)?' · ocupada':'')+'</option>').join('')+'</select></label>'+
 '<label>Receita contratada (US$)<input id="careerRevenue" type="number" min="0" step="100" value="'+defaultRevenue+'" required></label>'+
 '<label>Cliente / contrato<input id="careerClient" maxlength="100" placeholder="Contrato fictício · lote dedicado" value="Contrato simulado"></label>'+
 '<div class="hca-form-actions"><div class="hca-chip">Contribuição preliminar: <b id="careerMarginPreview">'+usd(defaultRevenue-est.expense)+'</b></div><button class="hca-primary" type="submit">Aceitar contrato</button><button class="hca-quiet" type="button" id="careerDiscard">Descartar</button></div></form>'+
 '<div class="hca-note">Receita sugerida pelo modelo, não cotação real. AFM, pista, meteorologia e infraestrutura permanecem pendentes. Aceitar cria uma missão <b>virtual</b>, não autoriza despacho real.</div></div></div>';
}
function missionSummary(m){
 const done=m.status==='completed';
 const e=m.economic||{};
 return '<article class="hca-mission '+(done?'hca-done':'')+'"><div class="hca-mission-top"><span><b>'+esc(m.id)+'</b> · '+esc(m.aircraft)+'</span><span class="hca-chip">'+(done?'Concluída':'Programada')+'</span></div>'+
 '<div class="hca-mission-route">'+esc(m.ofp.origin)+' <span>→</span> '+esc(m.ofp.destination)+'</div>'+
 '<div class="hca-mission-bottom"><span>'+usd(m.revenue)+'</span><span>'+(!done?'Pronta para debrief':'Margem '+usd(m.revenue-m.expense))+'</span></div>'+
 '<button class="hca-link" data-career-open="'+esc(m.id)+'">'+(done?'Detalhes →':'Registrar voo →')+'</button></article>';
}
function focused(m){
 if(!m)return '';
 const est=m.economic,done=m.status==='completed';
 const d=m.ofp; const observed=m.observed||{};
 return '<div class="hca-section"><div class="hca-title-row"><h3>'+esc(m.id)+'</h3><button class="hca-quiet" id="careerBack">Voltar</button></div><div class="hca-panel">'+routeViz(d)+
 '<div class="hca-mini-grid"><div><small>AVIÃO</small><strong>'+esc(m.aircraft)+'</strong></div><div><small>PAYLOAD OFP</small><strong>'+tonnes(d.payloadT)+'</strong></div><div><small>RECEITA</small><strong>'+usd(m.revenue)+'</strong></div></div>'+
 (done?'<div class="hca-mini-grid"><div><small>FUEL</small><strong>'+format(m.fuelKg)+' kg</strong><small>'+(observed.fuelKg===null?'Estimado':'Xbox')+'</small></div><div><small>HORAS</small><strong>'+format(m.hours,2)+' h</strong><small>'+(observed.blockHours===null?'Estimado':'Xbox')+'</small></div><div><small>RESULTADO</small><strong>'+usd(m.revenue-m.expense)+'</strong></div></div>'+
 '<div class="hca-compare"><div><span>Combustível · previsto</span><b>'+format(est.fuelKg)+' kg</b></div><div><span>Combustível · lançado</span><b>'+format(m.fuelKg)+' kg</b></div><div><span>Desvio</span><b>'+((observed.fuelKg===null||est.fuelKg<=0)?'Não medido':format((observed.fuelKg-est.fuelKg)/est.fuelKg*100,1)+'%')+'</b></div></div>'+
 '<div class="hca-form-actions">'+(!m.received?'<button class="hca-primary" data-career-receive="'+esc(m.id)+'">Registrar recebimento</button>':'<span class="hca-chip">Recebido ✓</span>')+
 (!m.paid?'<button class="hca-quiet" data-career-pay="'+esc(m.id)+'">Registrar pagamento</button>':'<span class="hca-chip">Custos pagos ✓</span>')+'</div>'+
 '<div class="hca-note">Peças consumidas são custo econômico do estoque; não entram novamente em contas a pagar. Resultado da carreira separado da projeção de 36 meses.</div>':
 '<form id="careerDebriefForm" class="hca-form">'+
 '<label>Combustível consumido no Xbox (kg)<input id="careerFuelKg" type="number" min="0" step="1" placeholder="Ex.: 8400"></label>'+
 '<label>Tempo de bloco observado (h)<input id="careerBlockHours" type="number" min="0.01" step=".01" placeholder="Ex.: 2.30"></label>'+
 '<label>Despesas adicionais (US$)<input id="careerExtra" type="number" min="0" step="1" value="0"></label>'+
 '<label>Observações<input id="careerNotes" maxlength="250" placeholder="Ventos, atrasos, condições..."></label>'+
 '<div class="hca-form-actions"><button class="hca-primary" type="submit">Concluir missão</button></div></form>'+
 '<div class="hca-note">Informe ao menos combustível ou tempo observado. Qualquer campo faltante será calculado e identificado como estimativa, sem contar na calibração.</div>')+'</div></div>';
}
function render(){
 const a=summary(),open=a.openMissions,history=a.missions;
 const list=getCareer().missions.slice().reverse();
 let pane=selected?focused(past(selected)):draft?jobForm():jobForm();
 if(selected&&!past(selected)){selected=null;pane=jobForm();}
 const m=state.simbrief;
 const head='<div class="hca-title-row"><div><h2>Career Operations</h2><div class="hca-sub">OFP → Missão → Xbox → Debrief</div></div><div class="hca-actions"><button class="hca-quiet" data-goto="simbrief">SimBrief ↗</button>'+
 (m?'<button class="hca-primary" id="careerUseOFP">+ Missão do OFP</button>':'')+'</div></div>';
 const chart='<div class="hca-panel"><div class="hca-title-row"><h3>Calibração MSFS</h3><span class="hca-chip">'+history.filter(x=>x.observed?.fuelKg!==null).length+' medições</span></div>'+
 '<div class="hca-calib">'+state.fleet.map(air=>{
   const arr=history.filter(x=>x.aircraft===air.id&&x.observed?.fuelKg!==null&&x.economic?.fuelKg>0);
   const ratios=arr.map(x=>x.observed.fuelKg/x.economic.fuelKg).filter(x=>Number.isFinite(x)&&x>0);
   const avg=ratios.length?ratios.reduce((a,b)=>a+b,0)/ratios.length:1;
   return '<div><span>'+esc(air.id)+'</span><div class="hca-track"><i style="width:'+Math.min(100,Math.max(4,avg*50))+'%"></i></div><b>'+(!ratios.length?'—':format((avg-1)*100,1)+'%')+'</b></div>';
 }).join('')+'</div><div class="hca-note">Desvios médios do combustível observado × previsto. Exploratórios; não alteram automaticamente o consumo de referência do 707.</div></div>';
 return '<div class="hca-career">'+(statusMessage?'<div class="hca-status" role="status">'+esc(statusMessage)+'</div>':'')+
 head+stats()+
 '<div class="hca-columns"><div>'+pane+
 '<div class="hca-section"><div class="hca-title-row"><h3>Missões</h3><span class="hca-chip">'+getCareer().missions.length+' registros</span></div>'+
 (list.length?'<div class="hca-missions">'+list.map(missionSummary).join('')+'</div>':'<div class="hca-empty hca-compact">Nenhuma missão aceita.</div>')+
 '</div></div><div><div class="hca-panel"><div class="hca-title-row"><h3>Hangar</h3><span class="hca-chip">PANC</span></div>'+planes()+'</div>'+
 '<div class="hca-panel" style="margin-top:16px"><div class="hca-title-row"><h3>Ledger da carreira</h3></div>'+
 '<div class="hca-ledger"><div><span>Receita reconhecida</span><b>'+usd(a.revenue)+'</b></div><div><span>Custos econômicos</span><b>'+usd(a.expense)+'</b></div><div><span>Contas a receber</span><b>'+usd(a.receivables)+'</b></div><div><span>Contas a pagar</span><b>'+usd(a.payables)+'</b></div><div><span>Estoque consumido</span><b>'+usd(a.stockConsumed)+'</b></div></div>'+
 '<div class="hca-note">Razão de missões fechado separadamente do cenário macroeconômico. Sem dupla contabilização no forecast.</div></div>'+
 '<div style="margin-top:16px">'+chart+'</div></div></div></div>';
}
function getInput(id){return byId(id)?.value??'';}
function makeMission(){
 if(!draft)throw Error('Nenhum OFP selecionado.');
 if(!Number.isFinite(Number(draft.routeNM))||Number(draft.routeNM)<=0)throw Error('OFP sem distância utilizável.');
 if([['towT','mtow'],['zfwT','mzfw'],['ldwT','mlw']].some(([src,lim])=>has(draft[src])&&Number(draft[src])>Number(state.model[lim])+0.001))throw Error('Massas do OFP excedem os limites estruturais de referência.');
 if(has(draft.payloadT)&&Number(draft.payloadT)>Number(state.model.commercialCapT)+0.001)throw Error('Payload excede o limite comercial configurado.');
 const aircraft=getInput('careerAircraft');
 if(!state.fleet.some(a=>a.id===aircraft))throw Error('Aeronave inválida.');
 if(activeFor(aircraft))throw Error('Esta aeronave já possui uma missão em aberto.');
 if(position(aircraft)!==draft.origin)throw Error('A aeronave está em '+position(aircraft)+'. O OFP parte de '+draft.origin+'.');
 if(getCareer().missions.some(m=>ofpKey(m.ofp)===ofpKey(draft)))throw Error('Este OFP já foi vinculado a uma missão. Gere outro plano para uma nova missão.');
 const revenue=Number(getInput('careerRevenue'));
 if(!Number.isFinite(revenue)||revenue<0||revenue>1e9)throw Error('Receita contratada inválida.');
 const planned=estimate(draft);
 const c=getCareer();
 const id='HCA-'+String(c.nextId).padStart(4,'0');
 const m={id,aircraft,status:'planned',ofp:clone(draft),createdAt:new Date().toISOString(),
    client:getInput('careerClient').trim().slice(0,100),revenue,economic:planned,
    received:false,paid:false,notes:'',observed:null,expense:0,payable:0,inventoryUsed:0,hours:0,fuelKg:0};
 c.nextId++;c.missions.push(m);selected=id;draft=null;statusMessage='Contrato aceito e OFP congelado para '+id+'.';save();window.render();
}
function completeMission(){
 const m=past(selected);
 if(!m||m.status!=='planned')throw Error('Missão indisponível para fechamento.');
 const f=getInput('careerFuelKg'), bh=getInput('careerBlockHours'), extra=Number(getInput('careerExtra')||0);
 if(!has(f)&&!has(bh))throw Error('Informe pelo menos consumo ou tempo observado no Xbox.');
 if(has(f)&&(!Number.isFinite(Number(f))||Number(f)<0))throw Error('Combustível inválido.');
 if(has(bh)&&(!Number.isFinite(Number(bh))||Number(bh)<=0))throw Error('Tempo de bloco inválido.');
 if(!Number.isFinite(extra)||extra<0||extra>10000000)throw Error('Despesa adicional inválida.');
 const fuel=has(f)?Number(f):m.economic.fuelKg;
 const hrs=has(bh)?Number(bh):m.economic.hours;
 if(fuel>200000||hrs>40)throw Error('Valores fora dos limites de segurança do formulário.');
 const mod=state.model, density=number(mod.density,3.04);
 const fuelUSD=fuel/Math.max(.1,density)*number(mod.fuelPrice);
 const partsUSD=hrs*number(mod.partsBH);
 const serviceUSD=hrs*(number(mod.flightCrewBH)+number(mod.mntLaborBH))+number(mod.cycleCost)+number(mod.feesRT)/2+extra;
 const expense=fuelUSD+partsUSD+serviceUSD;
 m.observed={fuelKg:has(f)?Number(f):null,blockHours:has(bh)?Number(bh):null,source:'MSFS 2024 Xbox — inserção manual'};
 m.fuelKg=fuel;m.hours=hrs;m.inventoryUsed=partsUSD;m.expense=expense;m.payable=fuelUSD+serviceUSD;
 m.notes=getInput('careerNotes').trim().slice(0,250);m.status='completed';m.completedAt=new Date().toISOString();
 m.costRates={fuelPrice:mod.fuelPrice,density:mod.density,partsBH:mod.partsBH,flightCrewBH:mod.flightCrewBH,mntLaborBH:mod.mntLaborBH,cycleCost:mod.cycleCost,feesRT:mod.feesRT};
 statusMessage='Missão '+m.id+' concluída. Resultado, ciclos, posição e saldos atualizados.';save();window.render();
}
function settle(id,type){
 const m=past(id);if(!m||m.status!=='completed')throw Error('A missão ainda não foi concluída.');
 if(type==='receive'&&!m.received){m.received=true;m.receivedAt=new Date().toISOString();}
 if(type==='pay'&&!m.paid){m.paid=true;m.paidAt=new Date().toISOString();}
 statusMessage='Lançamento de '+(type==='receive'?'recebimento':'pagamento')+' registrado.';
 save();window.render();
}
function overview(){
 const s=sim,a=summary();
 const flight=getCareer().missions.filter(m=>m.status==='planned')[0];
 return '<div class="hca-home"><div class="hca-title-row"><div><h2>Control Center</h2><div class="hca-sub">PANC · Boeing 707-320C · 3 aeronaves</div></div><button class="hca-primary" data-goto="career">Abrir Career →</button></div>'+
 '<div class="hca-stats">'+card('RECEITA · PROJEÇÃO',compact(s.yearRevenue),'Ano 1 · cenário','↗')+
 card('EBITDA · PROJEÇÃO',compact(s.yearEBITDA),'Ano 1 · cenário','◒')+
 card('CAIXA · PROJEÇÃO',compact(s.closingCash),'36 meses · cenário','◎')+
 card('MISSÕES CONCLUÍDAS',format(a.completed),'Histórico da carreira','✈')+'</div>'+
 '<div class="hca-columns hca-homecols"><div class="hca-panel"><div class="hca-title-row"><h3>Cash Flow</h3><span class="hca-chip">Projeção</span></div><canvas id="chartCash" class="chart"></canvas></div>'+
 '<div><div class="hca-panel"><div class="hca-title-row"><h3>Career</h3><button class="hca-link" data-goto="career">Ver missões →</button></div>'+
 (flight?missionSummary(flight):'<div class="hca-empty hca-compact">Importe um OFP para iniciar a carreira.<br><button class="hca-primary" data-goto="simbrief">Importar OFP</button></div>')+
 '</div><div class="hca-panel" style="margin-top:16px"><div class="hca-title-row"><h3>Fleet</h3><button class="hca-link" data-goto="fleet">Detalhes →</button></div>'+planes()+'</div></div></div>'+
 '<div class="hca-footline"><span>Carreira · resultado realizado '+usd(a.profit)+'</span><span>Recebíveis '+usd(a.receivables)+'</span><span>Estimativas econômicas ≠ telemetria Xbox</span></div></div>';
}
function financeStrip(){
 const a=summary();
 return '<div class="hca-panel" style="margin-bottom:14px"><div class="hca-title-row"><h3>Carreira · Lançamentos realizados</h3><span class="hca-chip">Separado da projeção</span></div>'+
 '<div class="hca-mini-grid"><div><small>RESULTADO ACUMULADO</small><strong>'+usd(a.profit)+'</strong></div>'+
 '<div><small>RECEBÍVEIS</small><strong>'+usd(a.receivables)+'</strong></div>'+
 '<div><small>CAIXA Δ</small><strong>'+usd(a.cashDelta)+'</strong></div></div>'+
 '<button class="hca-link" data-goto="career">Abrir ledger →</button></div>';
}
function fleetStrip(){
 const a=summary();
 return '<div class="hca-panel" style="margin-bottom:14px"><div class="hca-title-row"><h3>Frota · Histórico Xbox</h3><span class="hca-chip">'+a.completed+' voos concluídos</span></div>'+
 '<div class="hca-mini-grid">'+state.fleet.map(f=>{
   const rows=a.missions.filter(m=>m.aircraft===f.id);
   return '<div><small>'+esc(f.id)+' · '+esc(position(f.id))+'</small><strong>'+format(sum(rows,'hours'),1)+' BH · '+rows.length+' ciclos</strong></div>';
 }).join('')+'</div>'+
 '<div class="hca-note">Horas e ciclos de carreira registrados; independentes do cenário projetado abaixo. Ainda não alteram intervalos do check certificado.</div></div>';
}
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-career-open]');if(el){selected=el.dataset.careerOpen;draft=null;statusMessage='';window.render();return;}
 const recv=e.target.closest('[data-career-receive]');if(recv){try{settle(recv.dataset.careerReceive,'receive');}catch(err){statusMessage=err.message;window.render();}return;}
 const pay=e.target.closest('[data-career-pay]');if(pay){try{settle(pay.dataset.careerPay,'pay');}catch(err){statusMessage=err.message;window.render();}return;}
 if(e.target.closest('#careerBack')){selected=null;statusMessage='';window.render();return;}
 if(e.target.closest('#careerDiscard')){draft=null;statusMessage='Rascunho descartado. O OFP original permanece no SimBrief.';window.render();return;}
 if(e.target.closest('#careerUseOFP')){openFromOFP(state.simbrief);return;}
});
document.addEventListener('input',e=>{
 if(e.target.id==='careerRevenue'&&draft){const x=byId('careerMarginPreview');if(x)x.textContent=usd(number(e.target.value)-estimate(draft).expense);}
});
document.addEventListener('submit',e=>{
 if(e.target.id==='careerCreateForm'){e.preventDefault();try{makeMission();}catch(err){statusMessage=err.message;window.render();}return;}
 if(e.target.id==='careerDebriefForm'){e.preventDefault();try{completeMission();}catch(err){statusMessage=err.message;window.render();}return;}
});
window.HCACareer={render,summary,overview,openFromOFP,estimate,getCareer,position,financeStrip,fleetStrip};
if(typeof window.render==='function')window.render();
})();