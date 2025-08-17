import React, { useEffect, useMemo, useState } from "react";

// --- Types ---
type Region = "ASIA" | "NA" | "EU";
type Platform = "PC" | "Console";
type Mode = "Control" | "Hybrid" | "Escort" | "Push" | "Flashpoint" | "Clash";

type RankTier =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Master"
  | "Grandmaster"
  | "Champion";

// 指定の追加：Tankに「Hazard」、Damageに「Freja」、Supportに「Wu Gang」
// 参考: Blizzard公式ヒーロー一覧（ロール別表示）
const HEROES_BY_ROLE: Record<"Tank" | "Damage" | "Support", string[]> = {
  Tank: [
    "D.Va",
    "Doomfist",
    "Junker Queen",
    "Mauga",
    "Orisa",
    "Ramattra",
    "Reinhardt",
    "Roadhog",
    "Sigma",
    "Winston",
    "Wrecking Ball",
    "Zarya",
    "Hazard" // 追加
  ],
  Damage: [
    "Ashe",
    "Bastion",
    "Cassidy",
    "Echo",
    "Genji",
    "Hanzo",
    "Junkrat",
    "Mei",
    "Pharah",
    "Reaper",
    "Sojourn",
    "Soldier: 76",
    "Sombra",
    "Symmetra",
    "Torbjörn",
    "Tracer",
    "Venture",
    "Widowmaker",
    "Freja" // 追加
  ],
  Support: [
    "Ana",
    "Baptiste",
    "Brigitte",
    "Illari",
    "Juno",
    "Kiriko",
    "Lifeweaver",
    "Lúcio",
    "Mercy",
    "Moira",
    "Zenyatta",
    "Wu Gang" // 追加
  ]
};

// --- Team / Post types ---
type Team = {
  id: string;
  name: string;
  discord: string; // contact
  rankTier?: RankTier; // 平均ランク（ティア）
  rankDiv?: 1 | 2 | 3 | 4 | 5; // 平均ランク（ディビジョン）
  note?: string;
};

type ScrimPost = {
  id: string;
  createdAt: number;
  ownerTeamId: string;
  timeISO: string; // proposed start time
  durationMin: number; // 60 default
  region: Region;
  platform: Platform;
  srMin?: number; // 既存互換
  srMax?: number;
  format: string; // e.g. BO5, Maps: 3, etc.
  comms: string; // Discord VC, etc.
  note?: string;
  status: "open" | "pending" | "booked" | "expired";
  applicantTeamIds: string[]; // teams who applied
  bookedWithTeamId?: string; // accepted team
};

// --- Utilities ---
const uid = () => Math.random().toString(36).slice(2);

function tzDateISO(localISO: string) {
  return new Date(localISO).toISOString();
}

function fmt(dt: string) {
  const d = new Date(dt);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function chip(text: string) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 border border-gray-200 text-gray-900">
      {text}
    </span>
  );
}

const DEFAULT_MAPS: Record<Mode, string[]> = {
  Control: [
    "Lijiang Tower",
    "Ilios",
    "Nepal",
    "Oasis",
    "Busan",
    "Antarctic Peninsula"
  ],
  Hybrid: [
    "King's Row",
    "Midtown",
    "Hollywood (custom)",
    "Numbani (custom)",
    "Eichenwalde"
  ],
  Escort: ["Junkertown", "Circuit Royal", "Havana", "Shambali Monastery", "Rialto"],
  Push: ["Colosseo", "Esperança", "New Queen Street"],
  Flashpoint: ["Suravasa", "New Junk City"],
  Clash: ["Hanaoka (custom)", "Runasapi (custom)"]
};

// --- Storage Layer (local) ---
const LS = {
  teams: "ow2_scrim_teams",
  posts: "ow2_scrim_posts",
  me: "ow2_scrim_me",
  maps: "ow2_scrim_maps"
};

function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState] as const;
}

// --- Layout Container (背景/枠固定) ---
function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-orange-50 text-gray-900 border-l-8 border-r-8 border-blue-500">
      {children}
    </div>
  );
}

