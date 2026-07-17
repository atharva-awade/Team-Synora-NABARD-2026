"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi" | "mr";

export const LANGS: { code: Lang; label: string; native: string; speech: string }[] = [
  { code: "en", label: "English", native: "EN", speech: "en-IN" },
  { code: "hi", label: "Hindi", native: "हि", speech: "hi-IN" },
  { code: "mr", label: "Marathi", native: "मर", speech: "mr-IN" },
];

type Dict = Record<string, string>;

const STRINGS: Record<Lang, Dict> = {
  en: {
    "nav.officer": "Field officer",
    "nav.enterprise": "Enterprise",
    "owner.title": "My enterprise",
    "owner.sub": "Your financial co-pilot: records, forecast, alerts and next steps.",
    "vitals.runway": "Liquidity runway",
    "vitals.volatility": "Income volatility",
    "vitals.repay": "Repayment capacity",
    "vitals.ncf": "Avg net cash flow",
    "forecast.title": "Cash-flow forecast",
    "forecast.sub": "history · AI forecast",
    "sim.title": "Climate & market simulator",
    "risk.title": "Risk assessment",
    "risk.stress": "stress risk",
    "why.title": "Why this forecast?",
    "credit.title": "Credit readiness",
    "actions.title": "Recommended actions",
    "entry.title": "Record this month",
    "entry.offline": "Runs the AI model on your device, no network needed.",
    "entry.submit": "Update my outlook",
    "band.Low": "Low",
    "band.Watch": "Watch",
    "band.High": "High",
    "listen": "Listen",
  },
  hi: {
    "nav.officer": "क्षेत्र अधिकारी",
    "nav.enterprise": "उद्यम",
    "owner.title": "मेरा उद्यम",
    "owner.sub": "आपका वित्तीय सह-पायलट, रिकॉर्ड, पूर्वानुमान, चेतावनी और अगले कदम।",
    "vitals.runway": "नकदी अवधि",
    "vitals.volatility": "आय में उतार-चढ़ाव",
    "vitals.repay": "चुकौती क्षमता",
    "vitals.ncf": "औसत शुद्ध नकदी",
    "forecast.title": "नकदी प्रवाह पूर्वानुमान",
    "forecast.sub": "इतिहास · एआई पूर्वानुमान",
    "sim.title": "जलवायु और बाज़ार सिम्युलेटर",
    "risk.title": "जोखिम आकलन",
    "risk.stress": "वित्तीय जोखिम",
    "why.title": "यह पूर्वानुमान क्यों?",
    "credit.title": "ऋण तत्परता",
    "actions.title": "सुझाए गए कदम",
    "entry.title": "इस माह दर्ज करें",
    "entry.offline": "एआई मॉडल आपके डिवाइस पर चलता है, नेटवर्क की ज़रूरत नहीं।",
    "entry.submit": "मेरा पूर्वानुमान अपडेट करें",
    "band.Low": "कम",
    "band.Watch": "निगरानी",
    "band.High": "उच्च",
    "listen": "सुनें",
  },
  mr: {
    "nav.officer": "क्षेत्र अधिकारी",
    "nav.enterprise": "उद्योग",
    "owner.title": "माझा उद्योग",
    "owner.sub": "तुमचा आर्थिक सह-वैमानिक, नोंदी, अंदाज, इशारे आणि पुढील पावले.",
    "vitals.runway": "रोख कालावधी",
    "vitals.volatility": "उत्पन्नातील चढ-उतार",
    "vitals.repay": "परतफेड क्षमता",
    "vitals.ncf": "सरासरी निव्वळ रोख",
    "forecast.title": "रोख प्रवाह अंदाज",
    "forecast.sub": "इतिहास · एआय अंदाज",
    "sim.title": "हवामान व बाजार सिम्युलेटर",
    "risk.title": "जोखीम मूल्यांकन",
    "risk.stress": "आर्थिक जोखीम",
    "why.title": "हा अंदाज का?",
    "credit.title": "कर्ज तयारी",
    "actions.title": "शिफारस केलेली पावले",
    "entry.title": "या महिन्याची नोंद करा",
    "entry.offline": "एआय मॉडेल तुमच्या डिव्हाइसवर चालते, नेटवर्कची गरज नाही.",
    "entry.submit": "माझा अंदाज अद्यतनित करा",
    "band.Low": "कमी",
    "band.Watch": "निरीक्षण",
    "band.High": "उच्च",
    "listen": "ऐका",
  },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("pravah-lang") as Lang | null;
    if (saved && saved in STRINGS) setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("pravah-lang", l);
  };
  const t = (key: string) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** Speak text in the current language using the Web Speech API. */
export function speak(text: string, lang: Lang) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANGS.find((l) => l.code === lang)?.speech ?? "en-IN";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}
