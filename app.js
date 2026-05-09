document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Global State Management ---
    const state = {
        theme: 'dark',
        hasAnalyzed: true, // Default to true so mock data is visible immediately
        footprint: {
            transport: 150,
            electricity: 120,
            food: 90,
            shopping: 40,
            total: 400
        },
        baseline: 400, // for simulator
        points: 1250,
        streak: 12,
        history: [420, 390, 410, 380, 350, 400] // 6 months
    };

    // --- 2. GSAP Initialization & Navigation ---
    try { gsap.registerPlugin(); } catch(e) {}

    function animatePageIn(pageId) {
        gsap.fromTo(`#${pageId} .gs-reveal`, 
            { y: 30, opacity: 0 }, 
            { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: "power3.out" }
        );
    }
    
    // Initial reveal for home
    animatePageIn('home');

    const navLinks = document.querySelectorAll('.nav-links a, .nav-btn');
    const pageViews = document.querySelectorAll('.page-view');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            
            // Update nav active state
            document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
            const navItem = document.querySelector(`.nav-links a[data-target="${targetId}"]`);
            if(navItem) navItem.classList.add('active');

            // Switch views
            pageViews.forEach(view => {
                view.classList.remove('active');
                if (view.id === targetId) {
                    view.classList.add('active');
                    animatePageIn(targetId);
                }
            });

            // Trigger specific page renders
            if (targetId === 'dashboard') updateDashboardCharts();
            if (targetId === 'reports') updateReportsCharts();
            if (targetId === 'simulator') {
                initSimulator();
                handleSimulatorChange();
            }
        });
    });

    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle');
    themeBtn.addEventListener('click', () => {
        const body = document.body;
        if (body.classList.contains('dark')) {
            body.classList.remove('dark');
            body.classList.add('light');
            themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            state.theme = 'light';
        } else {
            body.classList.remove('light');
            body.classList.add('dark');
            themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            state.theme = 'dark';
        }
        updateDashboardCharts();
        updateReportsCharts();
        if(simChart) updateSimChart();
    });

    // --- 3. Smart Assessment Wizard Logic ---
    const steps = document.querySelectorAll('.wizard-step');
    const totalSteps = steps.length;
    let currentStep = 1;

    const btnNext = document.getElementById('wiz-next');
    const btnPrev = document.getElementById('wiz-prev');
    const btnSubmit = document.getElementById('wiz-submit');
    const progressBar = document.getElementById('wizard-progress');
    const stepNumber = document.getElementById('current-step');
    const stepTitle = document.getElementById('step-title');
    
    const stepTitles = ["Transport", "Energy", "Diet", "Lifestyle"];

    function updateWizard() {
        // Update Progress Bar
        progressBar.style.width = `${((currentStep - 1) / totalSteps) * 100 + 25}%`;
        stepNumber.textContent = currentStep;
        stepTitle.textContent = stepTitles[currentStep - 1];

        // Toggle Steps with GSAP
        steps.forEach(step => {
            if (parseInt(step.dataset.step) === currentStep) {
                step.classList.add('active');
                gsap.fromTo(step, { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5 });
            } else {
                step.classList.remove('active');
            }
        });

        // Toggle Buttons
        btnPrev.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
        
        if (currentStep === totalSteps) {
            btnNext.style.display = 'none';
            btnSubmit.style.display = 'inline-flex';
        } else {
            btnNext.style.display = 'inline-flex';
            btnSubmit.style.display = 'none';
        }
    }

    btnNext.addEventListener('click', () => {
        if (currentStep < totalSteps) { currentStep++; updateWizard(); }
    });
    btnPrev.addEventListener('click', () => {
        if (currentStep > 1) { currentStep--; updateWizard(); }
    });

    // Range Slider Value Displays
    document.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
            const display = document.getElementById(`${e.target.id}-val`);
            if(display) display.textContent = e.target.value;
            if(e.target.id.startsWith('sim-')) handleSimulatorChange();
        });
    });

    // Assessment Submission & Calculation
    document.getElementById('smart-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Complex Calculation
        const car = parseFloat(document.getElementById('q-car').value);
        const pub = parseFloat(document.getElementById('q-public').value);
        const flight = parseFloat(document.getElementById('q-flight').value);
        const transport = (car * 30 * 0.19) + (pub * 30 * 0.04) + (flight * 90 / 12);

        const kwh = parseFloat(document.getElementById('q-kwh').value);
        const ren = parseFloat(document.getElementById('q-renewable').value);
        const energy = (kwh * 0.82) * (1 - (ren / 100));

        const diet = document.querySelector('input[name="diet"]:checked').value;
        let dietBase = 100;
        if(diet === 'vegan') dietBase = 60;
        if(diet === 'vegetarian') dietBase = 75;
        if(diet === 'meat-heavy') dietBase = 150;

        const clothes = parseFloat(document.getElementById('q-clothes').value);
        const recycle = document.getElementById('q-recycle').value;
        let waste = 40;
        if(recycle === 'some') waste = 25;
        if(recycle === 'most') waste = 10;
        const lifestyle = (clothes * 15) + waste;

        // Save State
        state.footprint = {
            transport: Math.round(transport),
            electricity: Math.round(energy),
            food: Math.round(dietBase),
            shopping: Math.round(lifestyle),
            total: Math.round(transport + energy + dietBase + lifestyle)
        };
        state.baseline = state.footprint.total;
        state.history[5] = state.footprint.total; // current month
        state.hasAnalyzed = true;

        // Show Results Splash
        document.querySelector('.wizard-container').style.display = 'none';
        document.querySelector('.wizard-header').style.display = 'none';
        document.getElementById('assessment-results').style.display = 'block';
        
        // Counter Animation
        gsap.to({ val: 0 }, {
            val: state.footprint.total,
            duration: 2,
            onUpdate: function() {
                document.getElementById('splash-co2').textContent = Math.round(this.targets()[0].val);
            }
        });

        // Initialize downstream modules
        populateDashboard();
        initSimulator();
        generateAITips();
    });

    // --- 4. Dashboard Logic ---
    let dashDoughnut;

    function populateDashboard() {
        document.getElementById('dash-main-co2').textContent = state.footprint.total;
        document.getElementById('dash-trees').textContent = Math.ceil(state.footprint.total / 1.8);
        
        // Progress Ring SVG
        const ring = document.getElementById('dash-ring');
        const maxExpected = 1000;
        const percent = Math.min((state.footprint.total / maxExpected) * 100, 100);
        
        // Animate Ring
        gsap.to(ring, {
            strokeDasharray: `${percent}, 100`,
            duration: 2,
            ease: "power2.out"
        });
        
        // Animate Percent text
        gsap.to({ val: 0 }, {
            val: percent,
            duration: 2,
            onUpdate: function() {
                document.getElementById('dash-ring-percent').textContent = Math.round(this.targets()[0].val) + '%';
            }
        });

        // Rank Color
        const rankEl = document.getElementById('dash-rank');
        if(state.footprint.total < 250) { rankEl.textContent = 'Planet Guardian'; rankEl.style.color = '#10b981'; }
        else if(state.footprint.total < 450) { rankEl.textContent = 'Eco Warrior'; rankEl.style.color = '#fbbf24'; }
        else { rankEl.textContent = 'Beginner'; rankEl.style.color = '#ef4444'; }
    }

    function updateDashboardCharts() {
        if(!state.hasAnalyzed) return;
        const textColor = state.theme === 'dark' ? '#f8fafc' : '#0f172a';

        const ctx = document.getElementById('dashDoughnut');
        if(dashDoughnut) dashDoughnut.destroy();

        dashDoughnut = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Transport', 'Electricity', 'Food', 'Lifestyle'],
                datasets: [{
                    data: [state.footprint.transport, state.footprint.electricity, state.footprint.food, state.footprint.shopping],
                    backgroundColor: ['#38bdf8', '#fbbf24', '#10b981', '#f43f5e'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: textColor, padding: 20 } }
                }
            }
        });
    }

    // --- 5. What-If Simulator ---
    let simChart;

    function initSimulator() {
        document.getElementById('sim-current-co2').textContent = state.baseline;
        document.getElementById('sim-new-co2').textContent = state.baseline;
        updateSimChart();
    }

    function handleSimulatorChange() {
        if(!state.baseline) return;

        const reduceCar = parseFloat(document.getElementById('sim-car').value) / 100;
        const reduceKwh = parseFloat(document.getElementById('sim-kwh').value) / 100;
        const goVegan = parseFloat(document.getElementById('sim-vegan').value) / 100;

        // Simulate impact
        const newTransport = state.footprint.transport * (1 - reduceCar);
        const newEnergy = state.footprint.electricity * (1 - reduceKwh);
        // Going vegan reduces food footprint by roughly 40% max
        const newFood = state.footprint.food * (1 - (goVegan * 0.4));
        const newTotal = Math.round(newTransport + newEnergy + newFood + state.footprint.shopping);

        document.getElementById('sim-new-co2').textContent = newTotal;
        const savings = state.baseline - newTotal;
        document.getElementById('sim-save-amount').textContent = savings;

        // Update Chart
        if(simChart) {
            simChart.data.datasets[1].data = [newTotal];
            simChart.update();
        }
    }

    document.getElementById('sim-reset').addEventListener('click', () => {
        document.getElementById('sim-car').value = 0;
        document.getElementById('sim-kwh').value = 0;
        document.getElementById('sim-vegan').value = 0;
        document.querySelectorAll('.sim-range').forEach(input => {
            document.getElementById(`${input.id}-val`).textContent = 0;
        });
        handleSimulatorChange();
    });

    function updateSimChart() {
        const textColor = state.theme === 'dark' ? '#f8fafc' : '#0f172a';
        const gridColor = state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        
        const ctx = document.getElementById('simChart');
        if(simChart) simChart.destroy();

        simChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Monthly Projection'],
                datasets: [
                    { label: 'Current', data: [state.baseline], backgroundColor: '#64748b', borderRadius: 4 },
                    { label: 'Simulated', data: [state.baseline], backgroundColor: '#10b981', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: gridColor }, ticks: { color: textColor } },
                    x: { grid: { display: false }, ticks: { color: textColor } }
                },
                plugins: { legend: { display: true, labels: { color: textColor } } }
            }
        });
    }

    // --- 6. Reports & Averages ---
    let compChart, trendChart;

    function updateReportsCharts() {
        const textColor = state.theme === 'dark' ? '#f8fafc' : '#0f172a';
        const gridColor = state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

        // Comparison Chart
        const ctxComp = document.getElementById('compareChart');
        if(compChart) compChart.destroy();

        compChart = new Chart(ctxComp, {
            type: 'bar',
            data: {
                labels: ['You', 'India Avg', 'Global Avg'],
                datasets: [{
                    label: 'kg CO₂ / Month',
                    data: [state.footprint.total || 400, 160, 390],
                    backgroundColor: [
                        '#38bdf8', // You
                        '#fbbf24', // India
                        '#f43f5e'  // Global
                    ],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: gridColor }, ticks: { color: textColor } },
                    x: { grid: { display: false }, ticks: { color: textColor, font: { weight: 'bold' } } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // Trend Line Chart
        const ctxTrend = document.getElementById('trendLineChart');
        if(trendChart) trendChart.destroy();

        trendChart = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
                datasets: [{
                    label: 'Your Emissions',
                    data: state.history,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: gridColor }, ticks: { color: textColor } },
                    x: { grid: { color: gridColor }, ticks: { color: textColor } }
                },
                plugins: { legend: { labels: { color: textColor } } }
            }
        });
    }

    // --- 7. Eco Hub AI Tips ---
    function generateAITips() {
        const container = document.getElementById('ai-tips-container');
        container.innerHTML = '';

        const maxE = Math.max(state.footprint.transport, state.footprint.electricity, state.footprint.food);
        
        let tipHtml = '';
        if(maxE === state.footprint.transport) {
            tipHtml = `<div class="tip-card"><i class="fa-solid fa-car-side text-blue"></i> <h4>Transport Heavy</h4><p>Your transport emissions are your largest contributor. Consider carpooling or working from home 2 days a week to slash this by 40%.</p></div>`;
        } else if (maxE === state.footprint.electricity) {
            tipHtml = `<div class="tip-card"><i class="fa-solid fa-bolt text-yellow"></i> <h4>Energy Audit Needed</h4><p>Your electricity usage is high. Switching to LED bulbs and a smart thermostat can save you $200/yr and 300kg CO₂.</p></div>`;
        } else {
            tipHtml = `<div class="tip-card"><i class="fa-solid fa-burger text-green"></i> <h4>Dietary Impact</h4><p>Your food footprint is significant. Incorporating plant-based proteins just 3 times a week makes a huge difference.</p></div>`;
        }
        
        // Add a generic one
        tipHtml += `<div class="tip-card"><i class="fa-solid fa-box text-orange"></i> <h4>Online Deliveries</h4><p>Combine your online orders to reduce delivery trips. 'Slower shipping' often means a much lower carbon footprint.</p></div>`;

        container.innerHTML = tipHtml;
    }

    // --- Gamification Interactions ---
    const checkBoxes = document.querySelectorAll('.challenge-item input[type="checkbox"]');
    checkBoxes.forEach(cb => {
        cb.addEventListener('change', (e) => {
            const pts = parseInt(e.target.dataset.pts);
            if(e.target.checked) state.points += pts;
            else state.points -= pts;
            
            // Animate points update
            const ptsEl = document.getElementById('dash-points');
            gsap.to(ptsEl, {
                scale: 1.2,
                color: '#10b981',
                duration: 0.2,
                yoyo: true,
                repeat: 1,
                onComplete: () => {
                    ptsEl.textContent = state.points.toLocaleString();
                    ptsEl.style.color = ''; // reset
                }
            });
        });
    });

    // --- 8. Initialization ---
    // Render the dashboard and tips with mock data immediately so it's not empty
    populateDashboard();
    updateDashboardCharts();
    updateReportsCharts();
    initSimulator();
    generateAITips();

});
