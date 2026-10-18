// 다문화 학생 지원: 학생 화면 글자·감정 이름·되묻기 기본 질문을 영어·중국어·베트남어·일본어로.
// 기록은 늘 한국어 감정 이름으로 저장하고(선생님 화면·규칙이 같게), 보여 줄 때만 바꾼다.

export type Lang = "ko" | "en" | "zh" | "vi" | "ja";
type Tr = Record<Exclude<Lang, "ko">, string>;

export const LANGS: { id: Lang; label: string; speech: string; ai: string }[] = [
  { id: "ko", label: "한국어", speech: "ko-KR", ai: "한국어" },
  { id: "en", label: "English", speech: "en-US", ai: "English" },
  { id: "zh", label: "中文", speech: "zh-CN", ai: "简体中文" },
  { id: "vi", label: "Tiếng Việt", speech: "vi-VN", ai: "Tiếng Việt" },
  { id: "ja", label: "日本語", speech: "ja-JP", ai: "日本語" },
];
export const isLang = (x: unknown): x is Lang => LANGS.some((l) => l.id === x);
export const langOf = (id: Lang) => LANGS.find((l) => l.id === id)!;

const tr = (en: string, zh: string, vi: string, ja: string): Tr => ({ en, zh, vi, ja });

const WORDS: Record<string, Tr> = {
  // 감정 12
  기뻐요: tr("Happy", "开心", "Vui", "うれしい"),
  신나요: tr("Excited", "兴奋", "Hào hứng", "わくわく"),
  고마워요: tr("Thankful", "感谢", "Biết ơn", "ありがとう"),
  편안해요: tr("Calm", "平静", "Bình yên", "おだやか"),
  "그저 그래요": tr("So-so", "一般般", "Bình thường", "まあまあ"),
  피곤해요: tr("Tired", "累", "Mệt", "つかれた"),
  걱정돼요: tr("Worried", "担心", "Lo lắng", "しんぱい"),
  무서워요: tr("Scared", "害怕", "Sợ", "こわい"),
  슬퍼요: tr("Sad", "难过", "Buồn", "かなしい"),
  속상해요: tr("Upset", "难受", "Khó chịu", "しょんぼり"),
  억울해요: tr("Unfair", "委屈", "Oan ức", "ふこうへい"),
  화나요: tr("Angry", "生气", "Tức giận", "おこってる"),
  // 더 꼭 맞는 말 36
  뿌듯해요: tr("Proud", "自豪", "Tự hào", "ほこらしい"),
  즐거워요: tr("Joyful", "快乐", "Vui vẻ", "たのしい"),
  행복해요: tr("Happy inside", "幸福", "Hạnh phúc", "しあわせ"),
  설레요: tr("Thrilled", "心动", "Háo hức", "ドキドキ"),
  들떠요: tr("Bubbly", "兴冲冲", "Phấn khởi", "うきうき"),
  짜릿해요: tr("Thrilling", "刺激", "Phấn khích", "スカッと"),
  감동했어요: tr("Touched", "感动", "Xúc động", "かんどう"),
  든든해요: tr("Supported", "踏实", "Yên tâm", "こころづよい"),
  따뜻해요: tr("Warm", "温暖", "Ấm áp", "あたたかい"),
  후련해요: tr("Relieved", "轻松", "Nhẹ nhõm", "すっきり"),
  느긋해요: tr("Relaxed", "悠闲", "Thong thả", "のんびり"),
  홀가분해요: tr("Light-hearted", "释然", "Thanh thản", "ほっとした"),
  심심해요: tr("Bored", "无聊", "Chán", "たいくつ"),
  멍해요: tr("Spaced out", "发呆", "Ngẩn ngơ", "ぼーっと"),
  무덤덤해요: tr("Not much", "无所谓", "Thờ ơ", "なんともない"),
  지쳤어요: tr("Worn out", "疲惫", "Kiệt sức", "へとへと"),
  졸려요: tr("Sleepy", "困", "Buồn ngủ", "ねむい"),
  "기운 없어요": tr("Low energy", "没力气", "Uể oải", "げんきがない"),
  불안해요: tr("Uneasy", "不安", "Bất an", "ふあん"),
  긴장돼요: tr("Nervous", "紧张", "Căng thẳng", "きんちょう"),
  조마조마해요: tr("On edge", "忐忑", "Hồi hộp", "ハラハラ"),
  겁나요: tr("Afraid", "胆怯", "Sợ sệt", "びくびく"),
  "깜짝 놀랐어요": tr("Startled", "吓一跳", "Giật mình", "びっくり"),
  오싹해요: tr("Creepy", "毛骨悚然", "Rợn người", "ぞっとする"),
  서운해요: tr("Hurt", "失落", "Tủi thân", "せつない"),
  외로워요: tr("Lonely", "孤单", "Cô đơn", "さびしい"),
  그리워요: tr("Missing someone", "想念", "Nhớ", "あいたい"),
  실망했어요: tr("Disappointed", "失望", "Thất vọng", "がっかり"),
  아쉬워요: tr("What a pity", "可惜", "Tiếc", "ざんねん"),
  창피해요: tr("Embarrassed", "丢脸", "Xấu hổ", "はずかしい"),
  답답해요: tr("Frustrated", "憋闷", "Bức bối", "もどかしい"),
  분해요: tr("Bitter", "不甘心", "Cay cú", "くやしい"),
  서러워요: tr("Heartbroken", "心酸", "Tủi hờn", "なきたい"),
  "짜증 나요": tr("Annoyed", "烦躁", "Bực mình", "イライラ"),
  "약 올라요": tr("Teased", "被惹恼", "Bị chọc tức", "ムカッ"),
  부글부글해요: tr("Boiling", "火冒三丈", "Sôi sục", "ムカムカ"),
  // 까닭·크기·무리
  친구: tr("Friends", "朋友", "Bạn bè", "ともだち"),
  공부: tr("Study", "学习", "Học tập", "べんきょう"),
  집: tr("Home", "家", "Nhà", "いえ"),
  몸: tr("Body", "身体", "Cơ thể", "からだ"),
  그냥: tr("Just because", "没什么", "Không vì sao", "なんとなく"),
  조금: tr("A little", "一点点", "Một chút", "すこし"),
  살짝: tr("Some", "有点", "Hơi hơi", "ちょっと"),
  보통: tr("Medium", "一般", "Vừa", "ふつう"),
  많이: tr("A lot", "很多", "Nhiều", "たくさん"),
  "아주 많이": tr("Very much", "非常多", "Rất nhiều", "とても"),
  기쁨: tr("Joy", "开心", "Vui", "よろこび"),
  평온: tr("Calm", "平静", "Bình yên", "おだやか"),
  슬픔: tr("Sad", "难过", "Buồn", "かなしみ"),
  화남: tr("Angry", "生气", "Giận", "いかり"),
  불안: tr("Worry", "不安", "Lo", "ふあん"),
  아침: tr("Morning", "早上", "Buổi sáng", "あさ"),
  "하교 전": tr("Before home", "放学前", "Trước khi về", "かえるまえ"),
};

