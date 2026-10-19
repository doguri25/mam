"use client";
// 공감 쪽지: 친구에게 따뜻한 한마디를 쓰면 선생님이 먼저 읽고 전해 준다. 받은 쪽지·보낸 쪽지도 여기서 본다.
import { useCallback, useEffect, useState } from "react";
import BuddyLazy from "@/components/BuddyLazy";
import StudentFrame, { Loading, useStudent } from "@/components/StudentFrame";
import { api } from "@/lib/api";
import type { UIKey } from "@/lib/i18n";

type Inbox = { id: string; text: string; from: string | null; at: string; read: boolean };
type Sent = { id: string; text: string; to: string; status: "wait" | "ok" | "no"; at: string };
type Tab = "inbox" | "write" | "sent";

export default function LettersPage() {
  const { me, lang, tt } = useStudent();
  const [tab, setTab] = useState<Tab>("inbox");
  const [box, setBox] = useState<{ inbox: Inbox[]; sent: Sent[] } | null>(null);
  const [friends, setFriends] = useState<{ no: number; alias: string }[]>([]);
  const [to, setTo] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [showName, setShowName] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cheer, setCheer] = useState(0);

  const load = useCallback(async () => {
    const b = await api<{ inbox: Inbox[]; sent: Sent[] }>("student", "letters");
    setBox(b);
    // 받은 쪽지를 열어 보면 읽음으로
    for (const l of b.inbox.filter((x) => !x.read)) api("student", "readLetter", { id: l.id }).catch(() => {});
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load는 fetch가 끝난 뒤에만 setState한다
    load().catch(() => {});
    api<{ friends: { no: number; alias: string }[] }>("student", "classmates").then((r) => setFriends(r.friends), () => {});
  }, [load]);

  if (!me || !box) return <Loading />;

  async function send() {
    setMsg(null);
    try {
      await api("student", "letter", { to, text, showName, lang });
      setMsg({ ok: true, text: tt("lettersSentOk") });
      setText("");
      setTo(null);
      setCheer((n) => n + 1);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  const tabs: [Tab, UIKey][] = [["inbox", "lettersInbox"], ["write", "lettersWrite"], ["sent", "lettersSent"]];
  const unread = box.inbox.filter((l) => !l.read).length;

  return (
    <StudentFrame title={tt("tileLetters")} lang={lang} wide>
      <div role="tablist" className="mb-4 grid grid-cols-3 gap-2">
        {tabs.map(([id, k]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setMsg(null); }} className={`min-h-14 rounded-2xl text-lg font-bold ${tab === id ? "bg-leaf text-white" : "border border-line bg-card text-soft"}`}>
            {tt(k)}{id === "inbox" && unread > 0 && <span className="ml-1 rounded-full bg-alert px-2 text-sm text-white">{unread}</span>}
          </button>
        ))}
      </div>

      {tab === "inbox" && (
        <section className="space-y-3">
          {box.inbox.length ? box.inbox.map((l) => (
            <article key={l.id} className={`card space-y-2 ${!l.read ? "border-sun bg-[#fff8e1]" : ""}`}>
              <p className="text-sm font-bold text-soft">💌 {l.from ? tt("lettersFrom", { name: l.from }) : tt("lettersSecret")}</p>
              <p className="text-2xl leading-relaxed">{l.text}</p>
            </article>
          )) : (
            <div className="card flex flex-col items-center gap-3 text-center">
              <BuddyLazy look={me.look} size={160} className="size-32" />
              <p className="text-lg text-soft">{tt("lettersEmpty")}</p>
              <button onClick={() => setTab("write")} className="btn-main">{tt("lettersWrite")}</button>
            </div>
          )}
        </section>
      )}

      {tab === "write" && (
        <section className="card space-y-4">
          <h2 className="font-display text-2xl">{tt("lettersTo")}</h2>
          <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
            {friends.map((f) => (
              <button key={f.no} onClick={() => setTo(f.no)} aria-pressed={to === f.no} className={`chip min-h-14 px-2 py-2 text-base font-bold ${to === f.no ? "border-leaf bg-leaf-soft" : ""}`}>
                <span className="block text-xs font-normal text-soft">{f.no}</span>{f.alias}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="font-bold">{tt("lettersText")}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} rows={3} className="field mt-2 text-xl" />
          </label>
          <label className="flex min-h-12 items-center gap-3 text-lg">
            <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="size-6 accent-leaf" />
            {tt("lettersShowName")}
          </label>
          <p className="rounded-2xl bg-paper p-3 text-sm text-soft">{tt("lettersHint")}</p>
          {msg && <p className={msg.ok ? "text-lg text-leaf" : "text-alert"}>{msg.text}</p>}
          <div className="flex items-center justify-between gap-3">
            <BuddyLazy look={me.look} emotion="고마워요" cheer={cheer} size={110} className="size-24" />
            <button onClick={send} disabled={!to || text.trim().length < 2} className="btn-main px-10 text-lg">{tt("lettersSend")}</button>
          </div>
        </section>
      )}

      {tab === "sent" && (
        <section className="space-y-3">
          {box.sent.map((l) => (
            <article key={l.id} className="card flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm text-soft">→ {l.to}</p>
                <p className="text-lg">{l.text}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm ${l.status === "ok" ? "bg-leaf-soft text-leaf" : l.status === "no" ? "bg-alert-soft text-alert" : "bg-paper text-soft"}`}>
                {tt(`status_${l.status}` as UIKey)}
              </span>
            </article>
          ))}
          {!box.sent.length && <p className="card text-soft">—</p>}
        </section>
      )}
    </StudentFrame>
  );
}
