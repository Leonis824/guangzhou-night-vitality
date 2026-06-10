const C={bg:"#07111f",panel:"#0d1b2b",text:"#e8eef7",muted:"#9fb0c3",teal:"#5fd0c4",amber:"#f2b84b"};
const style="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const S={maps:{},page:"evidence",mode:"building"};
const $=id=>document.getElementById(id);
const fmtHour=h=>String(h).padStart(2,"0")+":00";
const plotLayout=title=>({title:{text:title,font:{size:16}},paper_bgcolor:C.panel,plot_bgcolor:C.panel,font:{color:C.text,family:"DM Sans"},margin:{l:52,r:18,t:52,b:46},legend:{orientation:"h",y:-.2},xaxis:{gridcolor:"#233a53"},yaxis:{gridcolor:"#233a53"}});
const opt=(el,items,label=x=>x,value=x=>x)=>{el.innerHTML=items.map(x=>`<option value="${value(x)}">${label(x)}</option>`).join("")};
const metrics=(el,items)=>el.innerHTML=items.map(x=>`<div class="metric"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join("");
const indexBy=(rows,key=0)=>new Map(rows.map(r=>[r[key],r]));
const scenarioIndex=(rows)=>new Map(rows.map(r=>[`${r[0]}|${r[1]}`,r]));

Promise.all(["metadata.json","grids.geojson","evidence.json","grid_scenarios.json","buildings.json","building_scenarios.json"].map(n=>fetch(`data/${n}`).then(r=>r.json()))).then(([meta,grids,evidence,gridScenarios,buildings,buildingScenarios])=>{
  Object.assign(S,{meta,grids,evidence,gridScenarios,buildings,buildingScenarios,evidenceById:indexBy(evidence),buildingById:indexBy(buildings),gridScenarioByKey:scenarioIndex(gridScenarios),buildingScenarioByKey:scenarioIndex(buildingScenarios)});
  $("loading").classList.add("hidden");$("evidence-page").classList.remove("hidden");
  setupNavigation();setupControls();renderEvidence();renderBuilding();
}).catch(e=>{$("loading").textContent="Could not load the public data package: "+e.message});

function setupNavigation(){
  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.page=b.dataset.page;document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$(`${S.page}-page`).classList.remove("hidden");setTimeout(()=>Object.values(S.maps).forEach(m=>m?.resize()),50)});
  document.querySelectorAll(".mode-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".mode-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.mode=b.dataset.mode;document.querySelectorAll(".mode").forEach(x=>x.classList.add("hidden"));$(`${S.mode}-mode`).classList.remove("hidden");if(S.mode==="grid")renderGrid();if(S.mode==="suitability")renderSuitability();setTimeout(()=>Object.values(S.maps).forEach(m=>m?.resize()),50)});
}
function setupControls(){
  ["ev-area","bc-area","gi-area","ls-area"].forEach(id=>opt($(id),S.meta.areas));
  ["ev-hour","ls-hour"].forEach(id=>opt($(id),S.meta.hours,fmtHour));
  ["gi-scenario"].forEach(id=>opt($(id),Object.entries(S.meta.gridScenarios),x=>x[1].name,x=>x[0]));
  opt($("bc-scenario"),Object.entries(S.meta.buildingConversions),x=>x[1].name,x=>x[0]);
  ["ev-area","ev-hour"].forEach(id=>$(id).onchange=renderEvidence);
  $("bc-area").onchange=()=>{populateBuildingFunctions();renderBuilding()};$("bc-function").onchange=()=>{populateBuildings();renderBuilding()};$("bc-building").onchange=renderBuilding;$("bc-scenario").onchange=renderBuilding;
  ["gi-area","gi-grid","gi-scenario"].forEach(id=>$(id).onchange=()=>{if(id==="gi-area")populateGrids();renderGrid()});
  ["ls-type","ls-area","ls-scenario","ls-hour"].forEach(id=>$(id).onchange=()=>{if(id==="ls-type")populateSuitabilityScenarios();renderSuitability()});
  populateBuildingFunctions();populateGrids();populateSuitabilityScenarios();
}
function gridsForArea(area){return S.evidence.filter(r=>r[1]===area)}
function buildingsForArea(area){return S.buildings.filter(r=>r[2]===area)}
function populateBuildingFunctions(){const rows=buildingsForArea($("bc-area").value);opt($("bc-function"),["All",...new Set(rows.map(r=>r[7]))]);populateBuildings()}
function populateBuildings(){let rows=buildingsForArea($("bc-area").value);if($("bc-function").value!=="All")rows=rows.filter(r=>r[7]===$("bc-function").value);rows.sort((a,b)=>b[5]-a[5]);opt($("bc-building"),rows.slice(0,600),r=>`Building ${r[0]} · ${r[7]} · ${Math.round(r[5]).toLocaleString()} m²`,r=>r[0])}
function populateGrids(){opt($("gi-grid"),gridsForArea($("gi-area").value),r=>`Grid ${r[0]}`,r=>r[0])}
function populateSuitabilityScenarios(){const building=$("ls-type").value==="building",source=building?S.meta.buildingConversions:S.meta.gridScenarios;opt($("ls-scenario"),Object.entries(source),x=>x[1].name,x=>x[0])}

function areaFeatures(area){return {...S.grids,features:S.grids.features.filter(f=>f.properties.area_name===area)}}
function bbox(geo){const c=[];const walk=x=>{if(Array.isArray(x)&&typeof x[0]==="number")c.push(x);else if(Array.isArray(x))x.forEach(walk)};geo.features.forEach(f=>walk(f.geometry.coordinates));return c.reduce((b,p)=>[[Math.min(b[0][0],p[0]),Math.min(b[0][1],p[1])],[Math.max(b[1][0],p[0]),Math.max(b[1][1],p[1])]],[[180,90],[-180,-90]])}
function gridMap(container,area,values,selected=null){
  S.maps[container]?.remove();const geo=areaFeatures(area);const map=new maplibregl.Map({container,style,center:[113.3,23.12],zoom:11});
  S.maps[container]=map;map.addControl(new maplibregl.NavigationControl(),"top-right");map.on("load",()=>{map.addSource("grids",{type:"geojson",data:geo,promoteId:"grid_id"});map.addLayer({id:"fills",type:"fill",source:"grids",paint:{"fill-color":["interpolate",["linear"],["coalesce",["feature-state","v"],0],-5,"#8b3a62",0,"#25364a",5,"#5fd0c4",15,"#f2b84b",30,"#fff3c4"],"fill-opacity":.82}});map.addLayer({id:"lines",type:"line",source:"grids",paint:{"line-color":["case",["boolean",["feature-state","selected"],false],"#ffffff","#50657b"],"line-width":["case",["boolean",["feature-state","selected"],false],3,.35]}});values.forEach(([id,v])=>map.setFeatureState({source:"grids",id},{v,selected:String(id)===String(selected)}));map.fitBounds(bbox(geo),{padding:28,duration:0});map.on("click","fills",e=>new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<strong>Grid ${e.features[0].properties.grid_id}</strong><br>Value: ${(e.features[0].state.v??0).toFixed(2)}`).addTo(map))});return map
}
function pointMap(container,rows,selected=null,valueIndex=null){
  S.maps[container]?.remove();const features=rows.map(r=>({type:"Feature",properties:{id:r[0],v:valueIndex===null?0:r[valueIndex],selected:String(r[0])===String(selected),label:`Building ${r[0]}`},geometry:{type:"Point",coordinates:[r[4],r[3]]}}));const geo={type:"FeatureCollection",features};const map=new maplibregl.Map({container,style,center:[113.3,23.12],zoom:11});S.maps[container]=map;map.addControl(new maplibregl.NavigationControl(),"top-right");map.on("load",()=>{map.addSource("points",{type:"geojson",data:geo});map.addLayer({id:"points",type:"circle",source:"points",paint:{"circle-radius":["case",["get","selected"],10,["interpolate",["linear"],["coalesce",["get","v"],0],0,4,8,10]],"circle-color":["interpolate",["linear"],["coalesce",["get","v"],0],-3,"#8b3a62",0,"#5d7185",5,"#5fd0c4",15,"#f2b84b"],"circle-stroke-color":["case",["get","selected"],"#fff","#17283a"],"circle-stroke-width":["case",["get","selected"],3,1],"circle-opacity":.85}});if(features.length)map.fitBounds(features.reduce((b,f)=>[[Math.min(b[0][0],f.geometry.coordinates[0]),Math.min(b[0][1],f.geometry.coordinates[1])],[Math.max(b[1][0],f.geometry.coordinates[0]),Math.max(b[1][1],f.geometry.coordinates[1])]],[[180,90],[-180,-90]]),{padding:35,duration:0});map.on("click","points",e=>new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<strong>${e.features[0].properties.label}</strong><br>Predicted change: ${(e.features[0].properties.v??0).toFixed(2)}`).addTo(map))});return map
}

function renderEvidence(){
  const area=$("ev-area").value,h=+$("ev-hour").value,hi=S.meta.hours.indexOf(h),rows=gridsForArea(area),vals=rows.map(r=>[r[0],r[2][hi]]),mean=vals.reduce((a,x)=>a+x[1],0)/vals.length,positive=vals.filter(x=>x[1]>0).length/vals.length;
  metrics($("ev-metrics"),[["Mean BA",mean.toFixed(2)],["Active grids",(positive*100).toFixed(0)+"%"],["Mean night POI",Math.round(rows.reduce((a,r)=>a+r[3],0)/rows.length)],["Grid count",rows.length.toLocaleString()]]);
  gridMap("evidence-map",area,vals);
  const profile=S.meta.hours.map((_,i)=>rows.reduce((a,r)=>a+r[2][i],0)/rows.length);
  Plotly.newPlot("evidence-profile",[{x:S.meta.hours.map(fmtHour),y:profile,type:"scatter",mode:"lines+markers",line:{color:C.teal,width:3}}],plotLayout("Average Night Vitality Profile"),{responsive:true,displayModeBar:false});
  Plotly.newPlot("model-chart",[{x:S.meta.modelComparison.map(x=>x.model),y:S.meta.modelComparison.map(x=>x.rmse_mean),type:"bar",marker:{color:[C.muted,C.teal,C.amber]}}],plotLayout("Leave-One-Area-Out RMSE"),{responsive:true,displayModeBar:false});
  const shap=[...S.meta.globalShap].reverse();Plotly.newPlot("shap-chart",[{x:shap.map(x=>x.mean_abs_shap),y:shap.map(x=>x.feature.replaceAll("_"," ")),type:"bar",orientation:"h",marker:{color:C.teal}}],plotLayout("Global SHAP Importance"),{responsive:true,displayModeBar:false});
}
function scenarioMetrics(el,base,change){const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;metrics(el,[["Mean baseline",mean(base).toFixed(2)],["Mean scenario",(mean(base)+mean(change)).toFixed(2)],["Mean predicted change",(mean(change)>=0?"+":"")+mean(change).toFixed(2)],["Positive-change hours",change.filter(x=>x>0).length+" / 13"]])}
function lineChart(el,title,base,change,observed=null){const traces=[];if(observed)traces.push({x:S.meta.hours.map(fmtHour),y:observed,name:"Observed BA",type:"scatter",line:{color:C.muted,dash:"dot"}});traces.push({x:S.meta.hours.map(fmtHour),y:base,name:"Baseline prediction",type:"scatter",line:{color:C.teal}},{x:S.meta.hours.map(fmtHour),y:base.map((x,i)=>x+change[i]),name:"Scenario prediction",type:"scatter",line:{color:C.amber,width:3}});Plotly.newPlot(el,traces,plotLayout(title),{responsive:true,displayModeBar:false})}
function renderBuilding(){
  if(!$("bc-building").value)return;const id=+$("bc-building").value,sid=$("bc-scenario").value,b=S.buildingById.get(id),p=S.buildingScenarioByKey.get(`${id}|${sid}`),ev=S.evidenceById.get(b[1]);
  scenarioMetrics($("bc-metrics"),p[2],p[3]);pointMap("building-map",buildingsForArea(b[2]),id);lineChart("bc-chart",`${b[7]} → ${S.meta.buildingConversions[sid].name} · Grid ${b[1]}`,p[2],p[3],ev[2]);
  $("bc-details").innerHTML=`<h3>Building ${id} · Conversion Evidence</h3><div class="detail-grid"><div><small>Current inferred use</small><strong>${b[7]}</strong></div><div><small>Inference confidence</small><strong>${b[8]}</strong></div><div><small>Building footprint</small><strong>${Math.round(b[5]).toLocaleString()} m²</strong></div><div><small>Receiving grid</small><strong>${b[1]}</strong></div><div><small>Model range clipping</small><strong>${(p[4]*100).toFixed(0)}%</strong></div><div><small>Function evidence</small><strong>${b[9]}</strong></div></div><p>The source building dataset has no official function field. The conversion is translated into changes in its receiving grid; it does not estimate building footfall or surrounding spillover.</p>`;
}
function renderGrid(){
  const gid=+$("gi-grid").value,sid=$("gi-scenario").value,p=S.gridScenarioByKey.get(`${gid}|${sid}`),ev=S.evidenceById.get(gid);if(!p)return;
  scenarioMetrics($("gi-metrics"),p[2],p[3]);gridMap("grid-map",$("gi-area").value,gridsForArea($("gi-area").value).map(r=>[r[0],r[0]===gid?p[3][4]:0]),gid);lineChart("gi-chart",`${S.meta.gridScenarios[sid].name} · Grid ${gid}`,p[2],p[3],ev[2]);
}
function renderSuitability(){
  const type=$("ls-type").value,area=$("ls-area").value,sid=$("ls-scenario").value,hi=S.meta.hours.indexOf(+$("ls-hour").value);let ranks=[];
  if(type==="grid"){ranks=gridsForArea(area).map(r=>{const p=S.gridScenarioByKey.get(`${r[0]}|${sid}`);return [r[0],p?p[3][hi]:0]});gridMap("suitability-map",area,ranks);ranks.sort((a,b)=>b[1]-a[1]);$("ranking").innerHTML=ranks.slice(0,15).map((r,i)=>`<div class="rank-row"><strong>${i+1}</strong><span>Grid ${r[0]}</span><strong>${r[1]>=0?"+":""}${r[1].toFixed(2)}</strong></div>`).join("")}
  else{const rows=buildingsForArea(area).map(b=>{const p=S.buildingScenarioByKey.get(`${b[0]}|${sid}`);return [...b,p?p[3][hi]:0]});pointMap("suitability-map",rows,null,11);rows.sort((a,b)=>b[11]-a[11]);$("ranking").innerHTML=rows.slice(0,15).map((r,i)=>`<div class="rank-row"><strong>${i+1}</strong><span>Building ${r[0]} · ${r[7]}</span><strong>${r[11]>=0?"+":""}${r[11].toFixed(2)}</strong></div>`).join("")}
}
