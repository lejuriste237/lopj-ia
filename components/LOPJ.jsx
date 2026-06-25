import { useState, useEffect, useCallback } from "react";

const LEXIQUE_BASE = [
  {terme:"Acquittement",src:"Général",def:"Décision par laquelle une juridiction répressive déclare un accusé non coupable des faits qui lui sont reprochés. L'acquittement est prononcé lorsque la preuve de la culpabilité n'est pas rapportée au-delà de tout doute raisonnable (in dubio pro reo)."},
  {terme:"Action publique",src:"Général",def:"Action en justice exercée au nom de la société par le Ministère Public devant les juridictions répressives, en cas d'infraction à la loi pénale. Elle vise à réprimer l'atteinte à l'ordre social par le prononcé d'une peine."},
  {terme:"Action civile",src:"Général",def:"Action exercée par la victime d'une infraction pour obtenir réparation du préjudice subi. Elle peut être exercée devant les juridictions civiles ou jointe à l'action publique devant les juridictions pénales."},
  {terme:"Alibi",src:"Général",def:"Moyen de défense par lequel un accusé prouve qu'il se trouvait ailleurs que sur les lieux de l'infraction au moment de sa commission."},
  {terme:"Amnistie",src:"Général",def:"Mesure législative effaçant certaines infractions et annulant rétroactivement les condamnations prononcées. Elle éteint l'action publique et efface les peines prononcées."},
  {terme:"Appel",src:"Général",def:"Voie de recours ordinaire permettant à une partie de soumettre une décision de première instance à l'examen d'une juridiction supérieure (Cour d'Appel) pour qu'elle la réforme ou la confirme."},
  {terme:"Auteur de l'infraction",src:"Général",def:"Personne qui commet personnellement les faits constitutifs de l'infraction ou qui tente de les commettre. Se distingue du complice qui participe à l'infraction sans en être l'auteur principal."},
  {terme:"Aveu",src:"Général",def:"Déclaration par laquelle une personne reconnaît avoir commis une infraction. L'aveu est un élément de preuve mais ne dispense pas le juge de rechercher d'autres preuves."},
  {terme:"Casier judiciaire",src:"Général",def:"Registre officiel où sont inscrites les condamnations pénales prononcées contre une personne. Il comporte trois bulletins : le bulletin n°1 (intégral), le bulletin n°2 (délivré aux administrations), le bulletin n°3 (délivré à l'intéressé)."},
  {terme:"Charge de la preuve",src:"Général",def:"Obligation pour l'accusation de démontrer la culpabilité de l'accusé. En droit pénal, la charge de la preuve incombe au Ministère Public en vertu de la présomption d'innocence."}
];

const LEXIQUE_GENERAL = LEXIQUE_BASE.sort((a,b)=>a.terme.localeCompare(b.terme, "fr", {sensitivity:"base"}));

const DEFAULT_MODELS = {
  mistral: "mistral-large-latest",
  anthropic: "claude-3-5-sonnet-latest"
};

function getStoredValue(key, fallback="") {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

async function callLLM(messages, system, config, max_tokens=1000) {
  const provider = config?.provider || "mistral";
  const apiKey = config?.apiKey?.trim();
  const model = config?.model?.trim() || DEFAULT_MODELS[provider];

  if (!apiKey) {
    throw new Error(`Clé API ${provider === "mistral" ? "Mistral" : "Anthropic"} manquante.`);
  }

  if (provider === "mistral") {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens,
        temperature: 0.4,
        messages: [{ role: "system", content: system }, ...messages]
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.message || d?.error?.message || `HTTP ${r.status}`);
    const content = d?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
  }

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-api-key":apiKey,
      "anthropic-version":"2023-06-01"
    },
    body:JSON.stringify({model, max_tokens, system, messages})
  });
  const d = await r.json();
  if(!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
  return (d.content || []).map(b=>b.text||"").join("");
}

