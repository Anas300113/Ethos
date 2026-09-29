import React from "react";
import { toggleTopicPreferenceAction } from "@/app/actions";

interface TopicFollowButtonProps {
  topic: string;
  followed: boolean;
}

/**
 * Topic preference is a ranking input only — following a topic never hides
 * evidence or filters what a story is allowed to say.
 */
export const TopicFollowButton: React.FC<TopicFollowButtonProps> = ({
  topic,
  followed,
}) => {
  return (
    <form action={toggleTopicPreferenceAction} className="inline-flex">
      <input type="hidden" name="topic" value={topic} />
      <button
        type="submit"
        aria-pressed={followed}
        className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        {followed ? `Following ${topic}` : `Follow ${topic}`}
      </button>
    </form>
  );
};
