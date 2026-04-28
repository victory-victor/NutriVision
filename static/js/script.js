function toggleMenu() {
    const toggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('mobile-menu');

    // Toggle classes
    toggle.classList.toggle('active');
    menu.classList.toggle('active');

    // Premium Body Lock
    if (menu.classList.contains('active')) {
        document.body.style.overflow = 'hidden';

        // GSAP entrance for menu items
        gsap.from(".mobile-nav-links li", {
            x: 50,
            opacity: 0,
            stagger: 0.1,
            duration: 0.6,
            ease: "power4.out",
            delay: 0.2
        });
    } else {
        document.body.style.overflow = 'auto';
    }
}
// ── Cursor ─────────────────────────────────────────────────────────
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let cx = 0, cy = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
    cx = e.clientX; cy = e.clientY;
    gsap.to(cursor, { x: cx, y: cy, duration: 0.05 });
});
// Ring lags behind
function animRing() {
    rx += (cx - rx) * .12;
    ry += (cy - ry) * .12;
    gsap.set(ring, { x: rx, y: ry });
    requestAnimationFrame(animRing);
}
animRing();

document.querySelectorAll('.hoverable').forEach(el => {
    el.addEventListener('mouseenter', () => {
        gsap.to(cursor, { width: 20, height: 20, background: 'var(--accent-2)', duration: .2 });
        gsap.to(ring, { scale: 1.6, borderColor: 'var(--accent)', duration: .3 });
    });
    el.addEventListener('mouseleave', () => {
        gsap.to(cursor, { width: 12, height: 12, background: 'var(--accent)', duration: .2 });
        gsap.to(ring, { scale: 1, borderColor: 'var(--ink-3)', duration: .3 });
    });
});

// ── GSAP Init ──────────────────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger, CustomEase);
CustomEase.create('spring', 'M0,0 C0.04,0 0.2,1.6 0.4,1 0.6,0.4 0.96,1 1,1');

window.addEventListener('load', () => {
    // Eyebrow
    // gsap.to('#eyebrow', { opacity: 1, y: 0, duration: .8, delay: .2, ease: 'power2.out' });
    // Title lines
    gsap.to('.line-inner', { y: '0%', duration: 1, stagger: .12, delay: .4, ease: 'power4.out' });
    // Subtitle
    gsap.to('#hero-sub', { opacity: 1, y: 0, duration: .8, delay: .8, ease: 'power2.out' });
    // Actions
    gsap.to('#hero-actions', { opacity: 1, y: 0, duration: .8, delay: 1, ease: 'power2.out' });
    // Stats
    gsap.to('#hero-stats', { opacity: 1, duration: .8, delay: 1.2 });
    // Counter animation
    document.querySelectorAll('[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count);
        gsap.to({ val: 0 }, {
            val: target, duration: 2, delay: 1.4, ease: 'power2.out',
            onUpdate: function () { el.textContent = Math.floor(this.targets()[0].val).toLocaleString(); }
        });
    });
    // Scroll reveals
    gsap.utils.toArray('.reveal').forEach((el, i) => {
        gsap.to(el, {
            opacity: 1, y: 0, duration: .7, delay: i * .08, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true }
        });
    });
    if (window.innerWidth > 768) {
        const letters = document.querySelectorAll("#interactive-logo span");
        const mainTl = gsap.timeline({ delay: 0.5 });
        if (letters.length > 0) {
            mainTl.to(letters, {
                duration: 2,
                y: 0,
                z: 0,
                rotationX: 0, // Stands up to vertical
                opacity: 1,
                filter: "blur(0px)",
                stagger: {
                    each: 0.1,
                    from: "edges", // Animation comes in from N and N, meets in middle
                    ease: "power3.inOut"
                },
                ease: "expo.out" // Snaps cleanly at the end
            });

            // 2. The "Refraction Flash" (Chromatic Aberration)
            // This happens slightly before the reveal finishes
            mainTl.to(letters, {
                duration: 0.1,
                // Intense, offset color shadows for the split-color look
                textShadow: `
      -5px 0 0px var(--chroma-1), 
      5px 0 0px var(--chroma-2), 
      0 0 20px rgba(0,0,0,0.1)
    `,
                stagger: {
                    each: 0.08,
                    from: "edges"
                },
                repeat: 1,
                yoyo: true, // Flashes and immediately reverts
                ease: "sine.inOut"
            }, "-=1.2"); // Starts when the letters are mid-flight

            // 3. Optional: Subtle idle "Prism Drift"
            // Letters gently sway in 3D space after assembly
            mainTl.to(letters, {
                rotationY: 15,
                z: 30,
                duration: 3,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
                stagger: {
                    each: 0.2,
                    from: "edges"
                }
            }, "+=0.5");
            letters.forEach(letter => {
                letter.addEventListener('mouseenter', () => {
                    gsap.to(letter, {
                        y: -30,
                        scale: 1.2,
                        color: "var(--accent)", // Assumes you have an accent variable
                        duration: 0.4,
                        ease: "power2.out"
                    });
                });

                letter.addEventListener('mouseleave', () => {
                    gsap.to(letter, {
                        y: 0,
                        scale: 1,
                        color: "var(--ink)",
                        duration: 0.6,
                        ease: "elastic.out(1, 0.3)"
                    });
                });
            });
        } else {
            // Mobile-only entrance animation for the image
            gsap.from(".mobile-hero-container", {
                opacity: 0,
                y: 30,
                duration: 1,
                ease: "power2.out"
            });
        }
    }
});