export default function LOPJ() {
  const [screen, setScreen] = useState("accueil");
  const [source, setSource] = useState("Les deux");
  const [niveau, setNiveau] = useState("Intermédiaire");
  const [cas, setCas] = useState(null);
  const [casLoading, setCasLoading] = useState(false);
  const [reponseUser, setReponseUser] = useState("");
  const [correction, setCorrection] = useState(null);
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [stats, setStats] = useState({total:0,corriges:0,score:0});
  const [historique, setHistorique] = useState([]);
  const [showCorrection, setShowCorrection] = useState(false);
  const [llmProvider, setLlmProvider] = useState(() => getStoredValue("lopj.llmProvider", "mistral"));
  const [apiKey, setApiKey] = useState(() => getStoredValue("lopj.apiKey", ""));
  const [apiModel, setApiModel] = useState(() => getStoredValue("lopj.apiModel", DEFAULT_MODELS.mistral));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("lopj.llmProvider", llmProvider);
      window.localStorage.setItem("lopj.apiKey", apiKey);
      window.localStorage.setItem("lopj.apiModel", apiModel);
    } catch {}
  }, [llmProvider, apiKey, apiModel]);

  const hasApiKey = apiKey.trim().length > 0;
  const llmConfig = { provider: llmProvider, apiKey, model: apiModel.trim() || DEFAULT_MODELS[llmProvider] };

  const ensureApiReady = () => {
    if (hasApiKey) return true;
    alert(`Ajoutez votre clé API ${llmProvider === "mistral" ? "Mistral" : "Anthropic"} dans Paramètres.`);
    setScreen("config");
    return false;
  };

  const generateCas = useCallback(async () => {
    if(!ensureApiReady()) return;
    setCasLoading(true);
    setCas(null);
    setCorrection(null);
    setReponseUser("");
    setShowCorrection(false);
    
    const sys = `Tu es L'OPJ, expert en droit pénal camerounais. Génère un cas pratique réaliste avec faits, questions et articles pertinents. Réponds en JSON valide uniquement.`;
    try {
      const txt = await callLLM([{role:"user",content:"Génère un cas pratique."}], sys, llmConfig);
      const clean = txt.replace(/```json|```/g,"").trim();
      let parsed = JSON.parse(clean);
      setCas(parsed);
      setStats(s=>({...s,total:s.total+1}));
      setScreen("cas");
    } catch(e) { 
      alert("Erreur: "+e.message);
    }
    finally { setCasLoading(false); }
  }, [llmProvider, apiKey, apiModel]);

  const getCorrection = useCallback(async (sansReponse=false) => {
    if(!ensureApiReady()) return;
    if(!sansReponse && !reponseUser.trim()) { alert("Rédigez votre analyse."); return; }
    setCorrectionLoading(true);
    
    const sys = `Tu es professeur de droit pénal. Corrige cette analyse avec la méthode socratique.`;
    const content = `CAS: ${cas.titre}\n\nFAITS:\n${cas.faits}\n\nRÉPONSE:\n${reponseUser || "(Pas de réponse)"}`;
    try {
      const txt = await callLLM([{role:"user",content}], sys, llmConfig, 1400);
      setCorrection(txt);
      setShowCorrection(true);
      if(!sansReponse){
        const m = txt.match(/(\d+)\/20/);
        const score = m?parseInt(m[1]):10;
        setStats(s=>{const n=s.corriges+1;return{...s,corriges:n,score:Math.round((s.score*s.corriges+score)/n)};});
        setHistorique(h=>[{titre:cas.titre,score,date:new Date().toLocaleDateString("fr-FR")},...h.slice(0,19)]);
      }
    } catch(e) { alert("Erreur: "+e.message); }
    finally { setCorrectionLoading(false); }
  }, [cas, reponseUser, llmProvider, apiKey, apiModel]);

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.hLeft}>
          <span style={S.logo}>⚖️</span>
          <div><div style={S.hTitle}>L'OPJ</div><div style={S.hSub}>Agent IA · Droit Pénal Camerounais</div></div>
        </div>
        <nav style={S.nav}>
          {[["accueil","🏠"],["config","⚙️"],["stats","📊"],["lexique","📚"]].map(([k,icon])=>(
            <button key={k} onClick={()=>setScreen(k)} style={{...S.navBtn,...(screen===k?S.navActive:{})}}>{icon}</button>
          ))}
        </nav>
      </header>

      <main style={S.main}>
        {screen==="accueil"&&<Accueil stats={stats} historique={historique} onGenerate={generateCas} casLoading={casLoading}/>}
        {screen==="config"&&<Config source={source} setSource={setSource} niveau={niveau} setNiveau={setNiveau} llmProvider={llmProvider} setLlmProvider={setLlmProvider} apiKey={apiKey} setApiKey={setApiKey} apiModel={apiModel} setApiModel={setApiModel}/>}
        {screen==="cas"&&cas&&<CasScreen cas={cas} reponseUser={reponseUser} setReponseUser={setReponseUser} correction={correction} correctionLoading={correctionLoading} casLoading={casLoading} onCorrection={getCorrection} onNewCas={generateCas} showCorrection={showCorrection}/>}
        {screen==="stats"&&<Stats stats={stats} historique={historique}/>}
        {screen==="lexique"&&<Lexique allTerms={LEXIQUE_GENERAL}/>}
      </main>
      <footer style={S.footer}>L'OPJ — Maîtrisez le droit pénal camerounais</footer>
    </div>
  );
}

