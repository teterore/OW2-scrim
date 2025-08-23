import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

/** ===== Types ===== */
type Region = "ASIA" | "NA" | "EU";
type Platform = "PC" | "Console";
type Mode = "Control" | "Hybrid" | "Escort" | "Push" | "Flashpoint" | "Clash";
type RankTier =
  | "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Master" | "Grandmaster" | "Champion";

type Team = {
  id: string;
  name: string;
  discord: string;
  rankTier?: RankTier;
  rankDiv?: 1 | 2 | 3 | 4 | 5;
  note?: string;
};

type ScrimPostLocal = {
  id: string;        // ローカルID（既存UIとの互換）
  title: string;
  region: Region;
  platform: Platform;
  roomCode?: string; // 簡易入室コード
};

type Phase = "BAN" | "PICK";
type Side = "A" | "B";

/** ===== Hero list (ロール別) ===== */
const HEROES_BY_ROLE: Record<"Tank" | "Damage" | "Support", string[]> = {
  Tank: ["D.Va","Doomfist","Junker Queen","Mauga","Orisa","Ramattra","Reinhardt","Roadhog","Sigma","Winston","Wrecking Ball","Zarya","Hazard"],
  Damage: ["Ashe","Bastion","Cassidy","Echo","Genji","Hanzo","Junkrat","Mei","Pharah","Reaper","Sojourn","Soldier: 76","Sombra","Symmetra","Torbjörn","Tracer","Venture","Widowmaker","Freja"],
  Support: ["Ana","Baptiste","Brigitte","Illari","Juno","Kiriko","Lifeweaver","Lúcio","Mercy","Moira","Zenyatta","Wu Gang"]
};

const ALL_HEROES = [...HEROES_BY_ROLE.Tank, ...HEROES_BY_ROLE.Damage, ...HEROES_BY_ROLE.Support];

/** ===== Utils ===== */
const uid = () => Math.random().toString(36).slice(2);
const fmt = (dt: string) =>
  new Date(dt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit" });

const chip = (text: string) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 border border-gray-200 text-gray-900">
    {text}
  </span>
);

/** ===== Local fallback storage (post単位) ===== */
const LSK = {
  posts: "ow2_posts",
  draft: (postId: string) => `ow2_draft_${postId}`,
  hero: (postId: string) => `ow2_hero_${postId}`
};

/** ===== Supabase helpers ===== */
async function upsertDraft(postId: string, rounds: any[], config: any) {
  if (!supabase) {
    localStorage.setItem(LSK.draft(postId), JSON.stringify({ rounds, config, updated_at: Date.now() }));
    return { data: true, error: null };
  }
  const { data, error } = await supabase
    .from("draft_states")
    .upsert({ post_id: postId, rounds, config, updated_at: new Date().toISOString() });
  return { data, error };
}

async function fetchDraft(postId: string) {
  if (!supabase) {
    const raw = localStorage.getItem(LSK.draft(postId));
    return raw ? JSON.parse(raw) : null;
  }
  const { data, error } = await supabase.from("draft_states").select("*").eq("post_id", postId).maybeSingle();
  if (error) return null;
  return data;
}

async function upsertHero(postId: string, state: any) {
  if (!supabase) {
    localStorage.setItem(LSK.hero(postId), JSON.stringify({ state, updated_at: Date.now() }));
    return { data: true, error: null };
  }
  const { data, error } = await supabase
    .from("hero_states")
    .upsert({ post_id: postId, state, updated_at: new Date().toISOString() });
  return { data, error };
}

async function fetchHero(postId: string) {
  if (!supabase) {
    const raw = localStorage.getItem(LSK.hero(postId));
    return raw ? JSON.parse(raw) : null;
  }
  const { data, error } = await supabase.from("hero_states").select("*").eq("post_id", postId).maybeSingle();
  if (error) return null;
  return data;
}

