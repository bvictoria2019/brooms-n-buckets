# Brooms & Buckets — Web Design Specification

**File:** `brooms-n-buckets_web design.md`  
**Project:** Brooms & Buckets LLC  
**Primary URL:** `https://www.brooms-n-buckets.com`  
**Purpose:** Comprehensive design and implementation guidance for Cursor

---

## 1. Project Objective

Create a polished, responsive, personality-driven website for **Brooms & Buckets LLC**, a boutique residential cleaning service serving the North Dallas area.

The website must preserve the basic functionality of a professional cleaning-service site while avoiding the generic look and feel of a template-based maid-service website.

The finished experience should feel:

- boutique
- trustworthy
- polished
- warm
- upbeat
- feminine without being overly girly
- playful without being childish
- premium without being pretentious
- memorable and distinctly branded

The site should communicate within the first few seconds:

1. What Brooms & Buckets does
2. Where the company operates
3. Why the brand feels different
4. How to book a cleaning

---

## 2. Brand Positioning

### Company Name

**Brooms & Buckets LLC**

### Website

**www.brooms-n-buckets.com**

The legal/customer-facing brand remains **Brooms & Buckets** even though the technical URL uses `brooms-n-buckets`.

Do not rename the visible brand to “Brooms N Buckets.”

### Brand Character

Brooms & Buckets is not positioned as a discount cleaning company or a large anonymous maid-service franchise.

It is a **boutique home-cleaning service** built around:

- personal attention
- friendliness
- reliable service
- detailed work
- cheerful personality
- high-quality presentation
- trust inside the customer’s home

### Primary Brand Statement

**Brooms & Buckets — We Make Clean Fun.**

### Supporting Brand Statements

Use selectively throughout the site:

- **Good Clean. Good People. Good Vibes.**
- **North Dallas Never Looked So Clean.**
- **We Bring the Sparkle.**
- **Serious About Clean. Not So Serious About Ourselves.**
- **A Better Kind of House Cleaning.**

Do not use all of these in one section. They should act as recurring brand language.

---

## 3. Core Design Principle

The mascot and wordmark must define the website.

Do **not** create a generic cleaning-company website and simply insert the logo afterward.

The visual system should originate from the Brooms & Buckets identity.

The mascot characters are a meaningful part of the brand and should be treated as recurring editorial illustrations, not tiny decorative clip art.

---

## 4. Brand Assets

Use the following assets as separate brand components.

Recommended repository structure:

```text
/public/brand/
    brooms-buckets-mascot.png
    brooms-buckets-wordmark.png
    brooms-buckets-full-logo.png
```

### 4.1 Mascot-Only Asset

`brooms-buckets-mascot.png`

Contains:

- two illustrated women
- broom
- bucket and cleaning supplies
- sparkle elements
- transparent background

Primary uses:

- homepage hero
- About preview
- booking CTA
- selected brand-story sections
- social/marketing adaptations

Important:

- Use the mascot prominently.
- Do not reduce it to a tiny navbar icon.
- Allow it to feel integrated into the page composition.
- On larger screens it may slightly overlap or bleed outside its visual column.
- Preserve aspect ratio.
- Never stretch or distort.

### 4.2 Wordmark Asset

`brooms-buckets-wordmark.png`

Primary uses:

- desktop header
- footer
- branded callouts
- formal brand identification

Important:

- Use this as the primary site identity in navigation.
- Maintain sufficient size for legibility.
- Do not place it inside an unnecessary white rectangle.
- Because the background is transparent, it should sit naturally on cream, pale blue, or other approved backgrounds.

### 4.3 Full Logo Asset

`brooms-buckets-full-logo.png`

Primary uses:

- full brand lockup
- footer
- print-oriented sections
- marketing pages
- occasional secondary brand display

Do not use this as the large hero image when the mascot-only composition is visually stronger.

---

## 5. Visual Direction

### Overall Mood

Think:

- boutique lifestyle service brand
- North Dallas residential market
- polished hospitality
- warm editorial design
- modern femininity
- friendly professionalism

Avoid:

- generic maid-service templates
- harsh black
- overly corporate layouts
- cheap clip-art aesthetics
- cartoon overload
- heavy gradients
- excessive shadows
- cluttered cards
- large dark overlays
- gimmicky animation

---

## 6. Color Palette

Use a restrained palette derived from the logo.

### Primary — Deep Navy

