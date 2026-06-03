# Metro Colab Cozy UI Theme

## Personality

Metro Colab should feel like a bright productivity studio: warm, modern, organized, and energetic without becoming loud. The interface should support repeated daily work while still feeling fresh and awake.

## Color Palette

- Background: bright warm canvas, `hsl(42 78% 97%)`.
- Surface: clean white cards for focused content.
- Sidebar: fresh warm tint, `hsl(39 88% 94%)`.
- Text: ink navy, `hsl(222 31% 13%)`.
- Muted text: slate gray, `hsl(222 13% 39%)`.
- Borders: low-contrast warm gray, `hsl(34 38% 84%)`.
- Accent families:
  - Coral for dashboard and priority moments.
  - Sky for calendar and discovery.
  - Emerald for collaboration and completion.
  - Amber for notes and warmth.
  - Violet/fuchsia for AI and whiteboard creativity.

## Typography

- Use a system sans stack with Inter as the preferred face when available.
- Keep dashboard headings clear but compact.
- Use `text-xs` and `text-sm` for dense operational UI like sidebar items, metadata, and card labels.
- Avoid negative letter spacing. Use restrained uppercase tracking only for section labels.

## Spacing And Shape

- Primary radius: `8px`.
- Use compact sidebar controls: `32px` item height, small icon/text gaps, and short group spacing.
- Cards should be single-level containers only. Avoid nested card compositions.
- Use soft shadows sparingly for active navigation and important surfaces.

## Sidebar Guidelines

- Expanded width should stay near `224px`.
- Collapsed width should stay near `68px`.
- Collapsed mode shows icons only and must preserve accessible labels through `aria-label` and `title`.
- Group labels should appear only when expanded.
- Icons should be Lucide icons with semantic color accents.
- Group labels should remain visible and scannable in expanded mode, using compact uppercase text.

## Dashboard Content

- The first screen should show useful product signals immediately: tasks, notes, calendar, spaces, AI assistant, and whiteboard activity.
- Keep the dashboard static until routing and data models are introduced.
- Prefer scan-friendly panels over marketing-style hero sections.