/** ===== App ===== */
export default function App() {
  // URLの ?post=... で同じ募集URLを共有できる
  const url = new URL(location.href);
  const initialPost = url.searchParams.get("post");
  const [posts, setPosts] = useState<ScrimPostLocal[]>(() => {
    const raw = localStorage.getItem(LSK.posts);
    return raw ? JSON.parse(raw) : [];
  });
  const [currentId, setCurrentId] = useState<string | null>(initialPost || posts[0]?.id || null);

  // 初回デモ募集
  useEffect(() => {
    if (posts.length === 0) {
      const p: ScrimPostLocal = {
        id: crypto.randomUUID ? crypto.randomUUID() : uid(),
        title: "Shibuya Foxes vs Osaka Tempest",
        region: "ASIA",
        platform: "PC",
        roomCode: "ow2-demo"
      };
      const next = [p];
      setPosts(next);
      localStorage.setItem(LSK.posts, JSON.stringify(next));
      setCurrentId(p.id);
      const u = new URL(location.href);
      u.searchParams.set("post", p.id);
      history.replaceState(null, "", u.toString());
    }
  }, []);

  // post切替時にURL反映
  useEffect(() => {
    if (!currentId) return;
    const u = new URL(location.href);
    u.searchParams.set("post", currentId);
    history.replaceState(null, "", u.toString());
  }, [currentId]);

  const current = posts.find(p => p.id === currentId) || null;

  return (
    <div className="min-h-screen bg-orange-50 text-gray-900 border-l-8 border-r-8 border-blue-500">
      <div className="p-6 max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">OW2 スクリム・MVP</h1>
          <div className="flex gap-2 items-center">
            <select
              className="border rounded px-2 py-1 bg-white"
              value={currentId || ""}
              onChange={(e) => setCurrentId(e.target.value)}
            >
              {posts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <button
              className="text-sm px-3 py-1 rounded bg-black text-white"
              onClick={() => {
                const p: ScrimPostLocal = {
                  id: crypto.randomUUID ? crypto.randomUUID() : uid(),
                  title: `Scrim ${posts.length + 1}`,
                  region: "ASIA",
                  platform: "PC",
                  roomCode: Math.random().toString(36).slice(2, 8)
                };
                const next = [...posts, p];
                setPosts(next);
                localStorage.setItem(LSK.posts, JSON.stringify(next));
                setCurrentId(p.id);
              }}
            >
              新規募集
            </button>
          </div>
        </header>

        {!current ? (
          <div className="text-gray-700">募集が選択されていません。</div>
        ) : (
          <PostView post={current} />
        )}
      </div>
    </div>
  );
}

/** ===== PostView: タブ & 内容 ===== */
function PostView({ post }: { post: ScrimPostLocal }) {
  const [tab, setTab] = useState<"board" | "draft" | "hero" | "settings">("draft");

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-lg font-semibold">{post.title}</div>
        <div className="flex gap-2 text-sm">
          {chip(post.region)}{chip(post.platform)}
          <span className="ml-2">部屋コード: <span className="font-mono">{post.roomCode || "-"}</span></span>
        </div>
      </div>

      <nav className="mb-4 flex gap-2 flex-wrap">
        {[
          { id: "board", label: "概要" },
          { id: "draft", label: "マップドラフト（ラウンド制）" },
          { id: "hero", label: "ヒーローピック/BAN（同時編集）" },
          { id: "settings", label: "募集設定" }
        ].map(({id, label}) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={`px-3 py-2 rounded-2xl border ${tab === id ? "bg-gray-900 text-white" : "bg-white"}`}
          >{label}</button>
        ))}
      </nav>

      {tab === "board" && <Overview post={post} />}
      {tab === "draft" && <MapDraftPerRound post={post} />}
      {tab === "hero" && <HeroPickBanRealtime post={post} />}
      {tab === "settings" && <PostSettings post={post} />}
    </>
  );
}

function Overview({ post }: { post: ScrimPostLocal }) {
  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="text-sm text-gray-700">この募集のURLを共有すると他ユーザーも同じ画面を開けます。</div>
      <div className="text-sm text-gray-700">部屋コードを知っている人だけ編集OK（簡易ガード）。</div>
    </div>
  );
}