Use for:

- primary text
- headings
- navigation
- footer accents
- strong brand elements

Suggested range:

```css
#102A43
#0F2742
#15324D
```

### Powder / Sky Blue

Use for:

- accents
- links
- sparkle motifs
- section details
- iconography

Suggested range:

```css
#62A8D3
#79B7DC
#A9D6EF
```

### Warm Cream / Off White

Primary page background.

Suggested range:

```css
#FAF7F0
#FFFDF8
#F7F3EB
```

### Soft Sage Green

Use for:

- primary CTA
- hover states
- small trust badges
- occasional accents

Suggested range:

```css
#7EA184
#86A98A
#739476
```

### Pale Blue

Use for alternate section backgrounds.

Suggested range:

```css
#EEF7FB
#E6F2F8
```

### Accent Gold / Warm Tan

Optional, subtle use only.

Suggested range:

```css
#D6B16F
#CBA56A
```

Do not introduce additional dominant colors unless necessary.

---

## 7. Typography

Use an elegant editorial serif for major headlines and a clean modern sans-serif for body copy and UI.

### Headline Style

Preferred feel:

- elegant
- warm
- slightly upscale
- editorial rather than corporate

Potential options:

- Playfair Display
- Cormorant Garamond
- Libre Baskerville
- DM Serif Display

### Body / UI Style

Potential options:

- Inter
- Manrope
- DM Sans
- Source Sans 3
- Lato

Use no more than two font families.

### Responsive Typography

Use CSS `clamp()` where appropriate.

Example:

```css
.hero-title {
  font-size: clamp(2.6rem, 5vw, 5.4rem);
  line-height: 0.98;
}
```

Avoid tiny body copy.

---

## 8. Site Architecture

Primary navigation:

```text
Home
Services
About
Contact
Book a Clean
```

Optional future pages:

```text
Service Areas
FAQ
Reviews
Policies
Gift Cards
```

The initial site should not become unnecessarily complex.

---

## 9. Header

### Desktop

Structure:

```text
[ WORDMARK ]       Home   Services   About   Contact        [ Book a Clean ]
```

Requirements:

- use transparent wordmark
- meaningful logo size
- clean horizontal alignment
- generous spacing
- sticky or semi-sticky behavior after scroll
- subtle background transition on scroll if desired

Preferred behavior:

- transparent/light header at top
- slightly reduced height after scrolling
- soft bottom border or subtle shadow only if needed

Primary CTA:

**Book a Clean**

Use sage green or another primary action treatment.

### Mobile

Structure:

```text
[ WORDMARK / SMALL MARK ]                     [ MENU ]
```

Menu opens into:

- Home
- Services
- About
- Contact
- Book a Clean

Booking CTA should remain highly visible.

Touch targets should be at least approximately 44px.

---

## 10. Homepage Hero

This is the most important section.

### Desktop Layout

Use approximately:

```text
55% text / 45% mascot
```

Concept:

```text
┌──────────────────────────────────────────────────────────────┐
│ WORDMARK      Home Services About Contact     BOOK A CLEAN   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ BOUTIQUE HOME CLEANING • NORTH DALLAS      [ LARGE MASCOT ] │
│                                            [               ] │
│ North Dallas,                            ✦ [               ] │
│ Meet Your New                              [               ] │
│ Favorite Clean.                            [               ] │
│                                                              │
│ Beautifully clean homes, friendly people,                   │
│ and a little more fun than your average                     │
│ cleaning company.                                            │
│                                                              │
│ [ BOOK A CLEAN ]    [ SEE OUR SERVICES ]                    │
│                                                              │
│ Good Clean. Good People. Good Vibes.                         │
└──────────────────────────────────────────────────────────────┘
```

### Hero Copy

Eyebrow:

**BOUTIQUE HOME CLEANING • NORTH DALLAS**

Headline:

**North Dallas, Meet Your New Favorite Clean.**

Supporting copy:

**Beautifully clean homes, friendly people, and a little more fun than your average cleaning company.**

Primary CTA:

**Book a Clean**

Secondary CTA:

**See Our Services**

Supporting phrase:

**Good Clean. Good People. Good Vibes.**

### Hero Mascot Treatment

Use the transparent mascot-only asset.

Requirements:

- large
- immediately recognizable
- visually balanced with headline
- no white box
- no framed card
- no excessive drop shadow
- preserve clean transparent edges

