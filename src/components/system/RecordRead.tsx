"use client";

import React, { useEffect } from "react";
import { recordReadAction } from "@/app/actions";

/**
 * Fires the read receipt once per mount. The action de-duplicates within an
 * hour, so reloads cannot inflate reading history.
 */
export const RecordRead: React.FC<{ slug: string }> = ({ slug }) => {
  useEffect(() => {
    const form = new FormData();
    form.set("slug", slug);
    void recordReadAction(form);
  }, [slug]);
  return null;
};
