"use client";
// 보호자 안내문·동의서(A4 한 장): 무엇을 남기고, 누가 보고, AI에는 무엇이 가고, 언제까지 두는지. 아래를 잘라 동의 여부를 받는다.
// 학교 이름·담임 이름은 이 기기에만 기억한다. 보관 기간은 「설정 → 기록 보관」 값을 따른다.
import { useLocal } from "@/lib/local";
import { RETENTION_LETTER, type Retention } from "@/lib/retention";

export default function ConsentLetter({ className, retention, origin }: { className: string; retention: Retention; origin: string }) {
  const [school, setSchool] = useLocal("mb_letter_school");
  const [teacher, setTeacher] = useLocal("mb_letter_teacher");
  const rows: [string, string][] = [
    ["쓰는 까닭", "아이가 자기 감정을 알아차리고 말로 나타내는 연습을 하고, 담임이 마음의 변화를 일찍 살펴 필요한 도움을 주기 위해서예요."],
    ["남기는 내용", "고른 감정 카드·마음 크기·까닭, 아이가 쓰거나 말한 한 문장(말은 음성 인식으로 글로 바꿔 남겨요), 마음 다스리기 뒤의 느낌, 한 주 돌아보기 글, 친구에게 보낸 공감 쪽지, 마음 점검(학급 역량 진단, 스스로 답하는 32문장), 활동지 피드백이에요. 학급 설정에 따라 목소리의 크기·높낮이·빠르기를 숫자로 재거나 AI가 말투를 살필 수 있어요. 녹음 파일은 남기지 않아요."],
    ["이름", "반 명단에는 번호와 가명(별명)을 써요. 실명은 담임 컴퓨터에만 따로 둬요."],
    ["보는 사람", "담임 선생님이 봐요. 위험해 보이는 말이 있으면 학교 위기관리 절차에 따라 상담 선생님 등과 함께 살펴요."],
    ["AI 사용", "기록 정리·되묻기·응원 글 초안에 AI 서비스(업스테이지 등)를 써요. 이름 없이 번호·가명과 기록 내용만 보내요. 선생님이 쓰는 글의 AI 초안은 담임이 읽고 고친 뒤에 써요."],
    ["보관 기간", `${RETENTION_LETTER[retention]} 두었다가 담임이 지워요.`],
    ["보호자 권리", "언제든 아이 기록을 보여 달라거나, 고치거나 지워 달라고 담임에게 말씀하실 수 있어요. 동의하지 않으셔도 불이익은 없고, 아이는 종이 활동 등 다른 방법으로 함께해요."],
  ];
  const who = [school.trim(), className].filter(Boolean).join(" ");

  return (
    <div className="space-y-3">
      <div className="no-print grid gap-2 sm:grid-cols-2">
        <label className="text-sm"><span className="text-soft">학교 이름</span><input value={school} onChange={(e) => setSchool(e.target.value.slice(0, 20))} className="field mt-1 min-h-11 py-2" placeholder="예: 홍북초등학교" /></label>
        <label className="text-sm"><span className="text-soft">담임 이름</span><input value={teacher} onChange={(e) => setTeacher(e.target.value.slice(0, 12))} className="field mt-1 min-h-11 py-2" placeholder="예: 김도구" /></label>
        <p className="text-xs text-soft sm:col-span-2">학교 개인정보 처리방침·담당 선생님 안내와 다른 점이 있으면 맞춰 고친 뒤 나눠 주세요.</p>
      </div>
      <article className="card mx-auto max-w-[210mm] space-y-4 bg-white p-6 text-[15px] leading-relaxed sm:p-8 print:border-0 print:p-0">
        <header className="space-y-1 text-center">
          <p className="text-sm text-soft">{who || "　"}</p>
          <h2 className="font-display text-2xl">「마음빛 길잡이」 이용 안내와 보호자 동의서</h2>
        </header>
        <p>
          안녕하세요. {who ? `${who} ` : ""}담임{teacher.trim() ? ` ${teacher.trim()}` : ""}입니다. 우리 반은 아이들이 아침과 하교 전에 자기 마음을 돌아보고 말로 나타내는
          사회정서교육 도구 「마음빛 길잡이」를 씁니다. 아래 내용을 읽어 보시고 동의 여부를 알려 주세요.
        </p>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-y border-line align-top">
                <th className="w-24 whitespace-nowrap bg-paper px-2 py-2 text-left font-bold">{k}</th>
                <td className="px-2 py-2">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-soft">자세한 안내: {origin}/privacy</p>
        <p className="border-t-2 border-dashed border-soft/60 pt-1 text-center text-xs text-soft">✂ 잘라서 담임 선생님께 내 주세요</p>
        <div className="space-y-3">
          <p className="font-bold">보호자 동의서</p>
          <p>{className} ( &nbsp;&nbsp;&nbsp; )번 &nbsp; 이름 (　　　　　　　)</p>
          <p>□ 위 내용을 읽었고, 아이가 「마음빛 길잡이」를 쓰는 것에 <b>동의합니다</b>.</p>
          <p>□ <b>동의하지 않습니다</b>(종이 활동 등 다른 방법으로 함께해요).</p>
          <p className="text-right">20　　년 　　월 　　일 &nbsp;&nbsp; 보호자 (　　　　　　　) (서명)</p>
        </div>
      </article>
    </div>
  );
}
