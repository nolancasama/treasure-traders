import type { ItemId } from "./ids";
import { ITEMS, askSentence, askSentenceJa, withArticle } from "./items";
import type { Line } from "./cast";

/** Capitalised article phrase for sentence starts: "A pen", "An eraser". */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ja = (id: ItemId) => ITEMS[id].ja;
const en = (id: ItemId) => ITEMS[id].en;

/** Every shared English line with its Japanese support (SPEC §2). */
export const L = {
  yes: { en: "Yes, I do!", ja: "うん、持っているよ！" },
  no: { en: "No, I don't.", ja: "ううん、持っていないよ。" },
  ask: (id: ItemId): Line => ({ en: askSentence(id), ja: askSentenceJa(id) }),
  askMyNotebooks: { en: "Do you have my notebooks?", ja: "わたしのノート、持っている？" },
  thisIsForYou: { en: "This is for you!", ja: "これ、どうぞ！" },
  hereYouAre: { en: "Here you are!", ja: "はい、どうぞ！" },
  thankYou: { en: "Thank you!", ja: "ありがとう！" },
  thanksFor: (id: ItemId): Line => ({ en: `Thanks for the ${en(id)}!`, ja: `${ja(id)}、ありがとう！` }),
  letsTrade: { en: "Let's trade!", ja: "こうかんしよう！" },
  bringMe: (id: ItemId): Line => ({ en: `Bring me ${withArticle(id)}, please!`, ja: `${ja(id)}を持ってきてね！` }),
  pleaseFind: (id: ItemId): Line => ({ en: `Please find ${withArticle(id)}!`, ja: `${ja(id)}をさがしてね！` }),
  butINeed: (id: ItemId): Line => ({ en: `But I need ${withArticle(id)}.`, ja: `でも、${ja(id)}がひつようなの。` }),
  iNeedIt: { en: "I need it. Sorry!", ja: "でも、つかっているの。ごめんね！" },
  hmmLetsLook: { en: "Hmm? Let's look!", ja: "あれ？かばんを見てみよう！" },
  great: { en: "Great!", ja: "すごい！" },
  hiAgain: { en: "Hi again!", ja: "また会ったね！" },
  iLostIt: { en: "No, I don't. I lost it!", ja: "ううん…なくしちゃったの。" },
  thatsMy: (id: ItemId): Line => ({ en: `That's my ${en(id)}! Thank you!`, ja: `あっ、なくした${ja(id)}だ！ありがとう！` }),
  hereSticker: { en: "Great! Here's a sticker!", ja: "シールをどうぞ！" },
  stickerThanks: { en: "Thanks! Have fun!", ja: "ありがとう！たのしんでね！" },
  comeBack: { en: "Come back any time!", ja: "いつでも来てね！" },

  // Mayor Pom
  mayorOhNo: { en: "Oh no! The festival things!", ja: "たいへん！おまつりの道具が！" },
  mayorHelp: { en: "Please help us!", ja: "手つだってくれる？" },
  mayorBackpack: { en: "Here is a backpack!", ja: "このかばんをどうぞ！" },
  mayorIntoChest: { en: "Great! Into the festival chest!", ja: "やった！おまつりのたからばこに入れよう！" },
  mayorAlso: (id: ItemId): Line => ({ en: `And the ${en(id)} too! Great!`, ja: `${ja(id)}も！すごい！` }),
  mayorChestHas: { en: "Yes, I do! It's in the festival chest!", ja: "うん！おまつりのたからばこに入っているよ！" },
  mayorHelpFirst: { en: "Please help everyone first!", ja: "先にみんなを手つだってね！" },
  mayorFind: (items: ItemId[]): Line => ({
    en: `Please find ${items.map((i) => `the ${en(i)}`).join(" and ")}!`,
    ja: `${items.map(ja).join("と")}をさがしてね！`
  }),
  mayorRulerFlew: { en: "The ruler flew to the market!", ja: "じょうぎは市場へとんでいったよ！" },
  mayorKeepPen: { en: "Keep the pen for trading!", ja: "ペンはこうかんにつかってね！" },
  mayorSpare: { en: "We'll use the rest at the festival too!", ja: "のこりもおまつりでつかうね！" },
  mayorHarborGift: { en: "Take these to the harbor! You can trade!", ja: "これを持って港へ行こう！こうかんできるよ！" },
  mayorMarketPen: { en: "Take this pen to the market!", ja: "このペンを市場へ持っていこう！" },
  mayorNeedPen: { en: "We need a pen! Then the festival can start!", ja: "あとはペンだけ！そうしたらおまつりがはじまるよ！" },
  mayorOpen: { en: "The School Festival is open!", ja: "学校まつり、はじまり！" },
  mayorThanks: { en: "Thank you, Treasure Trader!", ja: "ありがとう、トレジャー・トレーダー！" },

  // Chapter 1
  umeThisIsForYou: { en: "Oh! This is for you!", ja: "あら！じゃあ、これをどうぞ！" },
  umeFound: { en: "I found it in the wind!", ja: "風でとんできたのを、ひろったのよ。" },
  umeYouHaveOne: { en: "Oh, good! You have one!", ja: "あら、よかった！" },
  kenThanks: { en: "Thanks! Just a second!", ja: "ありがとう！ちょっとかしてね！" },
  kenDone: { en: "Done! Here you are!", ja: "できた！はい、かえすね！" },
  kenNoEraser: { en: "Oh no! Please find one!", ja: "ええっ！さがしてきて！" },
  kenPoster: { en: "Look at my poster!", ja: "ポスター、見て！" },

  // Chapter 3
  pageOhNo: { en: "Oh no! My notebooks are all over the library!", ja: "たいへん！ノートが図書室にちらばっちゃった！" },
  pageFindThree: { en: "Please find three!", ja: "三さつ、さがしてね！" },
  pageStillNeed: { en: "Please find three notebooks!", ja: "ノートを三さつさがしてね！" },
  pageThanks: { en: "Thank you! This notebook is for the festival!", ja: "ありがとう！このノートはおまつりにどうぞ！" },
  greenLook: { en: "Look! Three lost things!", ja: "見て！落とし物が三つあるの！" },
  greenFindOwners: { en: "Please find the owners!", ja: "持ち主をさがしてね！" },
  greenStill: { en: "Please find the owners!", ja: "まだ持ち主が見つかっていないね。" },
  greenForFestival: { en: "Great job! This pencil case is for the festival!", ja: "よくできました！このふでばこはおまつりにどうぞ！" },
  greenHelpFirst: { en: "Yes, I do! Please help the students first!", ja: "うん！先にみんなを手つだってね！" },

  // Chapter 4
  boNeedFor: { en: "I need it for my boat!", ja: "船でつかうんだ！" },
  boOpenChest: { en: "Thank you! Open my treasure chest!", ja: "ありがとう！わたしのたからばこをあけていいよ！" },
  chestOpen: { en: "Click! The chest is open!", ja: "カチッ！たからばこがあいた！" },

  // Chapter 5
  helperCame: { en: "I came to help!", ja: "手つだいに来たよ！" }
} as const;

/** Kiwi's Japanese-only coaching texts (Kiwi's English models use the target sentences). */
export const K = {
  hello: { en: "Hi! I'm Kiwi! Let's go!", ja: "キウイだよ！いっしょに行こう！" },
  has: (id: ItemId) => `${ja(id)}は持っているよ！`,
  hasNot: (id: ItemId) => `${ja(id)}は持っていないよ。`,
  sayIt: "このように言ってみよう：",
  thatsA: (id: ItemId): Line => ({ en: `That's ${withArticle(id)}!`, ja: `それは${ja(id)}だよ！` }),
  chestHint: "ふたの絵を見て、『Do you have a ___?』と聞いてみよう！",
  askCaptainFirst: "まず船長に話しかけてみよう！",
  notebookFound: (n: number) => `ノート ${n}/3`,
  aLostItem: "持っていない人が、なくした人かも！"
};

/** Capitalised article phrase for UI headings ("A pen!"). */
export function itemExclaim(id: ItemId): string {
  return `${cap(withArticle(id))}!`;
}
