import { colors } from '@/theme/tokens';
import { alpha } from './color';

/** Si en este tiempo no cargan los tiles, se asume sin conexión y se usa el respaldo. */
export const LOAD_TIMEOUT_MS = 6000;

/** Marca de los mensajes del mapa cuando corre en un <iframe> (web). */
export const WEB_BRIDGE_SOURCE = 'tambo-map';

export type MapMessage = { type: 'ready' | 'tiles' | 'error' | 'marker' | 'markerDouble'; id?: string };

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

// Glifos (24×24, Material Design Icons) para los pines de direcciones.
const HOME_PATH = 'M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z';
const OFFICE_PATH =
  'M10,2H14A2,2 0 0,1 16,4V6H20A2,2 0 0,1 22,8V19A2,2 0 0,1 20,21H4C2.89,21 2,20.1 2,19V8C2,6.89 2.89,6 4,6H8V4C8,2.89 8.89,2 10,2M14,6V4H10V6H14Z';

/**
 * Página Leaflet del mapa de web (<iframe srcDoc>). Tiles estándar de OpenStreetMap (sin key)
 * con atribución visible obligatoria. Pines SVG propios. (CARTO se retiró: ahora exige API key.)
 * Se actualiza con window.__update(data) sin recargar; la moto se interpola con
 * requestAnimationFrame. Mensajes hacia la app: ready, tiles, error, marker, markerDouble.
 */
