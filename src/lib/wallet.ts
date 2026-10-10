"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet } from "ethers";

const KEY = "shakeproof-burner-key";
const NAME = "shakeproof-name";

function loadWallet(): Wallet {
  let pk = window.localStorage.getItem(KEY);
  if (!pk) {
    pk = Wallet.createRandom().privateKey;
    window.localStorage.setItem(KEY, pk);
  }
  return new Wallet(pk);
}

export function importKey(privateKey: string): boolean {
  try {
    const w = new Wallet(privateKey.trim());
    window.localStorage.setItem(KEY, w.privateKey);
    return true;
  } catch {
    return false;
  }
}

export function exportKey(): string {
  return window.localStorage.getItem(KEY) ?? "";
}

/** Burner wallet + display name kept in localStorage. Testnet use only. */
export function useIdentity() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [name, setNameState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWallet(loadWallet());
    setNameState(window.localStorage.getItem(NAME) ?? "");
    setReady(true);
  }, []);

  const setName = useCallback((n: string) => {
    setNameState(n);
    window.localStorage.setItem(NAME, n);
  }, []);

  const reload = useCallback(() => setWallet(loadWallet()), []);

  return { wallet, address: wallet?.address ?? "", name, setName, ready, reload };
}

export function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export function tierFor(meets: number): { label: string; emoji: string; next: number | null } {
  if (meets >= 10) return { label: "Hub", emoji: "🌐", next: null };
  if (meets >= 3) return { label: "Connector", emoji: "🔗", next: 10 };
  if (meets >= 1) return { label: "Rookie", emoji: "🤝", next: 3 };
  return { label: "Lurker", emoji: "👀", next: 1 };
}
