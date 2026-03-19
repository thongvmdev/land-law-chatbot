"use client";

import { useEffect, useState } from "react";

/**
 * Simple user management - generates and persists a user ID
 * No authentication, just for multi-user thread separation
 */
export function useUser() {
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Get or generate user ID
    let id = localStorage.getItem("land-law-chatbot-user-id");

    if (!id) {
      // Generate simple UUID-like ID
      id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("land-law-chatbot-user-id", id);
    }

    setUserId(id);
  }, []);

  return { userId };
}
