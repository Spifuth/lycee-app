module.exports=[63219,a=>{"use strict";var b=a.i(87924),c=a.i(72131),d=a.i(8395);let e={idle:{label:"EN ATTENTE",color:"#475569"},"type-url":{label:"✍️  TU TAPES L'URL",color:"#60a5fa"},"dns-query":{label:"❓  RECHERCHE DNS",color:"#a855f7"},"dns-response":{label:"📬  IP TROUVÉE",color:"#a855f7"},"http-request":{label:"🚀  REQUÊTE HTTP",color:"#60a5fa"},"server-processing":{label:"⚙️  SERVEUR EN TRAVAIL",color:"#22c55e"},"http-response":{label:"📨  RÉPONSE HTTP 200",color:"#22c55e"},rendered:{label:"✅  PAGE AFFICHÉE",color:"#4ade80"}},f=[{phase:"type-url",ms:1200,log:{text:"Tu tapes lycee.nebulahost.tech",color:"#60a5fa"}},{phase:"dns-query",ms:1400,log:{text:"Navigateur → DNS : « c'est quelle IP ? »",color:"#a855f7"}},{phase:"dns-response",ms:1200,log:{text:"DNS → Navigateur : 78.46.x.y",color:"#a855f7"}},{phase:"http-request",ms:1400,log:{text:"Navigateur → Serveur : GET /",color:"#60a5fa"}},{phase:"server-processing",ms:1500,log:{text:"Serveur : je prépare le HTML…",color:"#22c55e"}},{phase:"http-response",ms:1400,log:{text:"Serveur → Navigateur : 200 OK + HTML",color:"#22c55e"}},{phase:"rendered",ms:1800,log:{text:"✓ Page affichée à l'écran",color:"#4ade80"}},{phase:"idle",ms:1600,log:{text:"— pause —",color:"#475569"}}],g={idle:{title:"On recommence ?",body:"Le cycle va redémarrer pour que tu puisses revoir chaque étape."},"type-url":{title:"L'URL dans la barre",body:"Tu écris lycee.nebulahost.tech. Le navigateur doit traduire ce nom en IP."},"dns-query":{title:"Question au DNS",body:"Le navigateur demande à un serveur DNS (annuaire du web) à quelle IP correspond ce nom."},"dns-response":{title:"Le DNS répond",body:"Le DNS renvoie l'adresse IP. Le navigateur sait maintenant qui contacter."},"http-request":{title:"GET / vers le serveur",body:"Le navigateur ouvre une connexion TLS (cadenas vert) et envoie une requête HTTP : « donne-moi la page d'accueil »."},"server-processing":{title:"Le serveur bosse",body:"Nginx + FastAPI s'activent : récupère le HTML, ajoute les headers, prépare la réponse."},"http-response":{title:"200 OK",body:"Le serveur renvoie le code 200 (succès) avec le contenu HTML de la page."},rendered:{title:"Affichage",body:"Le navigateur reçoit, parse le HTML, télécharge le CSS/JS, et dessine la page que tu vois."}},h=["HTTP/2","TLS","DNS","TCP/IP","Traefik","nginx","FastAPI"];function i({color:a,size:c=10}){return(0,b.jsxs)("span",{style:{position:"relative",display:"inline-block",width:c,height:c},children:[(0,b.jsx)("span",{style:{position:"absolute",inset:0,borderRadius:"50%",background:a,opacity:.4,animation:"rh-ping 1.2s cubic-bezier(0,0,0.2,1) infinite"}}),(0,b.jsx)("span",{style:{position:"absolute",inset:0,borderRadius:"50%",background:a}})]})}function j({direction:a,color:c,active:d}){let e="right"===a?"›":"‹";return(0,b.jsx)("div",{style:{display:"flex",gap:4,padding:"0 4px",alignItems:"center"},children:[0,1,2].map(a=>(0,b.jsx)("span",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:18,fontWeight:700,color:d?c:"#1e293b",animation:d?`rh-chevron-pulse 0.8s ${.15*a}s ease-in-out infinite alternate`:"none"},children:e},a))})}function k({label:a,detail:c,dotColor:d,active:e,icon:f}){return(0,b.jsxs)("div",{style:{flex:1,background:e?d+"18":"#0d1520",border:`1px solid ${e?d+"66":"#1e293b"}`,borderRadius:10,padding:"12px 10px",transition:"all 0.4s ease",position:"relative",minWidth:0},children:[(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:6,fontFamily:"'JetBrains Mono', monospace",fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:8},children:[(0,b.jsx)(i,{color:e?d:"#1e293b",size:6}),(0,b.jsx)("span",{children:a})]}),(0,b.jsx)("div",{style:{fontSize:22,marginBottom:4},children:f}),(0,b.jsx)("div",{style:{fontFamily:"'JetBrains Mono', monospace",fontSize:11,color:e?"#f1f5f9":"#64748b",wordBreak:"break-word",lineHeight:1.3,transition:"color 0.4s ease"},children:c})]})}a.s(["default",0,function(){let[a,l]=(0,c.useState)(0),[m,n]=(0,c.useState)([]),o=(0,c.useRef)(null),p=(0,d.useAnimControls)();(0,c.useEffect)(()=>{let b=f[a];if(b.log&&n(a=>[{id:Date.now()+Math.random(),text:b.log.text,color:b.log.color},...a].slice(0,12)),!p.paused)return o.current=window.setTimeout(()=>{l(a=>(a+1)%f.length)},b.ms/p.speed),()=>{o.current&&window.clearTimeout(o.current)}},[a,p.speed,p.paused]);let q=f[a].phase,r=e[q],s=g[q],t=["type-url","dns-query","http-request","rendered"].includes(q),u=["dns-query","dns-response"].includes(q),v=["http-request","server-processing","http-response"].includes(q),w="dns-query"===q,x="dns-response"===q,y="http-request"===q,z="http-response"===q;return(0,b.jsxs)("div",{className:"rh-root",children:[(0,b.jsx)("style",{children:`
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
      `}),(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:16,flexWrap:"wrap"},children:[(0,b.jsxs)("span",{className:"rh-badge",style:{background:r.color+"15",border:`1px solid ${r.color}55`,color:r.color,animation:"rh-badge-morph 0.5s ease"},children:[(0,b.jsx)(i,{color:r.color,size:6}),r.label]},q),(0,b.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:10},children:[(0,b.jsx)(d.AnimControls,{ctrl:p,compact:!0}),(0,b.jsxs)("span",{style:{fontSize:10,color:"#475569",letterSpacing:"0.15em"},children:["ÉTAPE ",a+1,"/",f.length]})]})]}),(0,b.jsxs)("div",{className:"rh-grid",children:[(0,b.jsxs)("div",{children:[(0,b.jsxs)("div",{className:"rh-stage",children:[(0,b.jsx)(k,{label:"navigateur",icon:"🌐",detail:"lycee.nebulahost.tech",dotColor:"#3b82f6",active:t}),(0,b.jsx)(j,{direction:w||y?"right":x||z?"left":"right",color:w||x?"#a855f7":"#22c55e",active:w||x}),(0,b.jsx)(k,{label:"DNS",icon:"📖",detail:"annuaire du web",dotColor:"#a855f7",active:u}),(0,b.jsx)(j,{direction:y?"right":z?"left":"right",color:"#22c55e",active:y||z}),(0,b.jsx)(k,{label:"serveur",icon:"🖥️",detail:"lycee-web container",dotColor:"#22c55e",active:v})]}),(0,b.jsxs)("div",{style:{marginTop:14,background:"#0d1520",border:`1px solid ${r.color}33`,borderRadius:10,padding:"12px 14px",animation:"rh-slide-in 0.35s ease"},children:[(0,b.jsx)("div",{style:{fontSize:9,color:"#64748b",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4},children:"CE QUI SE PASSE"}),(0,b.jsx)("div",{style:{fontSize:14,color:"#f1f5f9",marginBottom:4},children:s.title}),(0,b.jsx)("div",{style:{fontSize:12,color:"#94a3b8",lineHeight:1.5},children:s.body})]},q+"-detail")]}),(0,b.jsxs)("div",{children:[(0,b.jsxs)("div",{style:{marginTop:14,background:"#0d1520",border:"1px solid #1e293b",borderRadius:10,padding:12},children:[(0,b.jsx)("div",{style:{fontSize:9,color:"#64748b",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8},children:"LIVE LOG"}),(0,b.jsx)("div",{style:{maxHeight:280,overflow:"hidden"},children:0===m.length?(0,b.jsx)("div",{style:{fontSize:11,color:"#1e293b",padding:4},children:"$ waiting..."}):m.map(a=>(0,b.jsxs)("div",{className:"rh-log-entry",style:{borderLeftColor:a.color,color:"#cbd5e1"},children:[(0,b.jsx)("span",{style:{color:a.color},children:"›"})," ",a.text]},a.id))})]}),(0,b.jsx)("div",{style:{marginTop:14,display:"flex",flexWrap:"wrap",gap:6},children:h.map(a=>(0,b.jsxs)("span",{style:{fontSize:10,color:"#334155",border:"1px solid #1e293b",borderRadius:100,padding:"3px 10px",fontFamily:"'JetBrains Mono', monospace"},children:["#",a]},a))})]})]}),(0,b.jsxs)("div",{style:{marginTop:16,fontSize:10,color:"#475569",textAlign:"center",letterSpacing:"0.05em"},children:["$ animation auto · lycee-app · ",new Date().getFullYear()]})]})}])},36274,function(a){a.n(a.i(63219))},8395,a=>{"use strict";var b=a.i(87924),c=a.i(72131);let d=[.5,1,2];a.s(["AnimControls",0,function({ctrl:a,compact:c=!1}){return(0,b.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 4px",borderRadius:100,background:"#0d1520",border:"1px solid #1e293b",fontFamily:"'JetBrains Mono', monospace"},"aria-label":"Contrôles d'animation",children:[d.map(d=>{let e=a.speed===d&&!a.paused;return(0,b.jsxs)("button",{type:"button",onClick:()=>{a.setSpeed(d),a.paused&&a.togglePause()},title:1===d?"Vitesse normale":`Vitesse \xd7 ${d}`,style:{fontFamily:"inherit",fontSize:c?10:11,fontWeight:700,padding:c?"3px 7px":"4px 9px",borderRadius:100,border:0,cursor:"pointer",background:e?"#38bdf8":"transparent",color:e?"#0a0a0b":"#64748b",transition:"all 0.2s ease"},onMouseEnter:a=>{e||(a.currentTarget.style.color="#cbd5e1")},onMouseLeave:a=>{e||(a.currentTarget.style.color="#64748b")},children:[d,"×"]},d)}),(0,b.jsx)("span",{style:{width:1,height:14,background:"#1e293b",margin:"0 2px"},"aria-hidden":!0}),(0,b.jsx)("button",{type:"button",onClick:a.togglePause,title:a.paused?"Reprendre":"Pause","aria-label":a.paused?"Reprendre":"Pause",style:{fontFamily:"inherit",fontSize:c?11:12,padding:c?"3px 8px":"4px 10px",borderRadius:100,border:0,cursor:"pointer",background:a.paused?"#fbbf24":"transparent",color:a.paused?"#0a0a0b":"#94a3b8",fontWeight:700,transition:"all 0.2s ease"},children:a.paused?"▶":"⏸"})]})},"useAnimControls",0,function(a=1){let[b,d]=(0,c.useState)(a),[e,f]=(0,c.useState)(!1);return{speed:b,paused:e,setSpeed:d,togglePause:()=>f(a=>!a)}}])}];

//# sourceMappingURL=components_animations_1naxk2k._.js.map