// --- Root ---
export default function App() {
  return (
    <Container>
      <MainApp />
    </Container>
  );
}

function MainApp() {
  const [teams, setTeams] = useLocalStorage<Team[]>(LS.teams, []);
  const [posts, setPosts] = useLocalStorage<ScrimPost[]>(LS.posts, []);
  const [meId, setMeId] = useLocalStorage<string | null>(LS.me, null);
  const [tab, setTab] = useState<"board" | "new" | "draft" | "team" | "pickban">(
    "board"
  );
  const me = useMemo(() => teams.find((t) => t.id === meId) || null, [teams, meId]);

  // seed sample data
  useEffect(() => {
    if (teams.length === 0) {
      const a: Team = {
        id: uid(),
        name: "Shibuya Foxes",
        discord: "@foxes_captain",
        rankTier: "Diamond",
        rankDiv: 3
      };
      const b: Team = {
        id: uid(),
        name: "Osaka Tempest",
        discord: "@tempest#8877",
        rankTier: "Master",
        rankDiv: 5
      };
      setTeams([a, b]);
      setMeId(a.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (posts.length === 0 && teams.length >= 2) {
      const now = new Date();
      const p1: ScrimPost = {
        id: uid(),
        createdAt: Date.now(),
        ownerTeamId: teams[1]?.id || teams[0].id,
        timeISO: tzDateISO(new Date(now.getTime() + 1000 * 60 * 60 * 26).toISOString()),
        durationMin: 90,
        region: "ASIA",
        platform: "PC",
        srMin: 3200,
        srMax: 3800,
        format: "BO5",
        comms: "Discord VC",
        note: "Prefer Push/Control maps.",
        status: "open",
        applicantTeamIds: []
      };
      setPosts([p1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.length]);

  // expire old posts
  useEffect(() => {
    const now = Date.now();
    setPosts((prev) =>
      prev.map((p) =>
        new Date(p.timeISO).getTime() + p.durationMin * 60_000 < now && p.status === "open"
          ? { ...p, status: "expired" }
          : p
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">OW2 スクリム・MVP</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">ログイン中:</span>
          <select
            className="border rounded px-2 py-1 bg-white"
            value={meId || ""}
            onChange={(e) => setMeId(e.target.value)}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            className="ml-2 text-sm px-3 py-1 rounded bg-black text-white"
            onClick={() => setTab("team")}
          >
            チーム設定
          </button>
        </div>
      </header>

      <nav className="mb-6 flex gap-2 flex-wrap">
        {[
          { id: "board", label: "募集ボード" },
          { id: "new", label: "募集を作成" },
          { id: "draft", label: "マップドラフト" },
          { id: "pickban", label: "ヒーローピック/BAN" },
          { id: "team", label: "マイチーム" }
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={`px-3 py-2 rounded-2xl border ${
              tab === id ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "board" && (
        <Board me={me} teams={teams} posts={posts} setPosts={setPosts} />
      )}
      {tab === "new" && me && (
        <NewPost me={me} add={(p) => setPosts((prev) => [p, ...prev])} />
      )}
      {tab === "draft" && <MapDraft />}
      {tab === "pickban" && <HeroPickBan />}
      {tab === "team" && (
        <TeamSettings teams={teams} setTeams={setTeams} meId={meId} setMeId={setMeId} />
      )}

      <footer className="mt-10 text-xs text-gray-600">
        <p>ローカル保存のデモです。実運用では Discord OAuth / DB / 通知 を接続します。</p>
      </footer>
    </div>
  );
}

// --- Board ---
function Board({
  me,
  teams,
  posts,
  setPosts
}: {
  me: Team | null;
  teams: Team[];
  posts: ScrimPost[];
  setPosts: React.Dispatch<React.SetStateAction<ScrimPost[]>>;
}) {
  const [srMin, setSrMin] = useState<number | "">("");
  const [srMax, setSrMax] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [region, setRegion] = useState<Region | "">("");

  const filtered = posts
    .filter((p) => {
      if (p.status === "expired") return false;
      if (srMin !== "" && (p.srMin || 0) < Number(srMin)) return false;
      if (srMax !== "" && (p.srMax || 9999) > Number(srMax)) return false;
      if (dateFrom && new Date(p.timeISO) < new Date(dateFrom)) return false;
      if (region && p.region !== region) return false;
      return true;
    })
    .sort((a, b) => new Date(a.timeISO).getTime() - new Date(b.timeISO).getTime());

  const apply = (postId: string) => {
    if (!me) return alert("チーム選択が必要です");
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              applicantTeamIds: Array.from(
                new Set([...(p.applicantTeamIds || []), me.id])
              )
            }
          : p
      )
    );
  };

  const accept = (postId: string, applicantId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status: "booked", bookedWithTeamId: applicantId } : p))
    );
  };

  return (
    <div>
      <div className="grid sm:grid-cols-4 gap-2 mb-4">
        <input
          className="border rounded px-3 py-2 bg-white"
          placeholder="SR下限"
          value={srMin}
          onChange={(e) => setSrMin(e.target.value ? Number(e.target.value) : "")}
        />
        <input
          className="border rounded px-3 py-2 bg-white"
          placeholder="SR上限"
          value={srMax}
          onChange={(e) => setSrMax(e.target.value ? Number(e.target.value) : "")}
        />
        <input
          className="border rounded px-3 py-2 bg-white"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2 bg-white"
          value={region}
          onChange={(e) => setRegion(e.target.value as any)}
        >
          <option value="">地域すべて</option>
          <option value="ASIA">ASIA</option>
          <option value="NA">NA</option>
          <option value="EU">EU</option>
        </select>
      </div>

      <ul className="grid gap-3">
        {filtered.length === 0 && <div className="text-gray-600">一致する募集がありません。</div>}
        {filtered.map((p) => {
          const owner = teams.find((t) => t.id === p.ownerTeamId);
          const bookedWith = teams.find((t) => t.id === p.bookedWithTeamId || "");
          return (
            <li key={p.id} className="border rounded-xl p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="text-lg font-semibold">{owner?.name} の募集</div>
                  <div className="text-sm text-gray-600">
                    開始 {fmt(p.timeISO)} / {p.durationMin}分
                  </div>
                </div>
                <div className="flex gap-2">
                  {chip(p.region)}
                  {chip(p.platform)}
                  {chip(p.format)}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <div>SR: {p.srMin ?? "-"} ~ {p.srMax ?? "-"}</div>
                <div>Comms: {p.comms}</div>
                {p.note && <div className="text-gray-700">備考: {p.note}</div>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  連絡先: <span className="font-medium">{owner?.discord}</span>
                </div>
                <div className="flex items-center gap-2">
                  {p.status === "open" && (
                    <button className="px-3 py-1 rounded bg-black text-white" onClick={() => apply(p.id)}>
                      応募する
                    </button>
                  )}
                  {p.status === "booked" && (
                    <span className="text-green-700 font-medium">予約済: {bookedWith?.name}</span>
                  )}
                  {p.status === "pending" && <span className="text-amber-700">確認中</span>}
                </div>
              </div>

              {p.ownerTeamId === me?.id && p.applicantTeamIds.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <div className="text-sm font-semibold mb-2">応募チーム</div>
                  <div className="flex flex-wrap gap-2">
                    {p.applicantTeamIds.map((id) => {
                      const t = teams.find((tt) => tt.id === id);
                      if (!t) return null;
                      return (
                        <div key={id} className="flex items-center gap-2 border rounded-lg px-2 py-1 bg-white">
                          <span>
                            {t.name}（{t.rankTier ?? "-"} {t.rankDiv ?? "-"}）
                          </span>
                          <button
                            className="text-sm px-2 py-0.5 rounded bg-gray-900 text-white"
                            onClick={() => accept(p.id, id)}
                          >
                            確定
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- New Post ---
function NewPost({ me, add }: { me: Team; add: (p: ScrimPost) => void }) {
  const [timeISO, setTimeISO] = useState<string>(
    () => new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().slice(0, 16)
  );
  const [durationMin, setDurationMin] = useState(90);
  const [region, setRegion] = useState<Region>("ASIA");
  const [platform, setPlatform] = useState<Platform>("PC");
  const [srMin, setSrMin] = useState<number | "">("");
  const [srMax, setSrMax] = useState<number | "">("");
  const [format, setFormat] = useState("BO5");
  const [comms, setComms] = useState("Discord VC");
  const [note, setNote] = useState("");

  const submit = () => {
    const p: ScrimPost = {
      id: uid(),
      createdAt: Date.now(),
      ownerTeamId: me.id,
      timeISO: tzDateISO(timeISO),
      durationMin,
      region,
      platform,
      srMin: srMin === "" ? undefined : Number(srMin),
      srMax: srMax === "" ? undefined : Number(srMax),
      format,
      comms,
      note,
      status: "open",
      applicantTeamIds: []
    };
    add(p);
    alert("募集を作成しました（ローカル保存）");
  };

  return (
    <div className="grid gap-3 max-w-xl">
      <label className="grid gap-1">
        <span className="text-sm text-gray-700">開始日時（JST）</span>
        <input
          type="datetime-local"
          className="border rounded px-3 py-2 bg-white"
          value={timeISO}
          onChange={(e) => setTimeISO(e.target.value)}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-gray-700">所要時間（分）</span>
        <input
          type="number"
          className="border rounded px-3 py-2 bg-white"
          value={durationMin}
          onChange={(e) => setDurationMin(Number(e.target.value))}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-gray-700">地域</span>
          <select
            className="border rounded px-3 py-2 bg-white"
            value={region}
            onChange={(e) => setRegion(e.target.value as Region)}
          >
            <option>ASIA</option>
            <option>NA</option>
            <option>EU</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-700">プラットフォーム</span>
          <select
            className="border rounded px-3 py-2 bg-white"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
          >
            <option>PC</option>
            <option>Console</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-gray-700">SR下限</span>
          <input
            type="number"
            className="border rounded px-3 py-2 bg-white"
            value={srMin}
            onChange={(e) => setSrMin(e.target.value ? Number(e.target.value) : "")}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-700">SR上限</span>
          <input
            type="number"
            className="border rounded px-3 py-2 bg-white"
            value={srMax}
            onChange={(e) => setSrMax(e.target.value ? Number(e.target.value) : "")}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-gray-700">形式</span>
          <select
            className="border rounded px-3 py-2 bg-white"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option>BO3</option>
            <option>BO5</option>
            <option>時間制</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-700">Comms</span>
          <input
            className="border rounded px-3 py-2 bg-white"
            value={comms}
            onChange={(e) => setComms(e.target.value)}
          />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="text-sm text-gray-700">備考</span>
        <textarea
          className="border rounded px-3 py-2 bg-white"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例: タンク練習、マップ指定 など"
        />
      </label>
      <button onClick={submit} className="mt-2 px-4 py-2 rounded bg-black text-white w-fit">
        募集を公開
      </button>
    </div>
  );
}

// --- Team Settings (平均ランク: ティア+ディビジョン) ---
function TeamSettings({
  teams,
  setTeams,
  meId,
  setMeId
}: {
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  meId: string | null;
  setMeId: (id: string | null) => void;
}) {
  const me = teams.find((t) => t.id === meId) || teams[0];
  const [name, setName] = useState(me?.name || "");
  const [discord, setDiscord] = useState(me?.discord || "");
  const [rankTier, setRankTier] = useState<RankTier | "">(me?.rankTier || "");
  const [rankDiv, setRankDiv] = useState<1 | 2 | 3 | 4 | 5 | "">(me?.rankDiv || "");
  const [note, setNote] = useState(me?.note || "");

  useEffect(() => {
    setName(me?.name || "");
    setDiscord(me?.discord || "");
    setRankTier(me?.rankTier || "");
    setRankDiv(me?.rankDiv || "");
    setNote(me?.note || "");
  }, [meId]);

  const save = () => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === me.id
          ? {
              ...t,
              name,
              discord,
              rankTier: (rankTier || undefined) as RankTier | undefined,
              rankDiv: (rankDiv || undefined) as 1 | 2 | 3 | 4 | 5 | undefined,
              note
            }
          : t
      )
    );
    alert("保存しました");
  };

  const create = () => {
    const t: Team = {
      id: uid(),
      name: name || `Team ${teams.length + 1}`,
      discord: discord || "@new-team",
      rankTier: (rankTier || undefined) as RankTier | undefined,
      rankDiv: (rankDiv || undefined) as 1 | 2 | 3 | 4 | 5 | undefined,
      note
    };
    setTeams((prev) => [...prev, t]);
    setMeId(t.id);
  };

  const TIERS: RankTier[] = [
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
    "Master",
    "Grandmaster",
    "Champion"
  ];

  return (
    <div className="grid gap-3 max-w-xl">
      <div className="text-sm text-gray-700">複数チームの切り替えが可能です。Discord を忘れずに。</div>
      <label className="grid gap-1">
        <span className="text-sm text-gray-700">チーム名</span>
        <input className="border rounded px-3 py-2 bg-white" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-gray-700">Discord 連絡先</span>
        <input
          className="border rounded px-3 py-2 bg-white"
          value={discord}
          onChange={(e) => setDiscord(e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-gray-700">平均ランク（ティア）</span>
          <select
            className="border rounded px-3 py-2 bg-white"
            value={rankTier as string}
            onChange={(e) => setRankTier(e.target.value as RankTier)}
          >
            <option value="">未設定</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-700">平均ランク（ディビジョン）</span>
          <select
            className="border rounded px-3 py-2 bg-white"
            value={(rankDiv as any) || ""}
            onChange={(e) => setRankDiv((Number(e.target.value) as 1 | 2 | 3 | 4 | 5) || ("" as any))}
          >
            <option value="">未設定</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-1">
        <span className="text-sm text-gray-700">紹介・メモ</span>
        <textarea
          className="border rounded px-3 py-2 bg-white"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <button className="px-4 py-2 rounded bg-black text-white" onClick={save}>
          保存
        </button>
        <button className="px-4 py-2 rounded border bg-white" onClick={create}>
          新規チーム作成
        </button>
      </div>
    </div>
  );
}

// --- Map Draft (1ラウンドごとに確定) ---
function MapDraft() {
  const [maps, setMaps] = useLocalStorage<Record<Mode, string[]>>(LS.maps, DEFAULT_MAPS);
  const [series, setSeries] = useState<"BO3" | "BO5">("BO5");
  const [order, setOrder] = useState<"A" | "B">("A");
  const [mode, setMode] = useState<Mode>("Control");
  const [customMap, setCustomMap] = useState("");

  const [picks, setPicks] = useState<string[]>([]);
  const [bans, setBans] = useState<string[]>([]);
  const [currentPick, setCurrentPick] = useState<string>("");
  const [slot, setSlot] = useState<number>(0);

  const targetCount = series === "BO3" ? 3 : 5;
  const seq = useMemo(() => {
    const arr = [] as ("A" | "B")[];
    for (let i = 0; i < targetCount; i++) {
      arr.push(i % 2 === 0 ? order : order === "A" ? "B" : "A");
    }
    return arr; // [A,B,A,B,A]
  }, [series, order, targetCount]);

  const pickable = maps[mode].filter((m) => !bans.includes(m) && !picks.includes(m));

  const confirmPick = () => {
    if (!currentPick) return alert("マップを選択してください");
    if (slot >= targetCount) return;
    const next = [...picks];
    next[slot] = currentPick;
    setPicks(next);
    setCurrentPick("");
    setSlot(slot + 1);
  };

  const addCustom = () => {
    if (!customMap.trim()) return;
    const mm = { ...maps };
    mm[mode] = [...mm[mode], customMap.trim()];
    setMaps(mm);
    setCustomMap("");
  };

  const reset = () => {
    setPicks([]);
    setBans([]);
    setCurrentPick("");
    setSlot(0);
  };

  return (
    <div className="grid gap-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 bg-white">
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm text-gray-700">シリーズ</label>
            <select
              className="border rounded px-2 py-1 bg-white"
              value={series}
              onChange={(e) => setSeries(e.target.value as any)}
            >
              <option>BO3</option>
              <option>BO5</option>
            </select>
            <label className="text-sm text-gray-700 ml-4">先手</label>
            <select
              className="border rounded px-2 py-1 bg-white"
              value={order}
              onChange={(e) => setOrder(e.target.value as any)}
            >
              <option value="A">チームA</option>
              <option value="B">チームB</option>
            </select>
            <button className="ml-auto px-3 py-1 rounded border bg-white" onClick={reset}>
              リセット
            </button>
          </div>

          <div className="text-sm text-gray-700 mb-2">ピック順: {seq.join(" → ")}</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from({ length: targetCount }).map((_, i) => (
              <div key={i} className={`p-3 border rounded-lg ${i === slot ? "bg-blue-50" : "bg-gray-50"}`}>
                <div className="text-xs text-gray-600 mb-1">
                  第{i + 1}マップ / {seq[i]}のピック {i === slot ? "(現在)" : ""}
                </div>
                <div className="font-medium">{picks[i] || "未選択"}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <select
              className="border rounded px-2 py-1 bg-white"
              value={currentPick}
              onChange={(e) => setCurrentPick(e.target.value)}
            >
              <option value="">マップを選択</option>
              {pickable.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button className="px-3 py-1 rounded bg-black text-white" onClick={confirmPick} disabled={slot >= targetCount}>
              このラウンドを確定
            </button>
          </div>
        </div>

        <div className="border rounded-xl p-4 bg-white">
          <div className="text-sm font-semibold mb-2">マッププール</div>
          <div className="flex items-end gap-2 mb-3">
            <select className="border rounded px-2 py-1 bg-white" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              {Object.keys(maps).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <input
              className="border rounded px-2 py-1 bg-white"
              placeholder="カスタムマップ名を追加"
              value={customMap}
              onChange={(e) => setCustomMap(e.target.value)}
            />
            <button className="px-3 py-1 rounded border bg-white" onClick={addCustom}>
              追加
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            {maps[mode].map((m) => (
              <div
                key={m}
                className={`flex items-center justify-between border rounded-lg px-3 py-2 bg-white ${
                  bans.includes(m) || picks.includes(m) ? "opacity-50" : ""
                }`}
              >
                <span>{m}</span>
                <div className="flex gap-2">
                  <button
                    className="text-xs px-2 py-1 rounded border bg-white"
                    onClick={() => setBans((prev) => (prev.includes(m) ? prev : [...prev, m]))}
                    disabled={bans.includes(m) || picks.includes(m)}
                  >
                    BAN
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-sm text-gray-700">BAN: {bans.join(", ") || "なし"}</div>
        </div>
      </div>

      <div className="border rounded-xl p-4 bg-white">
        <div className="text-sm font-semibold mb-2">エクスポート</div>
        <textarea
          className="w-full border rounded p-2 text-sm bg-white"
          rows={4}
          value={`シリーズ: ${series}\nピック順: ${seq.join(" → ")}\n選択マップ: ${picks.filter(Boolean).join(" / ")}\nBAN: ${bans.join(", ")}`}
          readOnly
        />
      </div>

      <div className="text-xs text-gray-700">※ 1ラウンドずつ確定。サイド選択/モード順自動化は拡張余地。</div>
    </div>
  );
}

// --- Hero Pick/BAN ---
// 仕様：PICK/BANどちら先行か選択、各チームの数(0〜10)、交互 or 片側まとめ、BANは「なし」可
function HeroPickBan() {
  // Config
  const [firstAction, setFirstAction] = useState<"BAN" | "PICK">("BAN");
  const [banPerTeam, setBanPerTeam] = useState<number>(2); // 0-10
  const [pickPerTeam, setPickPerTeam] = useState<number>(5); // 0-10
  const [sequence, setSequence] = useState<"ALTERNATE" | "TEAM_BY_TEAM">("ALTERNATE");

  // Session state
  const ALL_HEROES = useMemo(
    () => [...HEROES_BY_ROLE.Tank, ...HEROES_BY_ROLE.Damage, ...HEROES_BY_ROLE.Support],
    []
  );
  const [available, setAvailable] = useState<string[]>(ALL_HEROES);
  const [bansA, setBansA] = useState<string[]>([]);
  const [bansB, setBansB] = useState<string[]>([]);
  const [picksA, setPicksA] = useState<string[]>([]);
  const [picksB, setPicksB] = useState<string[]>([]);

  type Phase = "BAN" | "PICK";
  type TeamSide = "A" | "B";
  type Turn = { phase: Phase; side: TeamSide };
  const [queue, setQueue] = useState<Turn[]>([]);
  const [idx, setIdx] = useState(0);

  const [roleFilter, setRoleFilter] = useState<"All" | "Tank" | "Damage" | "Support">("All");
  const [select, setSelect] = useState<string>("");

  const buildQueue = () => {
    const other: Phase = firstAction === "BAN" ? "PICK" : "BAN";
    const build = (phase: Phase, perTeam: number): Turn[] => {
      const arr: Turn[] = [];
      if (perTeam <= 0) return arr;
      if (sequence === "ALTERNATE") {
        for (let i = 0; i < perTeam; i++) arr.push({ phase, side: "A" }, { phase, side: "B" });
      } else {
        for (let i = 0; i < perTeam; i++) arr.push({ phase, side: "A" });
        for (let i = 0; i < perTeam; i++) arr.push({ phase, side: "B" });
      }
      return arr;
    };

    const q = [
      ...build(firstAction, firstAction === "BAN" ? banPerTeam : pickPerTeam),
      ...build(other, other === "BAN" ? banPerTeam : pickPerTeam)
    ];
    setQueue(q);
    setIdx(0);
    setAvailable(ALL_HEROES);
    setBansA([]);
    setBansB([]);
    setPicksA([]);
    setPicksB([]);
    setSelect("");
  };

  const current = queue[idx];

  const visibleHeroes = useMemo(() => {
    const pool =
      roleFilter === "All"
        ? ALL_HEROES
        : HEROES_BY_ROLE[roleFilter as "Tank" | "Damage" | "Support"];
    return pool.filter((h) => available.includes(h));
  }, [ALL_HEROES, roleFilter, available]);

  const act = () => {
    if (!current) return;
    if (current.phase === "BAN") {
      if (select === "NONE") {
        if (current.side === "A") setBansA((p) => [...p, "なし"]);
        else setBansB((p) => [...p, "なし"]);
        setIdx(idx + 1);
        setSelect("");
        return;
      }
      if (!select) return alert("BANするヒーローを選択してください（または なし）");
      if (!available.includes(select)) return alert("選択不可です");
      setAvailable((prev) => prev.filter((h) => h !== select)); // BANは使用不可へ
      if (current.side === "A") setBansA((p) => [...p, select]);
      else setBansB((p) => [...p, select]);
      setIdx(idx + 1);
      setSelect("");
    } else {
      if (!select) return alert("PICKするヒーローを選択してください");
      if (!available.includes(select)) return alert("選択不可です");
      setAvailable((prev) => prev.filter((h) => h !== select));
      if (current.side === "A") setPicksA((p) => [...p, select]);
      else setPicksB((p) => [...p, select]);
      setIdx(idx + 1);
      setSelect("");
    }
  };

  const reset = () => {
    setQueue([]);
    setIdx(0);
    setAvailable(ALL_HEROES);
    setBansA([]);
    setBansB([]);
    setPicksA([]);
    setPicksB([]);
    setSelect("");
  };

  return (
    <div className="grid gap-4">
      {/* Config */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="grid md:grid-cols-4 gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">先に行うフェーズ</span>
            <select
              className="border rounded px-2 py-1 bg-white"
              value={firstAction}
              onChange={(e) => setFirstAction(e.target.value as any)}
            >
              <option value="BAN">BAN先行</option>
              <option value="PICK">PICK先行</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">BAN数（各チーム）</span>
            <select
              className="border rounded px-2 py-1 bg-white"
              value={banPerTeam}
              onChange={(e) => setBanPerTeam(Number(e.target.value))}
            >
              {Array.from({ length: 11 }).map((_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">PICK数（各チーム）</span>
            <select
              className="border rounded px-2 py-1 bg-white"
              value={pickPerTeam}
              onChange={(e) => setPickPerTeam(Number(e.target.value))}
            >
              {Array.from({ length: 11 }).map((_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">順序</span>
            <select
              className="border rounded px-2 py-1 bg-white"
              value={sequence}
              onChange={(e) => setSequence(e.target.value as any)}
            >
              <option value="ALTERNATE">A→B交互</option>
              <option value="TEAM_BY_TEAM">Aを先にまとめて→B</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="px-3 py-1 rounded bg-black text-white" onClick={buildQueue}>
            セッション開始
          </button>
          <button className="px-3 py-1 rounded border bg-white" onClick={reset}>
            リセット
          </button>
        </div>
        {queue.length > 0 && (
          <div className="mt-2 text-sm text-gray-700">
            手順: {queue.map((t, i) => `${t.side}-${t.phase}`).join(" → ")}
          </div>
        )}
      </div>

      {/* Turn & Selector */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-sm text-gray-700">
            現在: <span className="font-semibold">{current ? `${current.side} の ${current.phase}` : "完了"}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-gray-700">ロール</label>
            <select
              className="border rounded px-2 py-1 bg-white"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
            >
              <option>All</option>
              <option>Tank</option>
              <option>Damage</option>
              <option>Support</option>
            </select>
            <select
              className="border rounded px-2 py-1 bg-white"
              value={select}
              onChange={(e) => setSelect(e.target.value)}
            >
              <option value="">ヒーローを選択</option>
              {current?.phase === "BAN" && <option value="NONE">なし</option>}
              {visibleHeroes.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <button className="px-3 py-1 rounded bg-black text-white" onClick={act} disabled={!current}>
              確定
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Tank */}
          <div className="border rounded-lg p-3">
            <div className="font-semibold mb-2">タンク</div>
            <div className="flex flex-wrap gap-2">
              {HEROES_BY_ROLE.Tank.map((h) => (
                <span
                  key={h}
                  className={`text-xs px-2 py-1 border rounded-full ${
                    available.includes(h) ? "bg-gray-50" : "opacity-50 bg-gray-100"
                  }`}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
          {/* Damage */}
          <div className="border rounded-lg p-3">
            <div className="font-semibold mb-2">ダメージ</div>
            <div className="flex flex-wrap gap-2">
              {HEROES_BY_ROLE.Damage.map((h) => (
                <span
                  key={h}
                  className={`text-xs px-2 py-1 border rounded-full ${
                    available.includes(h) ? "bg-gray-50" : "opacity-50 bg-gray-100"
                  }`}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
          {/* Support */}
          <div className="border rounded-lg p-3">
            <div className="font-semibold mb-2">サポート</div>
            <div className="flex flex-wrap gap-2">
              {HEROES_BY_ROLE.Support.map((h) => (
                <span
                  key={h}
                  className={`text-xs px-2 py-1 border rounded-full ${
                    available.includes(h) ? "bg-gray-50" : "opacity-50 bg-gray-100"
                  }`}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Result */}
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
