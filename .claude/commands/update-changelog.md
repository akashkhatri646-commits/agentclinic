Update CHANGELOG.md with any git commits not yet recorded there.

Steps:

1. Read CHANGELOG.md and find the most recent date heading (format `## YYYY-MM-DD`). Note this as the cutoff date.

2. Run `git log --format="---COMMIT---%n%ad%n%s%n%b" --date=short` to get all commits with their full message bodies.

3. Keep only commits whose date is **after** the cutoff date. If the changelog is empty, include all commits.

4. Skip merge commits (subjects starting with "Merge "). Skip any `Co-Authored-By:` lines in the body.

5. For each remaining commit, expand its body into individual bullet points. Use the commit subject as a `### heading` within the date section. Each line of the commit body becomes a `- bullet`. If a body line is already a bullet (starts with `-`), keep it as-is; otherwise prefix it with `- `.

6. Group all headings under their `## YYYY-MM-DD` date heading, newest date at the top.

7. Insert the new date sections at the top of the changelog, directly after the `# Changelog` title line (and any `---` separator that follows it).

8. Write the updated CHANGELOG.md.

9. Report a summary: which dates were added and how many entries per date. If nothing was new, say so clearly.
