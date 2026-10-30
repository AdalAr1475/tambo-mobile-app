---
name: Tambo Digital Retail System
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#51434d'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#83727d'
  outline-variant: '#d5c1cd'
  surface-tint: '#943b89'
  primary: '#4c0047'
  on-primary: '#ffffff'
  primary-container: '#6b1464'
  on-primary-container: '#e884d7'
  inverse-primary: '#ffabed'
  secondary: '#7c5800'
  on-secondary: '#ffffff'
  secondary-container: '#ffbe3b'
  on-secondary-container: '#6f4e00'
  tertiary: '#54001f'
  on-tertiary: '#ffffff'
  tertiary-container: '#7c0032'
  on-tertiary-container: '#ff7d9b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd7f3'
  primary-fixed-dim: '#ffabed'
  on-primary-fixed: '#390035'
  on-primary-fixed-variant: '#78216f'
  secondary-fixed: '#ffdea8'
  secondary-fixed-dim: '#fbbc39'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5e4200'
  tertiary-fixed: '#ffd9de'
  tertiary-fixed-dim: '#ffb2bf'
  on-tertiary-fixed: '#3f0016'
  on-tertiary-fixed-variant: '#90003b'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  price-headline:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '800'
    lineHeight: 24px
  price-strikethrough:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
---

## Brand & Style

This design system translates the energetic, immediate, and accessible neighborhood convenience store experience into a modern e-commerce mobile product. Built for everyday Peruvian consumers seeking quick snacks, beverages, ready-to-eat meals, promotions, and instant delivery or store pickup, the experience balances streetwise vibrancy with swift, frictionless task completion.

The aesthetic blends **Modern Commercial** with **High-Contrast Tactical Retail**:
- High-impact brand presence led by the signature deep berry purple and vibrant magenta accents.
- Tactical yellow-gold action cues designed to drive rapid conversions, highlight limited-time savings, and anchor checkout interactions.
- High-readability surfaces using crisp off-white containers to display product imagery, transparent pricing in Soles (`S/`), and clear fulfillment statuses without sensory overload.

## Colors

The palette establishes an unmistakable retail hierarchy between brand identity, interactive calls-to-action, promo cues, and clear product canvases:

- **Primary (`#6B1464` & `#5A0C50`)**: Deep heritage purple applied to top app bars, primary modal triggers, bottom navigation active states, brand headers, and delivery toggle selectors.
- **Secondary (`#E5A824`)**: High-visibility warm mustard gold dedicated to core conversion flows—checkout buttons, primary progression banners, and high-impact promo tags.
- **Tertiary (`#D81B60`)**: Electric magenta used selectively for badge highlights, flash offers, notifications, and micro-interactions.
- **Neutrals & Surfaces**: Clean background surfaces rely on `#F8F9FA` canvas and `#FFFFFF` rounded card elevation. Primary typography uses deep charcoal `#1A1A1A` with subdued metadata rendered in `#6C757D` and border dividers in `#E9ECEF`.

## Typography

The type scale prioritizes rapid scannability in busy on-the-go environments:

- **Typeface Selection**: Inter delivers robust vertical metrics, high clarity for localized abbreviations (`S/`, `x 473 ml`), and consistent legibility across dense product grids and bottom sheets.
- **Price Display Rules**:
  - Main price points in Peruvian Soles (`S/ 14.90`) employ `price-headline` with bold black weight.
  - Previous or crossed-out regular prices (`S/ 21.90`) employ `price-strikethrough` with muted gray text (`#6C757D`).
- **Headlines & Modal Headers**: Bold weights (`700` and `800`) are maintained on bottom-sheet headers (e.g., "¿Cómo quieres tu pedido?", "Tu Carrito") to anchor context immediately upon surface transitions.

## Layout & Spacing

Layout geometry is optimized around compact mobile screen ergonomics:

- **Horizontal Bleed & Margins**: Standard phone viewport utilizes a fixed outer margin of `16px` (`margin: 1rem`) with an internal column gutter of `12px` (`gutter: 0.75rem`) for 2-column promotion and product grids.
- **Rhythm**: Spacing follows a 4px/8px modular grid. Product cards feature `12px` internal padding, bottom sheets use `20px` top and lateral padding, and sticky action containers employ `16px` padding around primary buttons.
- **Bottom Navigation Clearance**: All scrollable main views incorporate an extra `80px` bottom inset to prevent sticky bottom action footers and the 5-tab navigation bar from obstructing card interaction.