export const buildMapHtml = (interactive: boolean, controlsInset = 0) => `<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<style>
html,body,#map{margin:0;height:100%;background:${colors.surfaceMid};font-family:-apple-system,Roboto,'Segoe UI',sans-serif;-webkit-tap-highlight-color:transparent}
.leaflet-control-attribution{font-size:8px;line-height:12px;padding:0 5px;border-radius:6px 0 0 0;background:${alpha(colors.white, 0.72)}!important;color:${colors.textMuted}}
.leaflet-control-attribution a{color:${colors.textMuted}}
.leaflet-bottom{bottom:${controlsInset}px}
.leaflet-control-zoom{border:none!important;border-radius:12px!important;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.16)!important;margin-right:12px!important;margin-bottom:10px!important}
.leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:40px!important;font-size:20px!important;color:${colors.primary}!important;background:${colors.white}!important;border-bottom:1px solid ${colors.border}!important}
.leaflet-control-zoom a:last-child{border-bottom:none!important}
.mk{position:relative;width:100%;height:100%}
.mk svg{display:block;width:100%;height:100%;filter:drop-shadow(0 3px 3px rgba(0,0,0,.28));transition:transform .2s}
.badge{position:absolute;top:-4px;right:-8px;min-width:16px;padding:0 4px;border-radius:9px;background:${colors.gold};color:${colors.onGold};font-size:9px;line-height:15px;font-weight:800;text-align:center;border:1.5px solid ${colors.white};box-sizing:border-box}
.pill{position:absolute;left:50%;bottom:100%;transform:translate(-50%,-6px);padding:3px 9px;border-radius:12px;background:${colors.white};color:${colors.primaryDark};font-size:11px;line-height:15px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.22)}
.pill .st{color:${colors.goldText};margin-left:4px}
.lbl{position:absolute;left:50%;top:100%;transform:translate(-50%,2px);padding:1px 7px;border-radius:8px;background:${colors.white};color:${colors.primaryDark};font-size:10px;line-height:14px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.user{position:relative;width:18px;height:18px;border-radius:9px;background:${colors.userLocation};border:3px solid ${colors.white};box-sizing:border-box;animation:pulse 1.8s infinite}
.user .lbl{color:${colors.userLocation};transform:translate(-50%,6px)}
@keyframes pulse{0%{box-shadow:0 0 0 0 ${alpha(colors.userLocation, 0.55)}}70%{box-shadow:0 0 0 18px ${alpha(colors.userLocation, 0)}}100%{box-shadow:0 0 0 0 ${alpha(colors.userLocation, 0)}}}
.rider{width:40px;height:40px;border-radius:20px;background:${colors.white};border:3px solid ${colors.gold};box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
</style></head><body><div id="map"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
(function(){
  function post(m){
    if(window.parent && window.parent!==window){ m.source='${WEB_BRIDGE_SOURCE}'; window.parent.postMessage(m,'*'); }
  }
  if(!window.L){ post({type:'error'}); return; }
  var interactive=${interactive};
  var map = L.map('map',{zoomControl:false,attributionControl:true,dragging:interactive,touchZoom:interactive,scrollWheelZoom:interactive,doubleClickZoom:false,boxZoom:false,keyboard:false,zoomSnap:0.5});
  map.attributionControl.setPrefix(false);
  if(interactive) L.control.zoom({position:'bottomright',zoomInTitle:'Acercar',zoomOutTitle:'Alejar'}).addTo(map);
  var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  var notified=false; tiles.on('load',function(){ if(!notified){ notified=true; post({type:'tiles'}); } });
  map.setView([-12.0160,-77.0504],15);
  var markers={}, lines={}, circles={}, fitKey='', focusKey='';
  var C={primary:'${colors.primary}',dark:'${colors.primaryDark}',gold:'${colors.gold}',white:'${colors.white}',office:'${colors.wine}',place:'${colors.outline}'};
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function pin(fill,ring,ringW,glyph){
    return '<svg viewBox="0 0 34 44"><path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.7c0 11.6 15.5 25.8 15.5 25.8s15.5-14.2 15.5-25.8C32.5 8.3 25.6 1.5 17 1.5z" fill="'+fill+'" stroke="'+ring+'" stroke-width="'+ringW+'"/>'+glyph+'</svg>';
  }
  var GLYPH={
    store:'<text x="17" y="23" text-anchor="middle" font-size="17" font-weight="900" font-family="Arial Black,Arial,sans-serif" fill="'+C.white+'">T</text>',
    home:'<path transform="translate(8 7.5) scale(.75)" d="${HOME_PATH}" fill="'+C.white+'"/>',
    office:'<path transform="translate(8.5 8) scale(.7)" d="${OFFICE_PATH}" fill="'+C.white+'"/>',
    place:'<circle cx="17" cy="16.5" r="5" fill="'+C.white+'"/>'
  };
  var FILL={store:C.primary,home:C.dark,office:C.office,place:C.place};
  function icon(m){
    if(m.kind==='user'){
      var ul='<span class="lbl">'+esc(m.label||'Estás aquí')+'</span>';
      return L.divIcon({className:'',html:'<div class="user">'+ul+'</div>',iconSize:[18,18],iconAnchor:[9,9]});
    }
    if(m.kind==='rider') return L.divIcon({className:'',html:'<div class="rider">🛵</div>',iconSize:[40,40],iconAnchor:[20,20]});
    var sel=!!m.selected, w=sel?44:32, h=Math.round(w*44/34);
    var svg=pin(FILL[m.kind]||C.primary, sel?C.gold:C.white, sel?3.5:2.5, GLYPH[m.kind]||GLYPH.place);
    var badge=m.badge?'<span class="badge">'+esc(m.badge)+'</span>':'';
    var extra='';
    if(m.kind==='store'){
      if(sel && m.label) extra='<div class="pill">'+esc(m.label)+(m.rating?'<span class="st">★ '+Number(m.rating).toFixed(1)+'</span>':'')+'</div>';
    } else if(m.label) extra='<span class="lbl">'+esc(m.label)+'</span>';
    return L.divIcon({className:'',html:'<div class="mk">'+svg+badge+extra+'</div>',iconSize:[w,h],iconAnchor:[w/2,h]});
  }
  function zOf(m){ return m.kind==='rider'?1000:m.selected?600:m.kind==='user'?400:0; }
  function animate(mk,to){
    var from=mk.getLatLng(), t0=performance.now(), d=900;
    if(mk._raf) cancelAnimationFrame(mk._raf);
    function step(t){ var k=Math.min(1,(t-t0)/d); mk.setLatLng([from.lat+(to[0]-from.lat)*k, from.lng+(to[1]-from.lng)*k]); if(k<1) mk._raf=requestAnimationFrame(step); }
    mk._raf=requestAnimationFrame(step);
  }
  // Toque simple → marker; dos toques en menos de 300 ms sobre el mismo pin → markerDouble.
  function onTap(id,mk){
    var now=Date.now();
    if(mk._last && now-mk._last<300){ mk._last=0; post({type:'markerDouble',id:id}); }
    else { mk._last=now; post({type:'marker',id:id}); }
  }
  var STYLE={route:{color:C.primary,weight:5,opacity:.45,dashArray:'8 8'},travelled:{color:C.primary,weight:5,opacity:.95},walk:{color:'${colors.userLocation}',weight:4,opacity:.9,dashArray:'2 8'}};
  var CIRCLE={brand:{color:C.primary,weight:1,dashArray:'4 6',fillColor:C.primary,fillOpacity:.05},user:{color:'${colors.userLocation}',weight:1,dashArray:'4 6',fillColor:'${colors.userLocation}',fillOpacity:.06}};
  window.__update=function(d){
    var seen={};
    (d.markers||[]).forEach(function(m){
      seen[m.id]=1; var ll=[m.position.lat,m.position.lng], key=[m.kind,m.label,m.badge,m.selected,m.rating].join('|'), mk=markers[m.id];
      if(!mk){
        mk=L.marker(ll,{icon:icon(m),zIndexOffset:zOf(m),keyboard:false}).addTo(map); mk._key=key;
        (function(id,marker){ marker.on('click',function(){ onTap(id,marker); }); marker.on('dblclick',function(e){ L.DomEvent.stop(e); }); })(m.id,mk);
        markers[m.id]=mk;
      } else {
        if(mk._key!==key){ mk.setIcon(icon(m)); mk._key=key; mk.setZIndexOffset(zOf(m)); }
        if(m.kind==='rider') animate(mk,ll); else mk.setLatLng(ll);
      }
    });
    Object.keys(markers).forEach(function(id){ if(!seen[id]){ map.removeLayer(markers[id]); delete markers[id]; } });
    var seenL={};
    (d.lines||[]).forEach(function(l){ seenL[l.id]=1; var pts=l.points.map(function(p){return [p.lat,p.lng];}); if(lines[l.id]) lines[l.id].setLatLngs(pts).setStyle(STYLE[l.style]); else lines[l.id]=L.polyline(pts,STYLE[l.style]).addTo(map); });
    Object.keys(lines).forEach(function(id){ if(!seenL[id]){ map.removeLayer(lines[id]); delete lines[id]; } });
    var seenC={};
    (d.circles||[]).forEach(function(c){ seenC[c.id]=1; var st=CIRCLE[c.tone||'brand']; if(circles[c.id]) circles[c.id].setLatLng([c.center.lat,c.center.lng]).setRadius(c.radius).setStyle(st); else circles[c.id]=L.circle([c.center.lat,c.center.lng],L.extend({radius:c.radius,interactive:false},st)).addTo(map); });
    Object.keys(circles).forEach(function(id){ if(!seenC[id]){ map.removeLayer(circles[id]); delete circles[id]; } });
    var pad=d.fitPadding||{top:40,bottom:40};
    if(d.fit&&d.fit.length){
      var k=JSON.stringify(d.fit);
      if(k!==fitKey){
        var first=!fitKey; fitKey=k;
        var pts=d.fit.map(function(p){return [p.lat,p.lng];});
        var opts={paddingTopLeft:[40,pad.top],paddingBottomRight:[40,pad.bottom],maxZoom:17};
        if(pts.length===1){ if(first) map.setView(pts[0],16); else map.flyTo(pts[0],16,{duration:.8}); }
        else if(first) map.fitBounds(pts,opts);
        else map.flyToBounds(pts,L.extend({duration:.8},opts));
      }
    }
    if(d.focus){
      var fk=JSON.stringify(d.focus);
      if(fk!==focusKey){ focusKey=fk; map.flyTo([d.focus.point.lat,d.focus.point.lng],d.focus.zoom||Math.max(map.getZoom(),16),{duration:.7}); }
    }
  };
  post({type:'ready'});
})();
</script></body></html>`;
