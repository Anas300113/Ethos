import React from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleBookmarkAction } from "@/app/actions";

interface SaveButtonProps {
  slug: string;
  saved: boolean;
  /** True when the story moved on after the reader saved it. */
  updatedSinceSaved?: boolean;
}

/**
 * Progressively enhanced: a plain form posting to a Server Action, so Save
 * works before any client JS hydrates. Idempotent server-side, so a double
 * tap cannot create two bookmarks.
 */
export const SaveButton: React.FC<SaveButtonProps> = ({
  slug,
  saved,
  updatedSinceSaved,
}) => {
  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <form action={toggleBookmarkAction} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        aria-label={saved ? "Remove from saved stories" : "Save this story"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          saved
            ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
            : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800 dark:hover:bg-zinc-800"
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{saved ? "Saved" : "Save"}</span>
      </button>
      {saved && updatedSinceSaved && (
        <span className="text-[11px] text-amber-700 dark:text-amber-300">
          updated since you saved
        </span>
      )}
    </form>
  );
};
