---
title: "The Countdown to Uluru Begins: 50 Days to Go!"
subtitle: "From careful planning to the red dust of the outback"
description: "The Bundoora Scouts Uluru Adventure is almost here. 50 days until we hit the road with our friends from across Victoria."
image: /uploads/hero/uluru.jpg
author:
    - hamish
categories:
    - Scouts
    - Venturer Scouts
tags:
    - Uluru 2026
    - Adventure
    - Expedition
    - Camp
groups:
  - name: "Bundoora Scouts"
    image: "/assets/images/logo.svg"
    description: "Trip Organizers"
  - name: "Heany Park Scouts"
    image: "/uploads/2025-08-16-uluru-adventure-2026/heany-park.png"
    description: "Trip Organizers"
    url: "https://heanyparkscouts.com.au/"
  - name: "Carlton Scouts"
    image: "/assets/images/logo-sv-light.svg"
    url: "https://www.carltonscoutgroup.com"
  - name: "Eaglemont Scouts"
    image: "/uploads/2025-08-16-uluru-adventure-2026/eaglemont.png"
    url: "https://eaglemontscouts.org.au"
  - name: "Gembrook Scouts"
    image: "/assets/images/logo-sv-light.svg"
    url: "https://scoutsvictoria.com.au/location/1ST-GEMBROOK"
  - name: "Greenhills Scouts"
    image: "/uploads/2025-08-16-uluru-adventure-2026/greenhills.png"
    url: "https://1stgreenhills.org.au"
  - name: "Grovedale Scouts"
    image: "/assets/images/logo-sv-light.svg"
    url: "https://scoutsvictoria.com.au/location/1st-grovedale/"
  - name: "Watsonia Scouts"
    image: "/uploads/2025-08-16-uluru-adventure-2026/watsonia.png"
    url: "https://www.watsoniascoutcentre.org.au"
---

It is starting to feel real now.

In a little over **50 days**, the Bundoora Scouts Uluru Adventure moves from spreadsheets, permission notes, gear lists, and leader meetings into red dirt, long roads, and Scouts learning what a big expedition actually feels like.

> The countdown is on. Uluru, we are coming.

## The Excitement is Building

The expedition has been sitting on calendars for a long time, but it has started to feel close. Gear is coming together. Final plans are locking in. Scouts are asking good questions, parents are asking even better ones, and leaders are doing that thing where we pretend a list with 47 items is under control.

The pre-camp shakedown is done. Now we keep tightening the details until departure day arrives.

## A Journey Shared

We have planned this journey alongside our friends from **[Heany Park Scouts](https://heanyparkscouts.com.au/)**. Their leaders have put in a mountain of work, and the trip is stronger because we are doing it together.

We also will not be travelling alone. Scouts from across Victoria will join the convoy, which should make the stories better and the bus loading more interesting.

<section class="my-12 py-12 bg-surface-container-lowest rounded-[3rem] border border-outline-variant/10 shadow-sm not-prose">
  <div class="flex flex-wrap justify-center gap-x-12 gap-y-10 px-6">
    {% for group in page.groups %}
    <div class="flex flex-col items-center text-center max-w-[120px] group/item">
      {% if group.url %}
      <a href="{{ group.url }}" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center">
      {% endif %}
        <div class="w-24 h-24 rounded-full bg-white shadow-ambient-md border border-outline-variant/10 flex items-center justify-center overflow-hidden mb-4 group-hover/item:scale-110 transition-transform duration-300">
          <img src="{{ group.image }}" alt="" aria-hidden="true" class="w-16 h-16 object-contain">
        </div>
        <h5 class="font-headline font-bold text-primary text-xs leading-tight">{{ group.name }}</h5>
      {% if group.url %}
      </a>
      {% endif %}
      {% if group.description %}
      <p class="text-[10px] text-secondary font-black uppercase tracking-tighter mt-1">{{ group.description }}</p>
      {% endif %}
    </div>
    {% endfor %}
  </div>
</section>


## Follow the Adventure

To help families and friends follow along, we have launched a **countdown timer and live expedition tracker**. Once the convoy is on the road, you will be able to see where the group is and follow the trip as it unfolds.

<div class="flex flex-wrap gap-4 not-prose">
    <a href="/trip/uluru-2026" 
       class="text-on-primary px-8 py-4 rounded-lg font-bold hover:scale-105 transition-all duration-300 shadow-lg flex items-center gap-2"
       style="background: linear-gradient(135deg, #3f5e94, #100e4c);">
        <span class="material-symbols-outlined group-hover:rotate-12 transition-transform" aria-hidden="true">explore</span>
        Track the Uluru Expedition
        <span class="material-symbols-outlined group-hover:translate-x-1 transition-transform" aria-hidden="true">arrow_forward</span>
    </a>
</div>

The countdown is on. Time to check the gear pile one more time.


