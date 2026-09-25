# UI Context — LGU Treasury Connect

## Theme

The application uses an authoritative, high-trust **Municipal Treasury & Civic Workspace** aesthetic. It combines deep Emerald Green (symbolizing agricultural vitality and public stewardship) with clean Slate neutrals to deliver high contrast, readable financial tables and clear operational hierarchies.

## Colors

All styling adheres to semantic CSS custom properties and Tailwind tokens. No arbitrary one-off hex colors may be introduced.

| Role | Token / Class | Hex / Value | Purpose |
|---|---|---|---|
| **Primary Brand** | `emerald-800` / `emerald-900` | `#06382c` / `#04261f` | Headers, primary buttons, branding panels |
| **Active Accent** | `emerald-600` | `#059669` | Focus rings, status badges, active indicators |
| **Accent Light** | `emerald-50` / `emerald-100` | `#ecfdf5` / `#d1fae5` | Selected rows, highlight boxes, badge backgrounds |
| **Page Background** | `slate-50/80` | `#f8fafc` | Main application background |
| **Surface / Card** | `white` | `#ffffff` | Modals, data cards, table surfaces |
| **Border Default** | `slate-200` | `#e2e8f0` | Card borders, table cell dividers |
| **Text Primary** | `slate-800` / `slate-900` | `#1e293b` / `#0f172a` | Headers, table values, critical numbers |
| **Text Muted** | `slate-500` / `slate-400` | `#64748b` / `#94a3b8` | Subtext, labels, secondary metadata |
| **Arrears / Danger** | `rose-600` / `rose-700` | `#e11d48` / `#be123c` | Delinquency indicators, destructive actions |
| **Override / Warning**| `amber-500` / `amber-600` | `#f59e0b` / `#d97706` | Assessor adjustment pencils, override warnings |

## Typography

| Role | Font Family | Tailwind Class | Usage |
|---|---|---|---|
| **UI Primary** | System sans-serif / Inter | `font-sans` | Standard labels, table cells, modal copy |
| **Financial / IDs** | System Monospace | `font-mono` | Currency figures, TD numbers, PINs, timestamps |
| **Showcase / Banner**| System Serif | `font-serif` | Municipal seal showcase, official mottos |

## Border Radius Scale

| Context | Tailwind Class | Measurement |
|---|---|---|
| **Inline / Inputs** | `rounded-lg` | `8px` | Text inputs, dropdowns, table badges |
| **Buttons & Action Boxes** | `rounded-xl` | `12px` | Action buttons, callout panels, quick filters |
| **Cards & Tables** | `rounded-2xl` | `16px` | Masterlist table, property cards, modals |

## Component Library

- **shadcn/ui Primitives**: Headless accessible components located in `components/ui/` (`Button`, `Table`, `Badge`, `Input`, `Dialog`, `DropdownMenu`).
- All interactive elements use semantic HTML and proper accessible focus states (`focus-visible:ring-1`).

## Layout Patterns

- **Login Screen**: Split-viewport layout. Left pane contains login form for workstation account credentials with Supabase Auth session authority; right pane showcases the official Santa Rosa Municipal Seal on deep emerald (`#04261f`).
- **Masterlist Dashboard**: 4-card KPI summary header followed by the full-width Masterlist Table with inline search, barangay filter, and pagination.
- **Statement of Account (SOA)**: Split desktop layout:
  - *Left Column (Col 1)*: Property Master Card + Delinquency Verification & Clearance Status Box (shows conditional tax-clearance eligibility and verification controls).
  - *Right Column (Col 2-3)*: Sequential Statement of Account Table with Arrears-First selection checkboxes and dark scope summary footer.

## Icons

- **Lucide React**: Exclusively stroke-based SVG icons.
- Sizes: `size={14}` to `size={16}` for inline actions; `size={18}` to `size={20}` for primary headers and status indicators.
