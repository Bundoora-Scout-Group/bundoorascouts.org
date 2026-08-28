# Architecture Guide

This repository is a Jekyll static site with Tailwind CSS, data-driven navigation, reusable Liquid includes, and a few custom JavaScript features for trips and interactive UI.

## Build Stack

- Static site generator: Jekyll 4.
- CSS: Tailwind CSS v4 through `jekyll-tailwind`.
- Markdown: Kramdown with GitHub-flavoured Markdown input.
- JavaScript: mostly inline in layouts/includes plus `assets/js/site.js`.
- Animations: GSAP and ScrollTrigger loaded globally in `_layouts/default.html`.
- Maps: self-hosted Leaflet and MapLibre render OpenStreetMap Shortbread vector tiles, with a plain Leaflet raster fallback when WebGL2 is unavailable.

Configuration lives in `_config.yml`.

## Top-Level Structure

- `_config.yml`: site metadata, plugins, collections, pagination, Tailwind input, build exclusions, defaults.
- `_data/`: YAML data used across layouts and includes.
- `_includes/`: reusable Liquid/HTML components.
- `_layouts/`: page templates.
- `_people/`: Jekyll collection for leader/profile pages.
- `_posts/`: Campfire news posts.
- `_trips/`: Jekyll collection for trip and expedition pages.
- `about/`, `scouting/`, `sections/`: content directories for main site areas.
- `assets/`: CSS, JavaScript, logos, icons, and design assets.
- `uploads/`: content media, post images, trip photos, and hall hire documents.
- `scripts/`: local build/preprocessing helpers.
- `docs/`: contributor documentation excluded from the site build.

Do not use `_site/` as source; it is generated output.

## Layout Hierarchy

Most pages are Markdown files with YAML frontmatter. Their `layout` selects a file in `_layouts/`.

Key layouts:

- `default.html`: base HTML shell, SEO tags, fonts, CSS, nav, footer, GSAP setup, Markdown alert enhancement, and global trip banner logic.
- `page.html`: ordinary content pages with a compact hero and prose body.
- `section.html`: top-level section pages with section logo, age range, meeting time, actions, and section content.
- `achievement-pathway.html`: Achievement Pathway shell with pathway hero, sidebar/mobile nav, and page content.
- `blog.html`: Campfire listing and autopage layout with category filters, featured card, cards grid, and load-more pagination.
- `post.html`: individual Campfire post layout.
- `person.html`: people collection pages.
- `trip.html`: older trip/post-style layout.
- `expedition.html`: modern trip tracker layout with JSON data serialization, map, timeline, gallery, and optional test mode controls.

## Data Layer

The site uses `_data/*.yml` for shared structured content.

Important files:

- `_data/navigation.yml`: main navigation. Supports static children and dynamic section collection entries.
- `_data/sections.yml`: canonical section metadata including slug, URL, age range, time, colour, icons, logos, and joining IDs.
- `_data/achievement_pathway_nav.yml`: sidebar/mobile nav for Achievement Pathway pages. Uses `ap_page` for active state and optional `requires_*` flags for section-specific availability.
- `_data/oas.yml`: Outdoor Adventure Skills data.
- `_data/sia.yml`: Special Interest Areas data.
- `_data/icons.yml`: Material Symbols icon names included in the Google Fonts request.
- `_data/footer.yml`, `_data/sponsors.yml`, `_data/gallery.yml`: shared footer, sponsors, and gallery content.
- `_data/<trip-slug>/`: trip-specific data for expedition pages.

Prefer updating data files when the same content appears in multiple places.

## Content Areas

### Main Pages

Root pages such as `index.md`, `about.md`, `sections.md`, `scouting.md`, `contact.md`, `privacy-policy.md`, and `terms.md` are ordinary Markdown pages. Many use `layout: page`; some use custom layouts or include-driven content.

### Scouting Pages

