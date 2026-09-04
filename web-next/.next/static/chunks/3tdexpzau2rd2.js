(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,16436,e=>{"use strict";var r=e.i(43476),t=e.i(71645),o=e.i(36376);let s={idle:{label:"EN ATTENTE",color:"#475569"},"type-url":{label:"✍️  TU TAPES L'URL",color:"#60a5fa"},"dns-query":{label:"❓  RECHERCHE DNS",color:"#a855f7"},"dns-response":{label:"📬  IP TROUVÉE",color:"#a855f7"},"http-request":{label:"🚀  REQUÊTE HTTP",color:"#60a5fa"},"server-processing":{label:"⚙️  SERVEUR EN TRAVAIL",color:"#22c55e"},"http-response":{label:"📨  RÉPONSE HTTP 200",color:"#22c55e"},rendered:{label:"✅  PAGE AFFICHÉE",color:"#4ade80"}},a=[{phase:"type-url",ms:1200,log:{text:"Tu tapes lycee.nebulahost.tech",color:"#60a5fa"}},{phase:"dns-query",ms:1400,log:{text:"Navigateur → DNS : « c'est quelle IP ? »",color:"#a855f7"}},{phase:"dns-response",ms:1200,log:{text:"DNS → Navigateur : 78.46.x.y",color:"#a855f7"}},{phase:"http-request",ms:1400,log:{text:"Navigateur → Serveur : GET /",color:"#60a5fa"}},{phase:"server-processing",ms:1500,log:{text:"Serveur : je prépare le HTML…",color:"#22c55e"}},{phase:"http-response",ms:1400,log:{text:"Serveur → Navigateur : 200 OK + HTML",color:"#22c55e"}},{phase:"rendered",ms:1800,log:{text:"✓ Page affichée à l'écran",color:"#4ade80"}},{phase:"idle",ms:1600,log:{text:"— pause —",color:"#475569"}}],i={idle:{title:"On recommence ?",body:"Le cycle va redémarrer pour que tu puisses revoir chaque étape."},"type-url":{title:"L'URL dans la barre",body:"Tu écris lycee.nebulahost.tech. Le navigateur doit traduire ce nom en IP."},"dns-query":{title:"Question au DNS",body:"Le navigateur demande à un serveur DNS (annuaire du web) à quelle IP correspond ce nom."},"dns-response":{title:"Le DNS répond",body:"Le DNS renvoie l'adresse IP. Le navigateur sait maintenant qui contacter."},"http-request":{title:"GET / vers le serveur",body:"Le navigateur ouvre une connexion TLS (cadenas vert) et envoie une requête HTTP : « donne-moi la page d'accueil »."},"server-processing":{title:"Le serveur bosse",body:"Nginx + FastAPI s'activent : récupère le HTML, ajoute les headers, prépare la réponse."},"http-response":{title:"200 OK",body:"Le serveur renvoie le code 200 (succès) avec le contenu HTML de la page."},rendered:{title:"Affichage",body:"Le navigateur reçoit, parse le HTML, télécharge le CSS/JS, et dessine la page que tu vois."}},n=["HTTP/2","TLS","DNS","TCP/IP","Traefik","nginx","FastAPI"];function l({color:e,size:t=10}){return(0,r.jsxs)("span",{style:{position:"relative",display:"inline-block",width:t,height:t},children:[(0,r.jsx)("span",{style:{position:"absolute",inset:0,borderRadius:"50%",background:e,opacity:.4,animation:"rh-ping 1.2s cubic-bezier(0,0,0.2,1) infinite"}}),(0,r.jsx)("span",{style:{position:"absolute",inset:0,borderRadius:"50%",background:e}})]})}function d({direction:e,color:t,active:o}){let s="right"===e?"›":"‹";return(0,r.jsx)("div",{style:{display:"flex",gap:4,padding:"0 4px",alignItems:"center"},children:[0,1,2].map(e=>(0,r.jsx)("span",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:18,fontWeight:700,color:o?t:"#1e293b",animation:o?`rh-chevron-pulse 0.8s ${.15*e}s ease-in-out infinite alternate`:"none"},children:s},e))})}function c({label:e,detail:t,dotColor:o,active:s,icon:a}){return(0,r.jsxs)("div",{style:{flex:1,background:s?o+"18":"#0d1520",border:`1px solid ${s?o+"66":"#1e293b"}`,borderRadius:10,padding:"12px 10px",transition:"all 0.4s ease",position:"relative",minWidth:0},children:[(0,r.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:6,fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:8},children:[(0,r.jsx)(l,{color:s?o:"#1e293b",size:6}),(0,r.jsx)("span",{children:e})]}),(0,r.jsx)("div",{style:{fontSize:22,marginBottom:4},children:a}),(0,r.jsx)("div",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:11,color:s?"#f1f5f9":"#64748b",wordBreak:"break-word",lineHeight:1.3,transition:"color 0.4s ease"},children:t})]})}e.s(["default",0,function(){let[e,p]=(0,t.useState)(0),[u,g]=(0,t.useState)([]),h=(0,t.useRef)(null),m=(0,o.useAnimControls)();(0,t.useEffect)(()=>{let r=a[e];if(r.log&&g(e=>[{id:Date.now()+Math.random(),text:r.log.text,color:r.log.color},...e].slice(0,12)),!m.paused)return h.current=window.setTimeout(()=>{p(e=>(e+1)%a.length)},r.ms/m.speed),()=>{h.current&&window.clearTimeout(h.current)}},[e,m.speed,m.paused]);let x=a[e].phase,b=s[x],f=i[x],y=["type-url","dns-query","http-request","rendered"].includes(x),v=["dns-query","dns-response"].includes(x),j=["http-request","server-processing","http-response"].includes(x),S="dns-query"===x,T="dns-response"===x,L="http-request"===x,P="http-response"===x;return(0,r.jsxs)("div",{className:"rh-root",children:[(0,r.jsx)("style",{children:`
        @keyframes rh-ping  { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes rh-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes rh-slide-in {
          from { transform: translateY(-8px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes rh-chevron-pulse {
          from { opacity: 0.15; }
          to   { opacity: 1;    }
        }
        @keyframes rh-badge-morph {
          0%   { transform: scaleX(1);    opacity: 1; }
          40%  { transform: scaleX(0.15); opacity: 0; }
          60%  { transform: scaleX(0.15); opacity: 0; }
          100% { transform: scaleX(1);    opacity: 1; }
        }
        .rh-root {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          color: #94a3b8;
          background: #090e16;
          border: 1px solid #1e293b;
          border-radius: 14px;
          padding: 20px 16px;
          max-width: 100%;
        }
        .rh-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          font-family: 'JetBrains Mono', monospace;
          transition: all 0.4s ease;
        }
        .rh-stage {
          display: flex;
          gap: 6px;
          align-items: stretch;
        }
        .rh-log-entry {
          animation: rh-slide-in 0.25s ease;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          background: #0d1520;
          border-left: 2px solid;
          margin-bottom: 4px;
        }
        @media (min-width: 780px) {
          .rh-grid {
            display: grid;
            grid-template-columns: 1.4fr 1fr;
            gap: 16px;
            align-items: start;
          }
        }
      `}),(0,r.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:16,flexWrap:"wrap"},children:[(0,r.jsxs)("span",{className:"rh-badge",style:{background:b.color+"15",border:`1px solid ${b.color}55`,color:b.color,animation:"rh-badge-morph 0.5s ease"},children:[(0,r.jsx)(l,{color:b.color,size:6}),b.label]},x),(0,r.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:10},children:[(0,r.jsx)(o.AnimControls,{ctrl:m,compact:!0}),(0,r.jsxs)("span",{style:{fontSize:10,color:"#475569",letterSpacing:"0.15em"},children:["ÉTAPE ",e+1,"/",a.length]})]})]}),(0,r.jsxs)("div",{className:"rh-grid",children:[(0,r.jsxs)("div",{children:[(0,r.jsxs)("div",{className:"rh-stage",children:[(0,r.jsx)(c,{label:"navigateur",icon:"🌐",detail:"lycee.nebulahost.tech",dotColor:"#3b82f6",active:y}),(0,r.jsx)(d,{direction:S||L?"right":T||P?"left":"right",color:S||T?"#a855f7":"#22c55e",active:S||T}),(0,r.jsx)(c,{label:"DNS",icon:"📖",detail:"annuaire du web",dotColor:"#a855f7",active:v}),(0,r.jsx)(d,{direction:L?"right":P?"left":"right",color:"#22c55e",active:L||P}),(0,r.jsx)(c,{label:"serveur",icon:"🖥️",detail:"lycee-web container",dotColor:"#22c55e",active:j})]}),(0,r.jsxs)("div",{style:{marginTop:14,background:"#0d1520",border:`1px solid ${b.color}33`,borderRadius:10,padding:"12px 14px",animation:"rh-slide-in 0.35s ease"},children:[(0,r.jsx)("div",{style:{fontSize:9,color:"#64748b",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4},children:"CE QUI SE PASSE"}),(0,r.jsx)("div",{style:{fontSize:14,color:"#f1f5f9",marginBottom:4},children:f.title}),(0,r.jsx)("div",{style:{fontSize:12,color:"#94a3b8",lineHeight:1.5},children:f.body})]},x+"-detail")]}),(0,r.jsxs)("div",{children:[(0,r.jsxs)("div",{style:{marginTop:14,background:"#0d1520",border:"1px solid #1e293b",borderRadius:10,padding:12},children:[(0,r.jsx)("div",{style:{fontSize:9,color:"#64748b",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8},children:"LIVE LOG"}),(0,r.jsx)("div",{style:{maxHeight:280,overflow:"hidden"},children:0===u.length?(0,r.jsx)("div",{style:{fontSize:11,color:"#1e293b",padding:4},children:"$ waiting..."}):u.map(e=>(0,r.jsxs)("div",{className:"rh-log-entry",style:{borderLeftColor:e.color,color:"#cbd5e1"},children:[(0,r.jsx)("span",{style:{color:e.color},children:"›"})," ",e.text]},e.id))})]}),(0,r.jsx)("div",{style:{marginTop:14,display:"flex",flexWrap:"wrap",gap:6},children:n.map(e=>(0,r.jsxs)("span",{style:{fontSize:10,color:"#334155",border:"1px solid #1e293b",borderRadius:100,padding:"3px 10px",fontFamily:"'JetBrains Mono', monospace"},children:["#",e]},e))})]})]}),(0,r.jsxs)("div",{style:{marginTop:16,fontSize:10,color:"#475569",textAlign:"center",letterSpacing:"0.05em"},children:["$ animation auto · lycee-app · ",new Date().getFullYear()]})]})}])},22550,function(e){e.n(e.i(16436))},36376,e=>{"use strict";var r=e.i(43476),t=e.i(71645);let o=[.5,1,2];e.s(["AnimControls",0,function({ctrl:e,compact:t=!1}){return(0,r.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 4px",borderRadius:100,background:"#0d1520",border:"1px solid #1e293b",fontFamily:"'JetBrains Mono', monospace"},"aria-label":"Contrôles d'animation",children:[o.map(o=>{let s=e.speed===o&&!e.paused;return(0,r.jsxs)("button",{type:"button",onClick:()=>{e.setSpeed(o),e.paused&&e.togglePause()},title:1===o?"Vitesse normale":`Vitesse \xd7 ${o}`,style:{fontFamily:"inherit",fontSize:t?10:11,fontWeight:700,padding:t?"3px 7px":"4px 9px",borderRadius:100,border:0,cursor:"pointer",background:s?"#38bdf8":"transparent",color:s?"#0a0a0b":"#64748b",transition:"all 0.2s ease"},onMouseEnter:e=>{s||(e.currentTarget.style.color="#cbd5e1")},onMouseLeave:e=>{s||(e.currentTarget.style.color="#64748b")},children:[o,"×"]},o)}),(0,r.jsx)("span",{style:{width:1,height:14,background:"#1e293b",margin:"0 2px"},"aria-hidden":!0}),(0,r.jsx)("button",{type:"button",onClick:e.togglePause,title:e.paused?"Reprendre":"Pause","aria-label":e.paused?"Reprendre":"Pause",style:{fontFamily:"inherit",fontSize:t?11:12,padding:t?"3px 8px":"4px 10px",borderRadius:100,border:0,cursor:"pointer",background:e.paused?"#fbbf24":"transparent",color:e.paused?"#0a0a0b":"#94a3b8",fontWeight:700,transition:"all 0.2s ease"},children:e.paused?"▶":"⏸"})]})},"useAnimControls",0,function(e=1){let[r,o]=(0,t.useState)(e),[s,a]=(0,t.useState)(!1);return{speed:r,paused:s,setSpeed:o,togglePause:()=>a(e=>!e)}}])}]);