## Elevation & Depth

Visual depth is achieved through clean surface layering and soft, diffused shadows:

- **Level 0 (Base Canvas)**: Background rendered in `#F8F9FA` to define boundaries against white cards without heavy borders.
- **Level 1 (Card & Content Blocks)**: Surface `#FFFFFF` layered with ambient shadow `0 2px 8px rgba(107, 20, 100, 0.04), 0 1px 3px rgba(0, 0, 0, 0.05)`.
- **Level 2 (Active Floating Controls & Search Bars)**: Elevation `0 4px 14px rgba(0, 0, 0, 0.08)` for detached search inputs and floating quick-add counters.
- **Level 3 (Bottom Sheets & Modals)**: Overlaid with a 50% opacity neutral-dark scrim (`rgba(20, 10, 20, 0.55)`), bottom sheets lift with `0 -6px 24px rgba(0, 0, 0, 0.12)`, punctuated with a centered top pull handle (`#D0D5DD`, 36px × 4px, rounded-full).
- **Level 4 (Fixed Bottom Navigation)**: Solid white background with a subtle top border `#ECEFF1` and upward ambient diffusion `0 -2px 10px rgba(0, 0, 0, 0.04)`.

## Shapes

The interface embraces inviting, friendly geometry that reflects retail accessibility:

- **Cards & Promos**: Rounded corners set uniformly to `16px` (`rounded-xl` in the token scale), balancing modern softness with high content capacity.
- **Action Buttons & Form Fields**: Primary buttons, input bars, and search fields employ `12px` to `16px` radii.
- **Tags, Toggles & Chips**: Pill shapes (`rounded-full`, 9999px) are reserved for mode pickers (Delivery vs. Para llevar), quantity increment controls (`- 1 +`), and discount status tags.
- **Bottom Sheets**: Top-left and top-right radii set to `20px` for smooth ergonomic anchoring to the bottom edge.

## Components

### Buttons & CTAs
- **Primary Conversion CTA**: Filled in warm golden yellow (`#E5A824`), dark typography (`#1A1A1A`, 600 weight), height 48px, radius 12px. Used for "Continuar", "Ir a pagar", and checkout steps.
- **Brand Action Button**: Rich purple (`#6B1464`) background with pure white typography, used for primary modal choices, "Compartir ubicación", or adding bundles.
- **Secondary / Ghost Button**: White background, `#E9ECEF` border or muted text (`#6C757D`), used for dismissal ("Cerrar") and item edits.

### Segmented Fulfillment Toggle
- Container: Background `#F1F3F5`, pill or rounded-lg shell (8px padding).
- Segment Options: "Delivery" vs. "Para llevar". Active segment features filled purple (`#6B1464` or `#9C1B75`), bold white text; inactive segment uses transparent background with subtle slate text (`#495057`).

### Product & Cart Cards
- White background (`#FFFFFF`) with 16px corner radius and 1px `#F1F3F5` border.
- Layout: 72×72px product thumbnail, product name with volume/spec (`Pack 2 Rtd Four Loko Gold x 473 Ml`), itemized quantity stepper (`- 1 +`), and bold price stack (`S/ 14.90` above crossed-out `S/ 21.98`).

### Input Fields & Select Dropdowns
- Height 48px, rounded 10px, background `#FFFFFF`, border 1px solid `#DEE2E6`.
- Prefixed with contextual micro-icons (location pin, search magnifying glass) in muted charcoal, with placeholder text in `#ADB5BD`.

### Bottom Navigation Bar (5 Items)
- Height 64px, background `#FFFFFF`, 5 equidistant touch targets:
  1. **Inicio** (Storefront home)
  2. **Categorías** (Department catalog)
  3. **Descuentos** (Promotions & daily offers, tagged with magenta indicator)
  4. **Órdenes** (Order tracker & history)
  5. **Perfil** (Account, addresses, payment methods)
- Inactive state: `#6C757D` icon and text; active state: `#6B1464` icon with accent indicator.