Pages under `scouting/` explain Scouting, program, costs, child safety, badges, and glossary content. They are mostly content pages using shared page/prose styling.

### Section Pages

Top-level section pages are `sections/joeys.md`, `sections/cubs.md`, `sections/scouts.md`, `sections/venturers.md`, `sections/rovers.md`, and `sections/adult.md`.

They use `layout: section` and rely on structured frontmatter for features, intro copy, testimonials, award details, and Achievement Pathway callouts. They also depend on `_data/sections.yml` for canonical section metadata.

### Achievement Pathway

Achievement Pathway pages live under each section directory:

```text
sections/<section>/achievement-pathway.md
sections/<section>/program-essentials.md
sections/<section>/milestones.md
sections/<section>/outdoor-skills.md
sections/<section>/special-interests.md
sections/<section>/adventurous-journey.md
sections/<section>/leadership-course.md
sections/<section>/personal-reflection.md
sections/<section>/peak-award.md
```

Not every section has every page. Joeys skip some items through flags in `_data/achievement_pathway_nav.yml`.

The active nav item is controlled by `ap_page`. Page content is usually a single include such as:

```liquid
{% include achievement-pathway-overview.html %}
```

Overview content is in `_includes/achievement-pathway-overview.html`. Detail pages use shorter includes such as `achievement-pathway-pe.html`, `achievement-pathway-milestones.html`, `achievement-pathway-oas.html`, and similar.

### Campfire Posts

Posts live in `_posts/` and are listed through `the-campfire.md` using `layout: blog`. Categories and tags generate autopages through `jekyll-paginate-v2`.

Post cards are handled by `_includes/blog-card.html` and `_includes/featured-card.html`.

### People

People are a Jekyll collection configured in `_config.yml`. Files live in `_people/` and output to `/people/:name`. Leader grids/stacks filter this collection by section.

### Trips And Expeditions

Trip entries live in `_trips/`. Modern trip trackers use `layout: expedition` and point to data files in `_data/<trip-slug>/`.

The expedition layout serializes itinerary, gallery, route, and telemetry data into a JSON script tag:

```liquid
site.data[page.data_location][page.data_itinerary]
```

The map, timeline, and gallery are rendered by:

- `_includes/expedition-map.html`
- `_includes/expedition-timeline.html`
- `_includes/expedition-gallery.html`

Route preprocessing is handled by `scripts/precompute_route.js`.

The map renderer, vector style, glyphs, and sprites are committed under `assets/vendor/` and `assets/map/`. Run `npm ci` followed by `npm run build:maps` to refresh them from the pinned, checksum-verified sources in `scripts/build_map_assets.mjs`. Do not hand-edit those generated map assets.

## Assets

Reusable design assets live in `assets/images/`. Content-specific media lives in `uploads/`.

Common asset groups:

- `assets/images/logo-*.svg`: site and section logos.
- `assets/images/sections/`: section badges, milestone badges, peak award assets, and mountain artwork.
- `_includes/icons/`: inline SVG includes for OAS and SIA badge families.
- `uploads/hero/`: hero images used by pages/posts.
- `uploads/sections/<section>/`: section-specific photos.
- `uploads/trip/<trip>/`: trip media.

Use root-relative paths such as `/assets/images/logo.png` and `/uploads/hero/example.jpg`.

## CSS And JavaScript

CSS source is `assets/css/app.css`. It contains Tailwind imports, theme tokens, base styles, and component classes.

Global JavaScript is split between:

- `_layouts/default.html`: GSAP setup, Markdown alert transformation, global scripts.
- `assets/js/site.js`: shared site behaviour.
- Feature includes/layouts: trip maps, timelines, gallery behaviour, and pagination.

When adding JavaScript, keep it local to the component unless it is truly global.

## Build Exclusions

The site excludes docs, package files, generated/cache folders, scripts, and root agent guide files through `_config.yml`.

If adding contributor-only documentation, make sure it is excluded from the build.
