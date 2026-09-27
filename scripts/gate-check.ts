/**
 * Publish-gate CLI: validates every seeded story and exits non-zero if
 * any story would be blocked from publication.
 *
 * Usage: pnpm gate:check
 */
import { getAllStories } from "../src/data/mockStories";
import { validateStory } from "../src/lib/verification";

const stories = getAllStories();
let blocked = 0;

for (const story of stories) {
  const result = validateStory(story);
  if (result.publishable) {
    console.log(`PASS  ${story.slug}`);
    continue;
  }
  blocked += 1;
  console.log(`BLOCK ${story.slug} (${result.issues.length} issues)`);
  for (const issue of result.issues) {
    console.log(`      ${issue.code}: ${issue.message}`);
  }
}

console.log(`\n${stories.length - blocked}/${stories.length} stories publishable.`);

if (blocked > 0) {
  process.exit(1);
}
