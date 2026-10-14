<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->
- Discussion, grouped discussion notifications, and exam sort order are written only through SECURITY DEFINER RPCs; client code falls back gracefully when those RPCs/columns are missing (migrations are applied manually on external Supabase).
- Choice references in explanations are stored as `[[pilihan:X]]` tokens bound to the answer label (answer row IDs are regenerated on every save); renderers resolve them against the displayed order (`src/lib/choice-reference.ts`).