// 낱말(감정·까닭 등) 바꾸기: 표에 없으면 한국어 그대로
export function w(lang: Lang, ko: string) {
  return lang === "ko" ? ko : WORDS[ko]?.[lang] ?? ko;
}

const UI = {
  title: { ko: "{alias}의 오늘의 마음", en: "{alias}'s feelings today", zh: "{alias}今天的心情", vi: "Cảm xúc hôm nay của {alias}", ja: "{alias}のきょうのきもち" },
  readOn: { ko: "🔊 읽어 주기 켬", en: "🔊 Read aloud: on", zh: "🔊 朗读：开", vi: "🔊 Đọc to: bật", ja: "🔊 よみあげ：オン" },
  readOff: { ko: "🔊 읽어 주기 끔", en: "🔊 Read aloud: off", zh: "🔊 朗读：关", vi: "🔊 Đọc to: tắt", ja: "🔊 よみあげ：オフ" },
  next: { ko: "다음 친구 차례", en: "Next friend", zh: "下一位同学", vi: "Bạn tiếp theo", ja: "つぎのともだち" },
  how: { ko: "{slot} 마음을 어떻게 남길까요?", en: "How do you want to share your {slot} feelings?", zh: "你想怎样记录{slot}的心情？", vi: "Em muốn ghi cảm xúc {slot} thế nào?", ja: "{slot}のきもちをどうやってのこす？" },
  already: { ko: "{slot} 마음은 이미 남겼어요({emotion}). 다시 남기면 새로 바뀌어요.", en: "You already shared your {slot} feeling ({emotion}). Sharing again will replace it.", zh: "{slot}的心情已经记录了（{emotion}）。再记录会更新。", vi: "Em đã ghi cảm xúc {slot} rồi ({emotion}). Ghi lại sẽ thay thế.", ja: "{slot}のきもちはもうのこしたよ（{emotion}）。もういちどのこすとかわるよ。" },
  card: { ko: "카드로 골라요", en: "Pick a card", zh: "选卡片", vi: "Chọn thẻ", ja: "カードでえらぶ" },
  cardSub: { ko: "그림을 눌러서 골라요", en: "Tap a picture", zh: "点一点图片", vi: "Chạm vào hình", ja: "えをタップしてね" },
  voice: { ko: "말로 해요", en: "Say it", zh: "说出来", vi: "Nói ra", ja: "ことばでいう" },
  voiceSub: { ko: "한 문장으로 말하거나 적어요", en: "Say or write one sentence", zh: "说或写一句话", vi: "Nói hoặc viết một câu", ja: "ひとことでいうか、かいてね" },
  noAnswer: { ko: "마음에는 정답이 없어요. 말하고 싶지 않으면 안 해도 괜찮아요.", en: "There are no wrong feelings. It's okay not to share.", zh: "心情没有对错。不想说也没关系。", vi: "Cảm xúc không có đúng sai. Không muốn nói cũng không sao.", ja: "きもちにせいかいはないよ。いいたくなければいわなくていいよ。" },
  youSaid: { ko: "네가 한 말", en: "What you said", zh: "你说的话", vi: "Điều em nói", ja: "きみがいったこと" },
  heard: { ko: "마음 친구는 이렇게 들었어. 다르면 바꿔도 돼!", en: "This is what I heard. Change it if it's different!", zh: "心情朋友是这样理解的。不对可以改哦！", vi: "Bạn cảm xúc hiểu như vầy. Sai thì sửa nhé!", ja: "こうきこえたよ。ちがったらかえてね！" },
  q1: { ko: "① 지금 마음과 가까운 카드를 골라요", en: "① Pick the card closest to how you feel", zh: "① 选一张最像你现在心情的卡片", vi: "① Chọn thẻ giống cảm xúc của em nhất", ja: "① いまのきもちにちかいカードをえらぼう" },
  help: { ko: "잘 모르겠어요", en: "Not sure", zh: "不太确定", vi: "Em không chắc", ja: "よくわからない" },
  helpClose: { ko: "도움판 닫기", en: "Close help", zh: "关闭提示", vi: "Đóng gợi ý", ja: "ヒントをとじる" },
  classWords: { ko: "우리 반에서 배운 마음 단어", en: "Feeling words we learned", zh: "我们班学过的心情词", vi: "Từ cảm xúc lớp mình đã học", ja: "クラスでならったきもちのことば" },
  nuance: { ko: "더 꼭 맞는 말이 있을까?", en: "Is there a word that fits even better?", zh: "有更贴切的词吗？", vi: "Có từ nào đúng hơn không?", ja: "もっとぴったりのことばはある？" },
  nuanceSkip: { ko: "골라도 되고, 안 골라도 돼요.", en: "You can pick one or skip.", zh: "可以选，也可以不选。", vi: "Chọn hay không đều được.", ja: "えらんでも、えらばなくてもいいよ。" },
  learned: { ko: "⭐ 우리 반에서 배운 말", en: "⭐ We learned this", zh: "⭐ 班上学过", vi: "⭐ Lớp mình đã học", ja: "⭐ クラスでならった" },
  q2: { ko: "② 마음이 얼마나 큰가요?", en: "② How big is the feeling?", zh: "② 心情有多大？", vi: "② Cảm xúc lớn cỡ nào?", ja: "② きもちはどのくらい？" },
  q3: { ko: "③ 무엇 때문일까요?", en: "③ What is it about?", zh: "③ 是因为什么？", vi: "③ Vì điều gì?", ja: "③ なにがあったかな？" },
  restart: { ko: "처음으로", en: "Start over", zh: "重新开始", vi: "Làm lại", ja: "はじめから" },
  yesNext: { ko: "맞아요, 다음", en: "Yes, next", zh: "对，下一步", vi: "Đúng rồi, tiếp", ja: "そう、つぎへ" },
  nextBtn: { ko: "다음", en: "Next", zh: "下一步", vi: "Tiếp", ja: "つぎへ" },
  pick3: { ko: "세 가지를 골라 주세요", en: "Please pick all three", zh: "请选三项", vi: "Hãy chọn đủ ba mục", ja: "みっつえらんでね" },
  sayOne: { ko: "하고 싶은 말을 한 문장으로 해 봐요", en: "Say what you want in one sentence", zh: "用一句话说说你的心情", vi: "Hãy nói điều em muốn trong một câu", ja: "いいたいことをひとことでいってみよう" },
  listening: { ko: "듣고 있어요… 다 말하면 ■를 눌러요.", en: "Listening… press ■ when you're done.", zh: "正在听…说完请按 ■。", vi: "Đang nghe… nói xong bấm ■.", ja: "きいているよ… おわったら ■ をおしてね。" },
  micHint: { ko: "마이크를 누르고 말하거나, 아래에 적어요.", en: "Press the mic and talk, or type below.", zh: "按麦克风说话，或在下面写。", vi: "Bấm micro để nói, hoặc viết bên dưới.", ja: "マイクをおしてはなすか、したにかいてね。" },
  typeHint: { ko: "아래에 적어 주세요.", en: "Please type below.", zh: "请在下面写。", vi: "Hãy viết bên dưới.", ja: "したにかいてね。" },
  example: { ko: "예) 체육 시간에 내 차례를 친구가 가져갔어요", en: "e.g. A friend took my turn in P.E.", zh: "例：体育课上朋友抢了我的顺序", vi: "VD: Bạn lấy lượt của em trong giờ thể dục", ja: "れい：たいいくでともだちにじゅんばんをとられた" },
  toCard: { ko: "카드로 바꾸기", en: "Use cards instead", zh: "改用卡片", vi: "Đổi sang thẻ", ja: "カードにする" },
  organize: { ko: "마음 정리하기", en: "Sort my feelings", zh: "整理心情", vi: "Sắp xếp cảm xúc", ja: "きもちをまとめる" },
  notUnderstood: { ko: "마음 친구가 잘 못 알아들었어. 카드로 골라 줄래?", en: "I didn't quite get that. Can you pick with cards?", zh: "心情朋友没听懂，用卡片选好吗？", vi: "Bạn cảm xúc chưa hiểu lắm. Em chọn bằng thẻ nhé?", ja: "よくわからなかったよ。カードでえらんでくれる？" },
  askOnce: { ko: "마음 친구가 한 번만 더 물어볼게", en: "Just one more question", zh: "心情朋友再问一个问题", vi: "Bạn cảm xúc hỏi thêm một câu thôi", ja: "もうひとつだけきくね" },
  okNoAnswer: { ko: "대답하지 않아도 괜찮아요.", en: "You don't have to answer.", zh: "不回答也没关系。", vi: "Không trả lời cũng không sao.", ja: "こたえなくてもだいじょうぶ。" },
  ownAnswer: { ko: "직접 말하거나 적어도 돼요", en: "You can say or type your own answer", zh: "也可以自己说或写", vi: "Em có thể tự nói hoặc viết", ja: "じぶんでいっても、かいてもいいよ" },
  skipSave: { ko: "건너뛰고 저장", en: "Skip and save", zh: "跳过并保存", vi: "Bỏ qua và lưu", ja: "とばしてほぞん" },
  answerSave: { ko: "답하고 저장", en: "Answer and save", zh: "回答并保存", vi: "Trả lời và lưu", ja: "こたえてほぞん" },
  saved: { ko: "✓ 마음을 담았어요", en: "✓ Saved your feelings", zh: "✓ 心情已保存", vi: "✓ Đã lưu cảm xúc", ja: "✓ きもちをのこしたよ" },
  thanks: { ko: "마음을 나눠 줘서 고마워, {alias}!", en: "Thanks for sharing, {alias}!", zh: "谢谢你分享心情，{alias}！", vi: "Cảm ơn em đã chia sẻ, {alias}!", ja: "おしえてくれてありがとう、{alias}！" },
  flowerToday: { ko: "오늘의 마음 꽃이 피었어요", en: "Today's feeling flower bloomed", zh: "今天的心情花开了", vi: "Bông hoa cảm xúc hôm nay đã nở", ja: "きょうのきもちのはながさいたよ" },
  calendar: { ko: "📅 내 마음 달력", en: "📅 My feelings calendar", zh: "📅 我的心情日历", vi: "📅 Lịch cảm xúc của em", ja: "📅 きもちカレンダー" },
  calendarLink: { ko: "내 마음 달력 보기", en: "See my calendar", zh: "看我的日历", vi: "Xem lịch của em", ja: "カレンダーをみる" },
  buddy: { ko: "마음 친구", en: "Feeling Buddy", zh: "心情朋友", vi: "Bạn cảm xúc", ja: "こころのともだち" },
  hello: { ko: "안녕, {alias}! 오늘 마음은 어때?", en: "Hi, {alias}! How are you feeling today?", zh: "你好，{alias}！今天心情怎么样？", vi: "Chào {alias}! Hôm nay em thấy thế nào?", ja: "やあ、{alias}！きょうのきもちはどう？" },
  picked: { ko: "「{emotion}」를 골랐구나.", en: "You picked \"{emotion}\".", zh: "你选了「{emotion}」。", vi: "Em đã chọn \"{emotion}\".", ja: "「{emotion}」をえらんだんだね。" },
  slow: { ko: "천천히 생각해도 돼.", en: "Take your time.", zh: "慢慢想也没关系。", vi: "Cứ từ từ suy nghĩ nhé.", ja: "ゆっくりかんがえていいよ。" },
  todayRec: { ko: "오늘 남긴 마음", en: "Today's feelings", zh: "今天的心情", vi: "Cảm xúc hôm nay", ja: "きょうのきもち" },
  notYet: { ko: "아직이에요", en: "Not yet", zh: "还没有", vi: "Chưa có", ja: "まだだよ" },
  garden: { ko: "이번 달 마음 꽃밭", en: "This month's flower garden", zh: "本月心情花园", vi: "Vườn hoa tháng này", ja: "こんげつのきもちのはなばたけ" },
  gardenEmpty: { ko: "마음을 남긴 날마다 꽃이 한 송이씩 피어요.", en: "A flower blooms each day you share.", zh: "每记录一天，就开一朵花。", vi: "Mỗi ngày em ghi, một bông hoa nở.", ja: "きもちをのこすたびにはながさくよ。" },
  thinking: { ko: "마음 친구가 생각하는 중…", en: "Thinking…", zh: "心情朋友正在想…", vi: "Đang suy nghĩ…", ja: "かんがえているよ…" },
  listeningSort: { ko: "마음 친구가 듣고 정리하는 중…", en: "Listening and sorting…", zh: "正在听并整理…", vi: "Đang nghe và sắp xếp…", ja: "きいてまとめているよ…" },
  saving: { ko: "마음을 담는 중…", en: "Saving…", zh: "正在保存…", vi: "Đang lưu…", ja: "ほぞんしているよ…" },
  micDenied: { ko: "마이크를 쓸 수 없어요. 글로 적어 주세요.", en: "Can't use the mic. Please type instead.", zh: "无法使用麦克风，请改用文字。", vi: "Không dùng được micro. Hãy viết nhé.", ja: "マイクがつかえないよ。かいてね。" },
  noSpeech: { ko: "잘 안 들렸어요. 한 번 더 해 볼까요?", en: "I couldn't hear you. Try again?", zh: "没听清楚，再试一次？", vi: "Không nghe rõ. Thử lại nhé?", ja: "よくきこえなかったよ。もういちど？" },
  speechFail: { ko: "받아쓰기가 잘 안 됐어요. 글로 적어도 돼요.", en: "Speech didn't work. You can type instead.", zh: "语音识别不成功，可以改用文字。", vi: "Nhận giọng nói không được. Em có thể viết.", ja: "うまくききとれなかったよ。かいてもいいよ。" },
  lang: { ko: "🌐 언어", en: "🌐 Language", zh: "🌐 语言", vi: "🌐 Ngôn ngữ", ja: "🌐 ことば" },
} satisfies Record<string, Record<Lang, string>>;
export type UIKey = keyof typeof UI;