function Accueil({stats,historique,onGenerate,casLoading}){
  return <div style={S.pad}>
    <div style={S.hero}>
      <div style={{fontSize:52}}>⚖️</div>
      <h1 style={S.heroTitle}>L'OPJ</h1>
      <button onClick={onGenerate} disabled={casLoading} style={{...S.btnP,fontSize:16,padding:"14px 36px"}}>
        {casLoading?"⏳":"🎯 Générer un Cas"}
      </button>
    </div>
    {historique.length>0&&<div style={{marginTop:24}}>
      <h3 style={S.secTitle}>📋 Historique</h3>
      {historique.slice(0,5).map((h,i)=><div key={i} style={S.hItem}>
        <span>{h.titre}</span>
        <span style={{fontWeight:800,color:h.score>=14?C.green:C.warn}}>{h.score}/20</span>
      </div>)}
    </div>}
  </div>;
}

function Config({source,setSource,niveau,setNiveau,llmProvider,setLlmProvider,apiKey,setApiKey,apiModel,setApiModel}){
  return <div style={S.pad}>
    <h2 style={S.pageTitle}>⚙️ Paramètres</h2>
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <Block label="Source juridique">
        <div style={S.toggles}>{["Code Pénal","Code de Procédure Pénale","Les deux"].map(s=><button key={s} onClick={()=>setSource(s)} style={{...S.tog,...(source===s?S.togA:{})}}>{s}</button>)}</div>
      </Block>
      <Block label="Niveau">
        <div style={S.toggles}>{["Débutant","Intermédiaire","Avancé","Expert"].map(n=><button key={n} onClick={()=>setNiveau(n)} style={{...S.tog,...(niveau===n?S.togA:{})}}>{n}</button>)}</div>
      </Block>
      <Block label="Moteur IA">
        <div style={S.toggles}>
          {[["mistral","Mistral"],["anthropic","Anthropic"]].map(([id,label])=>(
            <button key={id} onClick={()=>setLlmProvider(id)} style={{...S.tog,...(llmProvider===id?S.togA:{})}}>{label}</button>
          ))}
        </div>
        <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Clé API..." style={{...S.input,marginTop:10}}/>
      </Block>
    </div>
  </div>;
}

function Block({label,children}){return<div><label style={{fontSize:14,fontWeight:700,color:C.gold,marginBottom:10,display:"block"}}>{label}</label>{children}</div>;}

function CasScreen({cas,reponseUser,setReponseUser,correction,correctionLoading,casLoading,onCorrection,onNewCas,showCorrection}){
  return <div style={S.pad}>
    <div style={S.card}>
      <h2 style={{fontSize:20,fontWeight:800,margin:0}}>{cas.titre}</h2>
    </div>
    <div style={S.card}>
      <div style={S.secLabel}>📜 FAITS</div>
      <p style={{fontSize:14,lineHeight:1.8,margin:0,color:C.text}}>{cas.faits}</p>
    </div>
    {!showCorrection ? (
      <div style={S.card}>
        <div style={S.secLabel}>✍️ VOTRE ANALYSE</div>
        <textarea value={reponseUser} onChange={e=>setReponseUser(e.target.value)} placeholder="Rédigez votre analyse..." style={{...S.textarea,minHeight:180}}/>
        <div style={{display:"flex",gap:10,marginTop:14}}>
          <button onClick={()=>onCorrection(false)} disabled={correctionLoading||!reponseUser.trim()} style={S.btnP}>✅ Soumettre</button>
          <button onClick={()=>onCorrection(true)} disabled={correctionLoading} style={S.btnS}>💡 Corrigé</button>
          <button onClick={onNewCas} disabled={casLoading} style={S.btnS}>🎲 Nouveau</button>
        </div>
      </div>
    ) : (
      <div style={{background:`${C.gold}08`,border:`1px solid ${C.gold}30`,borderRadius:12,padding:20,marginTop:4}}>
        <div style={{fontSize:14,fontWeight:800,color:C.gold,marginBottom:16}}>📖 CORRECTION</div>
        <p style={{fontSize:13,lineHeight:1.7,color:C.text,margin:0,whiteSpace:"pre-wrap"}}>{correction}</p>
        <button onClick={onNewCas} disabled={casLoading} style={{...S.btnP,marginTop:16}}>🎲 Nouveau cas</button>
      </div>
    )}
  </div>;
}