// ── Helpers ────────────────────────────────────────────────────────
function scrollToUpload() { document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth' }) }
function scrollToSearch() {
    scrollToUpload();
    setTimeout(() => document.getElementById('search-input').focus(), 600);
}
let toastQueue = [];
let isToastActive = false;

function toast(msg, type = '') {
    // Add the new request to our queue
    toastQueue.push({ msg, type });
    processQueue();
}

function processQueue() {
    if (isToastActive || toastQueue.length === 0) return;

    isToastActive = true;
    const { msg, type } = toastQueue.shift();

    const t = document.getElementById('toast');
    const m = document.getElementById('toast-msg');
    const i = document.getElementById('toast-icon');

    m.textContent = msg;
    t.className = 'show'; // Reset classes and add show
    if (type) t.classList.add(type);

    i.textContent = type === 'error' ? '✕' : type === 'success' ? '✓' : 'ℹ';

    // Show for 3 seconds, then hide and check for next toast
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => {
            isToastActive = false;
            processQueue(); // Check for the next message in line
        }, 500); // Small gap between toasts
    }, 3000);
}

// ── Drop Zone ──────────────────────────────────────────────────────
const dz = document.getElementById('drop-zone');
const fi = document.getElementById('file-input');
const prev = document.getElementById('preview-img');
let selectedFile = null;

dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over') });
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) loadFile(f);
    else toast('Please drop an image file', 'error');
});
fi.addEventListener('change', e => {
    if (e.target.files[0]) loadFile(e.target.files[0]);
});

function loadFile(f) {
    selectedFile = f;
    const url = URL.createObjectURL(f);
    prev.src = url;
    dz.classList.add('has-image');
    const btn = document.getElementById('analyze-btn');
    btn.disabled = false;
    document.getElementById('btn-text').textContent = 'Analyze This Dish';
    // Animate preview in
    gsap.from(prev, { scale: 1.1, opacity: 0, duration: .5, ease: 'power2.out' });
    toast('Image loaded! Click Analyze.', 'success');
}

function clearImage() {
    selectedFile = null;
    prev.src = '';
    dz.classList.remove('has-image');
    fi.value = '';
    const btn = document.getElementById('analyze-btn');
    btn.disabled = true;
    document.getElementById('btn-text').textContent = 'Upload an image first';
}

const uploadTrigger = document.getElementById('trigger-upload');

uploadTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevents the click from bubbling to the drop zone
    fi.click();
});

// Also, let's make the entire DZ clickable if it's empty
dz.addEventListener('click', (e) => {
    if (!dz.classList.contains('has-image') && e.target !== uploadTrigger) {
        fi.click();
    }
});

// ── Analyze ────────────────────────────────────────────────────────
async function analyzeImage() {
    if (!selectedFile) { toast('No image selected', 'error'); return; }
    showLoading('Analyzing your dish…', 'Running AI vision models…');
    try {
        const fd = new FormData();
        fd.append('file', selectedFile);
        setLoadingText('Classifying food…', 'Comparing with 100+ dish classes');
        const res = await fetch('/predict', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        setLoadingText('Fetching recipe…', 'Searching 2.2M+ recipes');
        const data = await res.json();
        hideLoading();
        renderResults(data);
        if (data.ai_recs) {
            displayAIInsights(data.ai_recs, data.nutrition);
        } else {
            console.error("AI recommendations missing from response!");
        }
        toast('Analysis complete!', 'success');
    } catch (e) {
        hideLoading();
        console.error(e);
        toast('Analysis failed. Is the API running?', 'error');
        renderDemo();
    }
}

async function searchDish() {
    const q = document.getElementById('search-input').value.trim();
    if (!q) { toast('Enter a dish name', 'error'); return; }
    showLoading(`Searching for "${q}"…`, 'Semantic recipe retrieval');
    try {
        const res = await fetch('/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        hideLoading();
        renderResults(data, true);
        if (data.ai_recs) {
            displayAIInsights(data.ai_recs, data.nutrition);
        } else {
            console.warn("No ai_recs found in the response.");
        }
        toast('Recipe found!', 'success');
    } catch (e) {
        hideLoading();
        toast('Search failed. Is the API running?', 'error');
    }
}

// ── Loading ────────────────────────────────────────────────────────
function showLoading(text, sub) {
    const ol = document.getElementById('loading-overlay');
    document.getElementById('loading-text').textContent = text || 'Analyzing…';
    document.getElementById('loading-sub').textContent = sub || '';
    ol.style.display = 'flex';
    gsap.from(ol, { opacity: 0, duration: .3 });
    // Disable button
    const btn = document.getElementById('analyze-btn');
    btn.disabled = true;
    document.getElementById('btn-spinner').style.display = 'block';
    document.getElementById('btn-text').textContent = 'Analyzing…';
}
function setLoadingText(t, s) {
    document.getElementById('loading-text').textContent = t;
    document.getElementById('loading-sub').textContent = s;
}
function hideLoading() {
    const ol = document.getElementById('loading-overlay');
    gsap.to(ol, { opacity: 0, duration: .3, onComplete: () => { ol.style.display = 'none' } });
    const btn = document.getElementById('analyze-btn');
    btn.disabled = false;
    document.getElementById('btn-spinner').style.display = 'none';
    document.getElementById('btn-text').textContent = 'Analyze This Dish';
}

// ── Render Results ─────────────────────────────────────────────────
function renderResults(d, isSearch = false) {
    const prevImg = document.getElementById('preview-img');
    const dz = document.getElementById('drop-zone');
    const sec = document.getElementById('results-section');
    const con = document.getElementById('results-content');
    sec.style.display = 'block';

    // If it's a search result, update the main preview image at the top
    if (isSearch && d.image_url) {
        // 1. Update the image source
        prevImg.src = d.image_url;

        // 2. Ensure the container shows the image
        dz.classList.add('has-image');

        // 3. Premium Animation: Fade the image in specifically
        gsap.fromTo(prevImg,
            { opacity: 0, scale: 1.1 },
            { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out" }
        );
    }

    const nut = d.nutrition || {};
    const cal = nut.calories || 0;
    const prot = nut.protein || 0;
    const carbs = nut.carbs || 0;
    const fat = nut.fat || 0;
    const ings = d.ingredients || [];
    const steps = d.recipe_steps || d.steps || d.recipe || [];
    const sims = (d.similar_dishes || d.similar || []).map(s =>
        typeof s === 'string' ? { title: s, link: '#' } : s
    );
    const diet = d.diet_tags || d.diet || '';
    const conf = d.confidence ? `${d.confidence}%` : '';
    const model = d.model_used || 'Recipe Search';

    const nutCards = [
        { key: 'cal', label: 'Calories', val: cal, unit: 'kcal', color: 'var(--accent)', max: 800 },
        { key: 'protein', label: 'Protein', val: prot, unit: 'g', color: 'var(--accent-3)', max: 50 },
        { key: 'carbs', label: 'Carbs', val: carbs, unit: 'g', color: 'var(--accent-2)', max: 120 },
        { key: 'fat', label: 'Fat', val: fat, unit: 'g', color: 'var(--green)', max: 60 },
    ];

    const metaTags = [
        ...(diet ? diet.split(',').map(t => ({ label: t.trim(), cls: 'tag-diet' })) : []),
        ...(d.cuisine ? [{ label: d.cuisine, cls: 'tag-cuisine' }] : []),
        ...(d.course ? [{ label: d.course, cls: 'tag-course' }] : []),
        ...(d.cooking_method ? [{ label: d.cooking_method, cls: 'tag-method' }] : []),
    ].filter(t => t.label && t.label !== 'nan');

    const times = [
        { label: 'PREP', val: d.prep_mins, unit: 'min' },
        { label: 'COOK', val: d.cook_mins, unit: 'min' },
        { label: 'TOTAL', val: d.total_mins, unit: 'min' },
        { label: 'SERVES', val: d.servings, unit: 'ppl' },
    ].filter(t => t.val && t.val !== 'nan' && t.val !== '');

    con.innerHTML = `
    <div class="results-header">
      <div>
        <div class="dish-name-display" id="dish-title">${d.dish_name || 'Unknown Dish'}</div>
        ${conf ? `<div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap">
          <span class="model-badge"><span class="model-badge-dot"></span>${model}</span>
          <span class="model-badge"><span class="model-badge-dot" style="background:var(--accent-2)"></span>${conf} confidence</span>
          ${d.is_indian ? '<span class="model-badge"><span class="model-badge-dot" style="background:#e8673a"></span>Indian Cuisine</span>' : ''}
        </div>` : ''}
      </div>
      ${d.source_link ? `<a href="${d.source_link}" target="_blank" class="source-link hoverable">
        View Full Recipe
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>` : ''}
    </div>

    <!-- BLIP caption -->
    ${d.blip_caption ? `<div style="margin-bottom:24px;padding:14px 20px;background:rgba(58,181,232,.08);border-radius:var(--radius-sm);border-left:3px solid var(--accent-3);font-size:.85rem;color:var(--ink-3)">
      <strong style="color:var(--ink)">Vision Caption:</strong> "${d.blip_caption}"
    </div>` : ''}

    <!-- NUTRITION -->
    ${(cal || prot || carbs || fat) ? `
    <div class="nutrition-grid" id="nut-grid">
      ${nutCards.map(n => `
        <div class="nut-card ${n.key}">
          <div class="nut-ring">
            <svg viewBox="0 0 80 80">
              <circle class="track" cx="40" cy="40" r="35"/>
              <circle class="fill" cx="40" cy="40" r="35"
                stroke="${n.color}"
                style="stroke-dashoffset:${220 - Math.min(220 * (n.val / n.max), 220)}"/>
            </svg>
            <div class="nut-value">${n.val}</div>
          </div>
          <div class="nut-label">${n.label}</div>
          <div style="font-size:.7rem;color:var(--ink-3);margin-top:2px">${n.unit}</div>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- META INFO -->
    ${(metaTags.length || times.length) ? `
    <div class="info-row">
      ${metaTags.length ? `
      <div class="info-card">
        <div class="info-card-header">
          <span>🏷️</span> Tags &amp; Details
        </div>
        <div class="tag-list">
          ${metaTags.map(t => `<span class="tag ${t.cls}">${t.label}</span>`).join('')}
        </div>
      </div>` : '<div></div>'}
      ${times.length ? `
      <div class="info-card">
        <div class="info-card-header">
          <span>⏱️</span> Timing
        </div>
        <div class="time-pills">
          ${times.map(t => `
            <div class="time-pill">
              <div class="time-pill-num">${t.val}</div>
              <div class="time-pill-unit">${t.label}<br>${t.unit}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    </div>` : ''}

    <!-- INGREDIENTS -->
    ${ings.length ? `
    <div class="ingredients-card">
      <div class="info-card-header" style="margin-bottom:16px;">
        <span>🥘</span> Ingredients
        <span style="margin-left:auto;font-size:.75rem;font-weight:400;color:var(--ink-3)">${ings.length} items</span>
      </div>
      <ul class="ingredient-list">
        ${ings.map(ing => `
          <li class="ingredient-item">
            <span class="ingredient-dot"></span>
            ${ing}
          </li>
        `).join('')}
      </ul>
    </div>` : ''}

    <!-- RECIPE STEPS -->
    ${steps.length ? `
    <div class="recipe-card" id="recipe-card">
      <div class="recipe-card-title">
        <span>📋</span> How to Make It
      </div>
      <ol class="steps-list" id="steps-list">
        ${steps.map((s, i) => `
          <li class="step-item" style="transition-delay:${i * 80}ms">
            <div class="step-num">${String(i + 1).padStart(2, '0')}</div>
            <div class="step-text">${s}</div>
          </li>
        `).join('')}
      </ol>
    </div>` : ''}

    <!-- SIMILAR DISHES -->
    ${sims.length ? `
    <div class="similar-card">
        <div class="info-card-header" style="margin-bottom:16px">
            <span>🍜</span> Similar Dishes
        </div>
        <div class="similar-grid">
            ${sims.map((s, index) => `
                <a href="${s.link || '#'}" target="_blank" class="similar-item hoverable" id="sim-link-${index}">
                    <div class="similar-img-wrapper">
                        <img src="https://via.placeholder.com/300x200?text=Loading..." 
                            class="sim-img" 
                            id="sim-img-${index}" 
                            alt="${s.title}">
                    </div>
                    <div class="similar-title">${s.title}</div>
                    <svg class="similar-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                </a>
            `).join('')}
        </div>
    </div>` : ''}
  `;

    // Inside your render function after setting innerHTML:
    sims.forEach(async (s, index) => {
        const imgUrl = await getPexelsImage(s.title);
        const imgElement = document.getElementById(`sim-img-${index}`);
        if (imgElement) {
            imgElement.src = imgUrl;
            // Optional: Fade in with GSAP
            gsap.from(imgElement, { opacity: 0, duration: 0.5 });
        }
    });

    // Scroll to results
    setTimeout(() => {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // GSAP animations for results
        gsap.from('#dish-title', { y: 30, opacity: 0, duration: .7, ease: 'power3.out' });
        gsap.from('.nut-card', { y: 40, opacity: 0, stagger: .1, duration: .6, delay: .2, ease: 'power2.out' });
        gsap.from('.info-card', { y: 30, opacity: 0, stagger: .1, duration: .5, delay: .4, ease: 'power2.out' });
        gsap.from('.ingredients-card', { y: 30, opacity: 0, duration: .5, delay: .5, ease: 'power2.out' });
        gsap.from('#recipe-card', { y: 40, opacity: 0, duration: .6, delay: .6, ease: 'power2.out' });
        // Steps stagger
        document.querySelectorAll('.step-item').forEach((el, i) => {
            gsap.to(el, { opacity: 1, x: 0, duration: .5, delay: .8 + i * .06, ease: 'power2.out' });
        });
        gsap.from('.similar-card', { y: 30, opacity: 0, duration: .5, delay: 1, ease: 'power2.out' });
        // Nutrition ring animation
        document.querySelectorAll('.nut-ring .fill').forEach(circle => {
            const target = circle.style.strokeDashoffset;
            circle.style.strokeDashoffset = '220';
            setTimeout(() => { circle.style.strokeDashoffset = target; }, 800);
        });
    }, 300);
}

// ── Demo (when API is offline) ─────────────────────────────────────
function renderDemo() {
    renderResults({
        dish_name: 'Butter Chicken (Demo)',
        confidence: 94.2,
        model_used: 'Indian Classifier',
        is_indian: true,
        blip_caption: 'a plate of creamy orange chicken curry with naan bread',
        nutrition: { calories: 320, protein: 28, carbs: 18, fat: 14 },
        cooking_method: 'Grilled & Simmered',
        cuisine: 'North Indian',
        course: 'Main Course',
        diet: 'Non-Vegetarian',
        prep_mins: '30', cook_mins: '45', total_mins: '75', servings: '4',
        ingredients: ['500g chicken thighs', '1 cup yogurt', '3 tbsp butter', '2 onions chopped', '1 can tomato purée', '1 cup heavy cream', '2 tsp garam masala', '1 tsp cumin', '1 tsp coriander', 'Salt to taste'],
        recipe_steps: [
            'Marinate chicken in yogurt, spices and lemon juice for at least 30 minutes.',
            'Grill or pan-fry chicken until charred and cooked through. Set aside.',
            'In a large pan, melt butter and sauté onions until golden brown.',
            'Add ginger-garlic paste and cook until raw smell disappears.',
            'Pour in tomato purée and cook on medium heat for 10 minutes.',
            'Add cream and simmer gently. Season with garam masala and salt.',
            'Add grilled chicken pieces and simmer for 10 more minutes.',
            'Garnish with cream and coriander. Serve hot with naan or rice.',
        ],
        similar_dishes: [
            { title: 'Chicken Tikka Masala', link: '#' },
            { title: 'Murgh Makhani', link: '#' },
            { title: 'Chicken Korma', link: '#' },
            { title: 'Kadai Chicken', link: '#' },
        ],
        source_link: '#',
    });
}

// --- Chatbot Toggle Logic with GSAP ---
const chatBubble = document.getElementById('chat-bubble');
const chatWindow = document.getElementById('chat-window');
const chatIcon = chatBubble.querySelector('.chat-icon');
const closeIcon = chatBubble.querySelector('.close-icon');

let isChatOpen = false;

chatBubble.addEventListener('click', () => {
    if (!isChatOpen) {
        // OPEN ANIMATION
        chatWindow.style.display = 'flex';
        gsap.fromTo(chatWindow,
            { scale: 0, opacity: 0, rotation: -5 },
            { scale: 1, opacity: 1, rotation: 0, duration: 0.5, ease: "back.out(1.7)" }
        );
        chatIcon.style.display = 'none';
        closeIcon.style.display = 'block';
    } else {
        // CLOSE ANIMATION
        gsap.to(chatWindow, {
            scale: 0, opacity: 0, duration: 0.3, ease: "power2.in",
            onComplete: () => { chatWindow.style.display = 'none'; }
        });
        chatIcon.style.display = 'block';
        closeIcon.style.display = 'none';
    }
    isChatOpen = !isChatOpen;
});

// --- Chat Communication Logic ---
const sendBtn = document.getElementById('send-chat-btn');
const chatInput = document.getElementById('chat-user-input');
const chatMessages = document.getElementById('chat-messages');

async function handleChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Append User Message
    appendMessage('user-msg', text);
    chatInput.value = '';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        const data = await response.json();

        // Append AI Message
        appendMessage('bot-msg', data.reply);
    } catch (err) {
        appendMessage('bot-msg', "I'm having trouble connecting to my brain right now. Try again?");
    }
}

function appendMessage(className, text) {
    const msg = document.createElement('div');
    msg.className = `message ${className}`;
    msg.innerText = text;
    chatMessages.appendChild(msg);

    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // GSAP pop-in for messages
    gsap.from(msg, { y: 10, opacity: 0, duration: 0.3 });
}

sendBtn.addEventListener('click', handleChat);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleChat(); });

function displayAIInsights(recs, nutrition) {
    const container = document.getElementById('insight-cards-container');
    const section = document.getElementById('ai-insight-section');

    if (!section || !container) return;

    // 1. Reset and Show
    section.style.display = 'block';
    container.innerHTML = '';

    // 2. NUTRITION ALERTS (Toasts)
    setTimeout(() => {
        // Handle Protein
        if (nutrition.protein < 10) {
            toast("Low Protein detected", "error");
        } else if (nutrition.protein > 29) {
            toast("High Protein: Great for muscles!", "success");
        }

        // Handle Fats
        if (nutrition.fats > 25) {
            toast("High Fat content warning", "error");
        }
    }, 1000); // 1 second delay

    // 3. RENDER CARDS (Fixed the 'icon' error here)
    recs.forEach((text, index) => {
        if (!text.trim()) return;

        const card = document.createElement('div');
        card.className = 'insight-card'; // Add 'pro-border' if you kept that CSS
        card.innerHTML = `
            <div class="card-content">
                <span class="card-label" style="display:block; font-size:0.7rem; color:var(--accent); font-weight:800; letter-spacing:1px; margin-bottom:5px;">
                   ANALYSIS 0${index + 1}
                </span>
                <p style="margin:0; font-weight:500;">${text}</p>
            </div>
        `;
        container.appendChild(card);
    });

    // 4. GSAP ENTRANCE
    gsap.from(".insight-card", {
        opacity: 0,
        x: -30,
        stagger: 0.2,
        duration: 0.8,
        ease: "power3.out"
    });
}

function calculateBMI() {
    const h = document.getElementById('bmi-height').value;
    const w = document.getElementById('bmi-weight').value;

    if (!h || !w || h <= 0 || w <= 0) {
        toast("Please enter valid height and weight", "error");
        return;
    }

    // Calculation (Height in meters squared)
    const heightInMeters = h / 100;
    const bmi = (w / (heightInMeters * heightInMeters)).toFixed(1);

    // Update UI
    const valEl = document.getElementById('bmi-value');
    const catEl = document.getElementById('bmi-category');
    const advEl = document.getElementById('bmi-advice');

    let category = "";
    let color = "#E3FB56"; // Default Accent

    if (bmi < 18.5) {
        category = "Underweight";
        color = "#4D96FF";
    } else if (bmi < 24.9) {
        category = "Normal Weight";
        color = "#2ecc71";
    } else if (bmi < 29.9) {
        category = "Overweight";
        color = "#FFD93D";
    } else {
        category = "Obese";
        color = "#ff4d4d";
    }

    // GSAP Animation Sequence
    const tl = gsap.timeline();

    tl.to(".bmi-score-circle", { scale: 0.8, duration: 0.2, ease: "power2.in" })
        .add(() => {
            valEl.innerText = bmi;
            catEl.innerText = category;
            catEl.style.color = color;
            valEl.style.color = color;

            if (category === "Normal Weight") {
                advEl.innerText = "You are in the healthy range. Keep it up!";
                toast("Healthy BMI reached!", "success");
            } else {
                advEl.innerText = `Focus on a balanced diet and regular activity for ${category.toLowerCase()} status.`;
                toast("Unhealthy BMI detected!", "error");
            }
        })
        .to(".bmi-score-circle", {
            scale: 1,
            duration: 0.6,
            ease: "elastic.out(1, 0.5)",
            borderColor: color
        });
}

async function getPexelsImage(query) {
    try {
        const response = await fetch(`/get-food-image?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        return data.url || 'https://via.placeholder.com/300x200?text=No+Image';
    } catch (error) {
        console.error("Proxy Error:", error);
        return 'https://via.placeholder.com/300x200?text=Error';
    }
}