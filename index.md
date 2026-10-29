---
layout: default
title: Joeys, Cubs, Scouts, Rovers & Youth Adventures
description: Discover Joey Scouts, Cub Scouts, Scouts, Venturers and Rovers at Bundoora Scout Group. Explore weekly activities, camping and how to join.
image: "/uploads/hero/aerial.jpg"
---

<header class="hero-shell bg-surface-container-low">
  <div class="hero-media">
    <img src="{{ page.image }}" alt="Scouts hiking" loading="eager" fetchpriority="high"
      class="hero-media-image hero-media-image--strong" />
    <div class="hero-overlay"></div>
  </div>
  <div class="site-container hero-content">
    <div class="hero-copy">
      <span class="eyebrow eyebrow--tertiary">
        Adventure Awaits in Bundoora
      </span>
      <h1 class="hero-title">
        Join Bundoora Scouts – Adventure, Friendship & Skills for Life
      </h1>
      <p class="hero-description">
        Empowering youth through outdoor education, leadership, and community. Join the journey from Joeys to Rovers.
      </p>
      <div class="hero-actions">
        <a href="#scouting-sections" class="btn text-on-primary"
          style="background: linear-gradient(135deg, #3f5e94, #100e4c);">
          Find Your Section
        </a>
        <a href="/about" class="btn btn-ghost">
          Learn More
        </a>
      </div>
    </div>
  </div>
</header>

<!-- Sections Bento Grid -->
<section id="scouting-sections" class="site-container-wide section-shell">
  <div class="section-header max-w-7xl mx-auto">
    <div>
      <h2 class="section-title">
        Our <br />
        <span class="text-secondary">Sections.</span>
      </h2>
      <p class="section-description mt-4">A progressive journey of discovery.</p>
    </div>
    <a href="/sections" class="btn btn-secondary flex-shrink-0">
      View All Sections <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </a>
  </div>

  <div class="max-w-7xl mx-auto not-prose">
    {% include section-grid.html %}
  </div>
</section>

<!-- Latest from The Campfire -->
<section class="site-container-wide section-shell">
  <div class="surface-band px-4 py-8 sm:px-6 md:px-8">
    <div class="section-header mb-10 md:mb-16">
      <h2 class="section-title">
        Latest from <br />
        <span class="text-on-tertiary-container">The Campfire.</span>
      </h2>
      <a href="/the-campfire" class="btn btn-secondary flex-shrink-0">
        Read All Stories <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
      </a>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      {% for post in site.posts limit:3 %}
      <div data-gsap="reveal" data-delay="{{ forloop.index | times: 0.1 }}">
        {% include blog-card.html post=post %}
      </div>
      {% endfor %}
    </div>
  </div>
</section>

<!-- Hall Hire CTA Section -->
<section class="site-container-wide pb-12" data-gsap="reveal">
  <div
    class="surface-band relative overflow-hidden shadow-ambient-lg">
    <div class="absolute inset-0 z-0">
      <img src="/uploads/hall-hire/Main-Hall-2.jpg" alt="Bundoora Scout Hall Interior"
        class="w-full h-full object-cover opacity-20 mix-blend-overlay">
      <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5"></div>
    </div>

    <div class="relative z-10 flex flex-col md:flex-row items-center">
      <div class="w-full md:w-1/2 p-6 sm:p-8 md:p-16 lg:p-24">
        <span class="eyebrow eyebrow--accent">
          Venue Hire
        </span>
        <h2 class="section-title mb-8">
          A Space for the <br />
          <span class="text-secondary">Community.</span>
        </h2>
        <p class="section-description mb-10 max-w-lg text-lg">
          Our affordable, versatile hall in N.J. Telfer Reserve is the perfect venue for your next class, meeting, or
          event.
        </p>
        <div class="hero-actions">
          <a href="/about/hall-hire" class="btn text-on-primary"
            style="background: linear-gradient(135deg, #3f5e94, #100e4c);">
            Learn More
          </a>
          <a href="https://www.spacetoco.com/space/bundoora-scout-hall" target="_blank"
            class="btn btn-secondary bg-white/60 border border-primary/10">
            <img src="/assets/images/spacetoco-icon-light.svg" alt="" aria-hidden="true" class="h-5 w-auto shrink-0">
            Book Now
          </a>
        </div>
      </div>

      <div class="w-full md:w-1/2 p-8 md:pr-16 lg:pr-24 hidden md:block">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-4">
            <img src="/uploads/hall-hire/Main-Hall-1.jpg" alt="Hall interior"
              class="rounded-3xl shadow-lg w-full aspect-square object-cover transform -rotate-2 hover:rotate-0 transition-transform duration-500">
            <img src="/uploads/hall-hire/Kitchen-1.jpg" alt="Kitchen"
              class="rounded-3xl shadow-lg w-full aspect-video object-cover transform rotate-3 hover:rotate-0 transition-transform duration-500">
          </div>
          <div class="space-y-4 pt-12">
            <img src="/uploads/hall-hire/Parking.jpg" alt="Parking"
              class="rounded-3xl shadow-lg w-full aspect-video object-cover transform rotate-2 hover:rotate-0 transition-transform duration-500">
            <img src="/uploads/hall-hire/Bio-Garden.jpg" alt="Garden"
              class="rounded-3xl shadow-lg w-full aspect-square object-cover transform -rotate-3 hover:rotate-0 transition-transform duration-500">
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
