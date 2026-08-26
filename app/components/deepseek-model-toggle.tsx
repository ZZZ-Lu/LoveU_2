/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability */
"use client";

import {useEffect, useState} from "react";

type Model = "deepseek-v4-flash" | "deepseek-v4-pro" | "kimi-k3-high" | "kimi-k3-max";
const COOKIE = "loveu_ai_model";
const options: Array<{value: Model; label: string}> = [
  {value: "deepseek-v4-flash", label: "Flash"},
  {value: "deepseek-v4-pro", label: "Pro"},
  {value: "kimi-k3-high", label: "K3 High"},
  {value: "kimi-k3-max", label: "K3 Max"},
];

export default function DeepSeekModelToggle() {
  const [model, setModel] = useState<Model>("deepseek-v4-pro");

  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const saved = cookies.find((item) => item.startsWith(`${COOKIE}=`))?.split("=")[1]
      || cookies.find((item) => item.startsWith("loveu_deepseek_model="))?.split("=")[1];
    const migrated = saved === "kimi-k3" ? "kimi-k3-max" : saved;
    if (options.some((item) => item.value === migrated)) {
      if (migrated !== saved) document.cookie = `${COOKIE}=${migrated}; Path=/; Max-Age=31536000; SameSite=None; Secure`;
      setModel(migrated as Model);
    }
    
    const handleModelChange = (event: Event) => {
      setModel((event as CustomEvent<Model>).detail);
    };
    window.addEventListener("loveu_ai_model_changed", handleModelChange);
    return () => window.removeEventListener("loveu_ai_model_changed", handleModelChange);
  }, []);

  const select = (next: Model) => {
    document.cookie = `${COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=None; Secure`;
    setModel(next);
    window.dispatchEvent(new CustomEvent("loveu_ai_model_changed", {detail: next}));
  };

  return <div className="deepseek-model-toggle" role="group" aria-label="接口模型" title={`当前接口模型：${model}`}>
    {options.map((item) => <button
      key={item.value}
      type="button"
      className={model === item.value ? "active" : ""}
      aria-pressed={model === item.value}
      onClick={() => select(item.value)}
    >{item.label}</button>)}
  </div>;
}