On desktop:

- mascot may extend slightly beyond its container
- allow some visual overlap with background shapes/sparkles
- keep broom fully visible where practical

On mobile:

- stack mascot below text
- maintain meaningful size
- do not shrink to insignificance

---

## 11. Homepage Section Sequence

Recommended order:

1. Hero
2. Brand promise
3. Services preview
4. Why choose us
5. Brand personality / About preview
6. Testimonials
7. Service area
8. Final booking CTA
9. Footer

---

## 12. Brand Promise Section

Headline:

**We Bring the Sparkle.**

Suggested copy:

**Thoughtful cleaning, friendly service, and attention to the little things that make home feel wonderful again.**

Design:

- centered or editorial split layout
- lots of breathing room
- small sparkle motifs
- no oversized card container required

Optional supporting microcopy:

**A Better Kind of House Cleaning.**

---

## 13. Services Preview

Use three primary service cards.

### Recurring Cleaning

**Weekly, biweekly, or monthly care that keeps your home consistently fresh.**

### Deep Cleaning

**A top-to-bottom reset when your home needs the full treatment.**

### Move-In / Move-Out

**A fresh beginning—or a spotless goodbye.**

Each service card should include:

- simple icon or tasteful photo
- service title
- short description
- Learn More link/button

Desktop: 3 columns  
Tablet: 2 columns where practical  
Mobile: 1 column

Avoid excessive card shadows.

---

## 14. Why Choose Us

Headline:

**Why North Dallas Homes Choose Brooms & Buckets**

Use four value points.

### Detail Obsessed

**We notice the things other people miss.**

### People You Trust

**Friendly, dependable service from people you feel comfortable welcoming into your home.**

### Boutique Service

**Personal attention without feeling like customer number 4,327.**

### We Make Clean Fun

**Professional results without the corporate cleaning-company personality.**

Design:

- icon + short text
- visually light
- equal hierarchy
- no unnecessary visual noise

---

## 15. Brand Personality / About Preview

Headline:

**Serious About Clean. Not So Serious About Ourselves.**

Suggested copy:

**We started Brooms & Buckets because professional house cleaning does not have to feel impersonal. We are detail-obsessed about your home, but we also believe great service should come with a smile.**

CTA:

**Meet Brooms & Buckets**

Recommended design:

- copy on one side
- mascot illustration on the other
- use a different crop/position from hero
- optional subtle pale blue background

This section should feel personal, not corporate.

Future-proof this section so real photographs of the founders can later be incorporated.

---

## 16. Testimonials

Headline:

**Good Clean. Good People. Good Vibes.**

Display:

- 2–3 testimonial cards on desktop
- stacked or swipeable on mobile

Each card may include:

- quote
- first name
- neighborhood or city if permission exists
- optional star rating only if genuine

Do not fabricate:

- customer counts
- review counts
- ratings
- testimonials
- “500+ happy homes” or similar claims

All social proof must be supportable.

---

## 17. Service Area

Headline:

**Proudly Cleaning North Dallas**

Potential service areas:

- Plano
- Frisco
- Allen
- McKinney
- Prosper
- Carrollton
- nearby communities

Implementation note:

Service areas should be easy to edit in source/configuration.

Do not bake city names into image assets.

Potential supporting copy:

**Not sure whether we serve your neighborhood? Send us a note and we’ll let you know.**

---

## 18. Final CTA

Create a strong branded closing section.

Headline:

**Ready for a Cleaner Home?**

Supporting copy:

**We’ll bring the brooms, the buckets, and the sparkle.**

Primary CTA:

**Book a Clean**

Secondary CTA:

**Contact Us**

Optional use:

- mascot crop
- sparkles
- pale blue or cream background
- restrained decorative illustration

---

## 19. Services Page

Purpose:

Clearly explain what is included without becoming visually dense.

Recommended sections:

1. Page hero
2. Recurring cleaning
3. Deep cleaning
4. Move-in / move-out
5. Optional add-ons
6. What to expect
7. Booking CTA

Each service should support:

- clear scope
- plain-language benefits
- optional checklist
- CTA

Do not overwhelm visitors with excessive fine print on the primary marketing page.

---

## 20. About Page

Purpose:

Build trust and personality.

Recommended structure:

1. About hero
2. Why Brooms & Buckets exists
3. Founders/team section
4. Service philosophy
5. Trust / reliability points
6. Booking CTA

