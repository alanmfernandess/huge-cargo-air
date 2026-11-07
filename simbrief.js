/* Huge Cargo Air — SimBrief OFP importer, read-only.
   Uses official latest-OFP fetch API on explicit user click only.
   No credentials/API keys; CORS may require manual local JSON/XML import. */
(function () {
  'use strict';
  const api = 'https://www.simbrief.com/api/xml.fetcher.php';
  const qs = (id) => document.getElementById(id);
  const h = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (x) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const n = (v) => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  const pretty = (v, d=0) => Number.isFinite(v) ? v.toLocaleString('pt-BR',{maximumFractionDigits:d}) : '—';
  const get = (o, ...keys) => { for (const k of keys) { if(o && Object.prototype.hasOwnProperty.call(o,k) && o[k] !== '' && o[k] != null) return o[k]; } return null; };
  function nodeObj(node) {
    const els=Array.from(node.children || []);
    if(!els.length) return node.textContent.trim();
    const r={};
    els.forEach(el => {
      const val=nodeObj(el);
      if(Object.prototype.hasOwnProperty.call(r, el.tagName)) {
        if(!Array.isArray(r[el.tagName])) r[el.tagName]=[r[el.tagName]];
        r[el.tagName].push(val);
      } else r[el.tagName]=val;
    });
    return r;
  }
  function parse(text) {
    const t=text.trim();
    if(!t) throw new Error('O arquivo está vazio.');
    if(t[0]==='{') return JSON.parse(t);
    if(t[0]==='<') {
      const xml=new DOMParser().parseFromString(t,'application/xml');
      if(xml.querySelector('parsererror')) throw new Error('XML inválido.');
      return nodeObj(xml.documentElement);
    }
    throw new Error('Importe um OFP em JSON ou XML, não apenas o texto PDF.');
  }
  function normalize(raw) {
    const g=raw.general || {}, w=raw.weights || {}, f=raw.fuel || {}, a=raw.aircraft || {};
    const origin=raw.origin || {}, destination=raw.destination || {};
    const nav=raw.navlog && (raw.navlog.fix || raw.navlog.fixes || raw.navlog);
    const list=Array.isArray(nav) ? nav : nav && typeof nav === 'object' ? [nav] : [];
    const points=list.slice(0,500).map((p,i) => ({
      id:String(get(p,'ident','name') || 'WPT'+(i+1)), stage:String(get(p,'stage') || ''),
      alt:n(get(p,'altitude_feet')), lat:n(get(p,'pos_lat','latitude')), lon:n(get(p,'pos_long','longitude')),
      windDir:n(get(p,'wind_dir')), windSpd:n(get(p,'wind_spd')),
      gs:n(get(p,'groundspeed')), tas:n(get(p,'true_airspeed')),
      legDist:n(get(p,'distance_leg')), totalDist:n(get(p,'distance_total')),
      legFuel:n(get(p,'fuel_leg')), fuelRemain:n(get(p,'fuel_plan_onboard')),
      legTime:get(p,'time_leg'), totalTime:get(p,'time_total'),
      oat:n(get(p,'oat')), mora:n(get(p,'mora')), windComponent:get(p,'wind_component')
    }));
    const units=String(get(raw.params,'units')||'kgs').toLowerCase();
    const toT=(v) => {const x=n(v);return x===null?null:(units.startsWith('lb')?x*0.00045359237:x/1000);};
    const alt=raw.alternate || raw.alternates || null;
    const alternates=Array.isArray(alt)?alt:alt?[alt]:[];
    const s={
      origin:String(get(origin,'icao_code','icao')||'').toUpperCase(),
      destination:String(get(destination,'icao_code','icao')||'').toUpperCase(),
      origRwy:String(get(origin,'plan_rwy')||''),
      destRwy:String(get(destination,'plan_rwy')||''),
      flight:String(get(g,'icao_airline','flight_number')||get(raw.atc,'callsign')||''),
      aircraft:String(get(a,'icaocode','icao_code','name')||''),
      registration:String(get(a,'reg')||''),
      airac:String(get(raw.params,'airac')||''),
      generated:String(get(raw.params,'time_generated')||''),
      route:String(get(g,'route')||get(raw.atc,'route')||''),
      routeNM:n(get(g,'route_distance')),
      initialAltitude:n(get(g,'initial_altitude')),
      avgWind:String(get(g,'avg_wind_comp')||''),
      estBlock:String(get(raw.times,'est_block')||''),
      payloadT:toT(get(w,'payload')),
      zfwT:toT(get(w,'est_zfw')),
      towT:toT(get(w,'est_tow')),
      ldwT:toT(get(w,'est_ldw')),
      rampFuelT:toT(get(f,'plan_ramp')),
      tripFuelT:toT(get(f,'enroute_burn')),
      taxiFuelT:toT(get(f,'taxi')),
      altFuelT:toT(get(f,'alternate_burn')),
      reserveFuelT:toT(get(f,'reserve')),
      extraFuelT:toT(get(f,'extra')),
      origMETAR:String(get(raw.weather||{},'orig_metar')||get(origin,'metar')||''),
      destMETAR:String(get(raw.weather||{},'dest_metar')||get(destination,'metar')||''),
      origTAF:String(get(origin,'taf')||''),
      destTAF:String(get(destination,'taf')||''),
      alternates:alternates.map(x=>({icao:String(get(x,'icao_code','icao')||''),burn:toT(get(x,'burn'))})),
      hasTLR:!!(raw.tlr && typeof raw.tlr==='object' && Object.keys(raw.tlr).length),
      points,
      importedAt:new Date().toISOString(),
      source:'SimBrief OFP — planejamento de simulador'
    };
    if(!/^[A-Z0-9]{4}$/.test(s.origin)||!/^[A-Z0-9]{4}$/.test(s.destination))
      throw new Error('O OFP não contém origem e destino ICAO reconhecíveis.');
    return s;
  }
  function profile(s) {
    const ps=s.points.filter(p=>p.alt!==null);
    if(ps.length<2) return '<div class="muted">Perfil de altitude indisponível no navlog.</div>';
    const maxAlt=Math.max(1000,...ps.map(p=>p.alt));
    const coords=ps.map((p,i)=>(12+i*656/(ps.length-1)).toFixed(1)+','+(142-p.alt/maxAlt*114).toFixed(1)).join(' ');
    return '<svg viewBox="0 0 680 162" role="img" aria-label="Perfil planejado de altitude" style="width:100%;max-height:190px"><path d="M12 142 H668" stroke="#c9d7e2" stroke-width="1"/><polyline points="'+coords+'" fill="none" stroke="#0f8d99" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><text x="14" y="154" fill="#7d8d9e" font-size="12">'+h(s.origin)+'</text><text x="627" y="154" fill="#7d8d9e" font-size="12">'+h(s.destination)+'</text><text x="14" y="15" fill="#68849b" font-size="12">FL'+Math.round(maxAlt/100)+'</text></svg>';
  }
  function kpi(label,value,small) {return '<div class="kpi"><div class="lbl">'+h(label)+'</div><div class="value">'+h(value)+'</div><div class="sub">'+h(small||'')+'</div></div>';}
  function renderPlan(s) {
    const comparable=state.routes.find(r=>r.code===s.destination && s.origin==='PANC');
    const m=state.model, warnings=[];
    if(s.aircraft && !/B70|707|B703|B707/i.test(s.aircraft)) warnings.push('O perfil do OFP pode não corresponder ao Boeing 707-320C.');
    if(s.origin!=='PANC') warnings.push('Origem diferente de PANC; a análise não corresponde diretamente ao hub da companhia.');
    if(s.towT!==null && s.towT>m.mtow) warnings.push('TOW do SimBrief excede o MTOW de referência HCA.');
    if(s.zfwT!==null && s.zfwT>m.mzfw) warnings.push('ZFW do SimBrief excede o MZFW de referência HCA.');
    if(s.ldwT!==null && s.ldwT>m.mlw) warnings.push('LDW do SimBrief excede o MLW de referência HCA.');
    const age=Date.now()-Date.parse(s.generated);
    if(Number.isFinite(age)&&age>24*3600e3) warnings.push('Plano gerado há mais de 24 horas. Meteorologia e NOTAMs podem estar desatualizados.');
    if(s.hasTLR) warnings.push('Existe análise TLR no OFP; não substitui AFM, pista, obstáculos e despacho certificado.');
    const rows=s.points.map((p,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+h(p.id)+'</b></td><td>'+h(p.stage)+'</td><td class="num">'+pretty(p.alt)+'</td><td class="num">'+pretty(p.legDist,1)+'</td><td class="num">'+pretty(p.gs)+'</td><td class="num">'+h(p.windDir===null?'—':pretty(p.windDir)+'°/'+pretty(p.windSpd)+' kt')+'</td><td class="num">'+pretty(p.legFuel,0)+'</td><td class="num">'+pretty(p.fuelRemain,0)+'</td></tr>').join('');
    return '<div class="sectionHead"><div><h2>'+h(s.origin)+' → '+h(s.destination)+'</h2><p>'+h(s.flight)+' · '+h(s.aircraft || 'Aeronave não informada')+' · '+h(s.registration||'Sem matrícula')+' · AIRAC '+h(s.airac||'—')+'</p></div><div class="flex"><span class="pill pending">OFP não certificado</span><button class="hca-primary" id="sbCreateMission">+ Criar missão</button></div></div>'+ 
    '<div class="kpis">'+kpi('Distância planejada',pretty(s.routeNM)+' NM','Trajeto, não ortodrômica')+
      kpi('Payload',pretty(s.payloadT,2)+' t','Valor informado no SimBrief')+
      kpi('Combustível de rampa',pretty(s.rampFuelT,2)+' t','Reservas incluídas conforme OFP')+
      kpi('Peso de decolagem',pretty(s.towT,2)+' t','Limite estrutural de referência: '+pretty(m.mtow,2)+' t')+'</div>'+
    (warnings.length?'<div class="notice warn"><div><b>Alertas:</b> '+warnings.map(h).join(' • ')+'</div></div>':'')+
    '<div class="columns"><section class="panel"><h3>Perfil de altitude planejada</h3>'+profile(s)+'<p class="muted">Vento médio: '+h(s.avgWind||'—')+' · Bloco: '+h(s.estBlock||'—')+'</p></section>'+
    '<section class="panel"><h3>Massas e combustível</h3>'+
    '<div class="statLine"><span>ZFW / TOW / LDW</span><b>'+pretty(s.zfwT,2)+' / '+pretty(s.towT,2)+' / '+pretty(s.ldwT,2)+' t</b></div>'+
    '<div class="statLine"><span>Trip / táxi</span><b>'+pretty(s.tripFuelT,2)+' / '+pretty(s.taxiFuelT,2)+' t</b></div>'+
    '<div class="statLine"><span>Alternado / reserva / extra</span><b>'+pretty(s.altFuelT,2)+' / '+pretty(s.reserveFuelT,2)+' / '+pretty(s.extraFuelT,2)+' t</b></div>'+
    '<div class="statLine"><span>Alternados</span><b>'+h(s.alternates.map(x=>x.icao).join(', ')||'—')+'</b></div>'+
    (comparable&&s.routeNM>0?'<button class="btn main" id="sbApplyDistance" style="margin-top:12px">Aplicar distância à rota HCA '+h(comparable.code)+'</button>':'<p class="muted">Nenhuma rota PANC → destino correspondente no modelo econômico.</p>')+
    '<p class="metricnotes">Aplicar distância atualiza tempo, combustível e custos previstos no HCA. Não altera automaticamente receita, contrato ou peso autorizado.</p></section></div>'+
    '<div class="columns equal" style="margin-top:16px"><section class="panel"><h3>METAR origem</h3><p class="helptext mono">'+h(s.origMETAR||'Não disponível no OFP')+'</p><p class="muted">'+h(s.origTAF||'TAF não incluído')+'</p></section>'+
    '<section class="panel"><h3>METAR destino</h3><p class="helptext mono">'+h(s.destMETAR||'Não disponível no OFP')+'</p><p class="muted">'+h(s.destTAF||'TAF não incluído')+'</p></section></div>'+
    '<details class="hca-navlog"><summary>Navlog ponto a ponto · '+s.points.length+' pontos</summary>'+
    '<section class="panel"><div class="tablewrap" style="max-height:370px;overflow:auto"><table class="data"><thead><tr><th>#</th><th>Fix</th><th>Fase</th><th class="num">Altitude ft</th><th class="num">Trecho NM</th><th class="num">GS kt</th><th class="num">Vento</th><th class="num">Fuel trecho</th><th class="num">Fuel bordo</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<p class="metricnotes">Dados previstos do OFP · não telemetria Xbox. Unidades conforme arquivo original.</p></section></details>'+
    '<section class="panel" style="margin-top:16px"><h3>Rota ATC</h3><p class="helptext mono" style="overflow-wrap:anywhere">'+h(s.route||'Rota textual não disponível')+'</p></section>';
  }
  function render() {
    const user=localStorage.getItem('HCA_SB_USER')||'';
    const s=state.simbrief;
    return '<div class="sectionHead"><div><h2>SimBrief Dispatch</h2><p>Importe o OFP já gerado para analisar rota, combustível, meteorologia e perfil vertical.</p></div><span class="pill pending">Xbox · leitura somente</span></div>'+
    '<section class="panel"><div class="flex"><div class="field" style="flex:2;min-width:190px"><label>Alias SimBrief / Navigraph</label><input id="sbUsername" type="text" autocomplete="off" spellcheck="false" value="'+h(user)+'" placeholder="Seu alias (não a senha)"></div>'+
    '<button class="btn main" id="sbFetch" style="align-self:end">Importar último OFP</button>'+
    '<button class="btn" id="sbFile" style="align-self:end">Importar JSON/XML</button><input type="file" id="sbUpload" class="fileInput" accept=".json,.xml,application/json,text/xml,application/xml">'+
    '<a class="btn" style="align-self:end" href="https://dispatch.simbrief.com/" target="_blank" rel="noopener noreferrer">Abrir SimBrief ↗</a></div>'+
    '<p class="metricnotes">Consulta realizada somente ao clicar. Sem senha ou chave. Se houver bloqueio CORS do navegador, baixe o XML/JSON do OFP e importe o arquivo.</p>'+
    '<p class="muted" id="sbStatus" role="status" aria-live="polite"></p></section>'+
    (s?renderPlan(s):'<div class="panel" style="margin-top:16px;text-align:center;padding:38px"><span class="bigIcon">✈</span><h3>Nenhum OFP carregado</h3><p class="muted">Gere o plano no SimBrief e importe para começar a análise de missão.</p></div>');
  }
  function notify(msg){const x=qs('sbStatus');if(x)x.textContent=msg;}
  function assign(data) {
    const x=normalize(data);
    state.simbrief=x;
    save();
    window.render();
    notify('OFP importado. Informações do SimBrief são previsões, não valores observados no Xbox.');
  }
  document.addEventListener('click', async (ev) => {
    if(ev.target.closest('#sbFile')){qs('sbUpload')?.click();return;}
    if(ev.target.closest('#sbCreateMission')){if(window.HCACareer)window.HCACareer.openFromOFP(state.simbrief);return;}
    if(ev.target.closest('#sbApplyDistance')){
      const s=state.simbrief, r=state.routes.find(r=>r.code===s.destination && s.origin==='PANC');
      if(!r || !Number.isFinite(s.routeNM) || s.routeNM<=0)return;
      r.nm=s.routeNM;
      save();window.render();notify('Distância planejada aplicada à rota '+r.code+'; custos e projeções recalculados.');return;
    }
    if(!ev.target.closest('#sbFetch'))return;
    const user=qs('sbUsername')?.value.trim();
    if(!user || user.length>64 || !/^[\w .@-]+$/u.test(user)){notify('Informe um alias SimBrief válido (sem senha).');return;}
    try {
      localStorage.setItem('HCA_SB_USER',user);
      notify('Importando o OFP mais recente…');
      const url=api+'?username='+encodeURIComponent(user)+'&client=HugeCargoAir-v1&json=v2';
      const res=await fetch(url,{mode:'cors',credentials:'omit',cache:'no-store'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      assign(await res.json());
    }catch(e){
      notify('A consulta não foi concluída ('+e.message+'). O navegador pode bloquear acesso CORS; use Importar JSON/XML. Não houve alteração no plano salvo.');
    }
  });
  document.addEventListener('change',async(ev)=>{
    if(ev.target.id!=='sbUpload')return;
    const file=ev.target.files?.[0];
    if(!file)return;
    try{if(file.size>5_000_000)throw new Error('Arquivo maior que 5 MB.');assign(parse(await file.text()));}
    catch(e){notify('Falha na importação: '+e.message);}
  });
  window.HCASimBrief={render,normalize,parse};
})();
