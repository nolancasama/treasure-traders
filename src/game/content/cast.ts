import type { CharacterId, DistrictId, NpcId } from "./ids";

/** A line of English with its Japanese support (SPEC §2). */
export interface Line {
  en: string;
  ja: string;
}

export interface VoicePreset {
  pitch: number;
  rate: number;
}

export interface CastInfo {
  id: NpcId;
  name: string;
  ja: string;
  district: DistrictId;
  personality: string;
  kid: boolean;
  voice: VoicePreset;
  /** First meeting. */
  greet: Line;
  /** Small talk when there is nothing to ask. */
  flavor: Line;
  /** After their part of the story is done. */
  done: Line;
}

export const CAST: Record<NpcId, CastInfo> = {
  pom: {
    id: "pom", name: "Mayor Pom", ja: "ポム町長", district: "square", personality: "jolly", kid: false,
    voice: { pitch: 0.6, rate: 0.92 },
    greet: { en: "Hello! I'm Mayor Pom!", ja: "こんにちは！ポム町長だよ！" },
    flavor: { en: "The festival is coming!", ja: "もうすぐおまつりだよ！" },
    done: { en: "Thank you, Treasure Trader!", ja: "ありがとう、トレジャー・トレーダー！" }
  },
  ume: {
    id: "ume", name: "Grandma Ume", ja: "ウメおばあちゃん", district: "square", personality: "gentle", kid: false,
    voice: { pitch: 1.15, rate: 0.82 },
    greet: { en: "Hello, dear!", ja: "こんにちは。" },
    flavor: { en: "What a windy day!", ja: "風がつよい日ね。" },
    done: { en: "You are so kind!", ja: "やさしい子ね。" }
  },
  ken: {
    id: "ken", name: "Ken", ja: "ケン", district: "square", personality: "energetic", kid: true,
    voice: { pitch: 1.35, rate: 1.05 },
    greet: { en: "Hi! I'm Ken!", ja: "やあ！ケンだよ！" },
    flavor: { en: "I love painting!", ja: "絵をかくのが大すき！" },
    done: { en: "Look at my poster!", ja: "ポスター、見て！" }
  },
  bruno: {
    id: "bruno", name: "Bruno", ja: "ブルーノ", district: "market", personality: "jolly baker", kid: false,
    voice: { pitch: 0.7, rate: 0.95 },
    greet: { en: "Hi! I'm Bruno!", ja: "やあ！ブルーノだよ！" },
    flavor: { en: "Mmm! Fresh bread!", ja: "やきたてのパンだよ！" },
    done: { en: "Come again!", ja: "また来てね！" }
  },
  lily: {
    id: "lily", name: "Lily", ja: "リリー", district: "market", personality: "soft-spoken florist", kid: false,
    voice: { pitch: 1.2, rate: 0.9 },
    greet: { en: "Hi! I'm Lily!", ja: "こんにちは！リリーです。" },
    flavor: { en: "I love flowers!", ja: "花が大すき！" },
    done: { en: "Have a nice day!", ja: "すてきな一日を！" }
  },
  max: {
    id: "max", name: "Max", ja: "マックス", district: "market", personality: "excitable toy seller", kid: false,
    voice: { pitch: 1.05, rate: 1.08 },
    greet: { en: "Hi! I'm Max! Toys!", ja: "やあ！マックスだよ！おもちゃ屋さん！" },
    flavor: { en: "Toys, toys, toys!", ja: "おもちゃ、おもちゃ！" },
    done: { en: "Super! Thanks!", ja: "さいこう！ありがとう！" }
  },
  sara: {
    id: "sara", name: "Sara", ja: "サラ", district: "market", personality: "brisk fruit seller", kid: false,
    voice: { pitch: 1.1, rate: 1.0 },
    greet: { en: "Hi! I'm Sara!", ja: "こんにちは！サラよ！" },
    flavor: { en: "Fresh fruit!", ja: "くだものはいかが？" },
    done: { en: "Thanks a lot!", ja: "どうもありがとう！" }
  },
  green: {
    id: "green", name: "Ms. Green", ja: "グリーン先生", district: "school", personality: "warm teacher", kid: false,
    voice: { pitch: 1.0, rate: 0.9 },
    greet: { en: "Welcome to our school!", ja: "学校へようこそ！" },
    flavor: { en: "Our school is fun!", ja: "楽しい学校でしょ？" },
    done: { en: "You are a great helper!", ja: "たよりになるね！" }
  },
  page: {
    id: "page", name: "Ms. Page", ja: "ページ先生", district: "school", personality: "quiet librarian", kid: false,
    voice: { pitch: 0.95, rate: 0.85 },
    greet: { en: "Hello. I'm Ms. Page.", ja: "こんにちは。図書室のページです。" },
    flavor: { en: "Shh! Books are fun!", ja: "しーっ！本は楽しいよ。" },
    done: { en: "Thank you so much!", ja: "本当にありがとう。" }
  },
  yuki: {
    id: "yuki", name: "Yuki", ja: "ユキ", district: "school", personality: "shy", kid: true,
    voice: { pitch: 1.45, rate: 0.95 },
    greet: { en: "Hi... I'm Yuki.", ja: "こんにちは…ユキです。" },
    flavor: { en: "I like reading.", ja: "本を読むのがすき。" },
    done: { en: "Thank you!", ja: "ありがとう！" }
  },
  tom: {
    id: "tom", name: "Tom", ja: "トム", district: "school", personality: "sporty", kid: true,
    voice: { pitch: 1.3, rate: 1.08 },
    greet: { en: "Hey! I'm Tom!", ja: "よう！トムだよ！" },
    flavor: { en: "Let's play soccer!", ja: "サッカーしようよ！" },
    done: { en: "Thanks, buddy!", ja: "ありがとな！" }
  },
  emma: {
    id: "emma", name: "Emma", ja: "エマ", district: "school", personality: "curious", kid: true,
    voice: { pitch: 1.5, rate: 1.0 },
    greet: { en: "Hi! I'm Emma!", ja: "こんにちは！エマだよ！" },
    flavor: { en: "What's that?", ja: "それ、なあに？" },
    done: { en: "Yay! Thank you!", ja: "やったあ！ありがとう！" }
  },
  bo: {
    id: "bo", name: "Captain Bo", ja: "ボー船長", district: "harbor", personality: "booming captain", kid: false,
    voice: { pitch: 0.5, rate: 0.9 },
    greet: { en: "Ahoy! I'm Captain Bo!", ja: "やあ！ボー船長だ！" },
    flavor: { en: "I love the sea!", ja: "海が大すきだ！" },
    done: { en: "Thank you, sailor!", ja: "ありがとう、船のりくん！" }
  },
  finn: {
    id: "finn", name: "Finn", ja: "フィン", district: "harbor", personality: "laid-back fisher", kid: false,
    voice: { pitch: 0.85, rate: 0.88 },
    greet: { en: "Hey there. I'm Finn.", ja: "やあ。フィンだよ。" },
    flavor: { en: "Fishing is fun.", ja: "つりは楽しいよ。" },
    done: { en: "Thanks, friend.", ja: "ありがとう。" }
  },
  mia: {
    id: "mia", name: "Mia", ja: "ミア", district: "harbor", personality: "adventurous sailor", kid: false,
    voice: { pitch: 1.25, rate: 1.05 },
    greet: { en: "Hi! I'm Mia!", ja: "やっほー！ミアだよ！" },
    flavor: { en: "I love my boat!", ja: "わたしのボート、すてきでしょ！" },
    done: { en: "You're awesome!", ja: "すごいね！" }
  },
  leo: {
    id: "leo", name: "Leo", ja: "レオ", district: "harbor", personality: "dreamy painter", kid: false,
    voice: { pitch: 0.95, rate: 0.85 },
    greet: { en: "Hello... I'm Leo.", ja: "やあ…レオだよ。" },
    flavor: { en: "I paint the river.", ja: "川の絵をかいているんだ。" },
    done: { en: "Beautiful! Thanks!", ja: "すてき！ありがとう！" }
  },
  dan: {
    id: "dan", name: "Coach Dan", ja: "ダンコーチ", district: "festival", personality: "loud, encouraging coach", kid: false,
    voice: { pitch: 0.75, rate: 1.0 },
    greet: { en: "Hi! I'm Coach Dan!", ja: "やあ！ダンコーチだ！" },
    flavor: { en: "Let's go, team!", ja: "がんばろう！" },
    done: { en: "Great job!", ja: "よくやった！" }
  },
  aya: {
    id: "aya", name: "Aya", ja: "アヤ", district: "festival", personality: "cheerful lantern maker", kid: false,
    voice: { pitch: 1.3, rate: 1.0 },
    greet: { en: "Hi! I'm Aya!", ja: "こんにちは！アヤだよ！" },
    flavor: { en: "Lanterns are pretty!", ja: "ちょうちん、きれいでしょ！" },
    done: { en: "Thank you so much!", ja: "本当にありがとう！" }
  }
};

/** Voice presets for every speaker, including Kiwi and the player (mic-free lines). */
export const VOICES: Record<CharacterId, VoicePreset> = {
  ...(Object.fromEntries(Object.values(CAST).map((c) => [c.id, c.voice])) as Record<NpcId, VoicePreset>),
  kiwi: { pitch: 1.75, rate: 1.05 },
  player: { pitch: 1.4, rate: 0.95 }
};

/** Display name of any speaker. */
export function speakerName(id: CharacterId): { en: string; ja: string } {
  if (id === "kiwi") return { en: "Kiwi", ja: "キウイ" };
  if (id === "player") return { en: "You", ja: "きみ" };
  return { en: CAST[id].name, ja: CAST[id].ja };
}
