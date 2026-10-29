---
layout: page
title: "Contact Us"
permalink: /contact
redirect_from: [/contact-us/]
badge: "Get in touch"
description: "Whether you want to enrol your child, volunteer as a leader, or just find out more – we'd love to hear from you."
image: /assets/images/about/contact-us.jpg
---

<div class="site-container-wide not-prose">

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

    <!-- Contact Form -->
    <div>
      <h2 class="font-headline text-2xl font-bold text-primary mb-8">Send us a message</h2>
      <form id="contact-form" class="flex flex-col gap-6" action="{{ site.formspree_action }}" method="POST">
        <input type="hidden" name="_subject" value="New contact from bundoorascouts.org website">

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div class="flex flex-col gap-2 sm:col-span-2">
            <label for="contact-name" class="text-sm font-label font-semibold text-on-surface-variant uppercase tracking-wider">Your Name <span class="text-error">*</span></label>
            <input id="contact-name" name="name" type="text" required
                   placeholder="Jane Smith"
                   class="form-control"/>
          </div>
          <div class="flex flex-col gap-2">
            <label for="contact-email" class="text-sm font-label font-semibold text-on-surface-variant uppercase tracking-wider">Email Address <span class="text-error">*</span></label>
            <input id="contact-email" name="_replyto" type="email" required
                   placeholder="jane@example.com"
                   class="form-control"/>
          </div>
          <div class="flex flex-col gap-2">
            <label for="contact-phone" class="text-sm font-label font-semibold text-on-surface-variant uppercase tracking-wider">Phone Number</label>
            <input id="contact-phone" name="phone" type="tel"
                   placeholder="0412 345 678"
                   class="form-control"/>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <span class="text-sm font-label font-semibold text-on-surface-variant uppercase tracking-wider">What can we help with? <span class="text-error">*</span> <span class="normal-case font-normal opacity-70">(Select at least one)</span></span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {% for section in site.data.sections %}
            {% if section.active %}
              {% if section.slug == "adult" %}
                {% assign option_label = "Leaders and Adult Members" %}
              {% elsif section.slug == "rovers" %}
                {% assign option_label = "Rovers - " | append: section.age_range | append: " Years" %}
              {% else %}
                {% assign option_label = section.name | append: " - " | append: section.age_range | append: " Years" %}
              {% endif %}
            <label class="form-check cursor-pointer">
              <input type="checkbox" name="help_with" value="{{ option_label }}"{% if section.sectionid %} data-section-name="{{ section.name }}"{% endif %} class="w-5 h-5 rounded border-outline text-primary focus:ring-secondary/30">
              <span class="text-on-surface text-sm">{{ option_label }}</span>
            </label>
            {% endif %}
            {% endfor %}
            {% assign additional_help_options = "Hall Hire,Other" | split: "," %}
            {% for option in additional_help_options %}
            <label class="form-check cursor-pointer">
              <input type="checkbox" name="help_with" value="{{ option }}" class="w-5 h-5 rounded border-outline text-primary focus:ring-secondary/30">
              <span class="text-on-surface text-sm">{{ option }}</span>
            </label>
            {% endfor %}
          </div>
        </div>

        <div id="extranet-suggestion" class="hidden">
          <div class="surface-card-muted p-6">
            <h4 class="font-headline font-bold text-primary text-lg mb-1">Ready to start the adventure?</h4>
            <p class="text-on-surface-variant text-sm mb-4">If you're looking to join, you can register your interest directly on the Scouts Victoria extranet. You can still send us a message if you just have a question!</p>
            <div id="extranet-buttons" class="flex flex-wrap gap-3">
              {% for section in site.data.sections %}
                {% if section.sectionid %}
                  {% assign encoded_id = section.sectionid | url_encode %}
                  {% assign join_url = site.onboarding_url | append: encoded_id %}
                  <a href="{{ join_url }}"
                    data-section-name="{{ section.name }}"
                    target="_blank" rel="noopener"
                    class="extranet-btn btn hidden text-white shadow-sm items-center justify-center"
                    style="background: linear-gradient(135deg, {{ section.colour | default: '#3f5e94' }}, {{ section.colour_dark | default: section.colour | default: '#100e4c' }});">
                    Join {{ section.name }} <span class="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
                  </a>
                {% endif %}
              {% endfor %}
            </div>
          </div>
        </div>

        <div id="hall-hire-suggestion" class="hidden">
          <div class="surface-card-muted p-6">
            <h4 class="font-headline font-bold text-primary text-lg mb-1">Short term or long term hire?</h4>
            <p class="text-on-surface-variant text-sm mb-4">If you're planning to make a single booking, please book via SpacetoCo. For longer term hire, we'd love to hear from you. If you just have a question about our hall, you can still send us a message.</p>
            <a href="https://www.spacetoco.com/space/bundoora-scout-hall"
               target="_blank" rel="noopener"
               class="btn btn-secondary bg-white/80 border border-primary/10">
              <img src="/assets/images/spacetoco-icon-light.svg" alt="" aria-hidden="true" class="h-5 w-auto shrink-0">
              Book via SpacetoCo
            </a>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label for="contact-comments" class="text-sm font-label font-semibold text-on-surface-variant uppercase tracking-wider">Message <span class="text-error">*</span></label>
          <textarea id="contact-comments" name="comments" rows="5" required
                    placeholder="Tell us a bit about yourself..."
                    class="form-control resize-none"></textarea>
        </div>
        
        <!-- reCAPTCHA -->
        <script src="https://www.google.com/recaptcha/enterprise.js" async defer></script>
        <script>
          function onSubmit(token) {
            document.getElementById('contact-form').submit();
          }
          
          document.addEventListener('DOMContentLoaded', () => {
            const form = document.getElementById('contact-form');
            const checkboxes = Array.from(form.querySelectorAll('input[name="help_with"]'));
            
            document.getElementById('contact-submit').addEventListener('click', function(event) {
              var isChecked = checkboxes.some(cb => cb.checked);
              
              if (!isChecked) {
                checkboxes[0].setCustomValidity('Please select at least one option.');
              } else {
                checkboxes[0].setCustomValidity('');
              }

              if (!form.checkValidity()) {
                event.preventDefault();
                event.stopImmediatePropagation();
                form.reportValidity();
              }
            }, true);

            
            const extranetSuggestion = document.getElementById('extranet-suggestion');
            const extranetButtons = Array.from(document.querySelectorAll('.extranet-btn'));
            const hallHireSuggestion = document.getElementById('hall-hire-suggestion');

            function updateExtranetVisibility() {
              const selectedSections = checkboxes
                .filter(cb => cb.checked && cb.dataset.sectionName)
                .map(cb => cb.dataset.sectionName);
              const showExtranet = selectedSections.length > 0;

              if (showExtranet) {
                extranetSuggestion.classList.remove('hidden');
                extranetButtons.forEach(btn => {
                  if (selectedSections.includes(btn.dataset.sectionName)) {
                    btn.classList.remove('hidden');
                    btn.classList.add('inline-flex');
                  } else {
                    btn.classList.add('hidden');
                    btn.classList.remove('inline-flex');
                  }
                });
              } else {
                extranetSuggestion.classList.add('hidden');
              }
            }

            function updateHallHireVisibility() {
              const showHallHire = checkboxes.some(cb => cb.checked && cb.value === 'Hall Hire');
              hallHireSuggestion.classList.toggle('hidden', !showHallHire);
            }

            checkboxes.forEach(cb => {
              cb.addEventListener('change', () => {
                checkboxes[0].setCustomValidity('');
                updateExtranetVisibility();
                updateHallHireVisibility();
              });
            });

            // Initial check
            updateExtranetVisibility();
            updateHallHireVisibility();
          });
        </script>

        <button type="submit" id="contact-submit"
                class="btn btn-primary g-recaptcha" data-sitekey="{{ site.recapcha_site_key }}" data-callback="onSubmit" data-action="site_contact">
          Send Message <span class="material-symbols-outlined" aria-hidden="true">send</span>
        </button>

        <div class="text-xs text-on-surface-variant opacity-50">
          This site is protected by reCAPTCHA and the Google
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy Policy</a> and
          <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Terms of Service</a> apply.
        </div>

      </form>
    </div>

    <!-- Contact Info -->
    <div class="flex flex-col gap-8">
      <h2 class="font-headline text-2xl font-bold text-primary">Get in touch directly</h2>

      <div class="flex flex-col gap-6">

        <div class="surface-card-muted flex flex-row gap-6 p-6 sm:p-8 items-start not-prose">
          <div class="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-primary text-2xl" aria-hidden="true">location_on</span>
          </div>
          <div class="flex-1">
            <h3 class="mt-0 font-headline font-bold text-primary text-2xl mb-2 leading-tight">Scout Hall</h3>
            <p class="text-on-surface-variant text-base leading-relaxed">
              Bundoora Scout Group<br/>
              20 Noorong Ave<br/>
              Bundoora, VIC 3083
            </p>
          </div>
        </div>

        <div class="surface-card-muted flex flex-row gap-6 p-6 sm:p-8 items-start not-prose">
          <div class="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-primary text-2xl" aria-hidden="true">schedule</span>
          </div>
          <div class="flex-1">
            <h3 class="mt-0 font-headline font-bold text-primary text-2xl mb-3 leading-tight">Meeting Times</h3>
            <div class="space-y-3">
              {% assign meeting_sections = site.data.sections | where_exp: "item", "item.time" %}
              {% for section in meeting_sections %}
              <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4 pb-2 border-b border-outline-variant/10 last:border-0 last:pb-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-base uppercase tracking-wider" style="color: {{ section.colour }};">
                    {{ section.name }}
                  </span>
                </div>
                <span class="text-on-surface-variant text-base font-medium">{{ section.time }}</span>
              </div>
              {% endfor %}
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>
