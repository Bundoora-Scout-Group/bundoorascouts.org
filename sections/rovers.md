---
layout: section
title: "Rover Scouts"
permalink: /sections/rovers
description: "Service, adventure, and fellowship. Rovers are self-governing young adults aged 18 to 26 who create their own adventures and give back to the community."
tagline: "Service, adventure, fellowship."
colour: "#DC291E"
colour_dark: "#DC291E"
icon: directions_bike
section_slug: rovers
motto: "Service"
redirect_from: [/sections/rover-scouts]
award:
  title: "Award Scheme"
  name: "Baden-Powell Scout Award"
  description: "The highest award available to members of the Rover Section, recognized worldwide. The Baden-Powell Scout Award is earned through service, adventure, and personal development."
features:
  - icon: directions_car
    title: "Motorsports"
    description: "Get down and dirty with Victoria’s Rovers for motorsports at Mudbash."
  - icon: celebration
    title: "Social Events"
    description: "Costumed chaos reigns at the annual Rover Ball and Surfmoot camp at Anglesea."
  - icon: hiking
    title: "Outdoor Adventures"
    description: "The Armstrong 500 hiking competition and our very own Rover Bogong Ski Chalet."
  - icon: public
    title: "National Events"
    description: "Converge with Rovers from all over Australia for the tri-annual National Moot."
intro:
  title: "Beyond the Horizon"
  paragraphs:
    - "\"Rovers do stuff\" is a popular sentiment because we do in fact do lots of stuff! As Rovers, we create our own adventure from start to finish, building skills widely recognised outside of Scouting."
    - "Handfield Rover Unit is hosted at the Bundoora Scout Hall Rover Den and welcomes all young adults from 18 to 26 years. You don’t need any prior Scouting experience – just a 'give it a go' attitude!"
  rotation: "rotate-2"
testimonials:
  - quote: "Rovers is a great way to meet new people and have amazing experiences."
    source: "A Rover"
badge_card:
  title: "The Achievement Pathway"
  description: "Follow the path up the mountain! The Achievement Pathway is your personal progression through the program towards the Baden-Powell Scout Award."
  url: "/sections/rovers/achievement-pathway"
  icon: "terrain"
  button_text: "Explore the Pathway"
---

## What to Expect

{% include feature-grid.html features=page.features colour=page.colour %}

## {{ page.intro.title }}

{% include section-intro.html 
   section_slug=page.section_slug 
   paragraphs=page.intro.paragraphs 
   rotation=page.intro.rotation %}

{% include badge-card.html %}

## Our Promise and Law

{% include promise-law.html 
   colour=page.colour 
   motto=page.motto 
   section_slug=page.section_slug
   award_title=page.award.title 
   award_name=page.award.name 
   award_description=page.award.description %}

## What Our Families Say

{% include testimonial-grid.html testimonials=page.testimonials colour=page.colour %}

{% include info-grid.html colour=page.colour %}

{% assign section_people = site.people | where: "section", page.section_slug %}
{% if section_people.size > 0 %}
## Meet the Leaders

{% include leader-grid.html section_slug=page.section_slug colour=page.colour %}
{% endif %}
