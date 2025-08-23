import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

/** ===== Types ===== */
type Region = "ASIA" | "NA" | "EU";
type Platform = "PC" | "Console";
type Mode = "Control" | "Hybrid" | "Escort" | "Push" | "Flashpoint" | "Clash";
type Phase = "BAN" | "PICK";
type Side = "A" | "B";

type ScrimPostLocal = {
  id: string;
  title: string;
  region: Region;
  platform: Platform;
  roomCode?: string;
};

/** ===== Heroes (ロール別) ===== */
const HEROES_BY_ROLE: Record<"Tank" | "Damage" | "Support", string[]> = {
  Tank: [
    "D.Va","Doomfist","Junker Queen","Mauga","Orisa","Ramattra","Reinhardt",
    "Roadhog","Sigma","Winston","Wrecking Ball","Zarya","Hazard" // 追加
  ],
  Damage: [
    "Ashe","Bastion","Cassidy","Echo","Genji","Hanzo","Junkrat","Mei","Pharah",
    "Reaper","Sojourn","Soldier: 76","Sombra","Symmetra","Torbjörn","Tracer",
    "Venture","Widowmaker","Freja" // 追加
  ],
  Support: [
    "Ana","Baptiste","Brigitte","Illari","Juno","Kiriko","Lifeweaver",
    "Lúcio","Mercy","Moira","Zenyatta","Wu Gang" // 追加
  ]
};
const ALL_HEROES = [...HEROES_BY_ROLE.Tank, ...HEROES_BY_ROLE.Damage, ...HEROES_BY_ROLE.Support];

/** ===== Utils / UI ===== */
const uid = () => Math.random().toString(36).slice(2);
const chip = (text: string) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 border border-gray-200 text-gray-900">{text}</span>
);

/** ===== Local keys ===== */
const LSK = {
  posts: "ow2_posts",
  draft: (postId: string) => `ow2_draft_${postId}`,
  hero: (postId: string) => `ow2_hero_${postId}`
};

