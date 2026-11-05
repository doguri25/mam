// 「먼저 살펴볼 학생」과 위험 표현 규칙 — AI가 아니라 코드로, 이유를 교사가 그대로 읽을 수 있게
import { addDays } from "./date.ts";
import { CALM_KO, CALM_TOOLS, DEFAULT_RULES, RISK_CORE, groupOf, isHard, type Group, type MoodRecord, type Rules } from "./shared.ts";

// 위험 표현 찾기. 놓치는 것보다 잘못 거는 편이 낫다(선생님이 고른 「넓게 찾기」). 다만 터무니없이 걸리지는 않게.
// 견주기 전에 글과 말을 똑같이 고른다(norm): NFKC(반각 「ｼﾆﾀｲ」·전각 「ｋｉｌｌ」), 작은 글자, 둥근 따옴표 → ', 가타카나 → 히라가나,
// 보이지 않는 글자(폭 없는 빈칸·방향 표시·태그 글자·제어 글자)는 지운다. 빈칸처럼 보이는 한글 채움 문자(U+3164)는 FILL에 적은 대로 다룬다.
// · 한글·한자·가나 말
//   - 세 글자 이상(「죽고 싶」): 글자 사이에 빈칸·문장부호·기호·이모지·ㅠㅜ·「ー」가 끼어도 찾는다(「죽고ㅠㅠ싶어」「죽💀고 싶어」「しにたーい」).
//     끝 글자가 받침 없는 한글이면 받침이 붙은 꼴도 찾는다(「괴롭혀」→「괴롭혔어요」, 「다치게 하」→「다치게 함」).
//   - 두 글자 말(「자해」「왕따」)은 빈칸을 말에 빈칸이 있던 자리만 건너고 받침도 늘리지 않는다(「남자 해적」「놀자. 해 보자」「왕딸기」가 걸리지 않게).
//     한국어 두 글자 말은 글자 사이의 문장부호·기호·ㅠㅜ는 건넌다(「자.살」「자*해」).
//   - 평범한 말과 글자가 겹치면 그 말을 가리고 견준다(INNOCENT: 「わたしにたいせつ」「작은따옴표」「맛이 죽인다」).
//   - 끝 글자 받침이 ㅆ이면 ㅅ으로 잘못 친 꼴도 찾는다(「때렸」→「때렷어」, 「괴롭혔」→「괴롭혓어」).
// · 영어·베트남어처럼 빈칸으로 낱말을 나누는 말은 낱말 앞머리부터 견준다(「hit me」가 「white meat」에 걸리지 않게).
//   '는 빼고 견주고(「don't」=「dont」=「don’t」), 「do not」은 「dont」, 「wanna」는 「want to」로 본다.
//   성조가 붙은 말은 성조·모음 표시를 덜 친 낱말과도 견준다(「bi danh」「con muốn chet」). 다른 표시를 친 낱말은 다른 말이다(「bí danh」).
//   한 글자씩 띄어 쓴 영어(「k i l l m y s e l f」)는 붙여서 한 번 더 견준다.
// · 글자·숫자가 없는 말(「💀」「!!」)은 글에 그대로 들어 있을 때만 찾는다.
// · 몇 말은 사이에 말이 끼어도 찾는다(STRETCH): 「被打」→「我被爸爸用皮带打了」, 「bị đánh」→「Em bị bạn cùng lớp đánh」, 「사는 게 싫」→「사는게 너무 싫어」.
// 선생님 목록(words)에 RISK_CORE를 늘 더한다. 돌려주는 것은 걸린 말(선생님이 쓴 모양이 먼저, 같은 말·같은 자리에 걸린 말은 한 번만).
const CJK = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-鿿가-힯豈-﫿]/;
const CJK_RUN = new RegExp(`${CJK.source}+`, "g");
// 보이지 않는 글자: 폭 없는 빈칸·이음표, 방향 표시(LRM·RLM·ALM·양방향 꾸밈), 꾸밈 선택자, 태그 글자,
// 제어·서식 글자(\p{Cc}·\p{Cf}: U+0001·U+0085·U+FFF9·U+1D173 들 — 사이에 끼워 넣어 「죽고 싶어」가 빠져나가지 않게).
// 탭·줄바꿈 같은 빈칸 제어 글자(\t \n \v \f \r)는 지우지 않는다(낱말을 나누는 자리라서).
const INVISIBLE = /[\0-\x08\x0e-\x1f\x7f-\x9f\p{Cf}\u034f\u17b4\u17b5\u180b-\u180f\u2060-\u206f\ufe00-\ufe0f\u{e0000}-\u{e007f}\u{e0100}-\u{e01ef}]/gu;
// 빈칸처럼 보이는 글자(한글 채움 문자 U+3164·U+FFA0·U+115F·U+1160, 점자 빈칸 U+2800): 한글·한자·가나 말과 견줄 때는 지우고
// (「죽\u3164고\u3164싶어」→「죽고싶어」), 낱말로 견줄 때는 빈칸으로 본다(「i\u3164dont\u3164want…」→「i dont want…」)
const FILL = /[\u115f\u1160\u2800\u3164\uffa0]/g;
// 한글 낱자(ㅈㄱㅅㅇ·ㅠㅠ)는 NFKC에 넣지 않는다: NFKC는 「ㅇㅠ」를 「유」로 붙여 버린다
const norm = (s: string) =>
  s.replace(/[’‘ʼ＇`´′]/g, "'")
    .replace(INVISIBLE, "")
    .replace(/[^\u3130-\u318f]+/g, (m) => m.normalize("NFKC"))
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const normWord = (s: string) => norm(s).replace(FILL, " ");
// 고른 글을 낱말 사이 빈칸 하나로(한글·한자·가나 덩어리도 낱말 하나로 떼어 「나bully당했어」의 bully도 찾게)
const spaced = (s: string) =>
  ` ${s.replace(CJK_RUN, " $& ").replace(/'/g, "").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim()} `
    .replace(/ do not(?= )/g, " dont")
    .replace(/ wanna(?= )/g, " want to");
// 성조·모음 표시를 뗀 꼴(베트남어): muốn chết → muon chet
const bare = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").normalize("NFC");
// 같은 말 거르기: 한글·한자·가나 말은 빈칸·문장부호를 빼고, 다른 말은 낱말만 남겨 견준다(「hit-me」=「hit me」, 「kill my self」≠「kill myself」).
// 기호만 있는 말은 기호 그대로.
const keyOf = (w: string) => {
  const n = normWord(w).trim();
  if (!/[\p{L}\p{N}]/u.test(n)) return n.replace(/\s+/g, "");
  return CJK.test(n) ? n.replace(/[\s\p{P}]+/gu, "") : spaced(n).trim();
};
const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// 한글·한자·가나 말의 글자 사이에 끼어도 건너뛰는 것: 빈칸·문장부호·기호(이모지)·꾸밈 표시·ㅠㅜ, 일본어 늘임표와 작은 모음(「しにたーい」「しにたぁい」).
// 세 글자 이상인 말은 이것을 말과 글에서 모두 빼고(tight) 그대로 찾는다: 되짚기가 없어 말·글이 짓궂어도(「ㅠㅠㅠ싫」, ㅠ 2,000개) 빠르다.
const GAPS = /[\s\p{P}\p{S}\p{M}ㅠㅜーぁぃぅぇぉ]+/gu;
const HANGUL = /[ㄱ-ㆎ가-힣]/;
const openSyllable = (c: string) => c >= "가" && c <= "힣" && (c.charCodeAt(0) - 0xac00) % 28 === 0;
// 성조를 하나도 치지 않으면 견주지 않는 말: 「tu tu」는 「từ từ(천천히)」로 흔히 쓴다(「tu tử」「tự tu」는 찾는다)
const NO_BARE = new Set(["tu tu"]);
// 한국어 말 사이에 끼는 꾸밈말(「사는 게 너무 싫어」「살기 정말 싫어」)
const KO_MORE = "너무|정말|진짜|완전|넘|증말|참|다|좀|그냥|막|진심|넘나|맨날|매일|항상|늘";
// 위험 표현과 글자가 겹치는 평범한 말은 가리고 견준다. 빈칸·문장부호가 남은 글에서 가린 뒤에 빈칸·문장부호를 뺀다:
// 다 뺀 뒤에 가리면 문장이 끊긴 자리를 넘어 「しにたい。せつない」「しにたいよう。もういやだ」가 「たいせつ」「たいよう+も」로 가려진다.
// · 일본어: 「わたしにたいして(나에게)」「わたし に たいせつ(나에게 소중한)」「ほしにたいようがみえた(별에 해가)」「いっしょにたいいく(같이 체육)」
//   「わたしにたいこを(북)」「たいやき」「たいかいの(대회)」에 「しにたい」가, 「いちじさつまいもほり(한 시 고구마 캐기)」에 「じさつ」가,
//   「あついじめん(뜨거운 땅)」「むしあつい。じめじめ(눅눅)」에 「いじめ」가, 「りすかわいい(다람쥐 귀여워)」에 「リスカ」가 걸리지 않게.
//   「たいよう(해)」「たいこ(북)」는 뒤에 토씨가 올 때만 가린다: 「もうしにたいよう…(죽고 싶어…)」는 그대로 찾는다.
// · 한국어: 「마음은따뜻해」「작은따옴표」에 「은따」가, 「과자살래」「모자살거야」에 「자살」이, 「엄마는 내가 장난감 사는 거 싫어해요」(남이 싫어함)에
//   「사는 거 싫」이, 「공을 발로 찼어요」「맨발로 차가운」「두 발로 착지」「발로 차는 연습」에 「발로 차」가, 「열매를 맞혀」「남매 맞춤」에
//   「매를 맞」「매 맞」이, 「맛이 죽인다」에 「죽인다」가, 「차라리 죽을 먹을래」(먹는 죽)에 「차라리 죽」이 걸리지 않게.
const INNOCENT = new RegExp([
  "に\\s?たい(?:して|する|へん|せつ|よう(?=[がのはをにもとやへ])|こ(?=[をがはのもとや])|やき|いく|かい(?=[のでにがをはへ]))",
  "いっしょに(?=\\s?たい)", "さつまいも", "じめん(?!な)", "じめじめ", "りす(?=かわ)",
  "은따(?=뜻|옴)", "자살(?<=[과모]자살)(?=[래거게까러려])",
  `사는(?<=내가\\s+[^\\s.!?]+\\s+사는)\\s?[거게]\\s?(?:(?:${KO_MORE})\\s?)?싫(?=어하|어해|어했)`,
  "발로(?<=(?:공을?\\s?|맨)발로)(?=\\s?[차-찿])", "발로(?=\\s?(?:차가[운워웠]|착지|차는\\s?연습))",
  "매(?<=[열남자]매)(?=를?\\s?맞)", "매(?=를?\\s?맞[혀히춤춰추출췄])",
  "죽인(?<=맛(?:이|은|도)?\\s?(?:(?:진짜|정말|완전|너무|대박)\\s?)?죽인)(?=다)", "죽(?=(?:을|이|도|은|만)?\\s?먹)",
].join("|"), "gu");
// 영어 낱말로 견줄 때 가리는 평범한 말: 「I want to diet」의 diet가 「want to die」로, 「kick me the ball」(공을 차 줘)이 「kick me」로 걸리지 않게
const LOOSE_INNOCENT = / d(?=iet)| m(?=e the (?:ball|puck) )/g;
// 낱말 하나로만 찾는 말(앞머리만 같은 더 긴 낱말에는 걸지 않음)
const WHOLE = new Set(["kys"]);
// 한 글자씩 띄어 쓴 영어 낱말(「k i l l m y s e l f」): 붙여서 한 번 더 견준다
const SPELLED = /(?<= )[a-z](?: [a-z]){2,}(?= )/g;
// 문장·마디가 끊기는 자리(「bị…đánh」을 이 자리 너머까지 찾지 않게). 「...」「…」 말줄임은 끊긴 자리로 보지 않는다.
const BREAK = /[!?;,。！？、，\n]|(?<!\.)\.(?!\.)/;

// 낱말로 나눈 글(빈칸으로 낱말을 나누는 말과 견줄 때): 낱말, 성조를 뗀 낱말, loose에서 낱말 앞 빈칸의 자리, 앞에서 문장이 끊긴 낱말 번호
interface Words { toks: string[]; bare: string[]; at: number[]; cut: Set<number> }
// plain: 고른 글(한글·한자·가나 두 글자 말), tight: plain에서 GAPS를 뺀 글(세 글자 이상 말), loose·bareLoose·words: 낱말로 견주는 말, flat: 기호 말
interface Texts { plain: string; tight: string; loose: string; bareLoose: string; words: () => Words; flat: string }
// 걸리면 글의 어디에 걸렸는지(같은 자리에 걸린 다른 말을 거르려고), 아니면 null
type Find = (t: Texts) => string | null;

// open: 빈칸·문장부호가 남은 글. 주면 문장이 끊긴 자리(cut)도 적는다. 문장마다 나눈 낱말 수가 글 전체와 다르면(「do. not」) 모르는 것으로.
function wordsOf(loose: string, open?: string): Words {
  const toks = loose.trim() ? loose.trim().split(" ") : [];
  const at: number[] = [];
  let o = 0;
  for (const x of toks) {
    at.push(o);
    o += x.length + 1;
  }
  const cut = new Set<number>();
  if (open) {
    let n = 0;
    for (const part of open.split(BREAK)) {
      const k = spaced(part).trim();
      if (!k) continue;
      if (n) cut.add(n);
      n += k.split(" ").length;
    }
    if (n !== toks.length) cut.clear();
  }
  return { toks, bare: toks.map((x) => (/[^\x00-\x7f]/.test(x) ? bare(x) : x)), at, cut };
}

// 글 낱말 x가 목록 낱말 w와 같은 말인가: 같거나, 글자마다 w의 성조·모음 표시 가운데 일부만 쳤으면 같다(「chet」「chêt」→「chết」).
// w에 없는 표시를 친 글자가 있으면 다른 말이다(「bí」≠「bị」, 「từ」≠「tự」). prefix: x가 w로 시작하기만 해도 된다(끝 낱말).
const marksOf = (c: string) => c.normalize("NFD").slice(1);
function fits(x: string, w: string, prefix: boolean) {
  if (x === w || (prefix && x.startsWith(w))) return true;
  const xs = [...x];
  const ws = [...w];
  if (prefix ? xs.length < ws.length : xs.length !== ws.length) return false;
  return ws.every((c, i) => {
    const d = xs[i];
    if (d === c) return true;
    if (bare(d) !== bare(c)) return false;
    const m = marksOf(c);
    return [...marksOf(d)].every((k) => m.includes(k));
  });
}

// 낱말 P(성조를 뗀 꼴 B)가 글에 이어서 나오나. marked: 성조를 하나도 치지 않은 꼴은 빼고(「tu tu」)
function wordsFind(P: string[], B: string[], marked = false): Find {
  const last = P.length - 1;
  const lead = ` ${B.join(" ")}`;
  return (t) => {
    // 성조를 뗀 글로 먼저 빨리 거른다
    if (!t.bareLoose.includes(lead)) return null;
    const { toks, bare: bt, at } = t.words();
    const ok = (s: number, k: number) =>
      k === last ? bt[s].startsWith(B[k]) && fits(toks[s], P[k], true) : bt[s] === B[k] && fits(toks[s], P[k], false);
    for (let i = 0; i + last < toks.length; i++) {
      let k = 0;
      while (k <= last && ok(i + k, k)) k++;
      if (k <= last) continue;
      if (marked && toks.slice(i, i + last + 1).every((x, n) => x === bt[i + n])) continue;
      return `l${at[i]}:${at[i + last] + 1 + P[last].length - at[i]}`;
    }
    return null;
  };
}

// 「bị … đánh」: bị와 đánh 사이 네 낱말까지(「Em bị bạn cùng lớp đánh」), 문장이 끊긴 자리는 넘지 않고(「Con bị ốm. Đánh răng…」),
// đánh 뒤에 붙어 다른 뜻이 되는 말(이 닦기·악기·배드민턴·공·표시·평가·깨우기·철자)은 뺀다.
const VI_NOT_HIT = new Set(["răng", "đàn", "cầu", "bóng", "dấu", "giá", "thức", "vần"]);
// 성조 없이 써도 다른 뜻이 없는 것만 성조 없는 꼴도 뺀다(「dau」는 「đau(아파)」, 「roi」는 「rồi」일 수 있어 빼지 않는다)
const VI_NOT_HIT_BARE = new Set(["rang", "dan", "cau", "bong", "thuc", "gia"]);
function viBeaten(gap: number): Find {
  const len = "đánh".length + 1;
  return (t) => {
    if (!t.bareLoose.includes(" bi ") || !t.bareLoose.includes(" danh")) return null;
    const { toks, bare: bt, at, cut } = t.words();
    for (let i = 0; i < toks.length; i++) {
      if (bt[i] !== "bi" || !fits(toks[i], "bị", false)) continue;
      for (let j = i + 1; j <= i + 1 + gap && j < toks.length && !cut.has(j); j++) {
        if (!bt[j].startsWith("danh") || !fits(toks[j], "đánh", true)) continue;
        const next = cut.has(j + 1) ? "" : (toks[j + 1] ?? "");
        if (VI_NOT_HIT.has(next) || VI_NOT_HIT_BARE.has(next)) continue;
        return `l${at[i]}:${at[j] + len - at[i]}`;
      }
    }
    return null;
  };
}

// 고른 글(plain: 두 글자 말과 같은 자리 표시 c, tight: 세 글자 이상 말과 같은 자리 표시 g)에서 정규식으로 찾는 말
const reFind = (re: RegExp, on: "plain" | "tight"): Find => (t) => {
  const m = re.exec(t[on]);
  return m ? `${on === "plain" ? "c" : "g"}${m.index}:${m[0].length}` : null;
};
// 「被…打」 사이에 들어가도 되는 글자: 문장·마디가 끊기는 문장부호는 빼고
const ZH_IN = "[^。！？!?；;，,、.\\n]";
// 「打」 뒤에 붙어 때린 것이 아닌 말: 청소·전화·공놀이·경기·주사·열기·생각·인사·게임·꾸미기·천둥·지다/이기다·카드·글자·인쇄·물·밥·짐·차·일·할인·묻기·재채기·하품·졸기·북·눈싸움
const ZH_NOT_HIT = "扫|掃|电话|電話|篮球|籃球|羽毛球|乒乓球|网球|網球|排球|棒球|比赛|比賽|球|针|針|疫苗|开|開|算|招呼|游戏|遊戲|扮|雷|败|敗|赢|贏|卡|字|印|水|饭|飯|包|车|車|工|折|听|聽|喷嚏|噴嚏|哈欠|瞌睡|鼓|雪仗";
// 한국어 「싫」을 아이들이 흔히 치는 꼴
const KO_HATE = "싫|시러|실어|실타";

// 사이에 말이 끼어도 찾는 말(선생님 목록에 같은 말을 써도 이렇게 찾는다)
const STRETCH = new Map<string, Find>([
  // 「我被爸爸打了」「我被爸爸用皮带打了」「我被高年级的同学打了」: 被와 打 사이 여덟 글자까지(「我被叫去打扫教室」「我被邀请去打羽毛球」는 빼고)
  ["被打", reFind(new RegExp(`被${ZH_IN}{0,8}?打(?!${ZH_NOT_HIT})`, "u"), "plain")],
  ["被揍", reFind(new RegExp(`被${ZH_IN}{0,8}?揍`, "u"), "plain")],
  // 「Con bị bố đánh」「Con bị bố lấy roi đánh」「em bi ban danh」
  ["bị đánh", viBeaten(4)],
  // 「살기가 싫어」「살기 너무 싫어」「사는게 너무 싫어」「사는 게 시러」: 토씨·꾸밈말이 끼거나 「싫」을 다르게 쳐도.
  // 바로 붙은 「살기 시러」「살기 실어」는 핵심 목록의 제 말로 찾는다(걸린 말을 그대로 보여 주려고).
  ["살기싫", reFind(new RegExp(`살기싫|살기(?:[가는도](?:${KO_MORE})?|(?:${KO_MORE}))(?:${KO_HATE})`, "u"), "tight")],
  ["사는게싫", reFind(new RegExp(`사는(?:게|것이)(?:${KO_MORE})?(?:${KO_HATE})`, "u"), "tight")],
  ["사는거싫", reFind(new RegExp(`사는(?:거|건)(?:${KO_MORE})?(?:${KO_HATE})`, "u"), "tight")],
  // 「ぼくをなぐった」「おとうさんがぼくをたたく」「ママがわたしをける」: 나를 때리는 말(「たいこをたたく」「ボールをける」「わたしをなぐさめた」는 빼고)
  ["ぼくをたたく", reFind(/(?:ぼく|わたし|おれ|あたし|僕|私|俺)を(?:たたい(?=[たて])|たたく|叩[いくか]|なぐっ(?=[たて])|なぐる|殴|けっ(?=[たて])|ける|蹴)/u, "tight")],
]);

// 받침 ㅆ을 ㅅ으로 잘못 친 글자(「렸」→「렷」), 아니면 ""
const typoOf = (c: string) => (c >= "가" && c <= "힣" && (c.charCodeAt(0) - 0xac00) % 28 === 20 ? String.fromCharCode(c.charCodeAt(0) - 1) : "");
// 두 글자 말의 글자 사이에서 건너는 것: 빈칸이 없던 자리는 문장부호·기호·ㅠㅜ만(SKIP), 빈칸이 있던 자리는 빈칸까지(SKIP_SP)
const SKIP = "[\\p{P}\\p{S}\\p{M}ㅠㅜーぁぃぅぇぉ]*";
const SKIP_SP = "[\\s\\p{P}\\p{S}\\p{M}ㅠㅜーぁぃぅぇぉ]*";

function cjkFind(w: string): Find {
  // 건너뛸 수 있는 글자를 뺀 말이 tight에 있나. 끝 글자가 받침 없는 한글이면 받침이 붙은 글자도, 받침이 ㅆ이면 ㅅ도 된다.
  const core = [...w.replace(GAPS, "")];
  if (core.length >= 3) {
    const last = core.pop()!;
    const head = core.join("");
    const top = openSyllable(last) ? String.fromCharCode(last.charCodeAt(0) + 27) : last;
    const typo = typoOf(last);
    return (t) => {
      for (let i = t.tight.indexOf(head); i >= 0; i = t.tight.indexOf(head, i + 1)) {
        const c = String.fromCodePoint(t.tight.codePointAt(i + head.length) ?? 0);
        if ((c >= last && c <= top) || c === typo) return `g${i}:${head.length + c.length}`;
      }
      return null;
    };
  }
  let src: string;
  if (core.length === 2 && HANGUL.test(core.join(""))) {
    // 두 글자 한국어: 바로 붙었거나(말에 빈칸이 있었으면 빈칸만 끼고), 낱말 첫머리에서 문장부호·기호·ㅠㅜ가 낀 것(「자.살」「자*해」「자ㅠ해」).
    // 빈칸은 말에 빈칸이 있던 자리만 건너고(「남자 해적」「놀자. 해 보자」는 빼고), 앞 낱말의 끝 글자에서 시작하면 문장부호를 건너지 않는다
    // (「가자,해바라기」「남자,해적」「열매. 맞아」가 걸리지 않게).
    // 중국어·일본어 두 글자 말(「去死」「打我」)은 문장부호를 건너지 않는다: 쉼표·마침표가 마디를 나눠 「去，死」「打，我」가 엉뚱하게 이어진다.
    const [a, b] = core;
    const space = /\s/.test(w.slice(w.indexOf(a) + a.length, w.lastIndexOf(b)));
    const typo = typoOf(b);
    const last = typo ? `[${b}${typo}]` : esc(b);
    src = `${esc(a)}${space ? "\\s*" : ""}${last}|(?<![ㄱ-ㆎ가-힣])${esc(a)}${space ? SKIP_SP : SKIP}${last}`;
  } else {
    // 글자가 하나 이하로 남으면(「ㅠㅠ」「💀죽」) 쓴 그대로 찾는다(말에 빈칸이 있던 자리만 빈칸을 건너)
    src = w.split(/[\s\p{P}]+/u).filter(Boolean).map((p) => [...p].map(esc).join("")).join("\\s*");
  }
  return reFind(new RegExp(src, "u"), "plain");
}

function compile(raw: string, key: string): Find | null {
  const stretch = STRETCH.get(key);
  if (stretch) return stretch;
  const w = normWord(raw).trim();
  if (!w) return null;
  if (!/[\p{L}\p{N}]/u.test(w)) {
    const lit = w.replace(/\s+/g, "");
    return (t) => {
      const i = t.flat.indexOf(lit);
      return i < 0 ? null : `s${i}:${lit.length}`;
    };
  }
  if (CJK.test(w)) return cjkFind(w);
  const p = spaced(w).trimEnd();
  const whole = WHOLE.has(key) ? `${p} ` : p;
  const loose: Find = (t) => {
    const i = t.loose.indexOf(whole);
    return i < 0 ? null : `l${i}:${p.length}`;
  };
  const P = p.trim().split(" ");
  const B = P.map(bare);
  if (B.every((b, k) => b === P[k])) return loose;
  const near = wordsFind(P, B, NO_BARE.has(B.join(" ")));
  return (t) => loose(t) ?? near(t);
}

// 목록마다 한 번만 만들어 둔다(기록을 저장할 때마다 부르므로). latin: 낱말로 견주는 말(띄어 쓴 영어를 붙여 한 번 더 견줄 말)
const compiled = new Map<string, { word: string; find: Find; latin: boolean }[]>();
function matchersFor(words: string[]) {
  const id = JSON.stringify(words); // 낱말 안의 글자로 열쇠를 꾸며 다른 반 목록과 같은 열쇠를 만들 수 없게
  let list = compiled.get(id);
  if (list) return list;
  list = [];
  const seen = new Set<string>();
  for (const raw of [...words, ...RISK_CORE]) {
    const word = String(raw).trim();
    const key = keyOf(word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const find = compile(word, key);
    const w = normWord(word);
    if (find) list.push({ word, find, latin: /[\p{L}\p{N}]/u.test(w) && !CJK.test(w) });
  }
  if (compiled.size >= 32) compiled.delete(compiled.keys().next().value!);
  compiled.set(id, list);
  return list;
}

export function matchRisk(text: string, words: string[]) {
  const n = norm(text);
  const open = n.replace(FILL, " ");
  // 평범한 말은 빈칸·문장부호가 남은 글에서 가린 뒤(plain) 빈칸·문장부호를 뺀다(tight)
  const plain = n.replace(FILL, "").replace(INNOCENT, (m) => "\u0001".repeat(m.length));
  const loose = spaced(open).replace(LOOSE_INNOCENT, " \u0001");
  let ws: Words | undefined;
  const t: Texts = {
    plain,
    tight: plain.replace(GAPS, ""),
    loose,
    bareLoose: bare(loose),
    words: () => (ws ??= wordsOf(loose, open)),
    flat: open.replace(/\s+/g, ""),
  };
  const list = matchersFor(words);
  const out: string[] = [];
  // again: 띄어 쓴 영어를 붙인 글로 두 번째 견주기(낱말로 견주는 말 가운데 아직 걸리지 않은 말만)
  const run = (x: Texts, again: boolean) => {
    const at = new Set<string>();
    for (const { word, find, latin } of list) {
      if (again && (!latin || out.includes(word))) continue;
      const where = find(x);
      if (where && !at.has(where)) {
        at.add(where);
        out.push(word);
      }
    }
  };
  run(t, false);
  // 한 글자씩 띄어 쓴 영어(「k i l l m y s e l f」「k y s」)는 붙여서 낱말 말만 한 번 더 견준다
  const glued = loose.replace(SPELLED, (m) => m.replace(/ /g, ""));
  if (glued !== loose) {
    let gw: Words | undefined;
    run({ ...t, loose: glued, bareLoose: bare(glued), words: () => (gw ??= wordsOf(glued)) }, true);
  }
  return out;
}

// 기쁨·평온은 +세기, 힘든 감정은 −세기
function score(r: MoodRecord) {
  return (isHard(r.emotion) ? -1 : 1) * r.intensity;
}

export interface Flag {
  no: number;
  reasons: string[];
}

export function watchFlags(records: MoodRecord[], today: string, rules: Rules = DEFAULT_RULES): Flag[] {
  const from = addDays(today, -6);
  const byNo = new Map<number, MoodRecord[]>();
  for (const r of records) {
    if (r.date < from || r.date > today) continue;
    byNo.set(r.no, [...(byNo.get(r.no) ?? []), r]);
  }

  const flags: Flag[] = [];
  for (const [no, list] of byNo) {
    const reasons: string[] = [];
    const days = [...new Set(list.map((r) => r.date))].sort().reverse();

    // ① 기록한 날 기준 최근 날부터, 그날 기록이 모두 힘든 감정인 날이 이어짐
    let streak = 0;
    for (const d of days) {
      if (list.filter((r) => r.date === d).every((r) => isHard(r.emotion))) streak++;
      else break;
    }
    if (streak >= rules.streakDays) reasons.push(`힘든 마음이 기록한 날 ${streak}번 이어졌어요`);

    // ② 아침보다 하교 전 마음이 크게(4 이상) 가라앉은 날
    const drops = days.filter((d) => {
      const am = list.find((r) => r.date === d && r.slot === "am");
      const pm = list.find((r) => r.date === d && r.slot === "pm");
      return am && pm && score(am) - score(pm) >= 4;
    }).length;
    if (drops >= rules.dropDays) reasons.push(`아침보다 하교 전 마음이 크게 가라앉은 날이 ${drops}번 있어요`);

    // ③ 같은 까닭으로 힘든 마음
    const count = new Map<string, number>();
    for (const r of list) if (isHard(r.emotion) && r.reason !== "그냥") count.set(r.reason, (count.get(r.reason) ?? 0) + 1);
    for (const [reason, n] of count) if (n >= rules.reasonTimes) reasons.push(`「${reason}」 때문에 힘든 마음이 ${n}번 있었어요`);

    if (reasons.length) flags.push({ no, reasons });
  }
  return flags.sort((a, b) => a.no - b.no);
}

// 반에서 누군가 기록한 최근 n일(수업한 날) 동안 한 번도 기록하지 않은 학생
export function absentStudents(records: MoodRecord[], nos: number[], today: string, days: number) {
  const classDays = [...new Set(records.filter((r) => r.date <= today).map((r) => r.date))].sort().reverse().slice(0, days);
  if (classDays.length < days) return [];
  const seen = new Set(records.filter((r) => classDays.includes(r.date)).map((r) => r.no));
  return nos.filter((no) => !seen.has(no));
}

// 응원 초안·한 주 돌아보기 답에서 아이에게 그대로 옮기면 안 되는 선생님용 표현(횟수·날수·기록 이름).
// 「네 일처럼 기뻤구나」「규칙을 잘 지켰구나」「다음엔 네 차례야」「마음이 보내는 신호」 같은 평범한 말은 지나간다.
const LEAK = new RegExp([
  String.raw`\d+\s*(?:번(?!호)|일|회|차례)(?:째)?`, // 3번, 2일, 4회째
  String.raw`\d+\s*(?:times?|days?|次|天|回|日|lần|ngày)`, // 다른 언어로 쓴 답의 횟수·날수
  String.raw`(?<![가-힣])(?:두|세|네|다섯|여섯)\s*번(?!호)(?:째)?`, // 두 번, 세 번째(「네 번호」는 빼고)
  String.raw`(?<![가-힣])(?:두|세|다섯|여섯)\s*차례`, // 「네 차례」는 「너의 차례」로 흔히 쓰여 뺀다
  "이틀|사흘|나흘|닷새|며칠째|며칠 동안",
  String.raw`한\s?줄`, // 기록 칸 이름 「한줄」
  String.raw`(?<!신|최고\s?|달리기\s?|줄넘기\s?)기록`, // 「신기록」「달리기 기록」은 평범한 말
  String.raw`선생님이\s?본\s?신호|되묻기`, // 응원 초안에 넘긴 칸 이름
].join("|"), "g");
export function leaks(text: string) {
  return text.match(LEAK) ?? [];
}

// 주간 요약용 숫자 묶음: 학생 이름·번호는 넣지 않는다(AI로 가는 것)
export function weekStats(week: MoodRecord[], prev: MoodRecord[], rules: Rules, today: string) {
  const count = (xs: string[]) => Object.fromEntries([...new Set(xs)].map((k) => [k, xs.filter((x) => x === k).length]));
  const words = (rs: MoodRecord[]) => rs.map((r) => r.word).filter((w): w is string => !!w);
  const drops = week.filter((pm) => {
    if (pm.slot !== "pm") return false;
    const am = week.find((r) => r.no === pm.no && r.date === pm.date && r.slot === "am");
    return am && (isHard(am.emotion) ? -1 : 1) * am.intensity - (isHard(pm.emotion) ? -1 : 1) * pm.intensity >= 4;
  }).length;
  const thisWords = count(words(week));
  return {
    기록수: week.length,
    기록한학생수: new Set(week.map((r) => r.no)).size,
    날마다기록수: count(week.map((r) => r.date)),
    감정무리: count(week.map((r) => GROUP_LABEL[groupOf(r.emotion)])),
    힘든마음의까닭: count(week.filter((r) => isHard(r.emotion)).map((r) => r.reason)),
    하교전가라앉은날: drops,
    먼저살펴볼학생수: watchFlags(week, today, rules).length,
    위험표현수: week.filter((r) => r.risk).length,
    쓴감정단어: Object.entries(thisWords).sort((a, b) => b[1] - a[1]).slice(0, 8),
    쓴감정단어종류: Object.keys(thisWords).length,
    지난주감정단어종류: new Set(words(prev)).size,
    마음다스리기: calmStats(week),
  };
}

// 마음 다스리기 도구별로 몇 번 썼고, 그중 「조금 나아졌어요」가 몇 번인지(이름·번호 없이)
export function calmStats(records: MoodRecord[]) {
  const uses = records.flatMap((r) => r.calm ?? []);
  return Object.fromEntries(
    CALM_TOOLS.filter((t) => uses.some((u) => u.tool === t)).map((t) => {
      const mine = uses.filter((u) => u.tool === t);
      return [CALM_KO[t], { 횟수: mine.length, 나아짐: mine.filter((u) => u.felt === "better").length }];
    }),
  );
}

// 교실 TV 「우리 반 마음 날씨」: 이름·번호 없이 감정 무리 수와 감정 단어만. 위험 표현 여부는 넣지 않는다.
export type Weather = "sunny" | "warm" | "rain" | "storm" | "fog" | "partly" | "cloudy" | "rainbow";
export function classWeather(records: MoodRecord[]) {
  const groups: Record<Group, number> = { joy: 0, calm: 0, sad: 0, angry: 0, fear: 0 };
  for (const r of records) groups[groupOf(r.emotion)]++;
  const n = records.length;
  const words = Object.entries(
    records.reduce<Record<string, number>>((m, r) => (r.word ? { ...m, [r.word]: (m[r.word] ?? 0) + 1 } : m), {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const ranked = (Object.entries(groups) as [Group, number][]).sort((a, b) => b[1] - a[1]);
  const [top, topN] = ranked[0];
  const tie = ranked[1][1] === topN; // 반반으로 갈리면 한쪽 날씨로 정하지 않는다(기쁨 5·슬픔 5가 「맑음」이 되지 않게)
  const light = (groups.joy + groups.calm) / (n || 1);
  const weather: Weather =
    n === 0 ? "partly"
    : topN / n >= 0.5 && !tie ? ({ joy: "sunny", calm: "warm", sad: "rain", angry: "storm", fear: "fog" } as const)[top]
    : light >= 0.6 ? "partly"
    : light <= 0.4 ? "cloudy"
    : "rainbow";
  return { n, groups, words, weather };
}
const GROUP_LABEL = { joy: "기쁨", calm: "평온", sad: "슬픔", angry: "화남", fear: "불안" } as const;

// 활동지 피드백: 스캔한 순서대로 쪽을 학생 번호에 붙인다. 전출·결석으로 활동지가 없는 번호는 건너뛴다.
export const parseNums = (text: string) => [...new Set((text.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n < 100))].sort((a, b) => a - b);
export function sheetGroups(pageCount: number, pagesPer: number, skip: number[]) {
  const out: { no: number; pages: number[] }[] = [];
  let no = 0;
  for (let p = 1; p <= pageCount; p += pagesPer) {
    do no++; while (skip.includes(no));
    out.push({ no, pages: Array.from({ length: Math.min(pagesPer, pageCount - p + 1) }, (_, i) => p + i) });
  }
  return out;
}
