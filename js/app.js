// 2027 초등 1급 정교사 자격연수 「슬기로운 교직실무 올인원 포털 v2.0」 메인 애플리케이션
(function () {
  "use strict";

  const STORAGE_KEY = "EDU_PORTAL_STATE_2027_V2";
  const LEGACY_KEY = "EDU_PORTAL_STATE_2027_V1";

  const defaultState = {
    theme: "light",
    profile: {
      schoolName: "장성성산초등학교",
      slogan: "함께 여는 미래, 탄탄한 전남교육",
      teacherName: "연수생 교사"
    },
    lintCount: 0,
    checkedTasks: {},
    selectedDepts: ["dept-academic"],
    customTasks: [],
    labsCompleted: { lab1: false, lab2: false, lab3: false },
    quizAnswers: {},
    quizBestScore: null,
    settlement: {
      received: 640000,
      endDate: new Date().toISOString().slice(0, 10),
      className: "3학년 1반",
      rows: [
        { id: 1, date: "2026-04-06", vendor: "오늘 문구사", proof: "전산자료", desc: "4월 생일 파티 및 학급 게시판 용품", amount: 75000 },
        { id: 2, date: "2026-05-15", vendor: "바른 문구", proof: "전산자료", desc: "학급 다모임 프로젝트 활동지·색연필", amount: 112000 }
      ]
    }
  };

  let appState = loadState();
  let currentDeptId = (appState.selectedDepts && appState.selectedDepts[0]) || "dept-academic";
  let roleViewMode = "dept"; // 'dept' | 'month'
  let selectedMonth = new Date().getMonth() + 1;

  // 빌더 동적 표 데이터
  let builderTableRows = [
    { id: 1, time: "14:00~14:40", content: "이동 및 체험장 도착·안전관리자 면담", owner: "학년부장" },
    { id: 2, time: "14:40~16:00", content: "체험 동선·식당·비상 대피로·주차 구역 점검", owner: "인솔교사 전원" },
    { id: 3, time: "16:00~17:00", content: "우천 시 실내 대체 코스 확인 및 복귀", owner: "" }
  ];

  // 성립전 예산 시뮬레이터 행
  let preBudgetRows = [
    { id: 1, bimok: "교육운영비(자료)", desc: "공생의길 프로젝트 운영(교육자료)", formula: "150,000원×1식×3회=450,000원", amount: 450000 },
    { id: 2, bimok: "교육운영비(간식)", desc: "공생의길 프로젝트 간식 구매", formula: "50,000원×1식×6회=300,000원", amount: 300000 },
    { id: 3, bimok: "운영수당", desc: "공생의길 프로젝트 강사 수당", formula: "150,000원×1명×3회=450,000원", amount: 450000 }
  ];

  // K-에듀파인 품의 CSV 생성기 행
  let pumuiItems = [
    { id: 1, name: "양면 색종이 (15×15cm)", spec: "100매입/팩", unit: "팩", qty: 25, price: 2500 },
    { id: 2, name: "생태 관찰 기록 수첩", spec: "A5 스프링", unit: "권", qty: 25, price: 3200 },
    { id: 3, name: "친환경 12색 색연필", spec: "12색/세트", unit: "세트", qty: 25, price: 4800 }
  ];

  // 린터 상태 & 실행취소 스택
  let lastLintFixes = [];
  let lintUndoStack = [];

  // 비목 3단계 마법사 상태
  let costWizardPath = [];

  // 퀴즈 상태
  let quizMode = "focus"; // 'focus' | 'all' | 'wrong'
  let quizFocusIndex = 0;

  // 글로벌 검색 키보드 상태
  let currentSearchResults = [];
  let activeSearchIdx = -1;
  let deferredInstallPrompt = null;

  // ==========================================
  // 0. 상태 로드/저장 및 공통 유틸
  // ==========================================
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
      if (!raw) return clone(defaultState);
      const parsed = JSON.parse(raw);
      return {
        ...clone(defaultState),
        ...parsed,
        profile: { ...defaultState.profile, ...(parsed.profile || {}) },
        labsCompleted: { ...defaultState.labsCompleted, ...(parsed.labsCompleted || {}) },
        settlement: {
          ...clone(defaultState.settlement),
          ...(parsed.settlement || {}),
          rows: Array.isArray(parsed.settlement?.rows) ? parsed.settlement.rows : clone(defaultState.settlement.rows)
        },
        selectedDepts: Array.isArray(parsed.selectedDepts) && parsed.selectedDepts.length > 0 ? parsed.selectedDepts : ["dept-academic"],
        customTasks: Array.isArray(parsed.customTasks) ? parsed.customTasks : []
      };
    } catch (e) {
      return clone(defaultState);
    }
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      // ignore quota errors
    }
    updateDashboardStats();
    renderCertificate();
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function formatNumber(num) {
    return Number(num || 0).toLocaleString("ko-KR");
  }

  function spaceSchoolName(name) {
    const clean = String(name || "장성성산초등학교").replace(/\s+/g, "");
    return clean.split("").join(" ");
  }

  window.showToast = function (msg) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, 2600);
  };

  window.copyText = function (text, toastMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => window.showToast(toastMsg || "클립보드에 복사되었습니다."));
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      window.showToast(toastMsg || "클립보드에 복사되었습니다.");
    }
  };

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ==========================================
  // 1. 초기화, PWA, URL 해시 라우팅, 인쇄 엔진
  // ==========================================
  function initApp() {
    applyTheme(appState.theme);
    applyProfileToUi();
    registerPwa();

    // 데스크톱 + 모바일 메인 탭 이벤트
    document.querySelectorAll(".nav-tab, .mobile-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.switchMainTab(btn.dataset.tab);
      });
    });

    // 서브 탭 이벤트
    document.querySelectorAll(".sub-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const parentSection = btn.closest(".tab-panel");
        if (!parentSection) return;
        activateSubTab(parentSection.id, btn.dataset.sub, true);
      });
    });

    // 다크모드 토글
    document.getElementById("themeToggleBtn").addEventListener("click", () => {
      appState.theme = appState.theme === "dark" ? "light" : "dark";
      applyTheme(appState.theme);
      saveState();
    });

    // 설정 모달
    document.getElementById("openSettingsBtn").addEventListener("click", window.openSettingsModal);
    document.getElementById("settingsModalBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "settingsModalBackdrop") window.closeSettingsModal();
    });

    // 전체 기록 초기화
    document.getElementById("resetProgressBtn").addEventListener("click", () => {
      if (confirm("실습 완료 현황, 보직 체크리스트, 나만의 업무, 퀴즈 기록을 모두 초기화하시겠습니까?")) {
        const savedTheme = appState.theme;
        const savedProfile = clone(appState.profile);
        appState = clone(defaultState);
        appState.theme = savedTheme;
        appState.profile = savedProfile;
        saveState();
        renderDepartments();
        renderSettlementTable();
        renderQuiz();
        window.closeSettingsModal();
        window.showToast("학습 및 실습 기록이 초기화되었습니다.");
      }
    });

    // 글로벌 검색 모달 + 키보드 단축키
    document.getElementById("globalSearchTrigger").addEventListener("click", openSearchModal);
    document.getElementById("searchModalBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "searchModalBackdrop") window.closeSearchModal();
    });
    const searchInput = document.getElementById("globalSearchModalInput");
    searchInput.addEventListener("input", (e) => renderGlobalSearchResults(e.target.value));
    searchInput.addEventListener("keydown", handleSearchModalKeydown);

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearchModal();
      } else if (e.key === "Escape") {
        window.closeSearchModal();
        window.closeSettingsModal();
      }
    });

    // 인쇄 후 target 해제
    window.addEventListener("afterprint", () => {
      delete document.body.dataset.printTarget;
    });

    // 각 모듈 초기화
    renderHomeDashboard();
    initLinterModule();
    initBuilderModule();
    initPurifiedDictModule();
    initBudgetModule();
    initRoleModule();
    initLabModule();
    initQuizAndFaqModule();
    updateDashboardStats();
    renderCertificate();

    // URL 해시 라우팅 적용
    window.addEventListener("hashchange", applyHashRoute);
    applyHashRoute();
  }

  function registerPwa() {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const btn = document.getElementById("pwaInstallBtn");
      if (btn) btn.style.display = "inline-flex";
    });
    const installBtn = document.getElementById("pwaInstallBtn");
    if (installBtn) {
      installBtn.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installBtn.style.display = "none";
      });
    }
  }

  function applyHashRoute() {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) return;
    const [tabId, subId] = raw.split("/");
    if (tabId && document.getElementById(tabId)) {
      window.switchMainTab(tabId, subId || null, false);
    }
  }

  function updateHash(tabId, subId) {
    const nextHash = subId ? `#${tabId}/${subId}` : `#${tabId}`;
    if (location.hash !== nextHash) {
      history.replaceState(null, "", nextHash);
    }
  }

  window.switchMainTab = function (tabId, subId, pushHash = true) {
    document.querySelectorAll(".nav-tab, .mobile-nav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === tabId);
    });

    const panel = document.getElementById(tabId);
    let activeSub = subId;
    if (panel) {
      if (subId) {
        activateSubTab(tabId, subId, false);
      } else {
        const currentSubBtn = panel.querySelector(".sub-tab.active");
        activeSub = currentSubBtn ? currentSubBtn.dataset.sub : null;
      }
    }
    if (pushHash) updateHash(tabId, activeSub);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function activateSubTab(tabId, subId, pushHash) {
    const panel = document.getElementById(tabId);
    if (!panel) return;
    panel.querySelectorAll(".sub-tab").forEach((b) => b.classList.toggle("active", b.dataset.sub === subId));
    panel.querySelectorAll(".sub-panel").forEach((p) => p.classList.toggle("active", p.id === subId));
    if (pushHash) updateHash(tabId, subId);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const icon = document.getElementById("themeIcon");
    const label = document.getElementById("themeLabel");
    if (icon && label) {
      icon.textContent = theme === "dark" ? "☀️" : "🌙";
      label.textContent = theme === "dark" ? "라이트" : "다크";
    }
  }

  // A4 단독 인쇄 엔진
  window.printIsolatedZone = function (zone) {
    document.body.dataset.printTarget = zone;
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        delete document.body.dataset.printTarget;
      }, 600);
    }, 60);
  };

  // ==========================================
  // 2. 내 학교 프로필 설정 & JSON 백업/복원
  // ==========================================
  function applyProfileToUi() {
    const p = appState.profile;
    const pill = document.getElementById("headerSchoolDisplay");
    if (pill) pill.textContent = `🏫 ${p.schoolName}`;

    const teacherInput = document.getElementById("settleTeacher");
    if (teacherInput && !teacherInput.value) {
      teacherInput.value = p.teacherName;
    }
  }

  window.openSettingsModal = function () {
    document.getElementById("settingSchoolName").value = appState.profile.schoolName;
    document.getElementById("settingSlogan").value = appState.profile.slogan;
    document.getElementById("settingTeacherName").value = appState.profile.teacherName;
    document.getElementById("settingsModalBackdrop").classList.add("open");
  };

  window.closeSettingsModal = function () {
    document.getElementById("settingsModalBackdrop").classList.remove("open");
  };

  window.saveSchoolProfile = function () {
    const school = document.getElementById("settingSchoolName").value.trim() || "장성성산초등학교";
    const slogan = document.getElementById("settingSlogan").value.trim() || "함께 여는 미래, 탄탄한 전남교육";
    const teacher = document.getElementById("settingTeacherName").value.trim() || "연수생 교사";

    appState.profile = { schoolName: school, slogan, teacherName: teacher };
    saveState();
    applyProfileToUi();

    const relInput = document.getElementById("bRelatedDoc");
    if (relInput && relInput.value.includes("초등학교-")) {
      relInput.value = relInput.value.replace(/^[^-]+-/, `${school}-`);
    }
    const settleTeacher = document.getElementById("settleTeacher");
    if (settleTeacher) settleTeacher.value = teacher;

    renderBuilderPreview();
    renderSettlementTable();
    window.closeSettingsModal();
    window.showToast(`'${school}' 프로필이 전체 문서에 반영되었습니다.`);
  };

  window.exportBackupJson = function () {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`교직실무포털_백업_${stamp}.json`, JSON.stringify(appState, null, 2), "application/json;charset=utf-8");
    window.showToast("백업 파일(.json)이 다운로드되었습니다.");
  };

  window.importBackupJson = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!imported || typeof imported !== "object") throw new Error("invalid");
        appState = {
          ...clone(defaultState),
          ...imported,
          profile: { ...defaultState.profile, ...(imported.profile || {}) },
          labsCompleted: { ...defaultState.labsCompleted, ...(imported.labsCompleted || {}) },
          settlement: { ...clone(defaultState.settlement), ...(imported.settlement || {}) }
        };
        saveState();
        applyTheme(appState.theme);
        applyProfileToUi();
        renderBuilderPreview();
        renderDepartments();
        renderSettlementTable();
        renderQuiz();
        window.closeSettingsModal();
        window.showToast("백업 데이터를 성공적으로 복원했습니다!");
      } catch (err) {
        window.showToast("올바른 백업 JSON 파일이 아닙니다.");
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  // ==========================================
  // 3. 홈 대시보드 & 통계
  // ==========================================
  function renderHomeDashboard() {
    const grid = document.getElementById("modulesOverviewGrid");
    grid.innerHTML = window.EDU_DATA.modulesOverview
      .map(
        (m) => `
      <div class="card card-hover" style="cursor:pointer;" onclick="window.switchMainTab('${m.targetTab}')">
        <div class="row-between mb-1">
          <span class="badge badge-blue">MODULE ${m.num}</span>
          <span class="text-xs" style="color:var(--brand-primary); font-weight:700;">도구 열기 →</span>
        </div>
        <div style="font-size:1.02rem; font-weight:800; margin-bottom:0.2rem;">${escapeHtml(m.title)}</div>
        <div class="text-xs text-muted mb-1">${escapeHtml(m.sub)}</div>
        <ul style="padding-left:1.1rem; font-size:0.83rem; color:var(--text-secondary);" class="stack-sm">
          ${m.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}
        </ul>
      </div>
    `
      )
      .join("");

    document.getElementById("shortcutsTableBody").innerHTML = window.EDU_DATA.shortcuts
      .map((s) => `<tr><td style="white-space:nowrap;"><kbd>${escapeHtml(s.key)}</kbd></td><td>${escapeHtml(s.desc)}</td></tr>`)
      .join("");

    document.getElementById("hierarchyTableBody").innerHTML = window.EDU_DATA.itemHierarchy
      .map(
        (h) => `
      <tr>
        <td><span class="badge badge-gray">${escapeHtml(h.level)}</span></td>
        <td style="font-weight:800; color:var(--brand-primary);">${escapeHtml(h.symbol)}</td>
        <td>${escapeHtml(h.indent)}</td>
        <td class="font-mono text-xs" style="white-space:pre;">${escapeHtml(h.example)}</td>
      </tr>
    `
      )
      .join("");
  }

  function updateDashboardStats() {
    const labsDone = Object.values(appState.labsCompleted || {}).filter(Boolean).length;
    const elLab = document.getElementById("statLabDone");
    if (elLab) elLab.textContent = `${labsDone} / 3`;
    const navBadge = document.getElementById("navLabBadge");
    if (navBadge) navBadge.textContent = `${labsDone}/3`;

    // 선택된 내 보직 기준 달성률 계산
    const myDepts = new Set(appState.selectedDepts || ["dept-academic"]);
    let totalTasks = 0;
    let checkedCount = 0;
    window.EDU_DATA.departments.forEach((d) => {
      if (!myDepts.has(d.id)) return;
      d.periods.forEach((p) =>
        p.tasks.forEach((t) => {
          totalTasks++;
          if (appState.checkedTasks && appState.checkedTasks[t.id]) checkedCount++;
        })
      );
    });
    (appState.customTasks || []).forEach((ct) => {
      if (!myDepts.has(ct.deptId)) return;
      totalTasks++;
      if (appState.checkedTasks && appState.checkedTasks[ct.id]) checkedCount++;
    });

    const pct = totalTasks > 0 ? Math.round((checkedCount / totalTasks) * 100) : 0;
    const elRole = document.getElementById("statRoleProgress");
    if (elRole) elRole.textContent = `${pct}%`;

    const elQuiz = document.getElementById("statQuizBest");
    if (elQuiz) elQuiz.textContent = appState.quizBestScore !== null ? `${appState.quizBestScore} / 20` : "- 점";

    const elLint = document.getElementById("statLintCount");
    if (elLint) elLint.textContent = `${appState.lintCount || 0} 회`;
  }

  // ==========================================
  // 4. MODULE 2: 공문서 린터 v2 (인라인 밑줄 + 실행 취소 + 항목 위계 검증)
  // ==========================================
  function initLinterModule() {
    window.loadLinterSample(0);
    document.getElementById("runLintBtn").addEventListener("click", () => {
      appState.lintCount = (appState.lintCount || 0) + 1;
      saveState();
      runDocumentLinter();
      window.showToast("공문서 어문규범·표기·항목 위계 점검을 완료했습니다.");
    });
    document.getElementById("applyAllFixesBtn").addEventListener("click", applyAllLinterFixes);
    document.getElementById("undoLintBtn").addEventListener("click", undoLintChange);
    document.getElementById("lintTitleInput").addEventListener("input", runDocumentLinter);
    document.getElementById("lintBodyInput").addEventListener("input", runDocumentLinter);
  }

  function pushLintUndo() {
    lintUndoStack.push({
      title: document.getElementById("lintTitleInput").value,
      body: document.getElementById("lintBodyInput").value
    });
    if (lintUndoStack.length > 20) lintUndoStack.shift();
    updateUndoBtn();
  }

  function updateUndoBtn() {
    const btn = document.getElementById("undoLintBtn");
    if (btn) btn.disabled = lintUndoStack.length === 0;
  }

  function undoLintChange() {
    if (lintUndoStack.length === 0) return;
    const prev = lintUndoStack.pop();
    document.getElementById("lintTitleInput").value = prev.title;
    document.getElementById("lintBodyInput").value = prev.body;
    updateUndoBtn();
    runDocumentLinter();
    window.showToast("직전 교정 내역을 되돌렸습니다.");
  }

  window.loadLinterSample = function (idx) {
    const sample = window.EDU_DATA.linterSamples[idx];
    if (!sample) return;
    lintUndoStack = [];
    updateUndoBtn();
    document.getElementById("lintTitleInput").value = sample.title;
    document.getElementById("lintBodyInput").value = sample.body;
    runDocumentLinter();
  };

  function runDocumentLinter() {
    const title = document.getElementById("lintTitleInput").value;
    const body = document.getElementById("lintBodyInput").value;
    const issues = [];

    // 1. 제목 불필요 수식어
    const titleSuffixRegex = /(에 관한 건|에 대하여|에 대한 건|관련의 건)\s*$/;
    if (titleSuffixRegex.test(title)) {
      const m = title.match(titleSuffixRegex)[0];
      issues.push({
        type: "error",
        category: "제목 작성 원칙 (p.6)",
        wrong: m,
        right: "명사형 종결 (예: ~계획, ~안내)",
        reason: "공문서 제목에서 '~에 관한 건', '~에 대하여' 같은 불필요한 수식어는 제거합니다.",
        fixTarget: "title",
        applyFix: (t) => t.replace(titleSuffixRegex, " 계획").replace(/\s+/g, " ").trim()
      });
    }

    // 2. 날짜 표기 (마침표 뒤 공백 & 일 뒤 마침표)
    const compactDateRegex = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})(\.)?/g;
    let match;
    while ((match = compactDateRegex.exec(body)) !== null) {
      const full = match[0];
      const standard = `${match[1]}. ${match[2]}. ${match[3]}.`;
      const afterChar = body.slice(match.index + full.length, match.index + full.length + 2);
      if (full !== standard && !/^\d/.test(afterChar)) {
        issues.push({
          type: "error",
          category: "날짜 표기법 (p.11)",
          wrong: full,
          right: standard,
          reason: "날짜의 마침표(.)는 연·월·일을 대체하므로 마침표 뒤를 한 칸씩 띄고 일(日) 뒤에도 마침표를 찍습니다.",
          fixTarget: "body",
          wrongRaw: full,
          rightRaw: standard
        });
      }
    }

    // 3. 날짜와 요일 사이 불필요한 공백
    const daySpaceRegex = /(\d{1,2}\.)\s+\(([월화수목금토일])\)/g;
    while ((match = daySpaceRegex.exec(body)) !== null) {
      issues.push({
        type: "warn",
        category: "날짜·요일 표기 (p.11)",
        wrong: match[0],
        right: `${match[1]}(${match[2]})`,
        reason: "날짜 뒤 요일 괄호는 띄지 않고 붙여 씁니다. 예: 2026. 5. 20.(수)",
        fixTarget: "body",
        wrongRaw: match[0],
        rightRaw: `${match[1]}(${match[2]})`
      });
    }

    // 4. 물결표 앞뒤 공백
    const waveSpaceRegex = /(\S)\s+~\s+(\S)/g;
    while ((match = waveSpaceRegex.exec(body)) !== null) {
      issues.push({
        type: "warn",
        category: "기간 물결표 표기 (p.11)",
        wrong: match[0],
        right: `${match[1]}~${match[2]}`,
        reason: "기간 물결표(~) 앞뒤는 띄어쓰지 않고 붙여 씁니다.",
        fixTarget: "body",
        wrongRaw: match[0],
        rightRaw: `${match[1]}~${match[2]}`
      });
    }

    // 5. ~와 '까지' 중복
    const waveUntilRegex = /(~[^\n,.;]+?시(?:\s*\d+분)?|\d{1,2}:\d{2})까지/g;
    while ((match = waveUntilRegex.exec(body)) !== null) {
      issues.push({
        type: "error",
        category: "시간·기간 중복 오류 (p.11)",
        wrong: match[0],
        right: match[1],
        reason: "물결표(~)에 이미 '부터~까지' 의미가 포함되어 있으므로 뒤에 '까지'를 중복 표기하지 않습니다.",
        fixTarget: "body",
        wrongRaw: match[0],
        rightRaw: match[1]
      });
    }

    // 6. 항목 위계 건너뛰기 검증 (1. 다음 가. 없이 바로 1) 등장 시)
    const lines = body.split("\n");
    let sawLevel1 = false;
    let sawLevel2 = false;
    lines.forEach((line) => {
      if (/^\s*1\.\s+/.test(line)) {
        sawLevel1 = true;
        sawLevel2 = false;
      } else if (/^\s*가\.\s+/.test(line)) {
        sawLevel2 = true;
      } else if (/^\s*1\)\s+/.test(line) && sawLevel1 && !sawLevel2) {
        issues.push({
          type: "warn",
          category: "항목 기호 위계 오류 (p.11)",
          wrong: line.trim().slice(0, 18),
          right: "1. → 가. → 1) 순서 준수",
          reason: "공문서 항목은 '1.' 다음에 반드시 '가.'를 먼저 사용한 뒤 하위 항목으로 '1)'을 사용해야 합니다.",
          fixTarget: "none"
        });
      }
    });

    // 7. 문법·띄어쓰기·피동·사동·투식어
    const grammarRules = [
      { regex: /검토바랍니다/g, right: "검토하여 주시기 바랍니다", cat: "공문서 문장·띄어쓰기 (p.12)", reason: "'검토하여 주시기 바랍니다'(내부결재 시 '검토하기 바랍니다')로 명확히 표현합니다." },
      { regex: /실시코자\s*하오니/g, right: "실시하고자 하오니", cat: "어문규범·투식어", reason: "'~코자' 대신 자연스러운 '~하고자'를 사용합니다." },
      { regex: /(할|될|볼|갈|올)수\s/g, right: "$1 수 ", cat: "의존명사 띄어쓰기 (p.10)", reason: "의존명사 '수'는 앞말과 반드시 띄어 씁니다." },
      { regex: /파악해주시기\s*드립니다/g, right: "파악하여 주시기 바랍니다", cat: "과도한 존칭·문장 호응 (p.12)", reason: "불필요한 '드립니다'를 지양하고 정확한 공문서 어미를 사용합니다." },
      { regex: /강화시키기\s*위한/g, right: "강화하기 위한", cat: "불필요한 사동 표현", reason: "'~하다'로 충분한 문장에 '~시키다'를 남용하지 않습니다." },
      { regex: /계획되었습니다/g, right: "계획하였습니다", cat: "능동형 문장 권장 (p.8)", reason: "책임 소재가 분명한 능동형 표현을 권장합니다." },
      { regex: /에\s*있어서/g, right: "에서", cat: "일본어 번역 투", reason: "'~에 있어서'는 일본어 번역 투이므로 '~에서' 또는 '~에 관하여'로 고칩니다." },
      { regex: /요망\b/g, right: "바람", cat: "권위적 표현 순화", reason: "'요망'은 권위적 표현이므로 '~하기 바람'으로 순화합니다." }
    ];

    grammarRules.forEach((rule) => {
      let m;
      while ((m = rule.regex.exec(body)) !== null) {
        const replaced = m[0].replace(rule.regex, rule.right);
        issues.push({
          type: "error",
          category: rule.cat,
          wrong: m[0].trim(),
          right: replaced.trim(),
          reason: rule.reason,
          fixTarget: "body",
          wrongRaw: m[0],
          rightRaw: replaced
        });
      }
    });

    // 8. 첨부물 1개일 때 '붙임 1.' 오류
    const attachOneRegex = /붙임\s+1\.\s*([^\n]+)\s+끝\./;
    if (attachOneRegex.test(body) && !/2\./.test(body.slice(body.indexOf("붙임")))) {
      const m = body.match(attachOneRegex);
      const fixedAttach = `붙임  ${m[1].trim()}  끝.`;
      issues.push({
        type: "warn",
        category: "붙임 표기 원칙 (p.18)",
        wrong: m[0],
        right: fixedAttach,
        reason: "첨부물이 1개일 때는 '1.'을 붙이지 않고 '붙임' 뒤 2칸(1타)을 띄운 후 기재합니다.",
        fixTarget: "body",
        wrongRaw: m[0],
        rightRaw: fixedAttach
      });
    }

    // 9. 순화어·외래어·일본어 투 사전 매칭
    window.EDU_DATA.purifiedTerms.forEach((item) => {
      if (item.wrong === "귀교" || item.wrong === "귀사") return;
      if (body.includes(item.wrong)) {
        const cleanRight = item.right.split("/")[0].split("(")[0].trim();
        issues.push({
          type: item.category.includes("오류") ? "error" : "warn",
          category: item.category,
          wrong: item.wrong,
          right: item.right,
          reason: item.reason,
          fixTarget: "body",
          wrongRaw: item.wrong,
          rightRaw: cleanRight
        });
      }
    });

    lastLintFixes = issues;
    renderLintIssues(issues);
    renderLintInlinePreview(title, body, issues);
  }

  function renderLintInlinePreview(title, body, issues) {
    const box = document.getElementById("lintInlinePreview");
    if (!box) return;
    let htmlBody = escapeHtml(body);

    const seen = new Set();
    issues.forEach((iss, idx) => {
      if (iss.fixTarget !== "body" || !iss.wrongRaw || seen.has(iss.wrongRaw)) return;
      seen.add(iss.wrongRaw);
      const cls = iss.type === "warn" ? "lint-mark-warn" : "lint-mark-error";
      const escapedTarget = escapeHtml(iss.wrongRaw);
      const regex = new RegExp(escapeRegex(escapedTarget), "g");
      htmlBody = htmlBody.replace(
        regex,
        `<span class="${cls}" title="${escapeHtml(iss.right)} (${escapeHtml(iss.category)})" onclick="window.applySingleLintFix(${idx})">${escapedTarget}</span>`
      );
    });

    box.innerHTML = `<div style="font-weight:800; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem; margin-bottom:0.5rem;">제목: ${escapeHtml(title || "(미입력)")}</div><div>${htmlBody || '<span class="text-muted">본문을 입력하면 오류 구간에 실시간 밑줄이 표시됩니다.</span>'}</div>`;
  }

  function renderLintIssues(issues) {
    const badge = document.getElementById("lintSummaryBadge");
    const container = document.getElementById("lintIssuesContainer");

    if (issues.length === 0) {
      badge.className = "badge badge-green";
      badge.textContent = "표기 · 어문규범 완벽 (0건)";
      container.innerHTML = `
        <div class="callout callout-success" style="text-align:center; padding:1.75rem 1rem;">
          <div style="font-weight:800; color:var(--success); font-size:1rem;">검출된 공문서 표기 및 공공언어 오류가 없습니다!</div>
          <div class="text-sm text-secondary mt-1">행정업무운영편람의 날짜·시간·항목·붙임 표기 원칙과 쉬운 공공언어 기준을 잘 준수하고 있습니다.</div>
        </div>
      `;
      return;
    }

    badge.className = "badge badge-red";
    badge.textContent = `교정 권장 ${issues.length}건`;

    container.innerHTML = issues
      .map(
        (iss, idx) => `
      <div class="lint-issue-card ${iss.type === "warn" ? "warn" : ""}">
        <div style="flex:1;">
          <div style="margin-bottom:0.25rem;"><span class="badge ${iss.type === "warn" ? "badge-amber" : "badge-red"}">${escapeHtml(iss.category)}</span></div>
          <div style="font-size:0.9rem; margin-bottom:0.22rem;">
            <span class="lint-wrong">${escapeHtml(iss.wrong)}</span>
            <span style="margin:0 0.3rem;">→</span>
            <span class="lint-right">${escapeHtml(iss.right)}</span>
          </div>
          <div class="text-xs text-secondary">${escapeHtml(iss.reason)}</div>
        </div>
        ${iss.fixTarget !== "none" ? `<button type="button" class="btn btn-sm btn-secondary" onclick="window.applySingleLintFix(${idx})">적용</button>` : ""}
      </div>
    `
      )
      .join("");
  }

  window.applySingleLintFix = function (idx) {
    const iss = lastLintFixes[idx];
    if (!iss || iss.fixTarget === "none") return;
    pushLintUndo();
    if (iss.fixTarget === "title" && iss.applyFix) {
      const titleEl = document.getElementById("lintTitleInput");
      titleEl.value = iss.applyFix(titleEl.value);
    } else if (iss.fixTarget === "body" && iss.wrongRaw) {
      const bodyEl = document.getElementById("lintBodyInput");
      bodyEl.value = bodyEl.value.replace(iss.wrongRaw, iss.rightRaw);
    }
    runDocumentLinter();
  };

  function applyAllLinterFixes() {
    const fixable = lastLintFixes.filter((i) => i.fixTarget !== "none");
    if (fixable.length === 0) {
      window.showToast("자동 교정할 오류가 없습니다.");
      return;
    }
    pushLintUndo();
    let titleVal = document.getElementById("lintTitleInput").value;
    let bodyVal = document.getElementById("lintBodyInput").value;

    fixable.forEach((iss) => {
      if (iss.fixTarget === "title" && iss.applyFix) {
        titleVal = iss.applyFix(titleVal);
      } else if (iss.fixTarget === "body" && iss.wrongRaw) {
        bodyVal = bodyVal.split(iss.wrongRaw).join(iss.rightRaw);
      }
    });

    document.getElementById("lintTitleInput").value = titleVal;
    document.getElementById("lintBodyInput").value = bodyVal;
    runDocumentLinter();
    window.showToast("검출된 모든 표기·어문규범 오류가 교정되었습니다. (실행 취소 가능)");
  }

  window.copyCorrectedDoc = function () {
    const t = document.getElementById("lintTitleInput").value;
    const b = document.getElementById("lintBodyInput").value;
    window.copyText(`제목: ${t}\n\n${b}`, "교정된 기안문이 복사되었습니다.");
  };

  // ==========================================
  // Sub 2-2: 에듀파인 기안문 & 동적 표 빌더 (Rich HTML 복사 + 내 학교명)
  // ==========================================
  function initBuilderModule() {
    const ids = ["bDocType", "bRelatedDoc", "bTitle", "bPurpose", "bDate", "bPlace", "bTarget", "bDetails", "bPlanB", "bBudget", "bAttachments", "bIncludeTable"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", renderBuilderPreview);
        el.addEventListener("change", renderBuilderPreview);
      }
    });
    renderBuilderTableEditor();
    renderBuilderPreview();
  }

  window.addBuilderTableRow = function () {
    builderTableRows.push({ id: Date.now(), time: "", content: "", owner: "" });
    renderBuilderTableEditor();
    renderBuilderPreview();
  };

  window.removeBuilderTableRow = function (id) {
    builderTableRows = builderTableRows.filter((r) => r.id !== id);
    renderBuilderTableEditor();
    renderBuilderPreview();
  };

  window.updateBuilderTableCell = function (id, field, val) {
    const row = builderTableRows.find((r) => r.id === id);
    if (row) row[field] = val;
    renderBuilderPreview();
  };

  function renderBuilderTableEditor() {
    const wrap = document.getElementById("builderTableEditor");
    if (!wrap) return;
    wrap.innerHTML = builderTableRows
      .map(
        (r) => `
      <div style="display:grid; grid-template-columns: 110px 1fr 90px 34px; gap:0.35rem;">
        <input type="text" class="form-input" style="padding:0.4rem 0.55rem; font-size:0.82rem;" value="${escapeHtml(r.time)}" placeholder="시간" oninput="window.updateBuilderTableCell(${r.id}, 'time', this.value)" />
        <input type="text" class="form-input" style="padding:0.4rem 0.55rem; font-size:0.82rem;" value="${escapeHtml(r.content)}" placeholder="세부 내용" oninput="window.updateBuilderTableCell(${r.id}, 'content', this.value)" />
        <input type="text" class="form-input" style="padding:0.4rem 0.55rem; font-size:0.82rem;" value="${escapeHtml(r.owner)}" placeholder="담당(비우면 이하빈칸)" oninput="window.updateBuilderTableCell(${r.id}, 'owner', this.value)" />
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.removeBuilderTableRow(${r.id})">✕</button>
      </div>
    `
      )
      .join("");
  }

  window.loadBuilderPreset = function (preset) {
    const school = appState.profile.schoolName || "장성성산초등학교";
    if (preset === "fieldtrip") {
      document.getElementById("bDocType").value = "내부결재";
      document.getElementById("bRelatedDoc").value = `${school}-4808(2026. 5. 8.)`;
      document.getElementById("bTitle").value = "2026학년도 1학기 현장체험학습 사전답사 실시 계획";
      document.getElementById("bPurpose").value = "2026학년도 현장체험학습 매뉴얼에 의거하여 안전하고 교육적인 체험학습 운영을 위해 다음과 같이 사전답사를 실시하고자 합니다.";
      document.getElementById("bDate").value = "2026. 5. 20.(수) 14:00~17:00";
      document.getElementById("bPlace").value = "국립광주과학관 및 이동 경로 일원";
      document.getElementById("bTarget").value = "3학년 부장 및 인솔교사 3명 (총 4명)";
      document.getElementById("bDetails").value = "체험 활동 장소의 교육적 적합성 및 안전 시설 확인\n학생 이동 동선, 식당 위생 상태, 비상 대피로 및 보건실 위치 점검\n차량 승·하차 구역 및 주차장 확보 상태 확인";
      document.getElementById("bPlanB").value = "우천 또는 미세먼지 '나쁨' 시 실내 상설전시관 및 천체투영관 관람 프로그램으로 대체 운영";
      document.getElementById("bBudget").value = "관외출장 여비 및 입장료(교육운영비·여비): 20,000원 × 4명 × 1회 = 80,000원";
      document.getElementById("bAttachments").value = "사전답사 계획 1부.\n사전답사 체크리스트 1부.";
      builderTableRows = [
        { id: 1, time: "14:00~14:40", content: "이동 및 체험장 도착·안전관리자 면담", owner: "학년부장" },
        { id: 2, time: "14:40~16:00", content: "체험 동선·식당·비상 대피로·주차 구역 점검", owner: "인솔교사 전원" },
        { id: 3, time: "16:00~17:00", content: "우천 시 실내 대체 코스 확인 및 복귀", owner: "" }
      ];
    } else if (preset === "eco") {
      document.getElementById("bDocType").value = "내부결재";
      document.getElementById("bRelatedDoc").value = "창의융합교육과-3120(2026. 4. 2.)";
      document.getElementById("bTitle").value = "2026학년도 학교 생태환경교육 자율동아리 5월 활동 계획";
      document.getElementById("bPurpose").value = "학생 주도적 생태환경 보호 실천과 협동심 함양을 위하여 자율동아리 5월 활동(우리 동네 플로깅)을 다음과 같이 운영하고자 합니다.";
      document.getElementById("bDate").value = "2026. 5. 22.(금) 13:30~15:50";
      document.getElementById("bPlace").value = "학교 주변 생태탐방로 및 성산천 일대";
      document.getElementById("bTarget").value = "생태환경 자율동아리 회원 16명 및 지도교사 2명";
      document.getElementById("bDetails").value = "사전 안전교육(교통안전·독충 주의·집게 사용법)\n생태 플로깅 및 교내·인근 식생 관찰\n수거 쓰레기 분리배출 및 활동 소감 나눔";
      document.getElementById("bPlanB").value = "우천 및 폭염 특보 시 과학실 내 '업사이클링 친환경 화분 만들기' 활동으로 대체(Plan B)";
      document.getElementById("bBudget").value = "생태 플로깅 물품 및 간식 구입(교육운영비): 10,000원 × 16명 × 1회 = 160,000원";
      document.getElementById("bAttachments").value = "2026학년도 생태환경 자율동아리 5월 운영 계획서 1부.";
      builderTableRows = [
        { id: 1, time: "13:30~13:50", content: "사전 안전교육 및 활동 도구 배부", owner: "지도교사" },
        { id: 2, time: "13:50~15:20", content: "성산천 산책로 플로깅 및 식생 관찰", owner: "동아리 전원" },
        { id: 3, time: "15:20~15:50", content: "분리배출 및 성찰 소감 나눔", owner: "" }
      ];
    }
    renderBuilderTableEditor();
    renderBuilderPreview();
    window.showToast("예시 기안문이 로드되었습니다.");
  };

  function buildDocModel() {
    const docType = document.getElementById("bDocType").value;
    const related = document.getElementById("bRelatedDoc").value.trim();
    const title = document.getElementById("bTitle").value.trim();
    const purpose = document.getElementById("bPurpose").value.trim();
    const date = document.getElementById("bDate").value.trim();
    const place = document.getElementById("bPlace").value.trim();
    const target = document.getElementById("bTarget").value.trim();
    const details = document.getElementById("bDetails").value.split("\n").map((s) => s.trim()).filter(Boolean);
    const planB = document.getElementById("bPlanB").value.trim();
    const budget = document.getElementById("bBudget").value.trim();
    const includeTable = document.getElementById("bIncludeTable").checked && builderTableRows.length > 0;
    const attaches = document.getElementById("bAttachments").value.split("\n").map((s) => s.trim()).filter(Boolean);

    const bodyLines = [];
    let mainNum = 1;
    if (related) {
      bodyLines.push(`${mainNum}. 관련: ${related}`);
      mainNum++;
    }
    bodyLines.push(`${mainNum}. ${purpose}`);
    bodyLines.push(`  가. 일시: ${date}`);
    bodyLines.push(`  나. 장소: ${place}`);
    bodyLines.push(`  다. 대상: ${target}`);
    if (details.length > 0) {
      bodyLines.push(`  라. 세부 추진 내용`);
      details.forEach((d, i) => bodyLines.push(`    ${i + 1}) ${d}`));
    }
    if (planB) bodyLines.push(`  마. 안전 대책 및 악천후 시 대안: ${planB}`);
    if (budget) bodyLines.push(`  바. 소요 예산: ${budget}`);
    if (includeTable) bodyLines.push(`  사. 세부 일정표`);

    // 표 행에서 빈 마지막 셀에 '이하 빈칸' 자동 표기 (강의안 p.17)
    const tableRowsFormatted = builderTableRows.map((r, rIdx) => {
      const isLast = rIdx === builderTableRows.length - 1;
      const cells = [r.time.trim(), r.content.trim(), r.owner.trim()];
      let markedBlank = false;
      const processed = cells.map((c) => {
        if (!c && isLast && !markedBlank) {
          markedBlank = true;
          return { text: "이하 빈칸", isBlank: true };
        }
        return { text: c || "-", isBlank: false };
      });
      return processed;
    });

    const attachLines = [];
    if (attaches.length === 0) {
      if (includeTable) {
        attachLines.push("  끝."); // 본문이 표로 끝날 때 표 아래 왼쪽 기본선에서 1타(2칸) 띄우고 '끝.' (p.17)
      } else {
        bodyLines[bodyLines.length - 1] += "  끝.";
      }
    } else if (attaches.length === 1) {
      const a0 = attaches[0].endsWith(".") ? attaches[0] : attaches[0] + ".";
      attachLines.push(`붙임  ${a0}  끝.`);
    } else {
      attaches.forEach((att, idx) => {
        const cleanAtt = att.endsWith(".") ? att : att + ".";
        const isLast = idx === attaches.length - 1;
        if (idx === 0) attachLines.push(`붙임  1. ${cleanAtt}${isLast ? "  끝." : ""}`);
        else attachLines.push(`      ${idx + 1}. ${cleanAtt}${isLast ? "  끝." : ""}`);
      });
    }

    return { docType, title, bodyLines, includeTable, tableRowsFormatted, attachLines };
  }

  function renderBuilderPreview() {
    const m = buildDocModel();
    const box = document.getElementById("edufinePreviewBox");
    const schoolSpaced = spaceSchoolName(appState.profile.schoolName);

    const tableHtml = m.includeTable
      ? `<table class="edufine-table">
          <thead><tr><th style="width:24%;">시간</th><th>주요 활동 내용</th><th style="width:20%;">담당</th></tr></thead>
          <tbody>
            ${m.tableRowsFormatted
              .map(
                (cells) =>
                  `<tr>${cells.map((c) => `<td class="${c.isBlank ? "blank-cell" : ""}">${escapeHtml(c.text)}</td>`).join("")}</tr>`
              )
              .join("")}
          </tbody>
        </table>`
      : "";

    box.innerHTML = `
      <div class="edufine-header">
        <div class="edufine-org-slogan">${escapeHtml(appState.profile.slogan)}</div>
        <div class="edufine-org-name">${escapeHtml(schoolSpaced)}</div>
      </div>
      <div class="edufine-meta-row"><span class="edufine-meta-label">수신</span><span>${escapeHtml(m.docType)}</span></div>
      <div class="edufine-meta-row"><span class="edufine-meta-label">(경유)</span><span></span></div>
      <div class="edufine-title-row"><span>제목</span><span>${escapeHtml(m.title)}</span></div>
      <div class="edufine-body">${escapeHtml(m.bodyLines.join("\n"))}</div>
      ${tableHtml}
      ${m.attachLines.length ? `<div class="edufine-body" style="margin-top:0.65rem;">${escapeHtml(m.attachLines.join("\n"))}</div>` : ""}
    `;
  }

  window.copyBuilderOutput = function () {
    const m = buildDocModel();
    let txt = `제목: ${m.title}\n\n${m.bodyLines.join("\n")}`;
    if (m.includeTable) {
      txt +=
        "\n[세부 일정표]\n" +
        m.tableRowsFormatted.map((cells) => `  - ${cells.map((c) => c.text).join(" | ")}`).join("\n");
    }
    if (m.attachLines.length) txt += `\n\n${m.attachLines.join("\n")}`;
    window.copyText(txt, "기안문 텍스트가 복사되었습니다.");
  };

  window.copyBuilderRichHtml = async function () {
    const m = buildDocModel();
    const inlineTable = m.includeTable
      ? `<table style="border-collapse:collapse;width:100%;font-size:10pt;margin:8px 0;">
          <thead><tr>
            <th style="border:1px solid #000;background:#f1f5f9;padding:4px 6px;">시간</th>
            <th style="border:1px solid #000;background:#f1f5f9;padding:4px 6px;">주요 활동 내용</th>
            <th style="border:1px solid #000;background:#f1f5f9;padding:4px 6px;">담당</th>
          </tr></thead>
          <tbody>${m.tableRowsFormatted
            .map((cells) => `<tr>${cells.map((c) => `<td style="border:1px solid #000;padding:4px 6px;text-align:center;">${escapeHtml(c.text)}</td>`).join("")}</tr>`)
            .join("")}</tbody>
        </table>`
      : "";

    const htmlDoc = `<div style="font-family:'맑은 고딕',sans-serif;font-size:10.5pt;line-height:1.7;">
      <p style="font-weight:bold;">제목: ${escapeHtml(m.title)}</p>
      <pre style="font-family:'맑은 고딕',sans-serif;white-space:pre-wrap;margin:0;">${escapeHtml(m.bodyLines.join("\n"))}</pre>
      ${inlineTable}
      <pre style="font-family:'맑은 고딕',sans-serif;white-space:pre-wrap;margin-top:8px;">${escapeHtml(m.attachLines.join("\n"))}</pre>
    </div>`;

    const plainText = `제목: ${m.title}\n\n${m.bodyLines.join("\n")}\n\n${m.attachLines.join("\n")}`;

    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([htmlDoc], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" })
          })
        ]);
        window.showToast("표 서식이 포함된 기안문이 복사되었습니다. 한글(HWP)·에듀파인에 바로 붙여넣으세요!");
        return;
      } catch (e) {
        // fallback to plain text
      }
    }
    window.copyBuilderOutput();
  };

  // Sub 2-3: 순화 사전
  function initPurifiedDictModule() {
    document.getElementById("dictCategoryFilter").addEventListener("change", renderPurifiedDict);
    document.getElementById("dictSearchInput").addEventListener("input", renderPurifiedDict);
    renderPurifiedDict();
  }

  function renderPurifiedDict() {
    const cat = document.getElementById("dictCategoryFilter").value;
    const q = document.getElementById("dictSearchInput").value.trim().toLowerCase();
    const filtered = window.EDU_DATA.purifiedTerms.filter((item) => {
      const matchCat = cat === "ALL" || item.category.includes(cat);
      const matchQ = !q || item.wrong.toLowerCase().includes(q) || item.right.toLowerCase().includes(q) || item.reason.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
    document.getElementById("dictTableBody").innerHTML = filtered
      .map(
        (item) => `
      <tr>
        <td><span class="badge badge-gray">${escapeHtml(item.category)}</span></td>
        <td><span class="lint-wrong">${escapeHtml(item.wrong)}</span></td>
        <td><span class="lint-right">${escapeHtml(item.right)}</span></td>
        <td>${escapeHtml(item.reason)}</td>
      </tr>
    `
      )
      .join("");
  }

  // ==========================================
  // 5. MODULE 3: 학교회계 (3단계 마법사 + 강사료 + 품의 CSV + 개산급 정산서)
  // ==========================================
  function initBudgetModule() {
    renderCostWizard();
    document.getElementById("costTargetFilter").addEventListener("change", renderCostFinder);
    document.getElementById("costSearchInput").addEventListener("input", renderCostFinder);
    renderCostFinder();
    renderCostVsCards();

    const instSelect = document.getElementById("instGradeSelect");
    instSelect.innerHTML = window.EDU_DATA.instructorRates.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
    instSelect.value = "general2";
    ["instGradeSelect", "instHoursPerDay", "instCount", "instVisits"].forEach((id) => {
      document.getElementById(id).addEventListener("input", calculateInstructorFee);
    });
    calculateInstructorFee();

    document.getElementById("preTotalGrant").addEventListener("input", renderPreBudgetTable);
    renderPreBudgetTable();
    renderPumuiCsvTable();

    // 개산급 정산서 초기화
    document.getElementById("settleReceived").value = appState.settlement.received;
    document.getElementById("settleEndDate").value = appState.settlement.endDate;
    document.getElementById("settleTeacher").value = appState.profile.teacherName;
    document.getElementById("settleClassName").value = appState.settlement.className;

    ["settleReceived", "settleEndDate", "settleTeacher", "settleClassName"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => {
        appState.settlement.received = parseInt(document.getElementById("settleReceived").value, 10) || 0;
        appState.settlement.endDate = document.getElementById("settleEndDate").value;
        appState.settlement.className = document.getElementById("settleClassName").value;
        saveState();
        renderSettlementTable();
      });
    });
    renderSettlementTable();

    ["classOpClasses", "classOpStudents"].forEach((id) => document.getElementById(id).addEventListener("input", calculateClassOperation));
    ["promoPeople", "promoTotal"].forEach((id) => document.getElementById(id).addEventListener("input", calculatePromoLimit));
    calculateClassOperation();
    calculatePromoLimit();
  }

  // 원가통계비목 3단계 의사결정 마법사
  window.resetCostWizard = function () {
    costWizardPath = [];
    renderCostWizard();
  };

  window.chooseCostWizardOption = function (idx) {
    costWizardPath.push(idx);
    renderCostWizard();
  };

  window.stepBackCostWizard = function () {
    costWizardPath.pop();
    renderCostWizard();
  };

  function renderCostWizard() {
    const container = document.getElementById("costWizardContainer");
    if (!container) return;

    let node = window.EDU_DATA.costWizardTree;
    const breadcrumbs = [];
    for (const idx of costWizardPath) {
      const opt = node.options && node.options[idx];
      if (!opt) break;
      breadcrumbs.push(opt.label);
      if (opt.result) {
        container.innerHTML = `
          <div class="wizard-steps">
            ${breadcrumbs.map((b, i) => `<span class="wizard-step-pill done">${i + 1}. ${escapeHtml(b)}</span>`).join("")}
            <span class="wizard-step-pill active">판별 완료</span>
          </div>
          <div class="card" style="border:2px solid var(--brand-primary);">
            <div class="row-between mb-1">
              <span class="badge badge-blue">세목 코드: ${escapeHtml(opt.result.code)}</span>
              <button type="button" class="btn btn-sm btn-secondary" onclick="window.stepBackCostWizard()">← 이전 단계</button>
            </div>
            <div style="font-size:1.25rem; font-weight:800; color:var(--brand-primary); margin-bottom:0.4rem;">
              추천 원가통계비목: 『${escapeHtml(opt.result.item)}』
            </div>
            <p class="text-sm mb-1"><strong>판단 근거:</strong> ${escapeHtml(opt.result.reason)}</p>
            <div class="callout callout-warn text-xs"><strong>실무 주의사항:</strong> ${escapeHtml(opt.result.caution)}</div>
          </div>
        `;
        return;
      }
      node = opt.next;
    }

    const stepNum = costWizardPath.length + 1;
    container.innerHTML = `
      <div class="wizard-steps">
        ${breadcrumbs.map((b, i) => `<span class="wizard-step-pill done">${i + 1}. ${escapeHtml(b)}</span>`).join("")}
        <span class="wizard-step-pill active">Step ${stepNum} 선택</span>
        ${costWizardPath.length > 0 ? `<button type="button" class="btn btn-sm btn-secondary" onclick="window.stepBackCostWizard()">← 이전</button>` : ""}
      </div>
      <div style="font-weight:800; font-size:0.95rem; margin-bottom:0.65rem;">${escapeHtml(node.question)}</div>
      <div class="wizard-choices">
        ${node.options
          .map(
            (opt, idx) => `
          <button type="button" class="wizard-choice-btn" onclick="window.chooseCostWizardOption(${idx})">
            ${escapeHtml(opt.label)}
            <span class="wizard-choice-sub">${escapeHtml(opt.sub)}</span>
          </button>
        `
          )
          .join("")}
      </div>
    `;
  }

  function renderCostFinder() {
    const target = document.getElementById("costTargetFilter").value;
    const q = document.getElementById("costSearchInput").value.trim().toLowerCase();
    const list = window.EDU_DATA.costFinderCases.filter((c) => {
      const mTarget = target === "ALL" || c.target === target;
      const mQ = !q || c.category.toLowerCase().includes(q) || c.item.toLowerCase().includes(q) || c.note.toLowerCase().includes(q);
      return mTarget && mQ;
    });

    document.getElementById("costFinderGrid").innerHTML = list
      .map(
        (c) => `
      <div class="surface-box" id="cost-card-${c.id}">
        <div class="row-between mb-1">
          <span class="badge badge-gray">대상: ${escapeHtml(c.target)}</span>
          <span class="badge badge-blue">세목: ${escapeHtml(c.code)}</span>
        </div>
        <div style="font-weight:700; font-size:0.93rem; margin-bottom:0.25rem;">${escapeHtml(c.category)}</div>
        <div style="font-size:1rem; font-weight:800; color:var(--brand-primary); margin-bottom:0.35rem;">→ 『${escapeHtml(c.item)}』</div>
        <div class="text-xs text-secondary">${escapeHtml(c.note)}</div>
      </div>
    `
      )
      .join("");
  }

  function renderCostVsCards() {
    document.getElementById("costVsGrid").innerHTML = window.EDU_DATA.costItemComparisons
      .map(
        (v) => `
      <div class="card card-compact">
        <div style="font-weight:800; font-size:0.95rem; margin-bottom:0.6rem; color:var(--brand-primary);">${escapeHtml(v.title)}</div>
        <div class="grid-2" style="gap:0.6rem;">
          <div class="callout callout-info" style="border-left-width:3px;">
            <div style="font-weight:700; font-size:0.84rem; margin-bottom:0.2rem;">${escapeHtml(v.leftName)}</div>
            <div class="text-xs text-secondary" style="white-space:pre-line;">${escapeHtml(v.leftDesc)}</div>
          </div>
          <div class="surface-box">
            <div style="font-weight:700; font-size:0.84rem; margin-bottom:0.2rem;">${escapeHtml(v.rightName)}</div>
            <div class="text-xs text-secondary" style="white-space:pre-line;">${escapeHtml(v.rightDesc)}</div>
          </div>
        </div>
      </div>
    `
      )
      .join("");
  }

  function getInstructorCalcData() {
    const gradeId = document.getElementById("instGradeSelect").value;
    const hours = Math.max(1, parseInt(document.getElementById("instHoursPerDay").value, 10) || 1);
    const count = Math.max(1, parseInt(document.getElementById("instCount").value, 10) || 1);
    const visits = Math.max(1, parseInt(document.getElementById("instVisits").value, 10) || 1);
    const rateObj = window.EDU_DATA.instructorRates.find((r) => r.id === gradeId) || window.EDU_DATA.instructorRates[3];
    const perVisitPerPerson = rateObj.isHourlyFlat ? rateObj.baseRate * hours : rateObj.baseRate + rateObj.extraRate * (hours - 1);
    const total = perVisitPerPerson * count * visits;
    const formula = `${formatNumber(perVisitPerPerson)}원×${count}명×${visits}회=${formatNumber(total)}원`;
    return { rateObj, hours, count, visits, perVisitPerPerson, total, formula };
  }

  function calculateInstructorFee() {
    const d = getInstructorCalcData();
    document.getElementById("instTargetDesc").textContent = `지급 대상: ${d.rateObj.target} (${d.rateObj.note})`;
    const breakdownText = d.rateObj.isHourlyFlat
      ? `시간당 정액 ${formatNumber(d.rateObj.baseRate)}원 × ${d.hours}시간 = 1회당 ${formatNumber(d.perVisitPerPerson)}원`
      : `기본(1시간) ${formatNumber(d.rateObj.baseRate)}원 + 초과(${d.hours - 1}시간 × ${formatNumber(d.rateObj.extraRate)}원) = 1회당 ${formatNumber(d.perVisitPerPerson)}원`;

    document.getElementById("instCalcResultBox").innerHTML = `
      <div class="text-xs text-secondary mb-1">${escapeHtml(breakdownText)}</div>
      <div style="font-size:1.25rem; font-weight:800; color:var(--brand-primary); margin-bottom:0.35rem;">
        총 강사수당: ${formatNumber(d.total)}원 <span class="badge badge-blue">운영수당</span>
      </div>
      <div class="font-mono text-xs" style="background:var(--bg-secondary); padding:0.4rem 0.6rem; border-radius:6px; border:1px solid var(--border-color);">
        에듀파인 산출식: <strong>${escapeHtml(d.formula)}</strong>
      </div>
    `;
  }

  window.copyInstructorFormula = function () {
    const d = getInstructorCalcData();
    window.copyText(d.formula, `산출식(${d.formula})이 복사되었습니다.`);
  };

  window.addInstructorToBudget = function () {
    const d = getInstructorCalcData();
    preBudgetRows.push({
      id: Date.now(),
      bimok: "운영수당",
      desc: `${d.rateObj.name.split("(")[0].trim()} 강사 수당 (${d.hours}시간)`,
      formula: d.formula,
      amount: d.total
    });
    renderPreBudgetTable();
    window.showToast("성립전 예산 세출표에 강사수당이 추가되었습니다.");
  };

  window.loadSamplePreBudget = function () {
    document.getElementById("preProjectName").value = "2026년 공생의 길(물길, 숲길) 프로젝트 운영";
    document.getElementById("preTotalGrant").value = "1200000";
    preBudgetRows = [
      { id: 1, bimok: "교육운영비(자료)", desc: "공생의길 프로젝트 운영(교육자료)", formula: "150,000원×1식×3회=450,000원", amount: 450000 },
      { id: 2, bimok: "교육운영비(간식)", desc: "공생의길 프로젝트 간식 구매", formula: "50,000원×1식×6회=300,000원", amount: 300000 },
      { id: 3, bimok: "운영수당", desc: "공생의길 프로젝트 강사 수당", formula: "150,000원×1명×3회=450,000원", amount: 450000 }
    ];
    renderPreBudgetTable();
    window.showToast("공생의 길 프로젝트 예시가 로드되었습니다.");
  };

  window.addCustomPreBudgetRow = function () {
    const bimok = document.getElementById("newPreBimok").value;
    const desc = document.getElementById("newPreDesc").value.trim() || "교육활동 운영";
    const formula = document.getElementById("newPreFormula").value.trim() || "100,000원×1식=100,000원";
    const amount = parseInt(document.getElementById("newPreAmount").value, 10) || 0;
    if (amount <= 0) return window.showToast("올바른 요구액(원)을 입력해 주세요.");
    preBudgetRows.push({ id: Date.now(), bimok, desc, formula, amount });
    document.getElementById("newPreDesc").value = "";
    document.getElementById("newPreFormula").value = "";
    document.getElementById("newPreAmount").value = "";
    renderPreBudgetTable();
  };

  window.removePreBudgetRow = function (id) {
    preBudgetRows = preBudgetRows.filter((r) => r.id !== id);
    renderPreBudgetTable();
  };

  function renderPreBudgetTable() {
    const grant = parseInt(document.getElementById("preTotalGrant").value, 10) || 0;
    const tbody = document.getElementById("preBudgetTableBody");
    let totalExp = 0;
    let snackExp = 0;

    tbody.innerHTML =
      preBudgetRows
        .map((r) => {
          totalExp += r.amount;
          if (r.bimok.includes("간식") || r.desc.includes("간식")) snackExp += r.amount;
          return `
          <tr>
            <td><span class="badge badge-blue">${escapeHtml(r.bimok.replace(/\(.*\)/, ""))}</span></td>
            <td>${escapeHtml(r.desc)}</td>
            <td class="font-mono text-xs">${escapeHtml(r.formula)}</td>
            <td style="font-weight:700; text-align:right;">${formatNumber(r.amount)}</td>
            <td><button type="button" class="btn btn-sm btn-secondary" onclick="window.removePreBudgetRow(${r.id})">✕</button></td>
          </tr>
        `;
        })
        .join("") +
      `<tr style="background:var(--bg-accent); font-weight:800;"><td colspan="3" style="text-align:center;">합 계</td><td style="text-align:right; color:var(--brand-primary);">${formatNumber(totalExp)}원</td><td></td></tr>`;

    const snackRatio = grant > 0 ? ((snackExp / grant) * 100).toFixed(1) : "0.0";
    const isSnackOk = parseFloat(snackRatio) < 30.0;
    const diff = grant - totalExp;

    document.getElementById("preBudgetStatusPanel").innerHTML = `
      <div class="row-between mb-1 text-sm">
        <div><strong>교부금 잔액:</strong> <span class="badge ${diff === 0 ? "badge-green" : "badge-red"}">${diff === 0 ? "세입·세출 일치 (0원)" : `차액 ${formatNumber(diff)}원`}</span></div>
        <div><strong>간식비 비율(30% 미만):</strong> <span class="badge ${isSnackOk ? "badge-green" : "badge-red"}">${snackRatio}% (${formatNumber(snackExp)}원) ${isSnackOk ? "통과" : "초과 위반"}</span></div>
      </div>
      <div class="progress-track"><div class="progress-fill ${isSnackOk ? "success" : "danger"}" style="width:${Math.min(100, parseFloat(snackRatio))}%;"></div></div>
    `;
  }

  window.copyPreBudgetDoc = function () {
    const proj = document.getElementById("preProjectName").value.trim();
    const grant = parseInt(document.getElementById("preTotalGrant").value, 10) || 0;
    const rowsText = preBudgetRows.map((r, i) => `    ${i + 1}) [${r.bimok.replace(/\(.*\)/, "")}] ${r.desc}: ${r.formula}`).join("\n");
    const text = `제목: ${proj} 성립전 예산 요구\n\n1. 관련: 교육지원과-6788(2026. 4. 13.)\n2. ${proj} 운영비가 교부되었으나, 추가경정예산에 편성하기에는 시간적 여유가 없어 다음과 같이 성립전 예산편성을 요구합니다.\n  가. 사업명: ${proj}\n  나. 교부금액: ${formatNumber(grant)}원\n  다. 예산편성 요구 내용\n    [세입예산] 교육비특별회계전입금(목적사업비전입금): ${formatNumber(grant)}원\n    [세출예산]\n${rowsText}\n    - 합계: ${formatNumber(grant)}원.  끝.`;
    window.copyText(text, "성립전 예산 요구 기안문이 복사되었습니다.");
  };

  // K-에듀파인 품의 엑셀업로드용 CSV 생성기
  window.addPumuiItemRow = function () {
    pumuiItems.push({ id: Date.now(), name: "", spec: "", unit: "개", qty: 1, price: 0 });
    renderPumuiCsvTable();
  };

  window.removePumuiItemRow = function (id) {
    pumuiItems = pumuiItems.filter((i) => i.id !== id);
    renderPumuiCsvTable();
  };

  window.updatePumuiCell = function (id, field, val) {
    const item = pumuiItems.find((i) => i.id === id);
    if (!item) return;
    item[field] = field === "qty" || field === "price" ? Math.max(0, parseInt(val, 10) || 0) : val;
    renderPumuiCsvTable();
  };

  function renderPumuiCsvTable() {
    const tbody = document.getElementById("pumuiCsvTableBody");
    if (!tbody) return;
    let grandTotal = 0;
    tbody.innerHTML = pumuiItems
      .map((item) => {
        const sub = item.qty * item.price;
        grandTotal += sub;
        return `
        <tr>
          <td><input type="text" class="form-input" style="padding:0.4rem 0.55rem;" value="${escapeHtml(item.name)}" placeholder="품명" oninput="window.updatePumuiCell(${item.id}, 'name', this.value)" /></td>
          <td><input type="text" class="form-input" style="padding:0.4rem 0.55rem;" value="${escapeHtml(item.spec)}" placeholder="규격" oninput="window.updatePumuiCell(${item.id}, 'spec', this.value)" /></td>
          <td style="width:85px;"><input type="text" class="form-input" style="padding:0.4rem 0.55rem;" value="${escapeHtml(item.unit)}" oninput="window.updatePumuiCell(${item.id}, 'unit', this.value)" /></td>
          <td style="width:90px;"><input type="number" class="form-input" style="padding:0.4rem 0.55rem;" value="${item.qty}" min="1" oninput="window.updatePumuiCell(${item.id}, 'qty', this.value)" /></td>
          <td style="width:120px;"><input type="number" class="form-input" style="padding:0.4rem 0.55rem;" value="${item.price}" step="100" oninput="window.updatePumuiCell(${item.id}, 'price', this.value)" /></td>
          <td style="font-weight:700; text-align:right; white-space:nowrap;">${formatNumber(sub)}원</td>
          <td><button type="button" class="btn btn-sm btn-secondary" onclick="window.removePumuiItemRow(${item.id})">✕</button></td>
        </tr>
      `;
      })
      .join("");
    document.getElementById("pumuiCsvTotalDisplay").textContent = `총 품의 예상액: ${formatNumber(grandTotal)}원`;
  }

  window.exportPumuiCsv = function () {
    const header = ["품명", "규격", "단위", "수량", "예상단가", "예상금액"];
    const rows = pumuiItems.map((i) => [i.name, i.spec, i.unit, i.qty, i.price, i.qty * i.price]);
    const csvBody = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    downloadFile("K에듀파인_품의품목_업로드양식.csv", "\uFEFF" + csvBody, "text/csv;charset=utf-8;");
    window.showToast("K-에듀파인 품의용 CSV 파일(한글 UTF-8 BOM)이 다운로드되었습니다.");
  };

  // 학급운영비 개산급 정산표 계산기 (+5일 마감일 계산 & CSV/A4 인쇄)
  window.addSettlementRow = function () {
    appState.settlement.rows.push({
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      vendor: "",
      proof: "전산자료",
      desc: "",
      amount: 0
    });
    saveState();
    renderSettlementTable();
  };

  window.removeSettlementRow = function (id) {
    appState.settlement.rows = appState.settlement.rows.filter((r) => r.id !== id);
    saveState();
    renderSettlementTable();
  };

  window.updateSettlementCell = function (id, field, val) {
    const row = appState.settlement.rows.find((r) => r.id === id);
    if (!row) return;
    row[field] = field === "amount" ? Math.max(0, parseInt(val, 10) || 0) : val;
    saveState();
    renderSettlementTable();
  };

  function renderSettlementTable() {
    const received = appState.settlement.received || 0;
    const rows = appState.settlement.rows || [];
    const spent = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const remain = received - spent;

    let deadlineHtml = `<span class="badge badge-gray">집행 완료일 미입력</span>`;
    if (appState.settlement.endDate) {
      const end = new Date(appState.settlement.endDate + "T00:00:00");
      const deadline = new Date(end.getTime() + 5 * 24 * 60 * 60 * 1000);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      const dStr = deadline.toISOString().slice(0, 10);
      const dTag = diffDays < 0 ? `마감 경과 (D+${Math.abs(diffDays)})` : diffDays === 0 ? "오늘 마감 (D-Day)" : `마감 D-${diffDays}`;
      const cls = diffDays < 0 ? "badge-red" : diffDays <= 2 ? "badge-amber" : "badge-green";
      deadlineHtml = `<span class="badge ${cls}">정산 기한(+5일): ${dStr} (${dTag})</span>`;
    }

    const teacher = document.getElementById("settleTeacher")?.value || appState.profile.teacherName;
    document.getElementById("settleSummaryBanner").innerHTML = `
      <div class="row-between">
        <div>
          <strong>${escapeHtml(appState.profile.schoolName)} ${escapeHtml(appState.settlement.className)} (${escapeHtml(teacher)})</strong><br/>
          <span class="text-sm">수령액(A): <strong>${formatNumber(received)}원</strong> · 집행액(B): <strong>${formatNumber(spent)}원</strong> · 잔액(A-B): <strong style="color:${remain < 0 ? "var(--danger)" : "var(--brand-primary)"};">${formatNumber(remain)}원</strong></span>
        </div>
        <div>${deadlineHtml}</div>
      </div>
    `;

    document.getElementById("settlementTableBody").innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td style="width:140px;"><input type="date" class="form-input" style="padding:0.38rem 0.5rem;" value="${escapeHtml(r.date)}" oninput="window.updateSettlementCell(${r.id}, 'date', this.value)" /></td>
        <td><input type="text" class="form-input" style="padding:0.38rem 0.5rem;" value="${escapeHtml(r.vendor)}" placeholder="사용업체명" oninput="window.updateSettlementCell(${r.id}, 'vendor', this.value)" /></td>
        <td style="width:120px;">
          <select class="form-select" style="padding:0.38rem 0.5rem;" onchange="window.updateSettlementCell(${r.id}, 'proof', this.value)">
            <option value="전산자료" ${r.proof === "전산자료" ? "selected" : ""}>전산자료(카드)</option>
            <option value="현금영수증" ${r.proof === "현금영수증" ? "selected" : ""}>현금영수증</option>
            <option value="간이영수증" ${r.proof === "간이영수증" ? "selected" : ""}>기타 영수증</option>
          </select>
        </td>
        <td><input type="text" class="form-input" style="padding:0.38rem 0.5rem;" value="${escapeHtml(r.desc)}" placeholder="사용내역" oninput="window.updateSettlementCell(${r.id}, 'desc', this.value)" /></td>
        <td style="width:125px;"><input type="number" class="form-input" style="padding:0.38rem 0.5rem; text-align:right;" value="${r.amount}" step="100" oninput="window.updateSettlementCell(${r.id}, 'amount', this.value)" /></td>
        <td class="no-print"><button type="button" class="btn btn-sm btn-secondary" onclick="window.removeSettlementRow(${r.id})">✕</button></td>
      </tr>
    `
      )
      .join("");
  }

  window.exportSettlementCsv = function () {
    const header = ["사용일자", "사용업체명", "증빙구분", "사용내역", "사용금액"];
    const rows = (appState.settlement.rows || []).map((r) => [r.date, r.vendor, r.proof, r.desc, r.amount]);
    const csvBody = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    downloadFile(`학급운영비_개산급정산서_${appState.settlement.className}.csv`, "\uFEFF" + csvBody, "text/csv;charset=utf-8;");
    window.showToast("개산급 정산내역 CSV 파일이 다운로드되었습니다.");
  };

  function calculateClassOperation() {
    const classes = Math.max(1, parseInt(document.getElementById("classOpClasses").value, 10) || 1);
    const students = Math.max(1, parseInt(document.getElementById("classOpStudents").value, 10) || 1);
    const baseAmt = classes * 500000;
    const studentAmt = students * 14000;
    document.getElementById("classOpResultBox").innerHTML = `
      <div style="font-size:1.12rem; font-weight:800; color:var(--brand-primary); margin-bottom:0.3rem;">최저 편성 기준액: ${formatNumber(baseAmt + studentAmt)}원 이상</div>
      <div class="text-xs text-secondary">학급당(${formatNumber(baseAmt)}원) + 학생당(14,000원 × ${students}명 = ${formatNumber(studentAmt)}원) · 개산급 집행 완료 후 <strong>5일 이내</strong> 정산 제출</div>
    `;
  }

  function calculatePromoLimit() {
    const people = Math.max(1, parseInt(document.getElementById("promoPeople").value, 10) || 1);
    const total = Math.max(0, parseInt(document.getElementById("promoTotal").value, 10) || 0);
    const maxLimit = people * 40000;
    const perPerson = Math.round(total / people);
    const isOk = total <= maxLimit;
    document.getElementById("promoResultBox").innerHTML = `
      <div class="row-between mb-1">
        <span style="font-weight:800;">1인당 평균: ${formatNumber(perPerson)}원</span>
        <span class="badge ${isOk ? "badge-green" : "badge-red"}">${isOk ? "40,000원 한도 준수" : `한도 초과 (최대 ${formatNumber(maxLimit)}원)`}</span>
      </div>
      <div class="text-xs text-secondary">간담회 1인당 40,000원 이내 (50만 원 이상 시 상대방 소속·성명 기재) · 경조사비는 <strong>기관운영업무추진비</strong>에서만 집행(축·조의금 5만 / 화환 10만)</div>
    `;
  }

  // ==========================================
  // 6. MODULE 4: 8대 보직 한해살이 (복수 겸임 + 월별 뷰 + 커스텀 업무 + .ics) & AI PII 가드
  // ==========================================
  function initRoleModule() {
    const customDeptSel = document.getElementById("customTaskDept");
    customDeptSel.innerHTML = window.EDU_DATA.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
    document.getElementById("customTaskMonth").value = String(selectedMonth);

    renderMonthFilterBar();
    renderDepartments();

    document.getElementById("aiTaskSelect").addEventListener("change", generateAiPrompt);
    document.getElementById("aiKeywordsInput").addEventListener("input", generateAiPrompt);
    generateAiPrompt();
  }

  window.setRoleViewMode = function (mode) {
    roleViewMode = mode;
    document.getElementById("roleViewDeptBtn").className = `btn btn-sm ${mode === "dept" ? "btn-primary" : "btn-secondary"}`;
    document.getElementById("roleViewMonthBtn").className = `btn btn-sm ${mode === "month" ? "btn-primary" : "btn-secondary"}`;
    document.getElementById("monthFilterWrap").style.display = mode === "month" ? "block" : "none";
    renderDepartments();
  };

  window.selectMonthFilter = function (month) {
    selectedMonth = month;
    renderMonthFilterBar();
    renderDepartments();
  };

  function renderMonthFilterBar() {
    const months = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
    const bar = document.getElementById("monthFilterBar");
    if (!bar) return;
    bar.innerHTML = months
      .map((m) => `<button type="button" class="month-chip ${selectedMonth === m ? "active" : ""}" onclick="window.selectMonthFilter(${m})">${m}월</button>`)
      .join("");
  }

  window.selectOrToggleDepartment = function (deptId) {
    if (roleViewMode === "month") {
      const idx = appState.selectedDepts.indexOf(deptId);
      if (idx >= 0) {
        if (appState.selectedDepts.length > 1) appState.selectedDepts.splice(idx, 1);
      } else {
        appState.selectedDepts.push(deptId);
      }
    } else {
      currentDeptId = deptId;
      if (!appState.selectedDepts.includes(deptId)) appState.selectedDepts.push(deptId);
    }
    saveState();
    renderDepartments();
  };

  window.toggleDeptTask = function (taskId) {
    if (!appState.checkedTasks) appState.checkedTasks = {};
    appState.checkedTasks[taskId] = !appState.checkedTasks[taskId];
    saveState();
    renderDepartments();
  };

  window.addCustomRoleTask = function () {
    const deptId = document.getElementById("customTaskDept").value;
    const month = parseInt(document.getElementById("customTaskMonth").value, 10) || 3;
    const title = document.getElementById("customTaskTitle").value.trim();
    if (!title) return window.showToast("추가할 업무 내용을 입력해 주세요.");

    appState.customTasks.push({
      id: "custom-" + Date.now(),
      deptId,
      month,
      title,
      detail: `${month}월 우리 학교 특색·사용자 추가 업무`
    });
    if (!appState.selectedDepts.includes(deptId)) appState.selectedDepts.push(deptId);
    document.getElementById("customTaskTitle").value = "";
    saveState();
    renderDepartments();
    window.showToast("나만의 학교 업무가 체크리스트에 추가되었습니다.");
  };

  window.deleteCustomRoleTask = function (taskId, e) {
    if (e) e.stopPropagation();
    appState.customTasks = appState.customTasks.filter((t) => t.id !== taskId);
    delete appState.checkedTasks[taskId];
    saveState();
    renderDepartments();
  };

  function getDeptTaskStats(dept) {
    let total = 0;
    let done = 0;
    dept.periods.forEach((p) =>
      p.tasks.forEach((t) => {
        total++;
        if (appState.checkedTasks[t.id]) done++;
      })
    );
    (appState.customTasks || []).forEach((ct) => {
      if (ct.deptId === dept.id) {
        total++;
        if (appState.checkedTasks[ct.id]) done++;
      }
    });
    return { total, done };
  }

  function renderDepartments() {
    const bar = document.getElementById("deptSelectorBar");
    bar.innerHTML = window.EDU_DATA.departments
      .map((d) => {
        const { total, done } = getDeptTaskStats(d);
        const isSelected = roleViewMode === "month" ? appState.selectedDepts.includes(d.id) : d.id === currentDeptId;
        return `
        <button type="button" class="btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}" onclick="window.selectOrToggleDepartment('${d.id}')">
          <span>${roleViewMode === "month" ? (isSelected ? "☑ " : "☐ ") : ""}${escapeHtml(d.name)}</span>
          <span class="badge ${isSelected ? "badge-gray" : "badge-blue"}">${done}/${total}</span>
        </button>
      `;
      })
      .join("");

    const detail = document.getElementById("deptDetailContainer");

    if (roleViewMode === "month") {
      // 월별 통합 타임라인 뷰 (겸임 부서 포함)
      const myDepts = window.EDU_DATA.departments.filter((d) => appState.selectedDepts.includes(d.id));
      const monthTasks = [];
      myDepts.forEach((d) => {
        d.periods.forEach((p) =>
          p.tasks.forEach((t) => {
            const months = (window.EDU_DATA.taskMonthsMap && window.EDU_DATA.taskMonthsMap[t.id]) || [];
            if (months.includes(selectedMonth)) {
              monthTasks.push({ ...t, deptName: d.name, period: p.period, isCustom: false });
            }
          })
        );
        (appState.customTasks || []).forEach((ct) => {
          if (ct.deptId === d.id && ct.month === selectedMonth) {
            monthTasks.push({ ...ct, deptName: d.name, period: `${selectedMonth}월 추가 업무`, isCustom: true });
          }
        });
      });

      const doneCnt = monthTasks.filter((t) => appState.checkedTasks[t.id]).length;
      const pct = monthTasks.length > 0 ? Math.round((doneCnt / monthTasks.length) * 100) : 0;

      detail.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${selectedMonth}월 이달의 필수 보직 업무 (${myDepts.map((d) => d.name.split(" ")[0]).join(" · ")})</div>
              <div class="card-subtitle">선택된 ${myDepts.length}개 담당 부서의 ${selectedMonth}월 추진 과업을 한눈에 관리합니다.</div>
            </div>
            <div style="min-width:180px; text-align:right;">
              <div class="text-xs" style="font-weight:700; margin-bottom:0.25rem;">${selectedMonth}월 달성률: ${pct}% (${doneCnt}/${monthTasks.length})</div>
              <div class="progress-track"><div class="progress-fill success" style="width:${pct}%;"></div></div>
            </div>
          </div>
          ${
            monthTasks.length === 0
              ? `<div class="surface-box text-muted" style="text-align:center; padding:1.5rem;">선택한 부서에 ${selectedMonth}월 예정된 기본 과업이 없습니다. 상단에서 다른 월을 선택하거나 나만의 업무를 추가해 보세요.</div>`
              : `<div class="grid-2">${monthTasks
                  .map((t) => {
                    const checked = Boolean(appState.checkedTasks[t.id]);
                    return `
                    <label class="check-item ${checked ? "checked" : ""}" id="role-task-${t.id}">
                      <input type="checkbox" ${checked ? "checked" : ""} onchange="window.toggleDeptTask('${t.id}')" />
                      <div style="flex:1;">
                        <div class="row-between">
                          <span class="badge badge-blue">${escapeHtml(t.deptName)}</span>
                          ${t.isCustom ? `<button type="button" class="btn btn-sm btn-secondary" onclick="window.deleteCustomRoleTask('${t.id}', event)">삭제</button>` : `<span class="text-xs text-muted">${escapeHtml(t.period)}</span>`}
                        </div>
                        <div class="check-title" style="font-weight:700; font-size:0.89rem; margin-top:0.25rem;">${escapeHtml(t.title)}</div>
                        <div class="text-xs text-secondary">${escapeHtml(t.detail)}</div>
                      </div>
                    </label>
                  `;
                  })
                  .join("")}</div>`
          }
        </div>
      `;
      return;
    }

    // 부서별 상세 뷰
    const dept = window.EDU_DATA.departments.find((d) => d.id === currentDeptId) || window.EDU_DATA.departments[0];
    const { total: deptTotal, done: deptDone } = getDeptTaskStats(dept);
    const deptPct = deptTotal > 0 ? Math.round((deptDone / deptTotal) * 100) : 0;
    const myCustomForDept = (appState.customTasks || []).filter((ct) => ct.deptId === dept.id);

    detail.innerHTML = `
      <div class="card" id="dept-panel-${dept.id}">
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(dept.name)} 연간 한해살이 <span class="badge badge-blue">${escapeHtml(dept.badge)}</span></div>
            <div class="card-subtitle">${escapeHtml(dept.desc)}</div>
          </div>
          <div style="min-width:180px; text-align:right;">
            <div class="text-xs" style="font-weight:700; margin-bottom:0.25rem;">부서 달성률: ${deptPct}% (${deptDone}/${deptTotal})</div>
            <div class="progress-track"><div class="progress-fill success" style="width:${deptPct}%;"></div></div>
          </div>
        </div>

        <div class="grid-3">
          ${dept.periods
            .map(
              (p) => `
            <div class="surface-box">
              <div style="font-weight:800; font-size:0.94rem; margin-bottom:0.7rem; color:var(--brand-primary);">${escapeHtml(p.period)}</div>
              ${p.tasks
                .map((t) => {
                  const isChecked = Boolean(appState.checkedTasks[t.id]);
                  return `
                  <label class="check-item ${isChecked ? "checked" : ""}" id="role-task-${t.id}">
                    <input type="checkbox" ${isChecked ? "checked" : ""} onchange="window.toggleDeptTask('${t.id}')" />
                    <div>
                      <div class="check-title" style="font-weight:700; font-size:0.86rem;">${escapeHtml(t.title)}</div>
                      <div class="text-xs text-secondary" style="margin-top:0.15rem;">${escapeHtml(t.detail)}</div>
                    </div>
                  </label>
                `;
                })
                .join("")}
            </div>
          `
            )
            .join("")}
        </div>

        ${
          myCustomForDept.length > 0
            ? `<div class="surface-box mt-2">
                <div style="font-weight:800; font-size:0.9rem; margin-bottom:0.55rem; color:var(--purple);">우리 학교 추가 업무 (${myCustomForDept.length}건)</div>
                <div class="grid-2">
                  ${myCustomForDept
                    .map((ct) => {
                      const isChecked = Boolean(appState.checkedTasks[ct.id]);
                      return `
                      <label class="check-item ${isChecked ? "checked" : ""}">
                        <input type="checkbox" ${isChecked ? "checked" : ""} onchange="window.toggleDeptTask('${ct.id}')" />
                        <div style="flex:1;">
                          <div class="row-between">
                            <span class="badge badge-purple">${ct.month}월</span>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="window.deleteCustomRoleTask('${ct.id}', event)">삭제</button>
                          </div>
                          <div class="check-title" style="font-weight:700; font-size:0.86rem; margin-top:0.2rem;">${escapeHtml(ct.title)}</div>
                        </div>
                      </label>
                    `;
                    })
                    .join("")}
                </div>
              </div>`
            : ""
        }
      </div>
    `;
  }

  // .ics 캘린더 파일 내보내기
  window.exportRoleIcs = function () {
    const year = 2026;
    const myDepts = window.EDU_DATA.departments.filter((d) => appState.selectedDepts.includes(d.id));
    const events = [];
    myDepts.forEach((d) => {
      d.periods.forEach((p) =>
        p.tasks.forEach((t) => {
          if (appState.checkedTasks[t.id]) return;
          const months = (window.EDU_DATA.taskMonthsMap && window.EDU_DATA.taskMonthsMap[t.id]) || [3];
          const m = months[0];
          const y = m <= 2 ? year + 1 : year;
          const dt = `${y}${String(m).padStart(2, "0")}02`;
          events.push(
            `BEGIN:VEVENT\r\nUID:${t.id}@ys2027\r\nDTSTART;VALUE=DATE:${dt}\r\nSUMMARY:[${d.name.split(" ")[0]}] ${t.title}\r\nDESCRIPTION:${t.detail}\r\nEND:VEVENT`
          );
        })
      );
    });

    if (events.length === 0) return window.showToast("내보낼 미완료 업무가 없습니다.");
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//YS2027 EduPortal//KR\r\n${events.join("\r\n")}\r\nEND:VCALENDAR`;
    downloadFile("보직교사_연간업무일정.ics", ics, "text/calendar;charset=utf-8");
    window.showToast(`미완료 보직 업무 ${events.length}건이 캘린더(.ics) 파일로 저장되었습니다.`);
  };

  // JneGPT 안전 프롬프트 + PII 개인정보 실시간 감지기
  function detectPii(text) {
    const hits = [];
    if (/\b\d{6}-?[1-4]\d{6}\b/.test(text)) hits.push("주민등록번호 패턴");
    if (/01[016789]-?\d{3,4}-?\d{4}/.test(text)) hits.push("휴대폰 번호");
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) hits.push("이메일 주소");
    return hits;
  }

  window.maskAiPiiInput = function () {
    const el = document.getElementById("aiKeywordsInput");
    el.value = el.value
      .replace(/\b\d{6}-?[1-4]\d{6}\b/g, "[주민번호 보호]")
      .replace(/01[016789]-?\d{3,4}-?\d{4}/g, "[연락처 보호]")
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[이메일 보호]");
    generateAiPrompt();
    window.showToast("민감정보가 안전하게 비식별(마스킹) 처리되었습니다.");
  };

  function generateAiPrompt() {
    const task = document.getElementById("aiTaskSelect").value;
    const kw = document.getElementById("aiKeywordsInput").value.trim() || "초등학교 생태환경 교육활동";
    const piiHits = detectPii(kw);
    const alertBox = document.getElementById("aiPiiAlertBox");

    if (piiHits.length > 0) {
      alertBox.style.display = "block";
      alertBox.innerHTML = `
        <div class="callout callout-danger row-between text-xs">
          <span><strong>개인정보 감지 경고!</strong> (${escapeHtml(piiHits.join(", "))}) — JneGPT에 민감정보를 입력하지 마세요.</span>
          <button type="button" class="btn btn-sm btn-danger" onclick="window.maskAiPiiInput()">자동 마스킹</button>
        </div>
      `;
    } else {
      alertBox.style.display = "none";
    }

    const school = appState.profile.schoolName;
    let prompt = "";
    if (task === "plan") {
      prompt = `[역할] 당신은 전라남도교육청 ${school} 교무행정 및 교육과정 전문가입니다.\n[주제] ${kw}\n[요청사항]\n위 주제로 누구든 바로 실행할 수 있는 '학교 업무 추진계획서' 초안을 작성해 주세요.\n공문서 어문규범(날짜 마침표 뒤 공백, 24시간제, 쉬운 공공언어)과 7대 표준 목차를 준수해 주세요.\n1. 목적 및 필요성 (관련 근거)\n2. 추진 방침\n3. 세부 추진 계획 (일시·장소·대상·시간대별 프로그램 표)\n4. 업무 분장표\n5. 안전 관리 계획 및 유의사항 (※ 우천·악천후 시 대체 계획 Plan B 필수)\n6. 예산 소요 계획 (원가통계비목 및 '단가 × 수량 × 횟수 = 금액' 산출식)\n7. 기대 효과`;
    } else if (task === "letter") {
      prompt = `[역할] 당신은 ${school} 학부모님과 따뜻하고 명확하게 소통하는 담당 교사입니다.\n[주제] ${kw}\n[요청사항]\n국립국어원 '공공언어 바로 쓰기' 원칙에 따라 어려운 한자어·일본어 투를 피하고 쉽고 정중한 가정통신문 초안을 작성해 주세요. (목적, 일시 '2026. 5. 20.(수)' 형식, 장소, 준비물, 안전 유의사항, 신청 회신서 포함)`;
    } else if (task === "press") {
      prompt = `[역할] 당신은 전라남도교육청 학교 홍보·보도자료 전문 담당자입니다.\n[주제] ${kw}\n[요청사항]\n지역 언론사 배포용 보도자료 초안을 작성해 주세요.\n- 헤드라인·부제목 후보 3개 제시\n- 육하원칙 기반 간결한 문장(한 문장 2~3줄 이내) 및 학생·학교장 인터뷰 인용문 포함`;
    } else if (task === "reply") {
      prompt = `[역할] 당신은 경청과 공감을 바탕으로 학부모와 소통하며 교사를 보호하는 보직교사입니다.\n[상황/키워드] ${kw}\n[요청사항]\n① 공감·경청 → ② 학교 규정·사실관계 설명 → ③ 향후 지원 및 협조 요청 순으로 전화 상담용·문자 발송용 답변 초안을 각 1부 작성해 주세요. (개인식별정보는 [학생명]으로 비식별 표기)`;
    } else if (task === "compare") {
      prompt = `[NotebookLM 소스 분석 전용 프롬프트]\n업로드한 구버전 및 2026학년도 신버전 지침 문서만 근거로 분석해 주세요. (외부 추측 금지)\n1. 구버전 대비 신설·개정·삭제 항목을 '신·구 대조표(개정 전 / 개정 후 / 학교 현장 조치)'로 정리\n2. '${kw}'와 관련해 올해 우리 학교 규정에 반영할 필수 체크리스트 5가지 도출`;
    }
    document.getElementById("aiPromptOutput").value = prompt;
  }

  window.copyAiPrompt = function () {
    const kw = document.getElementById("aiKeywordsInput").value;
    if (detectPii(kw).length > 0) {
      window.showToast("개인정보가 감지되었습니다! 먼저 [자동 마스킹] 버튼을 눌러 제거해 주세요.");
      return;
    }
    window.copyText(document.getElementById("aiPromptOutput").value, "안전 프롬프트가 복사되었습니다.");
  };

  // ==========================================
  // 7. MODULE 5: 연수 실습 워크북 (3종)
  // ==========================================
  function initLabModule() {
    ["lab3Title", "lab3Purpose", "lab3Schedule", "lab3Budget", "lab3Safety"].forEach((id) => {
      document.getElementById(id).addEventListener("input", renderLab3Preview);
    });
    renderLab3Preview();
  }

  window.fillLab1Answer = function () {
    document.getElementById("lab1Bimok1").value = "교육운영비";
    document.getElementById("lab1Formula1").value = "150,000원×1식×3회=450,000원";
    document.getElementById("lab1Amt1").value = "450000";
    document.getElementById("lab1Bimok2").value = "교육운영비";
    document.getElementById("lab1Formula2").value = "50,000원×1식×6회=300,000원";
    document.getElementById("lab1Amt2").value = "300000";
    document.getElementById("lab1Bimok3").value = "운영수당";
    document.getElementById("lab1Formula3").value = "150,000원×1명×3회=450,000원";
    document.getElementById("lab1Amt3").value = "450000";
    document.getElementById("lab1RevBimok").value = "목적사업비전입금";
    window.gradeLab1();
  };

  window.gradeLab1 = function () {
    const b1 = document.getElementById("lab1Bimok1").value;
    const a1 = parseInt(document.getElementById("lab1Amt1").value, 10) || 0;
    const b2 = document.getElementById("lab1Bimok2").value;
    const a2 = parseInt(document.getElementById("lab1Amt2").value, 10) || 0;
    const b3 = document.getElementById("lab1Bimok3").value;
    const a3 = parseInt(document.getElementById("lab1Amt3").value, 10) || 0;
    const revB = document.getElementById("lab1RevBimok").value;

    const checks = [
      { pass: b1 === "교육운영비" && a1 > 0, title: "조건 1) 학생용 교육 자료 구입 원가통계비목", detail: b1 === "교육운영비" ? "정답! 교육용 재료 구입은 '교육운영비'입니다." : "오답: 학생 교육용 자료 구입은 '교육운영비'를 선택해야 합니다." },
      { pass: b2 === "교육운영비" && a2 > 0 && a2 < 360000, title: "조건 2) 학생용 간식 구입 비목 및 30% 미만 의무", detail: b2 === "교육운영비" && a2 > 0 && a2 < 360000 ? `정답! '교육운영비'이며 ${formatNumber(a2)}원(${((a2 / 1200000) * 100).toFixed(1)}%)으로 30% 미만 충족!` : "오답: 학생 간식비는 '교육운영비'이며 360,000원 미만(예: 300,000원)으로 편성해야 합니다." },
      { pass: b3 === "운영수당" && a3 === 450000, title: "조건 3) 외부 강사 편성 (일반강사 Ⅱ 1명, 2시간 × 3회)", detail: b3 === "운영수당" && a3 === 450000 ? "정답! '운영수당'이며 일반강사Ⅱ 150,000원(9만+6만) × 1명 × 3회 = 450,000원입니다." : "오답: 비목은 '운영수당', 요구액은 150,000원 × 3회 = 450,000원이어야 합니다." },
      { pass: a1 + a2 + a3 === 1200000 && revB === "목적사업비전입금", title: "조건 4) 총 교부금액(1,200,000원) 일치 및 세입 비목", detail: a1 + a2 + a3 === 1200000 ? "정답! 세입·세출 합계(1,200,000원)가 완벽히 일치합니다." : `현재 세출 합계는 ${formatNumber(a1 + a2 + a3)}원입니다. 1,200,000원과 일치해야 합니다.` }
    ];

    const allPass = checks.every((c) => c.pass);
    if (allPass) {
      appState.labsCompleted.lab1 = true;
      saveState();
      window.showToast("실습 1(성립전 예산 수립)을 완벽하게 통과하셨습니다!");
    }
    renderLabFeedback("lab1FeedbackBox", allPass, checks, "실습 1 완벽 통과 (4/4)", "일부 조건 재검토 필요");
  };

  window.fillLab2Answer = function () {
    const school = appState.profile.schoolName;
    document.getElementById("lab2Title").value = "2026학년도 1학기 현장체험학습 사전답사 실시 계획";
    document.getElementById("lab2Body").value = `1. 관련: 2026년 현장체험학습 매뉴얼 및 ${school}-4808(2026. 5. 8.)\n2. 2026학년도 1학기 현장체험학습의 안전한 운영을 위하여 다음과 같이 사전답사를 실시하고자 합니다.\n  가. 일시: 2026. 5. 20.(수) 14:00~17:00\n  나. 장소: 국립광주과학관 및 이동 경로 일원\n  다. 대상: 3학년 부장 및 인솔교사 4명\n  라. 주요 내용: 체험시설 안전 점검, 차량 승하차 구역 및 우천 시 대체 동선 확인\n  마. 예산 계획: 공무원 여비 및 입장료(교육운영비·여비) 80,000원\n\n붙임  1. 사전답사 계획 1부.\n      2. 사전답사 체크리스트 1부.  끝.`;
    window.gradeLab2();
  };

  window.gradeLab2 = function () {
    const title = document.getElementById("lab2Title").value.trim();
    const body = document.getElementById("lab2Body").value.trim();
    const checks = [
      { pass: title.length >= 5 && !/(에 관한 건|에 대하여)$/.test(title), title: "1) 제목 명확성 ('~에 관한 건' 지양)", detail: "핵심 내용이 명확하며 불필요한 수식어가 없습니다." },
      { pass: body.includes("매뉴얼") || body.includes("관련"), title: "2) 2026년 현장체험학습 매뉴얼 근거 명시", detail: "본문에 관련 근거가 포함되었습니다." },
      { pass: (body.includes("예산") || body.includes("원") || body.includes("여비")) && body.includes("일시"), title: "3) 주요 계획(일시·장소) 및 예산 계획 포함", detail: "주요 일정과 예산 계획이 포함되었습니다." },
      { pass: body.includes("사전답사 계획") && body.includes("체크리스트") && body.includes("끝."), title: "4) 복수 붙임(1. 2.) 및 '끝.' 표기", detail: "복수 첨부물 번호 구분과 문서 종료 표기가 정확합니다." }
    ];
    const allPass = checks.every((c) => c.pass);
    if (allPass) {
      appState.labsCompleted.lab2 = true;
      saveState();
      window.showToast("실습 2(사전답사 계획 기안문)를 통과하셨습니다!");
    }
    renderLabFeedback("lab2FeedbackBox", allPass, checks, "실습 2 통과 (4/4)", "누락된 필수 항목을 확인해 주세요");
  };

  function renderLabFeedback(boxId, allPass, checks, okMsg, failMsg) {
    document.getElementById(boxId).innerHTML = `
      <div class="mb-1"><span class="badge ${allPass ? "badge-green" : "badge-amber"}" style="font-size:0.86rem; padding:0.32rem 0.7rem;">${allPass ? okMsg : failMsg}</span></div>
      <div class="stack-sm">
        ${checks
          .map(
            (c) => `
          <div class="callout ${c.pass ? "callout-success" : "callout-danger"}">
            <div style="font-weight:700; font-size:0.86rem;">${c.pass ? "✔" : "✕"} ${escapeHtml(c.title)}</div>
            <div class="text-xs text-secondary" style="margin-top:0.15rem;">${escapeHtml(c.detail)}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  window.loadLab3Sample = function () {
    document.getElementById("lab3Title").value = "2026학년도 '초록 빛깔 생태 스케치' 운영 계획";
    document.getElementById("lab3Purpose").value = "• 생태 관찰 및 텃밭 가꾸기 활동을 통한 학생들의 생태 감수성 함양\n• 학생 주도적 프로젝트 활동을 통한 문제 해결 능력 및 협동심 고취";
    document.getElementById("lab3Schedule").value = "• 4월~5월 | 우리 학교 식물 지도 만들기 | 3학년 전원 | 교내 서식 식물 관찰 및 특징 기록\n• 6월~10월 | '성산 생태 수호대' 동아리 | 희망 학생 | 텃밭 작물 재배 및 생태 신문 발행\n• 11월 | 생태 스케치 결과 공유회 | 전교생 | 프로젝트 결과물 전시 및 소감 발표";
    document.getElementById("lab3Budget").value = "• 재배 모종 구입(교육운영비): 2,000원 × 100개 × 1회 = 200,000원 (상추, 방울토마토 등)\n• 관찰 기록 도구(교육운영비): 5,000원 × 25명 × 4학급 = 500,000원 (관찰 수첩 및 색연필)\n• 합계: 700,000원";
    document.getElementById("lab3Safety").value = "• 야외 관찰 시 사전 안전 교육 실시(독충 주의 및 도구 안전 사용법)\n• 우천 시 활동 장소를 교실 내 식물 도감 탐구 및 생태 세밀화 그리기 활동으로 변경(Plan B)";
    renderLab3Preview();
    window.showToast("생태 스케치 예시가 로드되었습니다.");
  };

  function renderLab3Preview() {
    const title = document.getElementById("lab3Title").value.trim();
    const purpose = document.getElementById("lab3Purpose").value.trim();
    const schedule = document.getElementById("lab3Schedule").value.trim();
    const budget = document.getElementById("lab3Budget").value.trim();
    const safety = document.getElementById("lab3Safety").value.trim();

    document.getElementById("lab3PreviewBox").innerHTML = `
      <div class="edufine-header">
        <div class="edufine-org-slogan">${escapeHtml(appState.profile.schoolName)} 업무 추진계획 초안</div>
        <div style="font-size:1.18rem; font-weight:800; margin-top:0.2rem; color:#0f172a;">${escapeHtml(title)}</div>
      </div>
      <div class="edufine-body"><strong>1. 목적 및 필요성</strong>\n${escapeHtml(purpose)}\n\n<strong>2. 주요 프로그램 및 세부 추진 계획</strong>\n${escapeHtml(schedule)}\n\n<strong>3. 예산 소요 계획 (산출 근거)</strong>\n${escapeHtml(budget)}\n\n<strong>4. 안전 관리 및 악천후 시 대체 계획 (Plan B)</strong>\n${escapeHtml(safety)}</div>
    `;
  }

  window.completeLab3 = function () {
    const ok = document.getElementById("lab3Chk1").checked && document.getElementById("lab3Chk2").checked && document.getElementById("lab3Chk3").checked;
    if (!ok) return window.showToast("자가 점검 3대 항목(구체성·정확성·대비성)을 모두 확인해 주세요.");
    appState.labsCompleted.lab3 = true;
    saveState();
    window.showToast("실습 3(업무 추진계획서 초안) 완료 처리되었습니다!");
  };

  window.copyLab3Plan = function () {
    window.copyText(document.getElementById("lab3PreviewBox").innerText, "업무 추진계획서 초안이 복사되었습니다.");
  };

  // ==========================================
  // 8. MODULE 6: 마스터 퀴즈 v2 (집중/전체/오답 모드 + 영역 분석 + 이수 리포트) & FAQ v2
  // ==========================================
  function initQuizAndFaqModule() {
    document.getElementById("quizCategoryFilter").addEventListener("change", () => {
      quizFocusIndex = 0;
      renderQuiz();
    });
    renderQuiz();

    document.getElementById("faqCatFilter").addEventListener("change", () => renderFaqList());
    document.getElementById("faqSearchInput").addEventListener("input", () => renderFaqList());
    renderFaqList();
  }

  function mapQuizDomain(cat) {
    if (cat.includes("공문서") || cat.includes("공공언어") || cat.includes("계획서")) return "공문서";
    if (cat.includes("회계") || cat.includes("품의") || cat.includes("학급운영비") || cat.includes("업무추진비")) return "회계";
    return "보직";
  }

  window.setQuizMode = function (mode) {
    quizMode = mode;
    quizFocusIndex = 0;
    document.getElementById("quizModeFocusBtn").className = `btn btn-sm ${mode === "focus" ? "btn-primary" : "btn-secondary"}`;
    document.getElementById("quizModeAllBtn").className = `btn btn-sm ${mode === "all" ? "btn-primary" : "btn-secondary"}`;
    document.getElementById("quizModeWrongBtn").className = `btn btn-sm ${mode === "wrong" ? "btn-primary" : "btn-danger"}`;
    renderQuiz();
  };

  window.moveQuizFocus = function (delta) {
    quizFocusIndex += delta;
    renderQuiz();
  };

  window.retrySingleQuiz = function (qId) {
    delete appState.quizAnswers[qId];
    saveState();
    renderQuiz();
  };

  function renderQuiz() {
    const questions = window.EDU_DATA.quizQuestions;
    const filter = document.getElementById("quizCategoryFilter").value;

    let totalCorrect = 0;
    let totalWrong = 0;
    const domainStats = {
      공문서: { label: "공문서 · 공공언어", total: 0, correct: 0 },
      회계: { label: "학교회계 · 비목 · 품의", total: 0, correct: 0 },
      보직: { label: "보직교사 · 협업 · AI", total: 0, correct: 0 }
    };

    questions.forEach((q) => {
      const dom = mapQuizDomain(q.category);
      domainStats[dom].total++;
      const ans = appState.quizAnswers[q.id];
      if (ans !== undefined) {
        if (ans === q.answer) {
          totalCorrect++;
          domainStats[dom].correct++;
        } else {
          totalWrong++;
        }
      }
    });

    document.getElementById("quizScoreBadge").textContent = `점수: ${totalCorrect} / ${questions.length} (${totalCorrect * 5}점)`;
    document.getElementById("quizWrongCount").textContent = String(totalWrong);

    // 영역별 분석 바
    document.getElementById("quizAnalyticsBar").innerHTML = Object.values(domainStats)
      .map((s) => {
        const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
        return `
        <div class="surface-box">
          <div class="row-between text-xs mb-1"><strong>${escapeHtml(s.label)}</strong><span>${s.correct}/${s.total} (${pct}%)</span></div>
          <div class="progress-track"><div class="progress-fill ${pct >= 80 ? "success" : ""}" style="width:${pct}%;"></div></div>
        </div>
      `;
      })
      .join("");

    // 필터링된 문제 목록
    let list = questions.filter((q) => filter === "ALL" || mapQuizDomain(q.category) === filter);
    if (quizMode === "wrong") {
      list = list.filter((q) => appState.quizAnswers[q.id] !== undefined && appState.quizAnswers[q.id] !== q.answer);
    }

    const container = document.getElementById("quizListContainer");
    if (list.length === 0) {
      container.innerHTML = `<div class="callout callout-success" style="text-align:center; padding:1.75rem;">${quizMode === "wrong" ? "현재 기록된 오답이 없습니다! 훌륭합니다." : "해당 영역에 문항이 없습니다."}</div>`;
      return;
    }

    const renderCard = (q, displayIndex, totalLen) => {
      const userAns = appState.quizAnswers[q.id];
      const answered = userAns !== undefined;
      return `
        <div class="surface-box">
          <div class="row-between mb-1">
            <span class="badge badge-blue">문제 ${q.id} (${displayIndex + 1}/${totalLen}) · ${escapeHtml(q.category)}</span>
            <div class="row-wrap">
              ${
                answered
                  ? `<span class="badge ${userAns === q.answer ? "badge-green" : "badge-red"}">${userAns === q.answer ? "정답" : "오답"}</span>
                     ${userAns !== q.answer ? `<button type="button" class="btn btn-sm btn-secondary" onclick="window.retrySingleQuiz(${q.id})">이 문제 다시 풀기</button>` : ""}`
                  : `<span class="badge badge-gray">미응시</span>`
              }
            </div>
          </div>
          <div style="font-weight:700; font-size:0.97rem; margin-bottom:0.85rem;">${escapeHtml(q.q)}</div>
          <div>
            ${q.options
              .map((opt, oIdx) => {
                let cls = "quiz-option";
                if (answered) {
                  if (oIdx === q.answer) cls += " correct";
                  else if (oIdx === userAns) cls += " wrong";
                }
                return `<button type="button" class="${cls}" ${answered ? "disabled" : ""} onclick="window.answerQuiz(${q.id}, ${oIdx})"><span class="badge badge-gray">${oIdx + 1}</span><span>${escapeHtml(opt)}</span></button>`;
              })
              .join("")}
          </div>
          ${
            answered
              ? `<div class="callout callout-info mt-1 text-sm"><strong>해설:</strong> ${escapeHtml(q.explanation)}</div>`
              : ""
          }
        </div>
      `;
    };

    if (quizMode === "focus") {
      if (quizFocusIndex < 0) quizFocusIndex = 0;
      if (quizFocusIndex >= list.length) quizFocusIndex = list.length - 1;
      const q = list[quizFocusIndex];
      const progressPct = Math.round(((quizFocusIndex + 1) / list.length) * 100);
      container.innerHTML = `
        <div class="mb-1">
          <div class="row-between text-xs text-muted mb-1"><span>집중 학습 진행도</span><span>${quizFocusIndex + 1} / ${list.length} 문항</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${progressPct}%;"></div></div>
        </div>
        ${renderCard(q, quizFocusIndex, list.length)}
        <div class="row-between mt-2">
          <button type="button" class="btn btn-secondary" ${quizFocusIndex === 0 ? "disabled" : ""} onclick="window.moveQuizFocus(-1)">← 이전 문제</button>
          <button type="button" class="btn btn-primary" ${quizFocusIndex === list.length - 1 ? "disabled" : ""} onclick="window.moveQuizFocus(1)">다음 문제 →</button>
        </div>
      `;
    } else {
      container.innerHTML = `<div class="stack-md">${list.map((q, i) => renderCard(q, i, list.length)).join("")}</div>`;
    }
  }

  window.answerQuiz = function (qId, optionIdx) {
    appState.quizAnswers[qId] = optionIdx;
    let score = 0;
    window.EDU_DATA.quizQuestions.forEach((q) => {
      if (appState.quizAnswers[q.id] === q.answer) score++;
    });
    if (appState.quizBestScore === null || score > appState.quizBestScore) {
      appState.quizBestScore = score;
    }
    saveState();
    renderQuiz();
  };

  window.resetQuiz = function () {
    appState.quizAnswers = {};
    quizFocusIndex = 0;
    saveState();
    renderQuiz();
    window.showToast("퀴즈 답안이 초기화되었습니다.");
  };

  function renderCertificate() {
    const sub = document.getElementById("certSubtitle");
    const grid = document.getElementById("certSummaryGrid");
    const ts = document.getElementById("certTimestamp");
    if (!sub || !grid || !ts) return;

    const labsDone = Object.values(appState.labsCompleted || {}).filter(Boolean).length;
    const score = appState.quizBestScore !== null ? appState.quizBestScore * 5 : 0;
    const myDepts = window.EDU_DATA.departments.filter((d) => (appState.selectedDepts || []).includes(d.id)).map((d) => d.name.split(" ")[0]).join(", ");

    sub.textContent = `${appState.profile.schoolName} · ${appState.profile.teacherName} (관심 보직: ${myDepts || "교무부장"})`;
    grid.innerHTML = `
      <div class="surface-box"><div class="text-xs text-muted">연수 실습 워크북</div><div style="font-size:1.3rem; font-weight:800; color:var(--brand-primary);">${labsDone} / 3 완료</div></div>
      <div class="surface-box"><div class="text-xs text-muted">종합 능력평가 최고점</div><div style="font-size:1.3rem; font-weight:800; color:${score >= 80 ? "var(--success)" : "var(--brand-primary)"};">${score}점 / 100점</div></div>
      <div class="surface-box"><div class="text-xs text-muted">공문서 린터 점검 누적</div><div style="font-size:1.3rem; font-weight:800; color:var(--brand-primary);">${appState.lintCount || 0}회</div></div>
    `;
    ts.textContent = `발급 일시: ${new Date().toLocaleDateString("ko-KR")} · 2027 초등 1급 정교사 자격연수 「슬기로운 교직실무 포털」`;
  }

  // FAQ v2 (기본 접힘 + 전체 펼치기/접기 + 검색어 하이라이트)
  function highlightText(rawText, query) {
    const safe = escapeHtml(rawText);
    if (!query) return safe;
    const reg = new RegExp(`(${escapeRegex(escapeHtml(query))})`, "gi");
    return safe.replace(reg, '<mark class="search-hl">$1</mark>');
  }

  function renderFaqList(forceExpandId = null) {
    const cat = document.getElementById("faqCatFilter").value;
    const q = document.getElementById("faqSearchInput").value.trim();
    const qLow = q.toLowerCase();
    const container = document.getElementById("faqAccordionContainer");

    const filtered = window.EDU_DATA.accountingFaqs.filter((f) => {
      const mCat = cat === "ALL" || f.cat === cat;
      const mQ = !qLow || f.q.toLowerCase().includes(qLow) || f.a.toLowerCase().includes(qLow);
      return mCat && mQ;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="surface-box text-muted" style="text-align:center; padding:1.5rem;">일치하는 FAQ 항목이 없습니다.</div>`;
      return;
    }

    container.innerHTML = filtered
      .map((f) => {
        const shouldOpen = Boolean(qLow) || forceExpandId === f.id;
        return `
        <div class="faq-item ${shouldOpen ? "open" : ""}" id="faq-box-${f.id}">
          <button type="button" class="faq-question" onclick="this.parentElement.classList.toggle('open')">
            <span><span class="badge badge-blue" style="margin-right:0.5rem;">${escapeHtml(f.cat)}</span>${highlightText(f.q, q)}</span>
            <svg class="svg-icon faq-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="faq-answer" style="white-space:pre-line;">${highlightText(f.a, q)}</div>
        </div>
      `;
      })
      .join("");
  }

  window.toggleAllFaqs = function (expand) {
    document.querySelectorAll("#faqAccordionContainer .faq-item").forEach((el) => {
      el.classList.toggle("open", expand);
    });
  };

  // ==========================================
  // 9. 글로벌 통합 검색 v2 (키보드 ↑/↓/Enter + 타깃 스크롤·강조 딥링크)
  // ==========================================
  function openSearchModal() {
    document.getElementById("searchModalBackdrop").classList.add("open");
    const input = document.getElementById("globalSearchModalInput");
    input.value = "";
    activeSearchIdx = -1;
    renderGlobalSearchResults("");
    setTimeout(() => input.focus(), 40);
  }

  window.closeSearchModal = function () {
    document.getElementById("searchModalBackdrop").classList.remove("open");
  };

  function handleSearchModalKeydown(e) {
    if (currentSearchResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSearchIdx = (activeSearchIdx + 1) % currentSearchResults.length;
      updateActiveSearchItem();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSearchIdx = (activeSearchIdx - 1 + currentSearchResults.length) % currentSearchResults.length;
      updateActiveSearchItem();
    } else if (e.key === "Enter" && activeSearchIdx >= 0) {
      e.preventDefault();
      const chosen = currentSearchResults[activeSearchIdx];
      if (chosen) window.jumpFromSearch(activeSearchIdx);
    }
  }

  function updateActiveSearchItem() {
    document.querySelectorAll(".search-result-item").forEach((el, idx) => {
      el.classList.toggle("active", idx === activeSearchIdx);
      if (idx === activeSearchIdx) el.scrollIntoView({ block: "nearest" });
    });
  }

  window.jumpFromSearch = function (idx) {
    const item = currentSearchResults[idx];
    if (!item) return;
    window.closeSearchModal();
    window.switchMainTab(item.tab, item.sub);

    setTimeout(() => {
      if (item.faqId) {
        document.getElementById("faqCatFilter").value = "ALL";
        document.getElementById("faqSearchInput").value = "";
        renderFaqList(item.faqId);
        focusAndPulse(`faq-box-${item.faqId}`);
      } else if (item.deptId) {
        roleViewMode = "dept";
        currentDeptId = item.deptId;
        window.setRoleViewMode("dept");
        focusAndPulse(item.taskId ? `role-task-${item.taskId}` : `dept-panel-${item.deptId}`);
      } else if (item.costId) {
        document.getElementById("costTargetFilter").value = "ALL";
        document.getElementById("costSearchInput").value = "";
        renderCostFinder();
        focusAndPulse(`cost-card-${item.costId}`);
      } else if (item.dictWord) {
        document.getElementById("dictCategoryFilter").value = "ALL";
        document.getElementById("dictSearchInput").value = item.dictWord;
        renderPurifiedDict();
      }
    }, 80);
  };

  function focusAndPulse(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("flash-highlight");
    void el.offsetWidth;
    el.classList.add("flash-highlight");
  }

  function renderGlobalSearchResults(query) {
    const q = query.trim().toLowerCase();
    const box = document.getElementById("globalSearchResults");
    activeSearchIdx = -1;

    if (!q) {
      currentSearchResults = [];
      box.innerHTML = `<div class="text-sm text-muted" style="padding:0.5rem;">추천 검색어: <code>개산급</code> · <code>일반강사</code> · <code>교육운영비</code> · <code>익일</code> · <code>연계반송</code> · <code>폐시약</code> · <code>경조사비</code> · <code>봉사료</code></div>`;
      return;
    }

    const results = [];
    window.EDU_DATA.purifiedTerms.forEach((t) => {
      if (t.wrong.toLowerCase().includes(q) || t.right.toLowerCase().includes(q) || t.reason.toLowerCase().includes(q)) {
        results.push({ badge: "공공언어·순화어", title: `${t.wrong} → ${t.right}`, desc: t.reason, tab: "tab-doc", sub: "doc-sub-dict", dictWord: t.wrong });
      }
    });
    window.EDU_DATA.costFinderCases.forEach((c) => {
      if (c.category.toLowerCase().includes(q) || c.item.toLowerCase().includes(q) || c.note.toLowerCase().includes(q)) {
        results.push({ badge: `원가통계비목 (${c.code})`, title: `${c.category} → ${c.item}`, desc: c.note, tab: "tab-budget", sub: "budget-sub-finder", costId: c.id });
      }
    });
    window.EDU_DATA.accountingFaqs.forEach((f) => {
      if (f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)) {
        results.push({ badge: `학교회계 FAQ · ${f.cat}`, title: f.q, desc: f.a.slice(0, 105) + "...", tab: "tab-quiz", sub: "quiz-sub-faq", faqId: f.id });
      }
    });
    window.EDU_DATA.departments.forEach((d) => {
      d.periods.forEach((p) =>
        p.tasks.forEach((t) => {
          if (t.title.toLowerCase().includes(q) || t.detail.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)) {
            results.push({ badge: `${d.name} (${p.period})`, title: t.title, desc: t.detail, tab: "tab-role", sub: "role-sub-dept", deptId: d.id, taskId: t.id });
          }
        })
      );
    });

    currentSearchResults = results.slice(0, 20);
    if (currentSearchResults.length === 0) {
      box.innerHTML = `<div class="text-muted" style="padding:1.5rem; text-align:center;">'${escapeHtml(query)}'에 대한 검색 결과가 없습니다.</div>`;
      return;
    }

    activeSearchIdx = 0;
    box.innerHTML = currentSearchResults
      .map(
        (r, i) => `
      <div class="search-result-item ${i === 0 ? "active" : ""}" onclick="window.jumpFromSearch(${i})">
        <div class="row-between" style="margin-bottom:0.2rem;">
          <span class="badge badge-blue">${escapeHtml(r.badge)}</span>
          <span class="text-xs" style="color:var(--brand-primary); font-weight:700;">바로 이동 →</span>
        </div>
        <div style="font-weight:700; font-size:0.91rem;">${escapeHtml(r.title)}</div>
        <div class="text-xs text-secondary" style="margin-top:0.15rem;">${escapeHtml(r.desc)}</div>
      </div>
    `
      )
      .join("");
  }

  document.addEventListener("DOMContentLoaded", initApp);
})();