/** ===== 募集設定（タイトル・部屋コード） ===== */
function PostSettings({ post }: { post: ScrimPostLocal }) {
  const [title, setTitle] = useState(post.title);
  const [room, setRoom] = useState(post.roomCode || "");

  useEffect(() => { setTitle(post.title); setRoom(post.roomCode || ""); }, [post.id]);

  return (
    <div className="grid gap-3 max-w-xl">
      <label className="grid gap-1">
        <span className="text-sm text-gray-700">タイトル</span>
        <input className="border rounded px-3 py-2 bg-white" value={title} onChange={e=>setTitle(e.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-gray-700">部屋コード（共有編集用）</span>
        <input className="border rounded px-3 py-2 bg-white" value={room} onChange={e=>setRoom(e.target.value)} />
      </label>
      <div className="text-xs text-gray-600">※ デモ用。実運用はログイン＋RLS推奨。</div>
    </div>
  );
}

/** ===== マップドラフト：1マップごとにBAN → PICKのラウンド制 ===== */
type Round = {
  index: number;
  mode: Mode;
  bansA: string[];
  bansB: string[];
  pickBy?: Side;
  map?: string;
};

function MapDraftPerRound({ post }: { post: ScrimPostLocal }) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [config, setConfig] = useState<{ total: number; banPerSide: number; firstPick: Side; allowed: Record<Mode,string[]>; roomCode?: string }>({
    total: 3,
    banPerSide: 1,
    firstPick: "A",
    allowed: {
      Control: ["Lijiang Tower","Ilios","Nepal","Oasis","Busan","Antarctic Peninsula"],
      Hybrid: ["King's Row","Midtown","Eichenwalde","Hollywood (custom)","Numbani (custom)"],
      Escort: ["Junkertown","Circuit Royal","Havana","Shambali Monastery","Rialto"],
      Push: ["Colosseo","Esperança","New Queen Street"],
      Flashpoint: ["Suravasa","New Junk City"],
      Clash: ["Hanaoka (custom)","Runasapi (custom)"]
    },
    roomCode: ""
  });
  const [mode, setMode] = useState<Mode>("Control");
  const [customMap, setCustomMap] = useState("");
  const [side, setSide] = useState<Side>("A");
  const [roomInput, setRoomInput] = useState("");

  // 初期化＆ロード
  useEffect(() => {
    (async () => {
      const d = await fetchDraft(post.id);
      if (d?.config) setConfig((c)=>({ ...c, ...(d.config||{}) }));
      if (d?.rounds?.length) setRounds(d.rounds);
      if (supabase) {
        supabase.channel(`draft:${post.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "draft_states", filter: `post_id=eq.${post.id}` },
            (payload) => {
              const row: any = payload.new;
              if (row?.rounds) setRounds(row.rounds);
              if (row?.config) setConfig((c)=>({ ...c, ...row.config }));
            }
          ).subscribe();
      }
    })();
  }, [post.id]);

  const save = async (nr = rounds, nc = config) => {
    await upsertDraft(post.id, nr, nc);
  };

  // ラウンド構成を作る
  const buildRounds = () => {
    const base: Round[] = Array.from({ length: config.total }).map((_, i) => ({
      index: i,
      mode,
      bansA: [],
      bansB: [],
      pickBy: i % 2 === 0 ? config.firstPick : (config.firstPick === "A" ? "B" : "A"),
      map: undefined
    }));
    setRounds(base);
    save(base, config);
  };

  const doBan = (r: Round, s: Side, m: string | null) => {
    const nr = rounds.map((it) => {
      if (it.index !== r.index) return it;
      if (m === null) { // なし（スキップ）
        return { ...it };
      }
      const already = new Set([...(it.bansA||[]), ...(it.bansB||[])]);
      if (already.has(m)) return it;
      if (s === "A") {
        if ((it.bansA?.length || 0) >= config.banPerSide) return it;
        return { ...it, bansA: [...it.bansA, m] };
      } else {
        if ((it.bansB?.length || 0) >= config.banPerSide) return it;
        return { ...it, bansB: [...it.bansB, m] };
      }
    });
    setRounds(nr as Round[]);
    save(nr as Round[], config);
  };

  const doPick = (r: Round, map: string) => {
    // pickByのチームが選ぶ想定（UIでどちらが操作しても可）
    const banned = new Set([...(r.bansA||[]), ...(r.bansB||[])]);
    if (banned.has(map)) return;
    const nr = rounds.map(it => it.index===r.index ? ({ ...it, map }) : it);
    setRounds(nr);
    save(nr, config);
  };

  const allowedForRound = (r: Round) =>
    (config.allowed[r.mode] || []).filter(m => !r.bansA.includes(m) && !r.bansB.includes(m) && r.map !== m);

  return (
    <div className="grid gap-4">
      <div className="border rounded-xl p-4 bg-white">
        <div className="grid md:grid-cols-4 gap-3">
          <label className="grid gap-1">
            <span className="text-sm">ラウンド数</span>
            <input type="number" className="border rounded px-2 py-1 bg-white" min={1} max={9}
              value={config.total} onChange={e=>setConfig(c=>({...c, total: Math.max(1, Math.min(9, Number(e.target.value)||1))}))}/>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">BAN数（各サイド/ラウンド）</span>
            <input type="number" className="border rounded px-2 py-1 bg-white" min={0} max={3}
              value={config.banPerSide} onChange={e=>setConfig(c=>({...c, banPerSide: Math.max(0, Math.min(3, Number(e.target.value)||0))}))}/>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">先手ピック</span>
            <select className="border rounded px-2 py-1 bg-white" value={config.firstPick} onChange={e=>setConfig(c=>({...c, firstPick: e.target.value as Side}))}>
              <option value="A">A</option><option value="B">B</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">対象モード</span>
            <select className="border rounded px-2 py-1 bg-white" value={mode} onChange={e=>setMode(e.target.value as Mode)}>
              {(["Control","Hybrid","Escort","Push","Flashpoint","Clash"] as Mode[]).map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="px-3 py-1 rounded bg-black text-white" onClick={buildRounds}>ラウンドを作成</button>
          <div className="ml-auto flex items-center gap-2">
            <input className="border rounded px-2 py-1 bg-white" placeholder="部屋コード入力" value={roomInput} onChange={e=>setRoomInput(e.target.value)} />
            <select className="border rounded px-2 py-1 bg-white" value={side} onChange={e=>setSide(e.target.value as Side)}>
              <option value="A">自チーム: A</option><option value="B">自チーム: B</option>
            </select>
          </div>
        </div>
      </div>

      {rounds.length === 0 ? (
        <div className="text-gray-700">「ラウンドを作成」を押してください。</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rounds.map(r => (
            <div key={r.index} className="border rounded-xl p-4 bg-white">
              <div className="text-sm text-gray-600">第{r.index+1}ラウンド / モード: {r.mode} / ピック: {r.pickBy}</div>
              <div className="mt-2 grid sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm font-semibold mb-1">BAN（A）</div>
                  <div className="flex gap-2 flex-wrap">
                    <button className="text-xs px-2 py-1 rounded border bg-white" onClick={()=>{
                      if (roomInput !== (config.roomCode||post.roomCode)) return alert("部屋コードが違います");
                      doBan(r,"A", null); // なし
                    }}>なし</button>
                    {(config.allowed[r.mode]||[]).map(m=>(
                      <button key={m} className="text-xs px-2 py-1 rounded border bg-white"
                        disabled={r.bansA.includes(m)||r.bansB.includes(m)||r.map===m}
                        onClick={()=>{
                          if (roomInput !== (config.roomCode||post.roomCode) || side!=="A") return alert("A側のみ操作可 / コード要");
                          doBan(r,"A",m);
                        }}>{m}</button>
                    ))}
                  </div>
                  <div className="mt-1 text-xs">選択: {r.bansA.join(", ")||"なし"}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-1">BAN（B）</div>
                  <div className="flex gap-2 flex-wrap">
                    <button className="text-xs px-2 py-1 rounded border bg-white" onClick={()=>{
                      if (roomInput !== (config.roomCode||post.roomCode)) return alert("部屋コードが違います");
                      doBan(r,"B", null);
                    }}>なし</button>
                    {(config.allowed[r.mode]||[]).map(m=>(
                      <button key={m} className="text-xs px-2 py-1 rounded border bg-white"
                        disabled={r.bansA.includes(m)||r.bansB.includes(m)||r.map===m}
                        onClick={()=>{
                          if (roomInput !== (config.roomCode||post.roomCode) || side!=="B") return alert("B側のみ操作可 / コード要");
                          doBan(r,"B",m);
                        }}>{m}</button>
                    ))}
                  </div>
                  <div className="mt-1 text-xs">選択: {r.bansB.join(", ")||"なし"}</div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-sm font-semibold mb-1">PICK（{r.pickBy}）</div>
                <div className="flex gap-2 flex-wrap">
                  {allowedForRound(r).map(m=>(
                    <button key={m} className="text-xs px-2 py-1 rounded border bg-white"
                      onClick={()=>{
                        if (roomInput !== (config.roomCode||post.roomCode) || side!==r.pickBy) return alert(`${r.pickBy}側のみ操作可 / コード要`);
                        doPick(r,m);
                      }}>{m}</button>
                  ))}
                </div>
                <div className="mt-1">選ばれたマップ：<span className="font-medium">{r.map || "未選択"}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** ===== ヒーローピック/BAN（Realtime同期） ===== */
function HeroPickBanRealtime({ post }: { post: ScrimPostLocal }) {
  const [firstAction, setFirstAction] = useState<"BAN"|"PICK">("BAN");
  const [banPerTeam, setBanPerTeam] = useState(2);
  const [pickPerTeam, setPickPerTeam] = useState(5);
  const [sequence, setSequence] = useState<"ALTERNATE"|"TEAM_BY_TEAM">("ALTERNATE");

  const [queue, setQueue] = useState<{phase: Phase; side: Side}[]>([]);
  const [idx, setIdx] = useState(0);
  const [available, setAvailable] = useState<string[]>(ALL_HEROES);
  const [bansA, setBansA] = useState<string[]>([]);
  const [bansB, setBansB] = useState<string[]>([]);
  const [picksA, setPicksA] = useState<string[]>([]);
  const [picksB, setPicksB] = useState<string[]>([]);

  const [roleFilter, setRoleFilter] = useState<"All"|"Tank"|"Damage"|"Support">("All");
  const [select, setSelect] = useState("");
  const [side, setSide] = useState<Side>("A");
  const [roomInput, setRoomInput] = useState("");

  const current = queue[idx];

  // 初期ロード + Realtime購読
  useEffect(() => {
    (async () => {
      const h = await fetchHero(post.id);
      if (h?.state) {
        const s = h.state;
        setQueue(s.queue || []);
        setIdx(s.idx || 0);
        setAvailable(s.available || ALL_HEROES);
        setBansA(s.bansA || []); setBansB(s.bansB || []);
        setPicksA(s.picksA || []); setPicksB(s.picksB || []);
      }
      if (supabase) {
        supabase.channel(`hero:${post.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "hero_states", filter: `post_id=eq.${post.id}` },
            (payload) => {
              const row: any = payload.new;
              const s = row?.state;
              if (!s) return;
              setQueue(s.queue || []);
              setIdx(s.idx || 0);
              setAvailable(s.available || ALL_HEROES);
              setBansA(s.bansA || []); setBansB(s.bansB || []);
              setPicksA(s.picksA || []); setPicksB(s.picksB || []);
            }
          ).subscribe();
      }
    })();
  }, [post.id]);

  const save = async () => {
    const state = { queue, idx, available, bansA, bansB, picksA, picksB };
    await upsertHero(post.id, state);
  };

  const buildQueue = () => {
    const other: Phase = firstAction === "BAN" ? "PICK" : "BAN";
    const build = (phase: Phase, per: number) => {
      const arr: {phase: Phase; side: Side}[] = [];
      if (per <= 0) return arr;
      if (sequence === "ALTERNATE") {
        for (let i=0;i<per;i++) arr.push({phase,side:"A"},{phase,side:"B"});
      } else {
        for (let i=0;i<per;i++) arr.push({phase,side:"A"});
        for (let i=0;i<per;i++) arr.push({phase,side:"B"});
      }
      return arr;
    };
    const q = [
      ...build(firstAction, firstAction==="BAN"?banPerTeam:pickPerTeam),
      ...build(other, other==="BAN"?banPerTeam:pickPerTeam)
    ];
    setQueue(q); setIdx(0);
    setAvailable(ALL_HEROES);
    setBansA([]); setBansB([]); setPicksA([]); setPicksB([]);
    save();
  };

  const visibleHeroes = useMemo(()=>{
    const pool = roleFilter==="All" ? ALL_HEROES : HEROES_BY_ROLE[roleFilter];
    return pool.filter(h => available.includes(h));
  }, [roleFilter, available]);

  const act = () => {
    if (!current) return;
    if (roomInput !== (post.roomCode || "")) return alert("部屋コードが違います");
    if (current.side !== side) return alert(`${current.side}側のターンです`);

    if (current.phase === "BAN") {
      if (select === "NONE") {
        if (current.side === "A") setBansA(p=>[...p, "なし"]); else setBansB(p=>[...p, "なし"]);
        setIdx(x=>x+1);
        setSelect("");
        save();
        return;
      }
      if (!select || !available.includes(select)) return;
      setAvailable(prev=>prev.filter(h=>h!==select)); // BANは使用不可
      if (current.side === "A") setBansA(p=>[...p, select]); else setBansB(p=>[...p, select]);
    } else {
      if (!select || !available.includes(select)) return;
      setAvailable(prev=>prev.filter(h=>h!==select));
      if (current.side === "A") setPicksA(p=>[...p, select]); else setPicksB(p=>[...p, select]);
    }
    setIdx(x=>x+1);
    setSelect("");
    save();
  };

  return (
    <div className="grid gap-4">
      <div className="border rounded-xl p-4 bg-white">
        <div className="grid md:grid-cols-4 gap-3">
          <label className="grid gap-1">
            <span className="text-sm">先に行うフェーズ</span>
            <select className="border rounded px-2 py-1 bg-white" value={firstAction} onChange={e=>setFirstAction(e.target.value as any)}>
              <option value="BAN">BAN先行</option>
              <option value="PICK">PICK先行</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">BAN数（各チーム）</span>
            <input type="number" min={0} max={10} className="border rounded px-2 py-1 bg-white" value={banPerTeam} onChange={e=>setBanPerTeam(Math.max(0, Math.min(10, Number(e.target.value)||0)))}/>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">PICK数（各チーム）</span>
            <input type="number" min={0} max={10} className="border rounded px-2 py-1 bg-white" value={pickPerTeam} onChange={e=>setPickPerTeam(Math.max(0, Math.min(10, Number(e.target.value)||0)))}/>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">順序</span>
            <select className="border rounded px-2 py-1 bg-white" value={sequence} onChange={e=>setSequence(e.target.value as any)}>
              <option value="ALTERNATE">A→B交互</option>
              <option value="TEAM_BY_TEAM">Aまとめて→B</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <button className="px-3 py-1 rounded bg-black text-white" onClick={buildQueue}>セッション開始</button>
          <div className="ml-auto flex items-center gap-2">
            <input className="border rounded px-2 py-1 bg-white" placeholder="部屋コード入力" value={roomInput} onChange={e=>setRoomInput(e.target.value)} />
            <select className="border rounded px-2 py-1 bg-white" value={side} onChange={e=>setSide(e.target.value as Side)}>
              <option value="A">自チーム: A</option><option value="B">自チーム: B</option>
            </select>
          </div>
        </div>
        {queue.length>0 && <div className="mt-2 text-sm text-gray-700">手順: {queue.map(t=>`${t.side}-${t.phase}`).join(" → ")}</div>}
      </div>

      <div className="border rounded-xl p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-sm">現在: <span className="font-semibold">{current ? `${current.side} の ${current.phase}` : "完了"}</span></div>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm">ロール</label>
            <select className="border rounded px-2 py-1 bg-white" value={roleFilter} onChange={e=>setRoleFilter(e.target.value as any)}>
              <option>All</option><option>Tank</option><option>Damage</option><option>Support</option>
            </select>
            <select className="border rounded px-2 py-1 bg-white" value={select} onChange={e=>setSelect(e.target.value)}>
              <option value="">ヒーローを選択</option>
              {current?.phase==="BAN" && <option value="NONE">なし</option>}
              {visibleHeroes.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <button className="px-3 py-1 rounded bg-black text-white" onClick={act} disabled={!current}>確定</button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {(["Tank","Damage","Support"] as const).map(role=>(
            <div key={role} className="border rounded-lg p-3">
              <div className="font-semibold mb-2">{role==="Tank"?"タンク":role==="Damage"?"ダメージ":"サポート"}</div>
              <div className="flex flex-wrap gap-2">
                {HEROES_BY_ROLE[role].map(h=>(
                  <span key={h} className={`text-xs px-2 py-1 border rounded-full ${available.includes(h) ? "bg-gray-50" : "opacity-50 bg-gray-100"}`}>{h}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 bg-white">
          <div className="font-semibold mb-2">チームA</div>
          <div className="text-sm">BAN: {bansA.join(", ") || "なし"}</div>
          <div className="text-sm">PICK: {picksA.join(", ") || "なし"}</div>
        </div>
        <div className="border rounded-xl p-4 bg-white">
          <div className="font-semibold mb-2">チームB</div>
          <div className="text-sm">BAN: {bansB.join(", ") || "なし"}</div>
          <div className="text-sm">PICK: {picksB.join(", ") || "なし"}</div>
        </div>
      </div>
    </div>
  );
}
