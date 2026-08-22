// FAST NUCES Dedicated MS Master's Timetable Portal Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const deptSelect = document.getElementById('deptSelect');
  const filterModeSelect = document.getElementById('filterModeSelect');
  const courseSearch = document.getElementById('courseSearch');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const searchKbd = document.getElementById('searchKbd');
  const dayTabs = document.getElementById('dayTabs');
  const timetableContainer = document.getElementById('timetableContainer');
  const emptyState = document.getElementById('emptyState');
  const emptyStateMessage = document.getElementById('emptyStateMessage');
  const classCountText = document.getElementById('classCountText');
  const clockDisplay = document.getElementById('clockDisplay');
  const liveStatusContainer = document.getElementById('liveStatusContainer');
  const themeToggle = document.getElementById('themeToggle');

  // State
  let allEvents = window.TIMETABLE_DATA || [];
  let currentDayFilter = 'Today';
  const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Refined Solid High-Contrast MS Program Palette (No Gradients)
  const PROGRAM_THEMES = {
    'MS-DS':       { dot: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', text: '#cbd5e1' },
    'MS-CS':       { dot: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)',   border: 'rgba(6, 182, 212, 0.3)',   text: '#22d3ee' },
    'MS-AI':       { dot: '#eab308', bg: 'rgba(234, 179, 8, 0.12)',   border: 'rgba(234, 179, 8, 0.3)',   text: '#fde047' },
    'MS-CY':       { dot: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)',  border: 'rgba(20, 184, 166, 0.3)',  text: '#5eead4' },
    'MS-SE':       { dot: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)',   border: 'rgba(239, 68, 68, 0.3)',   text: '#fca5a5' },
    'MS-CI':       { dot: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)',  border: 'rgba(139, 92, 246, 0.3)',  text: '#c4b5fd' },
    'MS-AIHS':     { dot: '#10b981', bg: 'rgba(16, 185, 129, 0.12)',  border: 'rgba(16, 185, 129, 0.3)',  text: '#6ee7b7' },
    'MS-ELECTIVE': { dot: '#f97316', bg: 'rgba(249, 115, 22, 0.12)',  border: 'rgba(249, 115, 22, 0.3)',  text: '#fdba74' }
  };

  function getTheme(dept) {
    return PROGRAM_THEMES[dept] || PROGRAM_THEMES['MS-ELECTIVE'];
  }

  // Initialize Application
  init();

  function init() {
    setupTheme();
    setupClock();
    loadPreferences();
    renderSchedule();
    setupEventListeners();
    const activeTab = dayTabs.querySelector('.tab-item.active');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    }
  }

  // Theme Management
  function setupTheme() {
    const saved = localStorage.getItem('unitime_theme') || 'dark';
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (saved === 'light') {
      document.body.classList.remove('dark');
      document.body.classList.add('light');
      if (metaTheme) metaTheme.setAttribute('content', '#f4f6f9');
    } else {
      document.body.classList.remove('light');
      document.body.classList.add('dark');
      if (metaTheme) metaTheme.setAttribute('content', '#0a0d14');
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('dark');
    document.body.classList.toggle('dark', !isDark);
    document.body.classList.toggle('light', isDark);
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('unitime_theme', newTheme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', newTheme === 'light' ? '#f4f6f9' : '#0a0d14');
    }
  }

  // Clock
  function setupClock() {
    function tick() {
      const now = new Date();
      clockDisplay.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      checkLiveStatus();
    }
    tick();
    setInterval(tick, 1000);
  }

  function getDayName(d = new Date()) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[d.getDay()];
  }

  // Preferences
  function loadPreferences() {
    const savedDept = localStorage.getItem('unitime_ms_dept');
    const savedFilter = localStorage.getItem('unitime_ms_filter');
    if (savedDept && Array.from(deptSelect.options).some(o => o.value === savedDept)) {
      deptSelect.value = savedDept;
    }
    if (savedFilter && Array.from(filterModeSelect.options).some(o => o.value === savedFilter)) {
      filterModeSelect.value = savedFilter;
    }
  }

  function savePreferences() {
    localStorage.setItem('unitime_ms_dept', deptSelect.value);
    localStorage.setItem('unitime_ms_filter', filterModeSelect.value);
  }

  // Filter Logic
  function getFilteredEvents() {
    const selectedDept = deptSelect.value;
    const filterMode = filterModeSelect.value;
    const query = courseSearch.value.trim().toLowerCase();
    const todayName = getDayName();

    return allEvents.filter(ev => {
      // 1. Program Match
      if (selectedDept === 'MS-ELECTIVE') {
        if (ev.department !== 'MS-ELECTIVE') return false;
      } else if (filterMode === 'ONLY_DEPT') {
        if (ev.department !== selectedDept) return false;
      } else if (filterMode === 'INCLUDE_ELECTIVES') {
        if (ev.department !== selectedDept && ev.department !== 'MS-ELECTIVE') return false;
      }

      // 2. Day Filter
      if (currentDayFilter === 'Today') {
        if (ev.day !== todayName) return false;
      } else if (currentDayFilter !== 'All') {
        if (ev.day !== currentDayFilter) return false;
      }

      // 3. Search query match
      if (query) {
        const text = `${ev.course_code} ${ev.course_full} ${ev.room} ${ev.department_name} ${ev.day} ${ev.raw || ''} ${ev.section || ''} ${ev.track || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }

      return true;
    }).sort((a, b) => {
      const dayDiff = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.time.localeCompare(b.time);
    });
  }

  function parseTimeSlot(timeStr) {
    if (!timeStr || !timeStr.includes('-')) return null;
    const parts = timeStr.split('-').map(p => p.trim());
    return {
      startStr: parts[0],
      endStr: parts[1]
    };
  }

  // Render Schedule Grid (Organized with Day Separation)
  function renderSchedule() {
    const events = getFilteredEvents();
    const progLabel = deptSelect.options[deptSelect.selectedIndex].text;
    
    classCountText.textContent = `${events.length} class${events.length === 1 ? '' : 'es'}`;

    if (events.length === 0) {
      timetableContainer.innerHTML = '';
      emptyState.style.display = 'block';
      if (currentDayFilter === 'Today') {
        emptyStateMessage.innerHTML = `
          No scheduled classes for today (<strong>${getDayName()}</strong>) in ${escapeHtml(progLabel)}.<br>
          <button id="showFullWeekBtn" class="btn-default">View Full Week Schedule</button>
        `;
        const btn = document.getElementById('showFullWeekBtn');
        if (btn) {
          btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            const allTab = document.querySelector('[data-day="All"]');
            if (allTab) {
              allTab.classList.add('active');
              allTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
            currentDayFilter = 'All';
            renderSchedule();
          });
        }
      } else {
        emptyStateMessage.textContent = `No scheduled classes found matching the selected filter.`;
      }
      return;
    }

    emptyState.style.display = 'none';

    // Group events by day in chronological order
    const groupedByDay = {};
    DAYS_ORDER.forEach(day => {
      groupedByDay[day] = [];
    });

    events.forEach(ev => {
      if (!groupedByDay[ev.day]) {
        groupedByDay[ev.day] = [];
      }
      groupedByDay[ev.day].push(ev);
    });

    let html = '';
    const isFullWeek = currentDayFilter === 'All' || currentDayFilter === 'Full Week';

    DAYS_ORDER.forEach(day => {
      const dayEvents = groupedByDay[day];
      if (!dayEvents || dayEvents.length === 0) return;

      html += `
        <section class="day-section">
          <div class="schedule-grid">
      `;

      dayEvents.forEach(ev => {
        const theme = getTheme(ev.department);
        const isElective = ev.department === 'MS-ELECTIVE';
        const badgeText = isElective ? 'MS Elective' : ev.department.replace('MS-', 'MS ');

        // Extract section info (e.g. AI-A, AI-B) if available
        let displayTitle = ev.course_code;
        
        const secMatch = ev.raw ? ev.raw.match(/\(([A-Za-z0-9-]+)\)/) : null;
        const secTag = secMatch ? secMatch[1] : (ev.section || '');

        if (secTag && (secTag.includes('-') || (ev.track && ev.track !== 'General'))) {
          if (!displayTitle.includes(secTag)) {
            displayTitle = `${ev.course_code} (${escapeHtml(secTag)})`;
          }
        }

        html += `
          <article class="course-card" data-id="${ev.id}">
            <div>
              <div class="card-header-row">
                <span class="day-tag">${ev.day}</span>
                <span class="program-tag" style="background: ${theme.bg}; color: ${theme.text}; border: 1px solid ${theme.border};">
                  <span class="program-dot" style="background: ${theme.dot};"></span>
                  ${escapeHtml(badgeText)}
                </span>
              </div>
              <h3 class="course-name-h3">${escapeHtml(displayTitle)}</h3>
              <p class="course-desc-p">${escapeHtml(ev.course_full)}</p>
            </div>

            <div class="card-footer-row">
              <div class="time-slot">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>${escapeHtml(ev.time)}</span>
              </div>
              <div class="room-badge" data-room="${escapeHtml(ev.room)}" title="Click to copy room">
                <span>📍 Room ${escapeHtml(ev.room)}</span>
              </div>
            </div>
          </article>
        `;
      });

      html += `
          </div>
        </section>
      `;
    });

    timetableContainer.innerHTML = html;
  }

  // Live Status Monitor
  function checkLiveStatus() {
    const todayName = getDayName();
    const selectedDept = deptSelect.value;
    const filterMode = filterModeSelect.value;

    const todayEvents = allEvents.filter(ev => {
      if (ev.day !== todayName) return false;
      if (selectedDept === 'MS-ELECTIVE') {
        if (ev.department !== 'MS-ELECTIVE') return false;
      } else if (filterMode === 'ONLY_DEPT') {
        if (ev.department !== selectedDept) return false;
      } else if (filterMode === 'INCLUDE_ELECTIVES') {
        if (ev.department !== selectedDept && ev.department !== 'MS-ELECTIVE') return false;
      }
      return true;
    });

    if (todayEvents.length === 0) {
      liveStatusContainer.style.display = 'none';
      return;
    }

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let ongoing = null;
    let upcoming = null;
    let minDiff = Infinity;

    todayEvents.forEach(ev => {
      const times = parseTimeSlot(ev.time);
      if (!times) return;

      const [sh, sm] = times.startStr.split(':').map(Number);
      const [eh, em] = times.endStr.split(':').map(Number);

      const startH24 = (sh < 8) ? sh + 12 : sh;
      const endH24 = (eh < 8) ? eh + 12 : eh;

      const startMins = startH24 * 60 + sm;
      const endMins = endH24 * 60 + em;

      if (currentMins >= startMins && currentMins < endMins) {
        ongoing = { ev, endMins };
      } else if (startMins > currentMins) {
        const diff = startMins - currentMins;
        if (diff < minDiff) {
          minDiff = diff;
          upcoming = { ev, startMins, diff };
        }
      }
    });

    if (ongoing) {
      liveStatusContainer.style.display = 'block';
      const minsLeft = ongoing.endMins - currentMins;
      liveStatusContainer.innerHTML = `
        <div class="alert-card">
          <div class="alert-left">
            <span class="alert-badge">In Progress</span>
            <div class="alert-info">
              <h4>${escapeHtml(ongoing.ev.course_full)} (${escapeHtml(ongoing.ev.course_code)})</h4>
              <div class="alert-details">Room: <strong>${escapeHtml(ongoing.ev.room)}</strong> • ${escapeHtml(ongoing.ev.time)}</div>
            </div>
          </div>
          <div class="alert-right">
            <span>${minsLeft}m remaining</span>
          </div>
        </div>
      `;
    } else if (upcoming) {
      liveStatusContainer.style.display = 'block';
      const hours = Math.floor(upcoming.diff / 60);
      const mins = upcoming.diff % 60;
      const startsInText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      liveStatusContainer.innerHTML = `
        <div class="alert-card upcoming-alert">
          <div class="alert-left">
            <span class="alert-badge" style="background: var(--status-upcoming-bg); color: var(--status-upcoming); border-color: var(--status-upcoming-border);">Upcoming</span>
            <div class="alert-info">
              <h4>${escapeHtml(upcoming.ev.course_full)} (${escapeHtml(upcoming.ev.course_code)})</h4>
              <div class="alert-details">Room: <strong>${escapeHtml(upcoming.ev.room)}</strong> • ${escapeHtml(upcoming.ev.time)}</div>
            </div>
          </div>
          <div class="alert-right">
            <span>Starts in ${startsInText}</span>
          </div>
        </div>
      `;
    } else {
      liveStatusContainer.style.display = 'none';
    }
  }

  // Event Listeners Setup
  function setupEventListeners() {
    deptSelect.addEventListener('change', () => {
      savePreferences();
      renderSchedule();
      checkLiveStatus();
    });

    filterModeSelect.addEventListener('change', () => {
      savePreferences();
      renderSchedule();
      checkLiveStatus();
    });

    courseSearch.addEventListener('input', () => {
      const hasQuery = courseSearch.value.trim().length > 0;
      clearSearchBtn.style.display = hasQuery ? 'flex' : 'none';
      if (searchKbd) searchKbd.style.display = hasQuery ? 'none' : 'block';
      renderSchedule();
    });

    courseSearch.addEventListener('focus', () => {
      if (searchKbd && !courseSearch.value) searchKbd.style.opacity = '0.3';
    });

    courseSearch.addEventListener('blur', () => {
      if (searchKbd && !courseSearch.value) searchKbd.style.opacity = '1';
    });

    clearSearchBtn.addEventListener('click', () => {
      courseSearch.value = '';
      clearSearchBtn.style.display = 'none';
      if (searchKbd) searchKbd.style.display = 'block';
      renderSchedule();
      courseSearch.focus();
    });

    dayTabs.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-item');
      if (!tabBtn) return;

      dayTabs.querySelectorAll('.tab-item').forEach(btn => btn.classList.remove('active'));
      tabBtn.classList.add('active');
      tabBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

      currentDayFilter = tabBtn.getAttribute('data-day');
      renderSchedule();
    });

    // Interactive Room Copy
    timetableContainer.addEventListener('click', (e) => {
      const roomBadge = e.target.closest('.room-badge');
      if (!roomBadge) return;

      const roomName = roomBadge.getAttribute('data-room');
      if (roomName && navigator.clipboard) {
        navigator.clipboard.writeText(roomName).then(() => {
          const originalContent = roomBadge.innerHTML;
          roomBadge.innerHTML = '<span>✓ Copied</span>';
          roomBadge.classList.add('copied');
          setTimeout(() => {
            roomBadge.innerHTML = originalContent;
            roomBadge.classList.remove('copied');
          }, 1400);
        }).catch(() => {});
      }
    });

    themeToggle.addEventListener('click', toggleTheme);

    // Keyboard shortcut '/' to search
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== courseSearch) {
        e.preventDefault();
        courseSearch.focus();
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
  }
});
