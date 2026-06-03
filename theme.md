# Metro Colab Cozy UI Theme

## Personality

Metro Colab should feel like a calm productivity studio: warm, modern, organized, and quietly playful. The interface should support repeated daily work without feeling heavy or overly decorative.

## Color Palette

- Background: warm canvas, `hsl(39 52% 96%)`.
- Surface: clean white cards for focused content.
- Sidebar: soft warm tint, `hsl(37 58% 94%)`.
- Text: ink navy, `hsl(224 26% 15%)`.
- Muted text: slate gray, `hsl(225 10% 42%)`.
- Borders: low-contrast warm gray, `hsl(34 29% 85%)`.
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
- Use compact sidebar controls: `36px` item height, small icon/text gaps, and short group spacing.
- Cards should be single-level containers only. Avoid nested card compositions.
- Use soft shadows sparingly for active navigation and important surfaces.

## Sidebar Guidelines

- Expanded width should stay near `240px`.
- Collapsed width should stay near `72px`.
- Collapsed mode shows icons only and must preserve accessible labels through `aria-label` and `title`.
- Group labels should appear only when expanded.
- Icons should be Lucide icons with semantic color accents.

## Dashboard Content

- The first screen should show useful product signals immediately: tasks, notes, calendar, spaces, AI assistant, and whiteboard activity.
- Keep the dashboard static until routing and data models are introduced.
- Prefer scan-friendly panels over marketing-style hero sections.
