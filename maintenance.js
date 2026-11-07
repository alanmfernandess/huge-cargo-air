/* HCA Maintenance v2.1 — simulated airframe/12-engine ledger, inventory FIFO and AOG dispatch gates.
  ALL intervals, reliability rates and prices are scenario assumptions, NOT JT3D-approved limits. */
(function(){
'use strict';
const $id=x=>document.getElementById(x);
const h=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=x=>Number.isFinite(Number(x))?Number(x):0;
const fmt=(x,d=0)=>Number.isFinite(x)?x.toLocaleString('pt-BR',{maximumFractionDigits:d}):'—';
const usd=x=>(x<0?'−':'')+'US$ '+fmt(Math.abs(x));
const deep=x=>JSON.parse(JSON.stringify(x));
const skuNames={inspection:'Kit inspeção JT3D',repair:'Kit reparo JT3D'};
const stamp=()=>new Date().toISOString();
let chosen=null,notice='';
function init(){
 const start=Math.max(0,q(state.model.startSpares));
 const kits={inspection:[{qty:6,unitCost:9000}],repair:[{qty:2,unitCost:65000}]};
 const kitValue=6*9000+2*65000;
 const value=start>=kitValue?kitValue:0;
 if(!value){kits.inspection=[];kits.repair=[];}
 const m={version:1,startedAt:stamp(),initialInventoryUSD:start,
  lineUSD:start-value,kits,orders:[],events:[],nextEvent:1,
  settings:{inspectionBH:250,inspectionFC:190,shopBH:2500,shopFC:1750,
    inspectionLaborUSD:6000,aogLaborUSD:25000,shopLaborUSD:200000,
    inspectKitPriceUSD:9000,repairKitPriceUSD:65000,
    faultPer1000EngineBH:1,autoAOG:false,aogDowntimeDays:5,shopDowntimeDays:20},
  engines:state.fleet.flatMap(a=>[1,2,3,4].map(i=>({
    id:a.id+'-E'+i,aircraft:a.id,position:i,runBH:0,runFC:0,
    inspectBH:0,inspectFC:0,shopBH:0,shopFC:0,status:'serviceable',fault:'',faultAt:''
  })))};
 // One-time legacy migration: existing flights are registered without charging expense twice.
 const existing=state.career?.missions?.filter(x=>x.status==='completed')||[];
 for(const flight of existing){
  if(flight.maintenanceApplied)continue;
  const engines=m.engines.filter(e=>e.aircraft===flight.aircraft);
  for(const engine of engines){
    engine.runBH+=q(flight.hours);engine.runFC+=1;
    engine.inspectBH+=q(flight.hours);engine.inspectFC+=1;
    engine.shopBH+=q(flight.hours);engine.shopFC+=1;
  }
  const p=Math.max(0,q(flight.inventoryUsed));
  const fromStock=Math.min(m.lineUSD,p);
  m.lineUSD-=fromStock;
  if(p>fromStock){flight.payable=q(flight.payable)+(p-fromStock);flight.inventoryUsed=fromStock;}
  flight.maintenanceApplied=true;
 }
 return m;
}
function getM(){
 if(!state.maintenance || !Array.isArray(state.maintenance.engines) || state.maintenance.engines.length!==12){
   state.maintenance=init();
 }
 return state.maintenance;
}
function kitQty(sku){return (getM().kits[sku]||[]).reduce((a,b)=>a+q(b.qty),0);}
function kitVal(sku){return (getM().kits[sku]||[]).reduce((a,b)=>a+q(b.qty)*q(b.unitCost),0);}
function inventory(){const m=getM();return Math.max(0,q(m.lineUSD))+kitVal('inspection')+kitVal('repair');}
function consumeKit(sku){
 const arr=getM().kits[sku]||[];
 if(kitQty(sku)<1)throw Error('Sem '+skuNames[sku]+' em estoque. Registre uma compra.');
 const b=arr.find(x=>x.qty>=1);
 if(!b)throw Error('Lote de peças inválido.');
 b.qty-=1;return q(b.unitCost);
}
function nextEvent(type,aircraft,engine,expense,payable,info){
 const m=getM(),id='MNT-'+String(m.nextEvent++).padStart(4,'0');
 const ev={id,type,aircraft:aircraft||null,engine:engine||null,expense:q(expense),payable:q(payable),
  paid:q(payable)===0,createdAt:stamp(),info:info||''};
 m.events.push(ev);return ev;
}
function enginesOf(ac){return getM().engines.filter(x=>x.aircraft===ac);}
function due(e){
 const s=getM().settings;
 const inspect=e.inspectBH>=s.inspectionBH||e.inspectFC>=s.inspectionFC;
 const shop=e.shopBH>=s.shopBH||e.shopFC>=s.shopFC;
 return {inspect,shop};
}
function availability(ac){
 const e=enginesOf(ac),issues=[];
 if(!e.length){return {ready:false,reasons:['Sem motores cadastrados']};}
 for(const engine of e){
  const d=due(engine);
  if(engine.status!=='serviceable')issues.push(engine.id+': '+engine.status.toUpperCase());
  else if(d.shop)issues.push(engine.id+': overhaul vencido');
  else if(d.inspect)issues.push(engine.id+': inspeção vencida');
 }
 return {ready:issues.length===0,reasons:issues,engines:e};
}
function flightCheck(ac,hours){
 const a=availability(ac),estimate=Math.max(0,q(hours))*Math.max(0,q(state.model.partsBH));
 if(q(getM().lineUSD)+.01<estimate)a.reasons.push('Estoque de consumíveis abaixo da reserva por hora estimada');
 return {ready:a.reasons.length===0,reasons:a.reasons};
}
function addFlight(mission){
 getM();
 if(mission.maintenanceApplied)return;
 const hrs=q(mission.hours);
 if(!Number.isFinite(hrs)||hrs<=0)throw Error('Horas de voo inválidas para manutenção.');
 for(const e of enginesOf(mission.aircraft)){
  e.runBH+=hrs;e.inspectBH+=hrs;e.shopBH+=hrs;
  e.runFC+=1;e.inspectFC+=1;e.shopFC+=1;
 }
 const expected=Math.max(0,q(mission.inventoryUsed));
 const consumed=Math.min(Math.max(0,getM().lineUSD),expected);
 getM().lineUSD=Math.max(0,getM().lineUSD-consumed);
 mission.inventoryUsed=consumed;
 const shortage=expected-consumed;
 if(shortage>0){
   mission.payable=q(mission.payable)+shortage;
   nextEvent('Emergency parts expensed',mission.aircraft,null,0,0,'Falta de estoque em '+mission.id+': '+usd(shortage)+' cobrada na missão.');
 }
 mission.maintenanceApplied=true;
 // Optional reproducible postflight fault experiment. Does not represent a measured reliability model.
 if(getM().settings.autoAOG){
  const rate=Math.max(0,q(getM().settings.faultPer1000EngineBH))/1000;
  for(const e of enginesOf(mission.aircraft)){
   let hash=2166136261;
   for(const ch of mission.id+'|'+e.id){hash=Math.imul(hash^ch.charCodeAt(0),16777619);}
   let x=(hash>>>0)/4294967296;
   if(x<1-Math.exp(-rate*hrs)){
     e.status='aog';e.fault='Falha simulada pós-voo';e.faultAt=stamp();
     nextEvent('AOG',e.aircraft,e.id,0,0,'Falha aleatória pós-voo, hipótese experimental '+rate*1000+'/1000 BH.');
   }
  }
 }
}
function reportAOG(id,reason){
 const e=getM().engines.find(x=>x.id===id);
 if(!e)throw Error('Motor não encontrado.');
 if(e.status!=='serviceable')throw Error('Motor indisponível. Regularize o evento existente.');
 e.status='aog';e.fault=String(reason||'Falha não programada').slice(0,160);e.faultAt=stamp();
 nextEvent('AOG',e.aircraft,e.id,0,0,e.fault);
 save();
}
function inspect(id){
 const e=getM().engines.find(x=>x.id===id);
 if(!e||e.status!=='serviceable')throw Error('É necessário liberar primeiro um motor em manutenção.');
 const part=consumeKit('inspection');
 const labor=q(getM().settings.inspectionLaborUSD);
 nextEvent('Inspeção',e.aircraft,e.id,part+labor,labor,'Peça do estoque '+usd(part)+'; mão de obra '+usd(labor));
 e.inspectBH=0;e.inspectFC=0;save();
}
function sendShop(id){
 const e=getM().engines.find(x=>x.id===id);
 if(!e||e.status!=='serviceable')throw Error('Motor indisponível.');
 e.status='shop';e.fault='Revisão em oficina';e.faultAt=stamp();
 nextEvent('Entrada oficina',e.aircraft,e.id,0,0,'Motor indisponível até retorno da oficina.');
 save();
}
function release(id){
 const e=getM().engines.find(x=>x.id===id);
 if(!e||!['aog','shop'].includes(e.status))throw Error('Motor não está em AOG ou oficina.');
 const part=consumeKit('repair'),isShop=e.status==='shop';
 const labor=q(isShop?getM().settings.shopLaborUSD:getM().settings.aogLaborUSD);
 nextEvent(isShop?'Revisão concluída':'Reparo AOG',e.aircraft,e.id,part+labor,labor,
   'Peça de estoque '+usd(part)+'; serviço externo '+usd(labor));
 if(isShop){e.shopBH=0;e.shopFC=0;e.inspectBH=0;e.inspectFC=0;}
 e.status='serviceable';e.fault='';e.faultAt='';save();
}
function purchase(sku,qty){
 const m=getM();qty=q(qty);
 if(!Number.isFinite(qty)||qty<=0)throw Error('Quantidade positiva obrigatória.');
 if(sku==='line'){
   if(qty>1e8)throw Error('Valor da compra excessivo.');
   m.lineUSD+=qty;
   nextEvent('Compra estoque',null,null,0,qty,'Recomposição de consumíveis: '+usd(qty));
 }else if(['inspection','repair'].includes(sku)){
   if(!Number.isInteger(qty)||qty>100)throw Error('A quantidade de kits deve ser um inteiro até 100.');
   const price=q(m.settings[sku==='inspection'?'inspectKitPriceUSD':'repairKitPriceUSD']);
   const val=qty*price;
   m.kits[sku].push({qty,unitCost:price});
   nextEvent('Compra estoque',null,null,0,val,qty+' × '+skuNames[sku]+' a '+usd(price));
 }else throw Error('Tipo de peça inválido.');
 save();
}
function settle(id){
 const e=getM().events.find(x=>x.id===id);
 if(!e||e.paid)throw Error('Fatura inexistente ou já paga.');
 e.paid=true;e.paidAt=stamp();save();
}
function finance(){
 const m=getM(),ev=m.events,initial=q(m.initialInventoryUSD);
 const expenses=ev.reduce((a,x)=>a+q(x.expense),0);
 const payables=ev.reduce((a,x)=>a+q(x.payable),0);
 const paid=ev.filter(x=>x.paid).reduce((a,x)=>a+q(x.payable),0);
 return {expense:expenses,payable:payables,paid,outstanding:payables-paid,
   inventoryUSD:inventory(),inventoryDelta:inventory()-initial,initialInventoryUSD:initial};
}
function fleetStats(){
 const m=getM();
 const ac=state.fleet.map(x=>({id:x.id,...availability(x.id)}));
 return {ac,available:ac.filter(x=>x.ready).length,unavailable:ac.filter(x=>!x.ready).length,
   engines:m.engines.length,groundedEngines:m.engines.filter(x=>x.status!=='serviceable'||due(x).inspect||due(x).shop).length,
   inventoryUSD:inventory(),lineUSD:m.lineUSD,invoiceOpen:m.events.filter(e=>!e.paid&&e.payable>0).length};
}
function stripes(){
 const s=fleetStats();
 return '<div class="hca-mini-grid"><div><small>AERONAVES LIBERADAS*</small><strong>'+s.available+'/3</strong></div>'+
 '<div><small>MOTORES SOB ALERTA</small><strong>'+s.groundedEngines+'/12</strong></div>'+
 '<div><small>ESTOQUE ATUAL</small><strong>'+usd(s.inventoryUSD)+'</strong></div></div>';
}
function engineCard(e){
 const s=getM().settings,d=due(e);
 const red=e.status!=='serviceable'||d.shop||d.inspect;
 const pctBH=Math.min(100,100*e.inspectBH/Math.max(1,s.inspectionBH));
 const pctFC=Math.min(100,100*e.inspectFC/Math.max(1,s.inspectionFC));
 return '<button class="mnt-engine '+(red?'mnt-hold':'')+' '+(chosen===e.id?'mnt-selected':'')+'" data-mnt-select="'+h(e.id)+'" title="'+h(e.id)+' · '+fmt(e.inspectBH,1)+' BH / '+e.inspectFC+' ciclos desde inspeção">'+
 '<span class="mnt-engine-icon">●</span><span class="mnt-engine-name">E'+e.position+'</span>'+
 '<span class="mnt-meter"><i style="width:'+Math.max(pctBH,pctFC)+'%"></i></span>'+
 '<span class="mnt-engine-time">'+fmt(e.runBH,1)+'h</span></button>';
}
function engineDetail(){
 const m=getM();
 const e=m.engines.find(x=>x.id===chosen);
 if(!e)return '<div class="hca-empty hca-compact">Selecione um motor para inspecionar.</div>';
 const s=m.settings,d=due(e);
 return '<div class="mnt-detail"><div class="hca-title-row"><h3>'+h(e.id)+'</h3><span class="hca-chip '+(e.status==='serviceable'&&!d.inspect&&!d.shop?'':'mnt-danger')+'">'+
 (e.status!=='serviceable'?h(e.status.toUpperCase()):d.shop?'SHOP DUE':d.inspect?'CHECK DUE':'ON WING')+'</span></div>'+
 '<div class="hca-mini-grid"><div><small>HORAS CARREIRA</small><strong>'+fmt(e.runBH,1)+' BH</strong></div><div><small>CICLOS CARREIRA</small><strong>'+fmt(e.runFC)+'</strong></div><div><small>DESDE INSPEÇÃO</small><strong>'+fmt(e.inspectBH,1)+' BH / '+e.inspectFC+' FC</strong></div></div>'+
 '<div class="mnt-detail-rows"><div><span>Limite inspeção*</span><b>'+fmt(s.inspectionBH)+' BH / '+fmt(s.inspectionFC)+' FC</b></div>'+
 '<div><span>Desde shop</span><b>'+fmt(e.shopBH,1)+' BH / '+e.shopFC+' FC</b></div>'+
 '<div><span>Limite shop*</span><b>'+fmt(s.shopBH)+' BH / '+fmt(s.shopFC)+' FC</b></div></div>'+
 (e.fault?'<div class="hca-warning">'+h(e.fault)+'</div>':'')+
 '<div class="hca-form-actions">'+
 (e.status==='serviceable'?'<button class="hca-primary" data-mnt-inspect="'+h(e.id)+'">Inspecionar</button><button class="hca-quiet" data-mnt-aog="'+h(e.id)+'">Registrar AOG</button><button class="hca-quiet" data-mnt-shop="'+h(e.id)+'">Enviar shop</button>':
 '<button class="hca-primary" data-mnt-release="'+h(e.id)+'">Concluir '+(e.status==='shop'?'shop':'reparo')+'</button>')+
 '</div><div class="hca-note">*Intervalos e preços são premissas da carreira. Não representam limites JT3D aprovados ou condição real do motor.</div></div>';
}
function render(){
 const m=getM(),fs=fleetStats(),f=finance();
 if(!chosen)chosen=m.engines[0].id;
 const history=m.events.slice().reverse().slice(0,25);
 return '<div class="mnt-board">'+
 '<div class="hca-title-row"><div><h2>Maintenance Control</h2><div class="hca-sub">3 × 707-320C · 12 × JT3D · dados simulados</div></div>'+
 '<span class="hca-chip">'+fs.available+' aeronaves liberadas*</span></div>'+
 (notice?'<div class="hca-status" role="status">'+h(notice)+'</div>':'')+
 '<div class="hca-stats">'+
 stat('ENGINES',fs.engines,fs.groundedEngines+' sob alerta')+
 stat('STOCK',usd(fs.inventoryUSD),'Consumíveis + kits')+
 stat('MAINT. EXPENSE',usd(f.expense),'Reconhecida na carreira')+
 stat('PAYABLES',usd(f.outstanding),fs.invoiceOpen+' faturas em aberto')+'</div>'+
 '<div class="hca-columns"><div><div class="hca-panel"><div class="hca-title-row"><h3>Engine Health</h3><span class="hca-chip">Selecionar motor</span></div>'+
 state.fleet.map(a=>{
 const aStat=availability(a.id),engines=enginesOf(a.id);
 return '<div class="mnt-aircraft"><div class="mnt-ac-head"><div><strong>'+h(a.id)+'</strong> <span>707-320C</span></div><span class="mnt-availability '+(aStat.ready?'':'mnt-danger')+'">'+(aStat.ready?'READY':'GROUNDED')+'</span></div>'+
 '<div class="mnt-engine-row">'+engines.map(engineCard).join('')+'</div></div>';
 }).join('')+
 '<div class="hca-note">Motor em AOG, shop ou inspeção vencida impede aceitar novas missões com a aeronave. Disponibilidade de carreira não é certificação aeronáutica.</div></div>'+
 '<div class="hca-panel" style="margin-top:15px">'+engineDetail()+'</div>'+
 '<div class="hca-panel" style="margin-top:15px"><div class="hca-title-row"><h3>Histórico de manutenção</h3><span class="hca-chip">'+m.events.length+' eventos</span></div>'+
 (history.length?'<div class="mnt-event-list">'+history.map(e=>'<div class="mnt-event"><div><b>'+h(e.type)+'</b><small>'+h(e.engine||e.aircraft||'Estoque')+' · '+h(e.id)+'</small></div>'+
 '<div class="mnt-event-money"><span>'+usd(e.expense)+'</span>'+
 (!e.paid&&e.payable>0?'<button class="hca-link" data-mnt-pay="'+h(e.id)+'">Pagar '+usd(e.payable)+'</button>':'<small>'+(e.payable>0?'Pago ✓':'Sem fatura')+'</small>')+
 '</div></div>').join('')+'</div>':'<div class="hca-empty hca-compact">Sem eventos registrados.</div>')+
 '</div></div>'+
 '<div><div class="hca-panel"><div class="hca-title-row"><h3>Inventory</h3><span class="hca-chip">FIFO</span></div>'+
 '<div class="mnt-stock"><div><span>Consumíveis de linha</span><b>'+usd(m.lineUSD)+'</b></div>'+
 '<div><span>Kit inspeção JT3D</span><b>'+kitQty('inspection')+' un. · '+usd(kitVal('inspection'))+'</b></div>'+
 '<div><span>Kit reparo JT3D</span><b>'+kitQty('repair')+' un. · '+usd(kitVal('repair'))+'</b></div></div>'+
 '<form id="mntStockForm" class="hca-form"><label>Material<select id="mntStockSku"><option value="line">Consumíveis USD</option><option value="inspection">Kit inspeção (un.)</option><option value="repair">Kit reparo (un.)</option></select></label>'+
 '<label>Valor / quantidade<input id="mntStockQuantity" type="number" min="1" step="1" value="1"></label>'+
 '<div class="hca-form-actions"><button class="hca-primary" type="submit">Comprar peças</button></div></form>'+
 '<div class="hca-note">Compra entra no estoque e cria contas a pagar; não é despesa até consumo. Entrega instantânea assumida.</div></div>'+
 '<div class="hca-panel" style="margin-top:15px"><div class="hca-title-row"><h3>Maintenance Policy*</h3><span class="hca-chip">Editável</span></div>'+
 '<div class="hca-form">'+cfg('inspectionBH','Check BH','BH')+cfg('inspectionFC','Check FC','ciclos')+
 cfg('shopBH','Shop BH','BH')+cfg('shopFC','Shop FC','ciclos')+
 cfg('inspectionLaborUSD','Mão de obra check','US$')+
 cfg('aogLaborUSD','Reparo AOG','US$')+
 cfg('shopLaborUSD','Revisão shop','US$')+
 cfg('inspectKitPriceUSD','Novo kit check','US$')+
 cfg('repairKitPriceUSD','Novo kit reparo','US$')+
 cfg('faultPer1000EngineBH','Falhas / 1000 BH','taxa')+
 '<label>Evento automático<select id="mntAutoFault" data-mnt-auto="1"><option value="0" '+(!m.settings.autoAOG?'selected':'')+'>Desativado</option><option value="1" '+(m.settings.autoAOG?'selected':'')+'>Simulado após voo</option></select></label></div>'+
 '<div class="hca-note">*Parâmetros ilustrativos, não prescrições JT3D. Falhas geradas por seed determinística do ID da missão e motor.</div></div></div></div></div>';
}
function cfg(key,label,unit){
 const v=getM().settings[key];return '<label>'+h(label)+' <small>'+h(unit)+'</small><input type="number" data-mnt-setting="'+h(key)+'" min="0.0001" step="any" value="'+h(v)+'"></label>';
}
function stat(label,value,sub){return '<div class="hca-stat"><div class="hca-stat-top"><span>'+h(label)+'</span><span>◈</span></div><strong>'+h(value)+'</strong><small>'+h(sub)+'</small></div>';}
function showError(err){notice='Ação não concluída: '+String(err.message||err);window.render();}
function good(txt){notice=txt;window.render();}
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-mnt-select],[data-mnt-inspect],[data-mnt-aog],[data-mnt-shop],[data-mnt-release],[data-mnt-pay]');
 if(!btn)return;
 const attr=btn.dataset;
 if(attr.mntSelect){chosen=attr.mntSelect;window.render();return;}
 try{
  if(attr.mntInspect){inspect(attr.mntInspect);good('Inspeção lançada e limites reiniciados.');}
  else if(attr.mntAog){reportAOG(attr.mntAog,'AOG registrado manualmente após constatação pelo piloto/gestor.');good('AOG lançado: aeronave indisponível.');}
  else if(attr.mntShop){sendShop(attr.mntShop);good('Motor encaminhado à oficina; aeronave indisponível.');}
  else if(attr.mntRelease){release(attr.mntRelease);good('Motor liberado após serviço e consumo de peças.');}
  else if(attr.mntPay){settle(attr.mntPay);good('Fatura de manutenção liquidada.');}
 }catch(err){showError(err);}
});
document.addEventListener('submit',e=>{
 if(e.target.id!=='mntStockForm')return;
 e.preventDefault();
 try{purchase($id('mntStockSku').value,$id('mntStockQuantity').value);good('Estoque e contas a pagar atualizados.');}
 catch(err){showError(err);}
});
document.addEventListener('change',e=>{
 const key=e.target.dataset.mntSetting;
 if(key){
  try{const v=Number(e.target.value);if(!Number.isFinite(v)||v<=0||v>1e8)throw Error('Valor fora da faixa configurada.');getM().settings[key]=v;save();good('Política de manutenção atualizada.');}
  catch(err){showError(err);}
 }
 if(e.target.dataset.mntAuto){
  getM().settings.autoAOG=e.target.value==='1';save();good('Simulação aleatória '+(getM().settings.autoAOG?'ativada':'desativada')+'.');
 }
});
window.HCAMaintenance={getM,availability,flightCheck,addFlight,finance,fleetStats,render,inventory,kitQty,
 reportAOG,inspect,sendShop,release,purchase,settle,engineDetail};
getM();
if(typeof window.render==='function')window.render();
})();