export function t(lang: Lang, key: UIKey, vars: Record<string, string | number> = {}) {
  return (UI[key][lang] ?? UI[key].ko).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// AI 없이 쓰는 기본 되묻기(까닭별) — 집 일은 캐묻지 않는다
const FALLBACK: Record<Lang, Record<string, [string, [string, string]]>> = {
  ko: {
    친구: ["그때 친구랑 무슨 일이 있었어?", ["같이 놀았어", "다툼이 있었어"]],
    공부: ["어떤 시간 때문이었어?", ["수학 시간", "국어 시간"]],
    집: ["지금 마음은 어때?", ["조금 괜찮아", "아직 힘들어"]],
    몸: ["몸 어디가 그랬어?", ["머리", "배"]],
    그냥: ["지금 제일 하고 싶은 건 뭐야?", ["쉬고 싶어", "놀고 싶어"]],
  },
  en: {
    친구: ["What happened with your friend?", ["We played", "We argued"]],
    공부: ["Which class was it?", ["Math", "Korean"]],
    집: ["How do you feel right now?", ["A bit better", "Still hard"]],
    몸: ["Where did it feel that way?", ["Head", "Tummy"]],
    그냥: ["What do you want to do most now?", ["Rest", "Play"]],
  },
  zh: {
    친구: ["那时和朋友发生了什么？", ["一起玩了", "吵架了"]],
    공부: ["是哪节课？", ["数学课", "语文课"]],
    집: ["现在心情怎么样？", ["好一点了", "还是难受"]],
    몸: ["身体哪里不舒服？", ["头", "肚子"]],
    그냥: ["现在最想做什么？", ["想休息", "想玩"]],
  },
  vi: {
    친구: ["Lúc đó em và bạn có chuyện gì?", ["Chơi cùng nhau", "Cãi nhau"]],
    공부: ["Là giờ học nào?", ["Giờ toán", "Giờ tiếng Hàn"]],
    집: ["Bây giờ em thấy thế nào?", ["Đỡ hơn rồi", "Vẫn còn buồn"]],
    몸: ["Em thấy khó chịu ở đâu?", ["Đầu", "Bụng"]],
    그냥: ["Bây giờ em muốn làm gì nhất?", ["Nghỉ ngơi", "Đi chơi"]],
  },
  ja: {
    친구: ["ともだちとなにがあったの？", ["いっしょにあそんだ", "けんかした"]],
    공부: ["どのじゅぎょうだった？", ["さんすう", "こくご"]],
    집: ["いまのきもちはどう？", ["すこしだいじょうぶ", "まだつらい"]],
    몸: ["からだのどこがそうだった？", ["あたま", "おなか"]],
    그냥: ["いまいちばんしたいことは？", ["やすみたい", "あそびたい"]],
  },
};
const LEAD: Record<Lang, [string, string]> = {
  ko: ["좋았겠다! ", "그랬구나. "],
  en: ["That sounds great! ", "I see. "],
  zh: ["真不错！", "原来是这样。"],
  vi: ["Tuyệt quá! ", "Ra là vậy. "],
  ja: ["よかったね！", "そうだったんだね。"],
};
export const SKIP: Record<Lang, string> = { ko: "말하기 싫어요", en: "I'd rather not say", zh: "不想说", vi: "Em không muốn nói", ja: "いいたくない" };
export const RISK_REPLY: Record<Lang, string> = {
  ko: "말해 줘서 정말 고마워. 선생님이 꼭 알고 있을게.",
  en: "Thank you so much for telling me. Your teacher will know and care.",
  zh: "谢谢你告诉我。老师一定会知道并关心你。",
  vi: "Cảm ơn em rất nhiều vì đã kể. Cô giáo/thầy giáo sẽ biết và quan tâm em.",
  ja: "おしえてくれてほんとうにありがとう。せんせいがちゃんとしっているよ。",
};

export function fallbackFor(lang: Lang, reason: string, joy: boolean) {
  const [q, opts] = FALLBACK[lang][reason] ?? FALLBACK[lang]["그냥"];
  return { question: LEAD[lang][joy ? 0 : 1] + q, options: [...opts, SKIP[lang]] };
}

// 감정 무리별 마음 친구 공감 한마디
export const CHEER: Record<Lang, Record<string, string>> = {
  ko: { joy: "좋은 마음을 나눠 줘서 나도 기뻐!", calm: "편안한 마음, 잘 간직하자.", sad: "속상한 마음을 말해 줘서 고마워. 선생님도 알고 있을게.", angry: "화가 날 만했구나. 말해 준 건 정말 잘한 일이야.", fear: "걱정되는 마음을 꺼내 줘서 고마워. 너는 혼자가 아니야." },
  en: { joy: "I'm happy you shared that!", calm: "Let's keep this calm feeling.", sad: "Thanks for telling me. Your teacher will know too.", angry: "No wonder you felt angry. Telling me was a great choice.", fear: "Thanks for sharing your worry. You're not alone." },
  zh: { joy: "你分享开心的事，我也很开心！", calm: "好好珍惜这份平静吧。", sad: "谢谢你说出难过的心情，老师也会知道。", angry: "难怪你会生气。说出来真棒。", fear: "谢谢你说出担心，你不是一个人。" },
  vi: { joy: "Em chia sẻ điều vui, mình cũng vui lắm!", calm: "Hãy giữ cảm giác bình yên này nhé.", sad: "Cảm ơn em đã nói. Thầy cô cũng sẽ biết.", angry: "Thảo nào em giận. Nói ra là rất giỏi.", fear: "Cảm ơn em đã chia sẻ nỗi lo. Em không một mình đâu." },
  ja: { joy: "うれしいきもちをおしえてくれて、ぼくもうれしい！", calm: "おだやかなきもち、たいせつにしようね。", sad: "おしえてくれてありがとう。せんせいもしっているよ。", angry: "おこるのもとうぜんだね。いってくれてえらいよ。", fear: "しんぱいをはなしてくれてありがとう。ひとりじゃないよ。" },
};