function Stats({stats,historique}){
  return <div style={S.pad}>
    <h2 style={S.pageTitle}>📊 Statistiques</h2>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
      {[["Cas",stats.total],["Corrigés",stats.corriges],["Score",stats.corriges?`${stats.score}/20`:"—"]].map(([l,v])=>(
        <div key={l} style={S.statBig}><div style={{fontSize:28,fontWeight:900,color:C.gold}}>{v}</div><div style={{fontSize:11,color:C.muted}}>{l}</div></div>
      ))}
    </div>
  </div>;
}

function Lexique({allTerms}){
  const [lettre,setLettre]=useState("A");
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const normalizeInitial = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
  const termesByLetter = (l) => allTerms.filter(t=>normalizeInitial(t.terme)===l);

  return <div style={S.pad}>
    <h2 style={S.pageTitle}>📚 Lexique</h2>
    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:16}}>
      {alphabet.map(l=><button key={l} onClick={()=>setLettre(l)} style={{...S.chip,...(lettre===l?{background:C.gold,color:"#000"}:{})}}>{l}</button>)}
    </div>
    {termesByLetter(lettre).map((t,i)=><div key={i} style={{...S.card,marginBottom:10}}>
      <div style={{fontWeight:800,color:C.gold,marginBottom:8}}>{t.terme}</div>
      <p style={{fontSize:13,lineHeight:1.7,color:C.text,margin:0}}>{t.def}</p>
    </div>)}
  </div>;
}

const C={bg:"#0f1419",surface:"#1a2332",border:"#2d3f55",gold:"#c8a84b",text:"#e2e8f0",muted:"#94a3b8",dim:"#64748b",green:"#22c55e",warn:"#f59e0b",red:"#ef4444"};

const S={
  app:{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"system-ui,sans-serif",display:"flex",flexDirection:"column"},
  header:{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100},
  hLeft:{display:"flex",alignItems:"center",gap:12},
  logo:{fontSize:28},
  hTitle:{fontWeight:800,fontSize:20,color:C.gold},
  hSub:{fontSize:11,color:C.muted},
  nav:{display:"flex",gap:4},
  navBtn:{background:"transparent",border:"none",cursor:"pointer",fontSize:20,padding:"6px 10px",borderRadius:8},
  navActive:{background:C.border,color:C.gold},
  main:{flex:1,maxWidth:820,margin:"0 auto",width:"100%"},
  footer:{textAlign:"center",padding:"12px",color:C.dim,fontSize:11,borderTop:`1px solid ${C.border}`},
  pad:{padding:"24px 20px"},
  pageTitle:{fontSize:22,fontWeight:700,marginBottom:20,color:C.gold},
  hero:{textAlign:"center",padding:"32px 20px",background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,marginBottom:24},
  heroTitle:{fontSize:42,fontWeight:900,color:C.gold,margin:"0 0 8px"},
  statBig:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16,textAlign:"center"},
  card:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:12},
  secLabel:{fontSize:11,fontWeight:800,color:C.gold,letterSpacing:1.5,marginBottom:12},
  secTitle:{fontSize:16,fontWeight:700,color:C.gold,marginBottom:12},
  hItem:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8},
  toggles:{display:"flex",flexWrap:"wrap",gap:8},
  tog:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 14px",cursor:"pointer"},
  togA:{background:C.gold,borderColor:C.gold,color:"#000",fontWeight:700},
  btnP:{background:C.gold,color:"#000",border:"none",borderRadius:8,padding:"11px 22px",fontWeight:700,cursor:"pointer"},
  btnS:{background:C.surface,color:C.text,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 22px",cursor:"pointer"},
  textarea:{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:14,fontSize:14,lineHeight:1.6,outline:"none",boxSizing:"border-box",fontFamily:"inherit"},
  input:{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"11px 16px",outline:"none"},
  chip:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,color:C.muted,padding:"5px 12px",fontSize:12,cursor:"pointer"},
};