Potential brand copy:

**Professional cleaning should feel personal.**

The About page should eventually support real team photos.

The mascot can remain as a supporting brand element, but real imagery should take priority once available.

---

## 21. Contact Page

Include:

- name
- email
- phone
- city / ZIP
- message
- preferred contact method
- optional cleaning-interest field

Clearly display:

- phone
- email
- service area
- business hours if established

Use clickable `tel:` and `mailto:` links where appropriate.

---

## 22. Book a Clean

This is the primary conversion flow.

At minimum collect:

- name
- email
- phone
- service address
- ZIP code
- property type
- approximate size
- bedrooms
- bathrooms
- cleaning type
- desired date
- frequency
- notes

Possible future enhancements:

- estimate calculator
- scheduling integration
- Stripe deposit/payment
- customer account
- recurring booking

Initial implementation should remain simple and dependable.

---

## 23. Responsive Design Requirements

### Desktop

- strong editorial composition
- generous spacing
- mascot integrated prominently
- multi-column content where appropriate

### Tablet

- simplify side-by-side sections where needed
- maintain image prominence
- preserve CTA hierarchy

### Mobile

Priority:

1. clear headline
2. service explanation
3. booking CTA
4. mascot
5. supporting sections

Rules:

- no horizontal scrolling
- comfortable side padding
- stack multi-column layouts
- keep mascot recognizable
- do not crowd navigation
- maintain 44px+ tap targets
- buttons may become full-width where beneficial

Card behavior:

```text
Desktop: 3 columns
Tablet: 2 columns
Mobile: 1 column
```

---

## 24. Motion and Interaction

Use motion sparingly.

Approved:

- subtle fade-in
- gentle upward entrance
- slight card hover lift
- button hover transitions
- restrained sparkle animation
- subtle mascot movement only if extremely light

Avoid:

- excessive parallax
- constant motion
- bouncing CTAs
- spinning icons
- distracting scroll effects
- autoplay video backgrounds

The brand should feel polished, not gimmicky.

---

## 25. Photography

Photography should support the brand, not dominate it.

Preferred imagery:

- bright North Dallas-style interiors
- clean kitchens
- airy living spaces
- polished bathrooms
- natural light
- real staff photos when available

Avoid:

- generic overused maid-service stock photography
- staged images of people aggressively scrubbing
- overly dark interiors
- sterile commercial-cleaning imagery

The homepage hero should prioritize the mascot rather than a full-screen generic living-room photo.

---

## 26. Accessibility

Required:

- semantic HTML
- keyboard-accessible navigation
- visible focus states
- sufficient text contrast
- alt text for meaningful images
- decorative images marked appropriately
- properly associated form labels
- accessible error messages
- responsive zoom behavior
- no text embedded in image-only form when equivalent HTML can be used

---

## 27. SEO Basics

Each page must have:

- unique page title
- meta description
- semantic heading structure
- canonical URL where appropriate
- social sharing metadata
- descriptive image alt text
- local-business-oriented copy

Potential homepage title:

**Brooms & Buckets | Boutique House Cleaning in North Dallas**

Potential meta description:

**Brooms & Buckets provides friendly, detail-focused boutique home cleaning across North Dallas, including Plano, Frisco, Allen, McKinney, Prosper and surrounding communities.**

Do not keyword-stuff.

---

## 28. Performance

Requirements:

- optimize image files
- lazy-load below-the-fold imagery
- preload only critical assets
- use WebP/AVIF where practical
- preserve PNG where transparency quality requires it
- avoid unnecessary JavaScript
- avoid large framework dependencies for simple effects
- use responsive image sizing

Target:

- fast first load
- minimal layout shift
- strong mobile performance

---

## 29. Technical Architecture

Use the simplest architecture appropriate to the existing Cursor project.

Acceptable:

- HTML/CSS/JavaScript
- Vite
- React
- Astro
- lightweight static framework

Do not introduce a new framework solely for visual redesign if the current codebase can support the requirements.

The site should be suitable for deployment to Cloudflare.

---

## 30. Suggested Component Structure

If using React or similar:

```text
src/
  components/
    Header
    Hero
    BrandPromise
    ServicesPreview
    WhyChooseUs
    AboutPreview
    Testimonials
    ServiceArea
    FinalCTA
    Footer
    BookingForm
  pages/
    Home
    Services
    About
    Contact
    Book
  styles/
    tokens
    typography
    layout
    components
```