/** ===== Debounce hook (保存をまとめる) ===== */
function useDebouncedEffect(effect: () => void, deps: any[], delay = 400) {
  const first = useRef(true);
  useEffect(() => {
    // 初回マウント直後の「復元直後の変更検知」は無視したいのでワンショット回避
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(effect, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** ===== Supabase helpers（localStorageフォールバック付き） ===== */
async function upsertDraft(postId: string, rounds: any[], config: any) {
  if (!supabase) {
    localStorage.setItem(LSK.draft(postId), JSON.stringify({ rounds, config, updated_at: Date.now() }));
    return;
  }
  await supabase.from("draft_states").upsert({ post_id: postId, rounds, config, updated_at: new Date().toISOString() });
}
async function fetchDraft(postId: string) {
  if (!supabase) {
    const raw = localStorage.getItem(LSK.draft(postId));
    return raw ? JSON.parse(raw) : null;
  }
  const { data } = await supabase.from("draft_states").select("*").eq("post_id", postId).maybeSingle();
  return data;
}

async function upsertHero(postId: string, state: any) {
  if (!supabase) {
    localStorage.setItem(LSK.hero(postId), JSON.stringify({ state, updated_at: Date.now() }));
    return;
  }
  await supabase.from("hero_states").upsert({ post_id: postId, state, updated_at: new Date().toISOString() });
}
async function fetchHero(postId: string) {
  if (!supabase) {
    const raw = localStorage.getItem(LSK.hero(postId));
    return raw ? JSON.parse(raw) : null;
  }
  const { data } = await supabase.from("hero_states").select("*").eq("post_id", postId).maybeSingle();
  return data;
}

/** ===== App（募集選択とURL共有） ===== */
export default function App() {
  const url = new URL(location.href);
  const initialPost = url.searchParams.get("post");

  const [posts, setPosts] = useState<ScrimPostLocal[]>(() => {
    const raw = localStorage.getItem(LSK.posts);
    return raw ? JSON.parse(raw) : [];
  });
  const [currentId, setCurrentId] = useState<string | null>(initialPost || posts[0]?.id || null);

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
            <select className="border rounded px-2 py-1 bg-white" value={currentId || ""} onChange={(e) => setCurrentId(e.target.value)}>
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

/** ===== Postビュー（タブごとに保存・復元） ===== */
function PostView({ post }: { post: ScrimPostLocal }) {
  const [tab, setTab] = useState<"draft" | "hero" | "settings">("draft");
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
        <button onClick={() => setTab("draft")} className={`px-3 py-2 rounded-2xl border ${tab==="draft"?"bg-gray-900 text-white":"bg-white"}`}>マップドラフト</button>
        <button onClick={() => setTab("hero")}  className={`px-3 py-2 rounded-2xl border ${tab==="hero" ?"bg-gray-900 text-white":"bg-white"}`}>ヒーローピック/BAN</button>
        <button onClick={() => setTab("settings")} className={`px-3 py-2 rounded-2xl border ${tab==="settings" ?"bg-gray-900 text-white":"bg-white"}`}>募集設定</button>
      </nav>

      {tab === "draft" && <MapDraftPerRound post={post} />}
      {tab === "hero"  && <HeroPickBanRealtime post={post} />}
      {tab === "settings" && <PostSettings post={post} />}
    </>
  );
}

/** ===== 募集設定（タイトル/部屋コードはローカルのみ保持） ===== */
function PostSettings({ post }: { post: ScrimPostLocal }) {
  const [title, setTitle] = useState(post.title);
  const [room, setRoom]   = useState(post.roomCode || "");

  useEffect(() => { setTitle(post.title); setRoom(post.roomCode || ""); }, [post.id]);

  // 簡易保存：posts配列を更新
  useEffect(() => {
    const raw = localStorage.getItem(LSK.posts);
    const list: ScrimPostLocal[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(p=>p.id===post.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], title, roomCode: room };
      localStorage.setItem(LSK.posts, JSON.stringify(list));
    }
  }, [title, room, post.id]);

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

/** ===== マップドラフト：ラウンドごとにBAN→PICK、保存＆同期 ===== */
type Round = { index: number; mode: Mode; bansA: string[]; bansB: string[]; pickBy?: Side; map?: string; };

function MapDraftPerRound({ post }: { post: ScrimPostLocal }) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [config, setConfig] = useState<{ total: number; banPerSide: number; firstPick: Side; allowed: Record<Mode,string[]>; roomCode?: string }>({
    total: 3, banPerSide: 1, firstPick: "A",
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
  const [side, setSide] = useState<Side>("A");
  const [roomInput, setRoomInput] = useState("");

  // 初回ロード & リアルタイム購読
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

  // オートセーブ（デバウンス）：rounds/configが変われば保存
  useDebouncedEffect(() => { upsertDraft(post.id, rounds, config); }, [rounds, config, post.id], 400);

  const buildRounds = () => {
    const base: Round[] = Array.from({ length: config.total }).map((_, i) => ({
      index: i, mode, bansA: [], bansB: [], pickBy: i % 2 === 0 ? config.firstPick : (config.firstPick === "A" ? "B" : "A"), map: undefined
    }));
    setRounds(base); // セーブはデバウンスで自動
  };

  const checkRoom = (needSide?: Side) => {
    const code = config.roomCode || post.roomCode || "";
    if (!code || roomInput !== code) { alert("部屋コードが違います"); return false; }
    if (needSide && side !== needSide) { alert(`${needSide}側のみ操作できます`); return false; }
    return true;
  };

  const doBan = (r: Round, s: Side, m: string | null) => {
    if (!checkRoom(s)) return;
    setRounds(prev => prev.map(rr => {
      if (rr.index !== r.index) return rr;
      if (m === null) return rr; // なし＝権利消費しない実装（必要なら消費する仕様に変更可能）
      const banned = new Set([...(rr.bansA||[]), ...(rr.bansB||[])]);
      if (banned.has(m)) return rr;
      if (s === "A") {
        if ((rr.bansA?.length || 0) >= config.banPerSide) return rr;
        return { ...rr, bansA: [...rr.bansA, m] };
      } else {
        if ((rr.bansB?.length || 0) >= config.banPerSide) return rr;
        return { ...rr, bansB: [...rr.bansB, m] };
      }
    }) as Round[]);
  };

  const doPick = (r: Round, map: string) => {
    if (!checkRoom(r.pickBy)) return;
    setRounds(prev => prev.map(rr => {
      if (rr.index !== r.index) return rr;
      const banned = new Set([...(rr.bansA||[]), ...(rr.bansB||[])]);
      if (banned.has(map)) return rr;
      return { ...rr, map };
    }));
  };

  const allowedForRound = (r: Round) =>
    (config.allowed[r.mode] || []).filter(m => !r.bansA.includes(m) && !r.bansB.includes(m) && r.map !== m);

  return (
    <div className="grid gap-4">
      <div className="border rounded-xl p-4 bg-white">
        <div className="grid md:grid-cols-5 gap-3">
          <label className="grid gap-1">
            <span className="text-sm">ラウンド数</span>
            <input type="number" min={1} max={9} className="border rounded px-2 py-1 bg-white"
              value={config.total} onChange={e=>setConfig(c=>({ ...c, total: Math.max(1, Math.min(9, Number(e.target.value)||1)) }))}/>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">BAN数/サイド</span>
            <input type="number" min={0} max={3} className="border rounded px-2 py-1 bg-white"
              value={config.banPerSide} onChange={e=>setConfig(c=>({ ...c, banPerSide: Math.max(0, Math.min(3, Number(e.target.value)||0)) }))}/>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">先手ピック</span>
            <select className="border rounded px-2 py-1 bg-white" value={config.firstPick} onChange={e=>setConfig(c=>({ ...c, firstPick: e.target.value as Side }))}>
              <option value="A">A</option><option value="B">B</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">対象モード</span>
            <select className="border rounded px-2 py-1 bg-white" value={mode} onChange={e=>setMode(e.target.value as Mode)}>
              {(["Control","Hybrid","Escort","Push","Flashpoint","Clash"] as Mode[]).map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="grid
