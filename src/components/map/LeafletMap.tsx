import { useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import WebViewBase from 'react-native-webview';
import { colors } from '@/theme/tokens';
import type { MapProps } from './types';

type WebViewHandle = { injectJavaScript: (script: string) => void };
type WebViewMessage = { nativeEvent: { data: string } };
/**
 * Los tipos de react-native-webview 14.0.1 intersectan las props de iOS/Android/Windows y con
 * los tipos de RN 0.88 resultan en `never`. Se tipa solo lo que usamos (el runtime no cambia).
 */
const WebView = WebViewBase as unknown as ComponentType<{
  ref?: Ref<WebViewHandle>;
  source: { html: string };
  originWhitelist?: string[];
  onMessage?: (e: WebViewMessage) => void;
  onError?: () => void;
  javaScriptEnabled?: boolean;
  scrollEnabled?: boolean;
  bounces?: boolean;
  overScrollMode?: 'always' | 'content' | 'never';
  setSupportMultipleWindows?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/** Si en este tiempo no cargan los tiles, se asume sin conexión y se usa el respaldo. */
const LOAD_TIMEOUT_MS = 6000;

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

/**
 * Página Leaflet embebida. Tiles CARTO light sobre datos OSM (atribución visible obligatoria).
 * Se actualiza con window.__update(data) sin recargar; la moto se interpola con
 * requestAnimationFrame para moverse suave aunque los datos lleguen cada segundo.
 */
const html = (interactive: boolean) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<style>
html,body,#map{margin:0;height:100%;background:${colors.surfaceMid};font-family:-apple-system,Roboto,sans-serif}
.leaflet-control-attribution{font-size:9px}
.mk{display:flex;flex-direction:column;align-items:center}
.pin{width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;font-size:17px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.store .pin{background:${colors.primary}}
.store.sel .pin{background:${colors.gold};border-color:${colors.primary};transform:scale(1.15)}
.home .pin{background:${colors.primaryDark}}
.rider .pin{width:40px;height:40px;border-radius:20px;background:#fff;border-color:${colors.gold};font-size:22px}
.lbl{margin-top:2px;padding:1px 6px;border-radius:8px;background:#fff;color:${colors.primaryDark};font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.badge{position:absolute;top:-6px;right:-10px;padding:0 4px;border-radius:8px;background:${colors.gold};color:#1a1a1a;font-size:9px;font-weight:800;border:1px solid #fff}
.user{width:18px;height:18px;border-radius:9px;background:${colors.userLocation};border:3px solid #fff;box-shadow:0 0 0 0 rgba(30,136,229,.6);animation:pulse 1.8s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(30,136,229,.55)}70%{box-shadow:0 0 0 16px rgba(30,136,229,0)}100%{box-shadow:0 0 0 0 rgba(30,136,229,0)}}
</style></head><body><div id="map"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
(function(){
  function post(m){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  if(!window.L){ post({type:'error'}); return; }
  var map = L.map('map',{zoomControl:false,attributionControl:true,dragging:${interactive},touchZoom:${interactive},scrollWheelZoom:false,doubleClickZoom:${interactive},boxZoom:false,keyboard:false,tap:true});
  map.attributionControl.setPrefix(false);
  var tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd',attribution:'© OpenStreetMap contributors © CARTO'}).addTo(map);
  var notified=false; tiles.on('load',function(){ if(!notified){ notified=true; post({type:'tiles'}); } });
  map.setView([-12.1218,-77.0304],15);
  var markers={}, lines={}, circles={}, fitKey='';
  var EMOJI={store:'🏪',home:'🏠',rider:'🛵'};
  function icon(m){
    if(m.kind==='user') return L.divIcon({className:'',html:'<div class="user"></div>',iconSize:[18,18],iconAnchor:[9,9]});
    var badge=m.badge?'<span class="badge">'+m.badge+'</span>':'';
    var label=m.label?'<div class="lbl">'+m.label+'</div>':'';
    var h='<div class="mk '+m.kind+(m.selected?' sel':'')+'"><div class="pin" style="position:relative">'+EMOJI[m.kind]+badge+'</div>'+label+'</div>';
    var s=m.kind==='rider'?40:34; return L.divIcon({className:'',html:h,iconSize:[s,s],iconAnchor:[s/2,s/2]});
  }
  function animate(mk,to){
    var from=mk.getLatLng(), t0=performance.now(), d=900;
    if(mk._raf) cancelAnimationFrame(mk._raf);
    function step(t){ var k=Math.min(1,(t-t0)/d); mk.setLatLng([from.lat+(to[0]-from.lat)*k, from.lng+(to[1]-from.lng)*k]); if(k<1) mk._raf=requestAnimationFrame(step); }
    mk._raf=requestAnimationFrame(step);
  }
  var STYLE={route:{color:'${colors.primary}',weight:5,opacity:.45,dashArray:'8 8'},travelled:{color:'${colors.primary}',weight:5,opacity:.95},walk:{color:'${colors.userLocation}',weight:4,opacity:.9,dashArray:'2 8'}};
  window.__update=function(d){
    var seen={};
    (d.markers||[]).forEach(function(m){
      seen[m.id]=1; var ll=[m.position.lat,m.position.lng], key=m.kind+m.label+m.badge+m.selected, mk=markers[m.id];
      if(!mk){ mk=L.marker(ll,{icon:icon(m),zIndexOffset:m.kind==='rider'?1000:(m.selected?500:0)}).addTo(map); mk._key=key; mk.on('click',function(){ post({type:'marker',id:m.id}); }); markers[m.id]=mk; }
      else { if(mk._key!==key){ mk.setIcon(icon(m)); mk._key=key; mk.setZIndexOffset(m.kind==='rider'?1000:(m.selected?500:0)); } if(m.kind==='rider') animate(mk,ll); else mk.setLatLng(ll); }
    });
    Object.keys(markers).forEach(function(id){ if(!seen[id]){ map.removeLayer(markers[id]); delete markers[id]; } });
    var seenL={};
    (d.lines||[]).forEach(function(l){ seenL[l.id]=1; var pts=l.points.map(function(p){return [p.lat,p.lng];}); if(lines[l.id]) lines[l.id].setLatLngs(pts).setStyle(STYLE[l.style]); else lines[l.id]=L.polyline(pts,STYLE[l.style]).addTo(map); });
    Object.keys(lines).forEach(function(id){ if(!seenL[id]){ map.removeLayer(lines[id]); delete lines[id]; } });
    var seenC={};
    (d.circles||[]).forEach(function(c){ seenC[c.id]=1; if(circles[c.id]) circles[c.id].setLatLng([c.center.lat,c.center.lng]).setRadius(c.radius); else circles[c.id]=L.circle([c.center.lat,c.center.lng],{radius:c.radius,color:'${colors.primary}',weight:1.5,fillColor:'${colors.primary}',fillOpacity:.08}).addTo(map); });
    Object.keys(circles).forEach(function(id){ if(!seenC[id]){ map.removeLayer(circles[id]); delete circles[id]; } });
    if(d.fit&&d.fit.length){ var k=JSON.stringify(d.fit); if(k!==fitKey){ fitKey=k; if(d.fit.length===1) map.setView([d.fit[0].lat,d.fit[0].lng],16); else map.fitBounds(d.fit.map(function(p){return [p.lat,p.lng];}),{padding:[40,40],maxZoom:17}); } }
  };
  post({type:'ready'});
})();
</script></body></html>`;

export function LeafletMap({ height, interactive = true, onMarkerPress, onFail, markers, lines, circles, fit }: MapProps) {
  const ref = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const source = useMemo(() => ({ html: html(interactive) }), [interactive]);
  const payload = JSON.stringify({ markers, lines, circles, fit });

  // Sin tiles en LOAD_TIMEOUT_MS → sin conexión: el padre muestra el mapa de respaldo.
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => onFail?.(), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loaded, onFail]);

  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(`window.__update && window.__update(${payload}); true;`);
  }, [ready, payload]);

  const onMessage = (e: WebViewMessage) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; id?: string };
      if (msg.type === 'ready') setReady(true);
      else if (msg.type === 'tiles') setLoaded(true);
      else if (msg.type === 'error') onFail?.();
      else if (msg.type === 'marker' && msg.id) onMarkerPress?.(msg.id);
    } catch {
      // Mensajes ajenos al puente: se ignoran.
    }
  };

  return (
    <View style={{ height, backgroundColor: colors.surfaceMid }}>
      <WebView
        ref={ref}
        source={source}
        originWhitelist={['*']}
        onMessage={onMessage}
        onError={() => onFail?.()}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={{ backgroundColor: 'transparent' }}
      />
      {!loaded && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMid,
  },
});