If using static HTML, preserve the same logical separation using partials or organized section classes.

---

## 31. Design Tokens

Prefer CSS custom properties.

Example:

```css
:root {
  --color-navy: #102A43;
  --color-blue: #62A8D3;
  --color-pale-blue: #EEF7FB;
  --color-cream: #FAF7F0;
  --color-white: #FFFDF8;
  --color-sage: #7EA184;
  --color-gold: #D6B16F;

  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 28px;

  --shadow-soft: 0 12px 32px rgba(16, 42, 67, 0.08);

  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 2rem;
  --space-lg: 4rem;
  --space-xl: 7rem;
}
```

Keep styling centralized and consistent.

---

## 32. Button System

### Primary

Sage background, high-contrast text.

Example:

**Book a Clean**

### Secondary

Outline or text-based treatment.

Example:

**See Our Services**

### Rules

- consistent radius
- clear hover state
- clear focus state
- no tiny buttons
- no excessive button styles

---

## 33. Image Handling

Mascot/logo images should:

- maintain natural proportions
- use `object-fit: contain`
- never stretch
- never receive rounded card backgrounds unless specifically required
- retain transparent edges
- use responsive max-width values

Suggested hero behavior:

```css
.hero-mascot {
  width: min(48vw, 680px);
  max-width: 100%;
  height: auto;
}
```

Mobile:

```css
.hero-mascot {
  width: min(92vw, 520px);
}
```

---

## 34. Content Tone

Voice should be:

- warm
- direct
- friendly
- confident
- lightly playful
- polished

Avoid:

- corporate jargon
- excessive exclamation points
- childish jokes
- exaggerated promises
- fake urgency
- overuse of puns

Good example:

**We’ll bring the brooms, the buckets, and the sparkle.**

Less desirable:

**OMG! Your house is about to be AMAZING!!!**

---

## 35. Trust and Claims

Never invent:

- customer counts
- years in business
- reviews
- ratings
- insurance status
- background-check claims
- satisfaction guarantees
- licensing claims
- certifications
- awards

Use placeholders where verified business information is not yet available.

---

## 36. Footer

Include:

- wordmark or full logo
- short brand sentence
- navigation
- service area
- phone
- email
- social links
- copyright
- privacy policy
- terms if created

Suggested short brand copy:

**Boutique home cleaning for North Dallas. Good clean. Good people. Good vibes.**

---

## 37. Favicon / Small Mark

The full logo is too detailed for a favicon.

Create or reserve space for a simplified mark, potentially:

- broom + bucket
- house + sparkle
- simplified initials
- simplified character badge

Do not shrink the entire illustrated logo into a 16px icon.

---

## 38. What Must Not Be Lost from the Existing Site

Preserve basic professional cleaning-site functionality:

- straightforward navigation
- services overview
- About page
- contact capability
- booking CTA
- responsive behavior
- clear business purpose
- local market emphasis

The redesign is visual and experiential, not a reason to make the site harder to use.

---

## 39. What Must Change from the Existing Airo Design

Do not preserve:

- generic stock-photo-dominant hero
- tiny logo treatment
- generic template spacing
- dark-overlay-first visual identity
- arbitrary trust claims
- visual hierarchy that minimizes the Brooms & Buckets brand

The mascot, wordmark, typography, color, tone, and layout should make the site recognizable even before reading the company name.

---

## 40. Acceptance Criteria

The redesign is successful when:

- the site clearly feels like Brooms & Buckets
- the mascot is used prominently but tastefully
- the wordmark is clearly visible
- the homepage hero is distinctive
- the site is fully responsive
- the user can easily understand services
- the booking CTA is obvious
- mobile navigation works cleanly
- no horizontal overflow occurs
- branding remains consistent across pages
- content is easy to edit later
- performance remains strong
- accessibility basics are implemented
- no unsupported business claims are introduced

---

## 41. Final Creative Direction

The guiding question is:

**Does this feel like a recognizable boutique brand, or does it feel like another house-cleaning template?**

If an element feels generic, simplify it or bring it back to the Brooms & Buckets identity.

The visual hierarchy should consistently reinforce:

**Beautiful homes. Friendly people. A little more fun.**

And the brand should always feel anchored by:

**Brooms & Buckets — We Make Clean Fun.**
