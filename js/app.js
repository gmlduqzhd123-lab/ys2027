// 2027 초등 1급 정교사 자격연수 「슬기로운 교직실무 올인원 포털 v3.0」 메인 애플리케이션
(function () {
  "use strict";

  const STORAGE_KEY = "EDU_PORTAL_STATE_2027_V2";
  const LEGACY_KEY = "EDU_PORTAL_STATE_2027_V1";
  const GITHUB_PAGES_BASE = "https://gmlduqzhd123-lab.github.io/ys2027/";

  const defaultPumuiItems = [
    { id: 1, name: "양면 색종이 (15×15cm)", spec: "100매입/팩", unit: "팩", qty: 25, price: 2500 },
    { id: 2, name: "생태 관찰 기록 수첩", spec: "A5 스프링", unit: "권", qty: 25, price: 3200 },
    { id: 3, name: "친환경 12색 색연필", spec: "12색/세트", unit: "세트", qty: 25, price: 4800 }
  ];

  const defaultPreBudgetRows = [
    { id: 1, bimok: "교육운영비(자료)", desc: "공생의길 프로젝트 운영(교육자료)", formula: "150,000원×1식×3회=450,000원", amount: 450000 },
    { id: 2, bimok: "교육운영비(간식)", desc: "공생의길 프로젝트 간식 구매", formula: "50,000원×1식×6회=300,000원", amount: 300000 },
    { id: 3, bimok: "운영수당", desc: "공생의길 프로젝트 강사 수당", formula: "150,000원×1명×3회=450,000원", amount: 450000 }
  ];

  const defaultBuilderTableRows = [
    { id: 1, time: "14:00~14:40", content: "이동 및 체험장 도착·안전관리자 면담", owner: "학년부장" },
    { id: 2, time: "14:40~16:00", content: "체험 동선·식당·비상 대피로·주차 구역 점검", owner: "인솔교사 전원" },
    { id: 3, time: "16:00~17:00", content: "우천 시 실내 대체 코스 확인 및 복귀", owner: "" }
  ];

  const defaultState = {
    theme: "light",
    fontScale: "normal",
    profile: {
      teacherName: "연수생 교사"
    },
    lintCount: 0,
    checkedTasks: {},
    selectedDepts: ["dept-academic"],
    customTasks: [],
    savedDrafts: [],
    recentSearches: [],
    builderDraft: null,
    preBudgetDraft: {
      projectName: "2026년 공생의 길(물길, 숲길) 프로젝트 운영",
      totalGrant: 1200000,
      rows: defaultPreBudgetRows
    },
    pumuiItems: defaultPumuiItems,
    labDrafts: { lab1: null, lab2: null, lab3: null },
    labsCompleted: { lab1: false, lab2: false, lab3: false },
    quizAnswers: {},
    quizBestScore: null,
    settlement: {
      received: 640000,
      endDate: new Date().toISOString().slice(0, 10),
      teacher: "",
      className: "3학년 1반",
      rows: [
        { id: 1, date: "2026-04-06", vendor: "오늘 문구사", proof: "전산자료", desc: "4월 생일 파티 및 학급 게시판 용품", amount: 75000 },
        { id: 2, date: "2026-05-15", vendor: "바른 문구", proof: "전산자료", desc: "학급 다모임 프로젝트 활동지·색연필", amount: 112000 }
      ]
    }
  };

  let appState = loadState();
  let currentDeptId = (appState.selectedDepts && appState.selectedDepts[0]) || "dept-academic";
  let roleViewMode = "dept";
  let selectedMonth = new Date().getMonth() + 1;

  let builderTableRows =
    appState.builderDraft && Array.isArray(appState.builderDraft.tableRows)
      ? clone(appState.builderDraft.tableRows)
      : clone(defaultBuilderTableRows);

  let lastLintFixes = [];
  let lintUndoStack = [];
  let costWizardPath = [];
  let quizMode = "focus";
  let quizFocusIndex = 0;
  let quizPresenterMode = false;
  let quizRevealedMap = {};
  let currentSearchResults = [];
  let activeSearchIdx = -1;
  let waitingWorker = null;
  let activeModalReturnFocus = null;
  let activeEdufineSimTab = "recall";

  // 에듀파인 시뮬레이터 2종 상태
  let recallSim = { stage: 0, checked: false, message: "결재가 진행 중인 '교무실 사무용품 구입' 품의를 수정하려고 합니다. 먼저 해당 문서를 체크해 주세요.", msgType: "info" };
  let settleSim = { stage: 0, selectedProof: "", message: "학급운영비 개산급을 정산할 차례입니다. 먼저 [1. 수령일 조회] 버튼을 눌러 미정산 건을 불러오세요.", msgType: "info" };

  // ==========================================
  // 0. 상태 로드/저장 및 공통 유틸
  // ==========================================
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
      if (!raw) return clone(defaultState);
      const sanitizedRaw = raw.replace(/[가-힣]{2,}초등학교/g, "○○초등학교");
      const parsed = JSON.parse(sanitizedRaw);
      return {
        ...clone(defaultState),
        ...parsed,
        profile: { teacherName: (parsed.profile && parsed.profile.teacherName) || defaultState.profile.teacherName },
        labsCompleted: { ...defaultState.labsCompleted, ...(parsed.labsCompleted || {}) },
        labDrafts: { ...defaultState.labDrafts, ...(parsed.labDrafts || {}) },
        preBudgetDraft: {
          ...clone(defaultState.preBudgetDraft),
          ...(parsed.preBudgetDraft || {}),
          rows: Array.isArray(parsed.preBudgetDraft?.rows) ? parsed.preBudgetDraft.rows : clone(defaultPreBudgetRows)
        },
        pumuiItems: Array.isArray(parsed.pumuiItems) ? parsed.pumuiItems : clone(defaultPumuiItems),
        savedDrafts: Array.isArray(parsed.savedDrafts) ? parsed.savedDrafts : [],
        recentSearches: Array.isArray(parsed.recentSearches) ? parsed.recentSearches : [],
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

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      // ignore storage quota errors
    }
    updateDashboardStats();
    renderHomeWorkspaceHub();
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

  // 숫자 → 공문서 한글 금액 병기 변환 (예: 1200000 -> 금1,200,000원(금일백이십만원))
  function numberToKoreanWords(num) {
    const n = Math.floor(Math.max(0, Number(num) || 0));
    if (n === 0) return "영";
    const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    const smallUnits = ["", "십", "백", "천"];
    const bigUnits = ["", "만", "억", "조"];
    let result = "";
    let unitIdx = 0;
    let temp = n;
    while (temp > 0) {
      const chunk = temp % 10000;
      if (chunk > 0) {
        let chunkStr = "";
        let c = chunk;
        for (let i = 0; i < 4; i++) {
          const d = c % 10;
          if (d > 0) {
            chunkStr = digits[d] + smallUnits[i] + chunkStr;
          }
          c = Math.floor(c / 10);
        }
        result = chunkStr + bigUnits[unitIdx] + result;
      }
      temp = Math.floor(temp / 10000);
      unitIdx++;
    }
    return result;
  }

  // ==========================================
  // 1. 초기화, PWA(업데이트 배너), 폰트 확대, QR 공유, 해시 라우팅
  // ==========================================
  function initApp() {
    applyTheme(appState.theme);
    applyFontScale(appState.fontScale);
    applyProfileToUi();
    registerPwa();

    document.querySelectorAll(".nav-tab, .mobile-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => window.switchMainTab(btn.dataset.tab));
    });

    document.querySelectorAll(".sub-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const parentSection = btn.closest(".tab-panel");
        if (parentSection) activateSubTab(parentSection.id, btn.dataset.sub, true);
      });
    });

    // 탭 목록 화살표 키 접근성 지원 (ArrowLeft / ArrowRight)
    document.querySelectorAll('[role="tablist"]').forEach((tablist) => {
      tablist.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const tabs = [...tablist.querySelectorAll('[role="tab"]')];
        const idx = tabs.indexOf(document.activeElement);
        if (idx < 0) return;
        e.preventDefault();
        const nextIdx = e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
        tabs[nextIdx].focus();
        tabs[nextIdx].click();
      });
    });

    document.getElementById("themeToggleBtn").addEventListener("click", () => {
      appState.theme = appState.theme === "dark" ? "light" : "dark";
      applyTheme(appState.theme);
      saveState();
    });

    document.getElementById("fontScaleToggleBtn").addEventListener("click", () => {
      appState.fontScale = appState.fontScale === "large" ? "normal" : "large";
      applyFontScale(appState.fontScale);
      saveState();
      window.showToast(appState.fontScale === "large" ? "빔프로젝터·발표용 큰 글씨 모드가 켜졌습니다." : "기본 글씨 크기로 복원되었습니다.");
    });

    document.getElementById("openQrShareBtn").addEventListener("click", window.openQrModal);
    document.getElementById("qrModalBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "qrModalBackdrop") window.closeQrModal();
    });

    document.getElementById("openSettingsBtn").addEventListener("click", window.openSettingsModal);
    document.getElementById("settingsModalBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "settingsModalBackdrop") window.closeSettingsModal();
    });

    document.getElementById("resetProgressBtn").addEventListener("click", () => {
      if (confirm("실습 완료 현황, 보직 체크리스트, 임시저장 문서, 퀴즈 기록을 모두 초기화하시겠습니까?")) {
        const savedTheme = appState.theme;
        const savedFont = appState.fontScale;
        const savedProfile = clone(appState.profile);
        appState = clone(defaultState);
        appState.theme = savedTheme;
        appState.fontScale = savedFont;
        appState.profile = savedProfile;
        builderTableRows = clone(defaultBuilderTableRows);
        saveState();
        restoreBuilderDraftToForm();
        renderBuilderDraftsBar();
        renderPreBudgetTable();
        renderPumuiCsvTable();
        renderSettlementTable();
        renderDepartments();
        renderQuiz();
        window.closeSettingsModal();
        window.showToast("학습 및 실습 기록이 초기화되었습니다.");
      }
    });

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
        return;
      }
      if (e.key === "Escape") {
        closeAllModals();
        return;
      }
      if (e.key === "Tab") {
        handleModalFocusTrap(e);
        return;
      }
      handleQuizKeyboardShortcuts(e);
    });

    window.addEventListener("afterprint", () => {
      delete document.body.dataset.printTarget;
    });

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

    window.addEventListener("hashchange", applyHashRoute);
    applyHashRoute();
  }

  function registerPwa() {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
      navigator.serviceWorker
        .register("./sw.js")
        .then((reg) => {
          if (reg.waiting) showSwUpdateBanner(reg.waiting);
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) {
                showSwUpdateBanner(nw);
              }
            });
          });
        })
        .catch(() => {});

      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    }

    const reloadBtn = document.getElementById("swReloadBtn");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => {
        if (waitingWorker) waitingWorker.postMessage({ type: "SKIP_WAITING" });
        else window.location.reload();
      });
    }
    // PWA 설치 프롬프트는 ys-install.js가 단일 관리 (중복 리스너 제거)
  }

  function openModalAccessible(backdropId, initialFocusEl) {
    const backdrop = document.getElementById(backdropId);
    if (!backdrop) return;
    if (!backdrop.classList.contains("open")) {
      activeModalReturnFocus = document.activeElement;
    }
    backdrop.classList.add("open");
    setTimeout(() => {
      if (initialFocusEl && initialFocusEl.focus) {
        initialFocusEl.focus();
      } else {
        const firstFocusable = backdrop.querySelector('button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) firstFocusable.focus();
      }
    }, 35);
  }

  function closeModalAccessible(backdropId) {
    const backdrop = document.getElementById(backdropId);
    if (!backdrop || !backdrop.classList.contains("open")) return;
    backdrop.classList.remove("open");
    if (activeModalReturnFocus && activeModalReturnFocus.focus && document.contains(activeModalReturnFocus)) {
      activeModalReturnFocus.focus();
    }
    activeModalReturnFocus = null;
  }

  function closeAllModals() {
    closeModalAccessible("searchModalBackdrop");
    closeModalAccessible("settingsModalBackdrop");
    closeModalAccessible("qrModalBackdrop");
  }

  function handleModalFocusTrap(e) {
    const openBackdrop = document.querySelector(".modal-backdrop.open");
    if (!openBackdrop) return;
    const focusables = [...openBackdrop.querySelectorAll('button:not(:disabled), [href], input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function showSwUpdateBanner(worker) {
    waitingWorker = worker;
    const banner = document.getElementById("swUpdateBanner");
    if (banner) banner.classList.add("show");
  }

  function applyFontScale(scale) {
    document.documentElement.setAttribute("data-font-scale", scale === "large" ? "large" : "normal");
    const label = document.getElementById("fontScaleLabel");
    if (label) label.textContent = scale === "large" ? "가-" : "가+";
  }

  function getShareableCurrentUrl() {
    const hash = location.hash || "#tab-home";
    if (location.protocol === "https:" || location.protocol === "http:") {
      return `${location.origin}${location.pathname}${hash}`;
    }
    return `${GITHUB_PAGES_BASE}${hash}`;
  }

  window.openQrModal = function () {
    const url = getShareableCurrentUrl();
    document.getElementById("qrUrlPreview").textContent = url;
    if (window.EduQr && window.EduQr.generateQrSvg) {
      document.getElementById("qrSvgWrap").innerHTML = window.EduQr.generateQrSvg(url, 220);
    }
    openModalAccessible("qrModalBackdrop");
  };

  window.closeQrModal = function () {
    closeModalAccessible("qrModalBackdrop");
  };

  window.copyCurrentShareUrl = function () {
    window.copyText(getShareableCurrentUrl(), "현재 화면 공유 링크가 복사되었습니다.");
  };

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
    if (location.hash !== nextHash) history.replaceState(null, "", nextHash);
  }

  window.switchMainTab = function (tabId, subId, pushHash = true) {
    document.querySelectorAll(".nav-tab, .mobile-nav-btn").forEach((b) => {
      const isAct = b.dataset.tab === tabId;
      b.classList.toggle("active", isAct);
      if (b.getAttribute("role") === "tab") b.setAttribute("aria-selected", String(isAct));
    });
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === tabId));
    const panel = document.getElementById(tabId);
    let activeSub = subId;
    if (panel) {
      if (subId) activateSubTab(tabId, subId, false);
      else {
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
    panel.querySelectorAll(".sub-tab").forEach((b) => {
      const isAct = b.dataset.sub === subId;
      b.classList.toggle("active", isAct);
      if (b.getAttribute("role") === "tab") b.setAttribute("aria-selected", String(isAct));
    });
    panel.querySelectorAll(".sub-panel").forEach((p) => p.classList.toggle("active", p.id === subId));
    if (pushHash) updateHash(tabId, subId);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", theme === "dark" ? "#0b1120" : "#1d4ed8");
    const icon = document.getElementById("themeIcon");
    const label = document.getElementById("themeLabel");
    if (icon && label) {
      icon.textContent = theme === "dark" ? "☀️" : "🌙";
      label.textContent = theme === "dark" ? "라이트" : "다크";
    }
  }

  window.printIsolatedZone = function (zone) {
    document.body.dataset.printTarget = zone;
    setTimeout(() => {
      window.print();
      setTimeout(() => delete document.body.dataset.printTarget, 700);
    }, 60);
  };

  // ==========================================
  // 2. 사용자 설정 & JSON 백업/복원
  // ==========================================
  function applyProfileToUi() {
    const p = appState.profile;
    const teacherInput = document.getElementById("settleTeacher");
    if (teacherInput && !teacherInput.value) {
      teacherInput.value = appState.settlement.teacher || p.teacherName;
    }
  }

  window.openSettingsModal = function () {
    const input = document.getElementById("settingTeacherName");
    input.value = appState.profile.teacherName;
    openModalAccessible("settingsModalBackdrop", input);
  };

  window.closeSettingsModal = function () {
    closeModalAccessible("settingsModalBackdrop");
  };

  window.saveUserProfile = function () {
    const teacher = document.getElementById("settingTeacherName").value.trim() || "연수생 교사";
    appState.profile = { teacherName: teacher };
    appState.settlement.teacher = teacher;
    saveState();
    applyProfileToUi();

    const settleTeacher = document.getElementById("settleTeacher");
    if (settleTeacher) settleTeacher.value = teacher;

    updateSettlementSummaryOnly();
    window.closeSettingsModal();
    window.showToast("사용자 설정이 저장되었습니다.");
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
          labDrafts: { ...defaultState.labDrafts, ...(imported.labDrafts || {}) },
          preBudgetDraft: { ...clone(defaultState.preBudgetDraft), ...(imported.preBudgetDraft || {}) },
          pumuiItems: Array.isArray(imported.pumuiItems) ? imported.pumuiItems : clone(defaultPumuiItems),
          savedDrafts: Array.isArray(imported.savedDrafts) ? imported.savedDrafts : [],
          settlement: { ...clone(defaultState.settlement), ...(imported.settlement || {}) }
        };
        if (appState.builderDraft?.tableRows) builderTableRows = clone(appState.builderDraft.tableRows);
        saveState();
        applyTheme(appState.theme);
        applyFontScale(appState.fontScale);
        applyProfileToUi();
        restoreBuilderDraftToForm();
        renderBuilderDraftsBar();
        renderPreBudgetTable();
        renderPumuiCsvTable();
        renderSettlementTable();
        renderDepartments();
        restoreLabDraftsToForm();
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
    document.getElementById("modulesOverviewGrid").innerHTML = window.EDU_DATA.modulesOverview
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

    renderHomeWorkspaceHub();
  }

  window.openRoleMonthView = function () {
    selectedMonth = new Date().getMonth() + 1;
    window.switchMainTab("tab-role", "role-sub-dept");
    renderMonthFilterBar();
    window.setRoleViewMode("month");
  };

  function renderHomeWorkspaceHub() {
    const tasksWrap = document.getElementById("homeMonthTasksWidget");
    const resumeWrap = document.getElementById("homeQuickResumeWidget");
    const titleEl = document.getElementById("homeMonthTasksTitle");
    if (!tasksWrap || !resumeWrap) return;

    const curMonth = new Date().getMonth() + 1;
    if (titleEl) titleEl.textContent = `${curMonth}월 이달의 내 보직 할 일`;

    const myDepts = window.EDU_DATA.departments.filter((d) => (appState.selectedDepts || ["dept-academic"]).includes(d.id));
    const monthTasks = [];
    myDepts.forEach((d) => {
      const shortDept = d.name.split(" ")[0];
      d.periods.forEach((p) =>
        p.tasks.forEach((t) => {
          const months = (window.EDU_DATA.taskMonthsMap && window.EDU_DATA.taskMonthsMap[t.id]) || [];
          if (months.includes(curMonth)) monthTasks.push({ id: t.id, title: t.title, dept: shortDept });
        })
      );
      (appState.customTasks || []).forEach((ct) => {
        if (ct.deptId === d.id && ct.month === curMonth) monthTasks.push({ id: ct.id, title: ct.title, dept: `${shortDept}·추가` });
      });
    });

    const doneCnt = monthTasks.filter((t) => appState.checkedTasks && appState.checkedTasks[t.id]).length;
    const sorted = [...monthTasks].sort((a, b) => Number(Boolean(appState.checkedTasks[a.id])) - Number(Boolean(appState.checkedTasks[b.id]))).slice(0, 4);

    if (monthTasks.length === 0) {
      tasksWrap.innerHTML = `<div class="surface-box text-sm text-muted" style="text-align:center;">${curMonth}월 등록된 내 부서 과업이 없습니다. 보직 탭에서 담당 부서나 특색 업무를 추가해 보세요.</div>`;
    } else {
      const pct = Math.round((doneCnt / monthTasks.length) * 100);
      tasksWrap.innerHTML = `
        <div class="row-between text-xs text-muted mb-1">
          <span>담당 부서: <strong>${escapeHtml(myDepts.map((d) => d.name.split(" ")[0]).join(" · "))}</strong></span>
          <span>완료 ${doneCnt} / ${monthTasks.length} (${pct}%)</span>
        </div>
        <div class="progress-track mb-1"><div class="progress-fill success" style="width:${pct}%;"></div></div>
        <div>
          ${sorted
            .map((t) => {
              const checked = Boolean(appState.checkedTasks && appState.checkedTasks[t.id]);
              return `<label class="check-item ${checked ? "checked" : ""}" style="padding:0.5rem 0.72rem; margin-bottom:0.4rem;">
                <input type="checkbox" ${checked ? "checked" : ""} onchange="window.toggleDeptTask('${t.id}')" />
                <div style="flex:1; min-width:0;">
                  <div class="row-between" style="gap:0.4rem;">
                    <span class="check-title text-sm" style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(t.title)}</span>
                    <span class="badge badge-blue" style="font-size:0.68rem;">${escapeHtml(t.dept)}</span>
                  </div>
                </div>
              </label>`;
            })
            .join("")}
        </div>
      `;
    }

    // 우측: 최근 작업 이어하기
    const draftTitle = (appState.builderDraft && appState.builderDraft.bTitle) || "2026학년도 1학기 현장체험학습 사전답사 실시 계획";
    const draftCnt = (appState.savedDrafts || []).length;

    const received = appState.settlement.received || 0;
    const spent = (appState.settlement.rows || []).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const remain = received - spent;
    let dTag = "정산 기한 확인";
    let dCls = "badge-blue";
    if (appState.settlement.endDate) {
      const end = new Date(appState.settlement.endDate + "T00:00:00");
      const deadline = new Date(end.getTime() + 5 * 24 * 60 * 60 * 1000);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      dTag = diff < 0 ? `마감 D+${Math.abs(diff)}` : diff === 0 ? "오늘 마감" : `마감 D-${diff}`;
      dCls = diff < 0 ? "badge-red" : diff <= 2 ? "badge-amber" : "badge-green";
    }

    const labsDone = Object.values(appState.labsCompleted || {}).filter(Boolean).length;
    const nextLabSub = !appState.labsCompleted.lab1 ? "lab-sub-1" : !appState.labsCompleted.lab2 ? "lab-sub-2" : "lab-sub-3";
    const nextLabText = labsDone === 3 ? "실습 3종 모두 완료!" : !appState.labsCompleted.lab1 ? "다음: 실습 1 (성립전 예산)" : !appState.labsCompleted.lab2 ? "다음: 실습 2 (사전답사 기안문)" : "다음: 실습 3 (업무 추진계획)";

    resumeWrap.innerHTML = `
      <button type="button" class="resume-item" onclick="window.switchMainTab('tab-doc', 'doc-sub-builder')">
        <div style="min-width:0; flex:1;">
          <div class="text-xs text-muted">임시저장 기안문 · 내 기안함 ${draftCnt}건</div>
          <div style="font-weight:700; font-size:0.88rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(draftTitle)}</div>
        </div>
        <span class="badge badge-blue">이어쓰기 →</span>
      </button>
      <button type="button" class="resume-item" onclick="window.switchMainTab('tab-budget', 'budget-sub-guide')">
        <div style="min-width:0; flex:1;">
          <div class="text-xs text-muted">학급운영비 개산급 정산 (${escapeHtml(appState.settlement.className)})</div>
          <div style="font-weight:700; font-size:0.88rem;" class="tabular-nums">집행 ${formatNumber(spent)}원 · 잔액 ${formatNumber(remain)}원</div>
        </div>
        <span class="badge ${dCls}">${escapeHtml(dTag)}</span>
      </button>
      <button type="button" class="resume-item" onclick="window.switchMainTab('tab-lab', '${nextLabSub}')">
        <div style="min-width:0; flex:1;">
          <div class="text-xs text-muted">연수 실습 워크북 (${labsDone} / 3 완료)</div>
          <div style="font-weight:700; font-size:0.88rem;">${escapeHtml(nextLabText)}</div>
        </div>
        <span class="badge ${labsDone === 3 ? "badge-green" : "badge-amber"}">${labsDone === 3 ? "완료 ✔" : "바로 시작 →"}</span>
      </button>
    `;
  }

  function updateDashboardStats() {
    const labsDone = Object.values(appState.labsCompleted || {}).filter(Boolean).length;
    const elLab = document.getElementById("statLabDone");
    if (elLab) elLab.textContent = `${labsDone} / 3`;
    const navBadge = document.getElementById("navLabBadge");
    if (navBadge) navBadge.textContent = `${labsDone}/3`;

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
  // 4. MODULE 2: 공문서 린터 v3.0 (24시간제 자동변환 + 오프셋 정확 치환 + 내부결재 어조 + 들여쓰기·천단위 쉼표)
  // ==========================================
  function initLinterModule() {
    window.loadLinterSample(0);
    document.getElementById("runLintBtn").addEventListener("click", () => {
      appState.lintCount = (appState.lintCount || 0) + 1;
      saveState();
      runDocumentLinter();
      window.showToast("공문서 어문규범·24시간제·항목 위계 점검을 완료했습니다.");
    });
    document.getElementById("applyAllFixesBtn").addEventListener("click", applyAllLinterFixes);
    document.getElementById("undoLintBtn").addEventListener("click", undoLintChange);
    document.getElementById("lintTitleInput").addEventListener("input", runDocumentLinter);
    document.getElementById("lintBodyInput").addEventListener("input", runDocumentLinter);
    const modeSel = document.getElementById("lintDocModeSelect");
    if (modeSel) modeSel.addEventListener("change", runDocumentLinter);

    const korAmtEl = document.getElementById("korAmountInput");
    if (korAmtEl) {
      korAmtEl.addEventListener("input", updateKorAmountDisplay);
      updateKorAmountDisplay();
    }
  }

  function updateKorAmountDisplay() {
    const val = parseInt(document.getElementById("korAmountInput").value, 10) || 0;
    const formatted = `금${formatNumber(val)}원(금${numberToKoreanWords(val)}원)`;
    document.getElementById("korAmountOutput").textContent = formatted;
  }

  window.copyKorAmount = function () {
    const txt = document.getElementById("korAmountOutput").textContent;
    window.copyText(txt, `금액 한글 병기(${txt})가 복사되었습니다.`);
  };

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
    const docMode = document.getElementById("lintDocModeSelect")?.value || "external";
    const issues = [];

    const pushBodyIssue = (item) => {
      if (typeof item.start !== "number" || typeof item.end !== "number" || item.end <= item.start) return;
      issues.push({ ...item, fixTarget: "body" });
    };

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

    // 2. 날짜 표기
    const compactDateRegex = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})(\.)?/g;
    let match;
    while ((match = compactDateRegex.exec(body)) !== null) {
      const full = match[0];
      const standard = `${match[1]}. ${match[2]}. ${match[3]}.`;
      const afterChar = body.slice(match.index + full.length, match.index + full.length + 2);
      if (full !== standard && !/^\d/.test(afterChar)) {
        pushBodyIssue({
          type: "error",
          category: "날짜 표기법 (p.11)",
          wrong: full,
          right: standard,
          reason: "날짜의 마침표(.)는 연·월·일을 대체하므로 마침표 뒤를 한 칸씩 띄고 일(日) 뒤에도 마침표를 찍습니다.",
          start: match.index,
          end: match.index + full.length,
          wrongRaw: full,
          rightRaw: standard
        });
      }
    }

    // 3. 날짜와 요일 사이 공백
    const daySpaceRegex = /(\d{1,2}\.)\s+\(([월화수목금토일])\)/g;
    while ((match = daySpaceRegex.exec(body)) !== null) {
      pushBodyIssue({
        type: "warn",
        category: "날짜·요일 표기 (p.11)",
        wrong: match[0],
        right: `${match[1]}(${match[2]})`,
        reason: "날짜 뒤 요일 괄호는 띄지 않고 붙여 씁니다.",
        start: match.index,
        end: match.index + match[0].length,
        wrongRaw: match[0],
        rightRaw: `${match[1]}(${match[2]})`
      });
    }

    // 4. 12시간제(오전/오후) → 24시간제 자동 변환 (v3.0 신규)
    const time12hRegex = /(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/g;
    while ((match = time12hRegex.exec(body)) !== null) {
      const ampm = match[1];
      let hr = parseInt(match[2], 10);
      const min = match[3] ? parseInt(match[3], 10) : 0;
      if (hr >= 0 && hr <= 12 && min >= 0 && min <= 59) {
        if (ampm === "오후" && hr < 12) hr += 12;
        if (ampm === "오전" && hr === 12) hr = 0;
        const stdTime = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        pushBodyIssue({
          type: "error",
          category: "24시간제 시간 표기 (p.11)",
          wrong: match[0],
          right: stdTime,
          reason: "공문서 시간은 '오전/오후' 대신 24시간제(예: 08:00, 15:00)로 표기하는 것이 원칙입니다.",
          start: match.index,
          end: match.index + match[0].length,
          wrongRaw: match[0],
          rightRaw: stdTime
        });
      }
    }

    // 5. 물결표 앞뒤 공백
    const waveSpaceRegex = /(\S)\s+~\s+(\S)/g;
    while ((match = waveSpaceRegex.exec(body)) !== null) {
      pushBodyIssue({
        type: "warn",
        category: "기간 물결표 표기 (p.11)",
        wrong: match[0],
        right: `${match[1]}~${match[2]}`,
        reason: "기간 물결표(~) 앞뒤는 띄어쓰지 않고 붙여 씁니다.",
        start: match.index,
        end: match.index + match[0].length,
        wrongRaw: match[0],
        rightRaw: `${match[1]}~${match[2]}`
      });
    }

    // 6. ~와 '까지' 중복 (24시간제 변환과 겹치지 않도록 말미 '까지'만 정밀 타깃팅)
    const waveUntilRegex = /(~[^\n,.;]+?(?:\d{1,2}시(?:\s*\d{1,2}분)?|\d{1,2}:\d{2}))까지/g;
    while ((match = waveUntilRegex.exec(body)) !== null) {
      const kkaStart = match.index + match[1].length;
      pushBodyIssue({
        type: "error",
        category: "시간·기간 중복 오류 (p.11)",
        wrong: match[0],
        right: match[1] + " ('까지' 삭제)",
        reason: "물결표(~)에 이미 '부터~까지' 의미가 담겨 있으므로 뒤에 '까지'를 중복 쓰지 않습니다.",
        start: kkaStart,
        end: match.index + match[0].length,
        wrongRaw: "까지",
        rightRaw: ""
      });
    }

    // 7. 천 단위 쉼표 누락 금액 검출 (v3.0 신규)
    const plainWonRegex = /(^|[^\d,])(\d{4,})원/g;
    while ((match = plainWonRegex.exec(body)) !== null) {
      const numStr = match[2];
      const numStart = match.index + match[1].length;
      const formatted = `${Number(numStr).toLocaleString("ko-KR")}원`;
      pushBodyIssue({
        type: "warn",
        category: "금액 천 단위 쉼표 표기",
        wrong: `${numStr}원`,
        right: formatted,
        reason: "4자리 이상 금액은 가독성과 오류 방지를 위해 세 자리마다 쉼표(,)를 표기합니다.",
        start: numStart,
        end: numStart + numStr.length + 1,
        wrongRaw: `${numStr}원`,
        rightRaw: formatted
      });
    }

    // 8. 붙임: 콜론 오용 & 마지막 '끝.' 앞 2칸 공백 검증
    const attachColonRegex = /붙임\s*:\s*/g;
    while ((match = attachColonRegex.exec(body)) !== null) {
      pushBodyIssue({
        type: "error",
        category: "붙임 표기 오류 (p.18)",
        wrong: match[0].trim(),
        right: "붙임  (콜론 없이 2칸 띄우기)",
        reason: "행정업무운영편람상 '붙임' 뒤에는 콜론(:)을 쓰지 않고 1타(띄어쓰기 2번) 띄어 씁니다.",
        start: match.index,
        end: match.index + match[0].length,
        wrongRaw: match[0],
        rightRaw: "붙임  "
      });
    }

    const endSingleSpace = /([^\s\n]) 끝\./g;
    while ((match = endSingleSpace.exec(body)) !== null) {
      pushBodyIssue({
        type: "warn",
        category: "문서 종료 '끝.' 띄어쓰기 (p.18)",
        wrong: match[0],
        right: `${match[1]}  끝. (2칸 띄움)`,
        reason: "본문 또는 붙임의 마지막 글자에서 1글자(띄어쓰기 2번, 1타)를 띄우고 '끝.'을 표기합니다.",
        start: match.index,
        end: match.index + match[0].length,
        wrongRaw: match[0],
        rightRaw: `${match[1]}  끝.`
      });
    }

    // 9. 항목 위계 건너뛰기 및 들여쓰기 칸수 검증 (v3.0 보강)
    const lines = body.split("\n");
    let sawLevel1 = false;
    let sawLevel2 = false;
    let lineOffset = 0;
    lines.forEach((line) => {
      if (/^\s*1\.\s+/.test(line)) {
        sawLevel1 = true;
        sawLevel2 = false;
      } else if (/^가\.\s+/.test(line)) {
        sawLevel2 = true;
        pushBodyIssue({
          type: "warn",
          category: "항목 들여쓰기 기준 (p.11)",
          wrong: line.slice(0, 8),
          right: "  " + line.slice(0, 8) + " (2칸 들여쓰기)",
          reason: "2단계 항목 '가.'는 왼쪽 기본선에서 2칸(1타, vv) 들여 씁니다.",
          start: lineOffset,
          end: lineOffset + 2,
          wrongRaw: "가.",
          rightRaw: "  가."
        });
      } else if (/^\s+가\.\s+/.test(line)) {
        sawLevel2 = true;
      } else if (/^\s*1\)\s+/.test(line)) {
        if (sawLevel1 && !sawLevel2) {
          issues.push({
            type: "warn",
            category: "항목 기호 위계 오류 (p.11)",
            wrong: line.trim().slice(0, 18),
            right: "1. → 가. → 1) 순서 준수",
            reason: "'1.' 다음에는 반드시 '가.'를 사용한 뒤 하위 항목으로 '1)'을 사용합니다.",
            fixTarget: "none"
          });
        }
        const leadSpaces = line.match(/^(\s*)1\)/)[1].length;
        if (leadSpaces < 4) {
          pushBodyIssue({
            type: "warn",
            category: "항목 들여쓰기 기준 (p.11)",
            wrong: line.slice(0, leadSpaces + 2),
            right: "    1) (4칸 들여쓰기)",
            reason: "3단계 항목 '1)'은 왼쪽 기본선에서 4칸(2타) 들여 씁니다.",
            start: lineOffset,
            end: lineOffset + leadSpaces + 2,
            wrongRaw: line.slice(0, leadSpaces + 2),
            rightRaw: "    1)"
          });
        }
      }

      // 본문 줄 중간 중복 공백 검출 (들여쓰기·'붙임  '·'  끝.' 제외)
      const trimmedLead = line.length - line.trimStart().length;
      const inner = line.slice(trimmedLead);
      const dblSpaceRegex = /([^\s]) {2,}([^\s])/g;
      let dm;
      while ((dm = dblSpaceRegex.exec(inner)) !== null) {
        const beforeChunk = inner.slice(0, dm.index + 1);
        const afterChunk = inner.slice(dm.index + dm[0].length - 1);
        if (beforeChunk.endsWith("붙임") || afterChunk.startsWith("끝.")) continue;
        const absStart = lineOffset + trimmedLead + dm.index;
        pushBodyIssue({
          type: "warn",
          category: "중복 띄어쓰기",
          wrong: dm[0],
          right: `${dm[1]} ${dm[2]}`,
          reason: "문장 내부에 불필요하게 두 칸 이상 띄어쓴 부분이 있습니다.",
          start: absStart,
          end: absStart + dm[0].length,
          wrongRaw: dm[0],
          rightRaw: `${dm[1]} ${dm[2]}`
        });
      }

      lineOffset += line.length + 1;
    });

    // 10. 내부결재 vs 대외발송 어조 검증 (v3.0 신규)
    if (docMode === "internal") {
      const extToneRegex = /(하여\s*주시기\s*바랍니다|해주시기\s*바랍니다)/g;
      while ((match = extToneRegex.exec(body)) !== null) {
        pushBodyIssue({
          type: "warn",
          category: "내부결재 어조 권장 (p.12)",
          wrong: match[0],
          right: "하기 바랍니다",
          reason: "학교 내부결재 기안문에서는 과도한 높임('~하여 주시기 바랍니다') 대신 간결한 '~하기 바랍니다' 또는 '~하고자 함'을 권장합니다.",
          start: match.index,
          end: match.index + match[0].length,
          wrongRaw: match[0],
          rightRaw: "하기 바랍니다"
        });
      }
    } else {
      const intToneRegex = /(하고자\s*함\.|하기\s*바람\.)/g;
      while ((match = intToneRegex.exec(body)) !== null) {
        const polite = match[0].includes("하고자") ? "하고자 합니다." : "하여 주시기 바랍니다.";
        pushBodyIssue({
          type: "warn",
          category: "대외발송 어조 권장 (p.12)",
          wrong: match[0],
          right: polite,
          reason: "대외 발송 공문서에서는 명사형 종결('~함', '~바람')보다 정중한 '~합니다 / ~하여 주시기 바랍니다'를 권장합니다.",
          start: match.index,
          end: match.index + match[0].length,
          wrongRaw: match[0],
          rightRaw: polite
        });
      }
    }

    // 11. 문법·띄어쓰기·피동·사동·중복 표현
    const grammarRules = [
      { regex: /검토바랍니다/g, right: docMode === "internal" ? "검토하기 바랍니다" : "검토하여 주시기 바랍니다", cat: "공문서 문장·띄어쓰기 (p.12)", reason: "대외발송은 '검토하여 주시기 바랍니다', 내부결재는 '검토하기 바랍니다'로 표현합니다." },
      { regex: /실시코자\s*하오니/g, right: "실시하고자 하오니", cat: "어문규범·투식어", reason: "'~코자' 대신 자연스러운 '~하고자'를 사용합니다." },
      { regex: /(할|될|볼|갈|올)수\s/g, right: "$1 수 ", cat: "의존명사 띄어쓰기 (p.10)", reason: "의존명사 '수'는 앞말과 반드시 띄어 씁니다." },
      { regex: /파악해주시기\s*드립니다/g, right: "파악하여 주시기 바랍니다", cat: "과도한 존칭·문장 호응 (p.12)", reason: "불필요한 '드립니다'를 지양합니다." },
      { regex: /강화시키기\s*위한/g, right: "강화하기 위한", cat: "불필요한 사동 표현", reason: "'~하다'로 충분한 곳에 '~시키다'를 남용하지 않습니다." },
      { regex: /계획되었습니다/g, right: "계획하였습니다", cat: "능동형 문장 권장 (p.8)", reason: "책임 소재가 분명한 능동형 표현을 권장합니다." },
      { regex: /에\s*있어서/g, right: "에서", cat: "일본어 번역 투", reason: "'~에 있어서'는 일본어 번역 투이므로 '~에서' 또는 '~에 관하여'로 고칩니다." },
      { regex: /요망\b/g, right: "바람", cat: "권위적 표현 순화", reason: "'요망' 대신 '~하기 바람'을 권장합니다." },
      { regex: /해마다\s*매년/g, right: "매년", cat: "중복 표현 (공문서 바로쓰기)", reason: "'해마다'와 '매년'은 같은 뜻의 중복 표현입니다." },
      { regex: /새로\s*신축/g, right: "신축", cat: "중복 표현 (공문서 바로쓰기)", reason: "'신축(新築)'에 이미 '새로'의 의미가 포함되어 있습니다." },
      { regex: /다시\s*재건/g, right: "재건", cat: "중복 표현 (공문서 바로쓰기)", reason: "'재건(再建)'에 이미 '다시'의 의미가 포함되어 있습니다." },
      { regex: /미리\s*사전/g, right: "사전", cat: "중복 표현 (공문서 바로쓰기)", reason: "'사전(事前)'에 이미 '미리'의 의미가 포함되어 있습니다." }
    ];

    grammarRules.forEach((rule) => {
      let m;
      const nonGlobal = new RegExp(rule.regex.source, rule.regex.flags.replace("g", ""));
      while ((m = rule.regex.exec(body)) !== null) {
        const replaced = m[0].replace(nonGlobal, rule.right);
        pushBodyIssue({
          type: "error",
          category: rule.cat,
          wrong: m[0].trim(),
          right: replaced.trim(),
          reason: rule.reason,
          start: m.index,
          end: m.index + m[0].length,
          wrongRaw: m[0],
          rightRaw: replaced
        });
      }
    });

    // 12. 첨부물 1개일 때 '붙임 1.' 오류
    const attachOneRegex = /붙임\s+1\.\s*([^\n]+?)\s+끝\./;
    if (attachOneRegex.test(body) && !/2\./.test(body.slice(body.indexOf("붙임")))) {
      const m = attachOneRegex.exec(body);
      const fixedAttach = `붙임  ${m[1].trim()}  끝.`;
      pushBodyIssue({
        type: "warn",
        category: "붙임 표기 원칙 (p.18)",
        wrong: m[0],
        right: fixedAttach,
        reason: "첨부물이 1개일 때는 '1.'을 매기지 않고 '붙임' 뒤 2칸(1타)을 띄운 후 바로 기재합니다.",
        start: m.index,
        end: m.index + m[0].length,
        wrongRaw: m[0],
        rightRaw: fixedAttach
      });
    }

    // 13. 순화어 사전 매칭 (모든 발생 위치 오프셋 기록)
    window.EDU_DATA.purifiedTerms.forEach((item) => {
      if (item.wrong === "귀교" || item.wrong === "귀사") return;
      let from = 0;
      const cleanRight = item.right.split("/")[0].split("(")[0].trim();
      while (from < body.length) {
        const pos = body.indexOf(item.wrong, from);
        if (pos === -1) break;
        pushBodyIssue({
          type: item.category.includes("오류") ? "error" : "warn",
          category: item.category,
          wrong: item.wrong,
          right: item.right,
          reason: item.reason,
          start: pos,
          end: pos + item.wrong.length,
          wrongRaw: item.wrong,
          rightRaw: cleanRight
        });
        from = pos + item.wrong.length;
      }
    });

    // 겹치는 본문 구간 정리 (더 길거나 앞선 오류 우선) → 제목·비수정 항목과 합치기
    const nonBodyIssues = issues.filter((i) => i.fixTarget !== "body");
    const bodyIssues = issues
      .filter((i) => i.fixTarget === "body")
      .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const dedupBody = [];
    let lastEnd = -1;
    for (const iss of bodyIssues) {
      if (iss.start >= lastEnd) {
        dedupBody.push(iss);
        lastEnd = iss.end;
      }
    }

    const finalIssues = [...nonBodyIssues, ...dedupBody];
    lastLintFixes = finalIssues;
    renderLintIssues(finalIssues);
    renderLintInlinePreviewSafe(title, body, finalIssues);
  }

  // 오프셋 기반 단일 패스 비중첩 하이라이트 (개별 클릭 시 정확한 해당 오프셋 교정)
  function renderLintInlinePreviewSafe(title, body, issues) {
    const box = document.getElementById("lintInlinePreview");
    if (!box) return;

    const spans = issues
      .map((iss, idx) => ({ iss, idx }))
      .filter(({ iss }) => iss.fixTarget === "body" && typeof iss.start === "number")
      .sort((a, b) => a.iss.start - b.iss.start);

    let htmlOut = "";
    let pos = 0;
    for (const { iss, idx } of spans) {
      if (iss.start < pos) continue;
      if (iss.start > pos) htmlOut += escapeHtml(body.slice(pos, iss.start));
      const cls = iss.type === "warn" ? "lint-mark-warn" : "lint-mark-error";
      const tip = `${iss.right} (${iss.category})`;
      htmlOut += `<span class="${cls}" title="${escapeHtml(tip)}" onclick="window.applySingleLintFix(${idx})">${escapeHtml(body.slice(iss.start, iss.end))}</span>`;
      pos = iss.end;
    }
    if (pos < body.length) htmlOut += escapeHtml(body.slice(pos));

    box.innerHTML = `<div style="font-weight:800; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem; margin-bottom:0.5rem;">제목: ${escapeHtml(title || "(미입력)")}</div><div>${htmlOut || '<span class="text-muted">본문을 입력하면 오류 구간에 실시간 밑줄이 표시됩니다.</span>'}</div>`;
  }

  function renderLintIssues(issues) {
    const badge = document.getElementById("lintSummaryBadge");
    const container = document.getElementById("lintIssuesContainer");
    if (issues.length === 0) {
      badge.className = "badge badge-green";
      badge.textContent = "표기 · 어문규범 완벽 (0건)";
      container.innerHTML = `<div class="callout callout-success" style="text-align:center; padding:1.75rem 1rem;"><div style="font-weight:800; color:var(--success); font-size:1rem;">검출된 공문서 표기 및 공공언어 오류가 없습니다!</div><div class="text-sm text-secondary mt-1">행정업무운영편람의 날짜·24시간제·항목·붙임 표기 원칙을 잘 준수하고 있습니다.</div></div>`;
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
          <div style="font-size:0.9rem; margin-bottom:0.22rem;"><span class="lint-wrong">${escapeHtml(iss.wrong)}</span><span style="margin:0 0.3rem;">→</span><span class="lint-right">${escapeHtml(iss.right)}</span></div>
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
    } else if (iss.fixTarget === "body" && typeof iss.start === "number") {
      const bodyEl = document.getElementById("lintBodyInput");
      const val = bodyEl.value;
      bodyEl.value = val.slice(0, iss.start) + iss.rightRaw + val.slice(iss.end);
    }
    runDocumentLinter();
  };

  function applyAllLinterFixes() {
    const fixable = lastLintFixes.filter((i) => i.fixTarget !== "none");
    if (fixable.length === 0) return window.showToast("자동 교정할 오류가 없습니다.");
    pushLintUndo();
    let titleVal = document.getElementById("lintTitleInput").value;
    let bodyVal = document.getElementById("lintBodyInput").value;
    fixable
      .filter((i) => i.fixTarget === "title" && i.applyFix)
      .forEach((iss) => {
        titleVal = iss.applyFix(titleVal);
      });
    // 본문 오류는 뒤쪽 오프셋부터 역순 치환 → 인덱스 어긋남 0%
    fixable
      .filter((i) => i.fixTarget === "body" && typeof i.start === "number")
      .sort((a, b) => b.start - a.start)
      .forEach((iss) => {
        bodyVal = bodyVal.slice(0, iss.start) + iss.rightRaw + bodyVal.slice(iss.end);
      });
    document.getElementById("lintTitleInput").value = titleVal;
    document.getElementById("lintBodyInput").value = bodyVal;
    runDocumentLinter();
    window.showToast("검출된 모든 표기·어문규범 오류가 교정되었습니다. (실행 취소 가능)");
  }

  window.copyCorrectedDoc = function () {
    window.copyText(`제목: ${document.getElementById("lintTitleInput").value}\n\n${document.getElementById("lintBodyInput").value}`, "교정된 기안문이 복사되었습니다.");
  };

  // ==========================================
  // Sub 2-2: 에듀파인 기안문 & 동적 표 빌더 + 자동 임시저장(P0-4) + 내 기안함(P1-1)
  // ==========================================
  const BUILDER_FIELD_IDS = ["bDocType", "bRelatedDoc", "bTitle", "bPurpose", "bDate", "bPlace", "bTarget", "bDetails", "bPlanB", "bBudget", "bAttachments", "bIncludeTable"];

  function initBuilderModule() {
    restoreBuilderDraftToForm();
    BUILDER_FIELD_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const onChange = () => {
        captureBuilderDraft();
        renderBuilderPreview();
      };
      el.addEventListener("input", onChange);
      el.addEventListener("change", onChange);
    });
    renderBuilderTableEditor();
    renderBuilderDraftsBar();
    renderBuilderPreview();
  }

  function captureBuilderDraft() {
    const data = {};
    BUILDER_FIELD_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      data[id] = el.type === "checkbox" ? el.checked : el.value;
    });
    data.tableRows = clone(builderTableRows);
    appState.builderDraft = data;
    saveState();
  }

  function restoreBuilderDraftToForm() {
    const d = appState.builderDraft;
    if (!d) return;
    BUILDER_FIELD_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el || d[id] === undefined) return;
      if (el.type === "checkbox") el.checked = Boolean(d[id]);
      else el.value = d[id];
    });
    if (Array.isArray(d.tableRows)) builderTableRows = clone(d.tableRows);
  }

  window.saveCurrentDraft = function () {
    captureBuilderDraft();
    const title = (document.getElementById("bTitle").value || "제목 없는 기안문").trim();
    const draft = {
      id: "draft-" + Date.now(),
      name: title.slice(0, 26),
      savedAt: new Date().toLocaleDateString("ko-KR"),
      payload: clone(appState.builderDraft)
    };
    appState.savedDrafts.unshift(draft);
    if (appState.savedDrafts.length > 20) appState.savedDrafts.pop();
    saveState();
    renderBuilderDraftsBar();
    window.showToast(`'${draft.name}'이(가) 내 기안함에 저장되었습니다.`);
  };

  window.loadSavedDraft = function (draftId) {
    const found = (appState.savedDrafts || []).find((d) => d.id === draftId);
    if (!found) return;
    appState.builderDraft = clone(found.payload);
    restoreBuilderDraftToForm();
    renderBuilderTableEditor();
    renderBuilderPreview();
    saveState();
    window.showToast(`'${found.name}' 기안문을 불러왔습니다.`);
  };

  window.deleteSavedDraft = function (draftId) {
    appState.savedDrafts = (appState.savedDrafts || []).filter((d) => d.id !== draftId);
    saveState();
    renderBuilderDraftsBar();
  };

  function renderBuilderDraftsBar() {
    const bar = document.getElementById("builderDraftsBar");
    if (!bar) return;
    const list = appState.savedDrafts || [];
    if (list.length === 0) {
      bar.innerHTML = `<span class="text-xs text-muted">저장된 기안문이 없습니다. 작성 중인 내용은 자동으로 임시저장됩니다.</span>`;
      return;
    }
    bar.innerHTML = list
      .map(
        (d) => `
      <span class="draft-chip">
        <button type="button" onclick="window.loadSavedDraft('${d.id}')" title="${escapeHtml(d.savedAt)} 저장">${escapeHtml(d.name)}</button>
        <button type="button" style="color:var(--text-muted);" onclick="window.deleteSavedDraft('${d.id}')" title="삭제">✕</button>
      </span>
    `
      )
      .join("");
  }

  window.addBuilderTableRow = function () {
    builderTableRows.push({ id: Date.now(), time: "", content: "", owner: "" });
    captureBuilderDraft();
    renderBuilderTableEditor();
    renderBuilderPreview();
  };

  window.removeBuilderTableRow = function (id) {
    builderTableRows = builderTableRows.filter((r) => r.id !== id);
    captureBuilderDraft();
    renderBuilderTableEditor();
    renderBuilderPreview();
  };

  window.updateBuilderTableCell = function (id, field, val) {
    const row = builderTableRows.find((r) => r.id === id);
    if (row) row[field] = val;
    captureBuilderDraft();
    renderBuilderPreview();
  };

  function renderBuilderTableEditor() {
    const wrap = document.getElementById("builderTableEditor");
    if (!wrap) return;
    wrap.innerHTML = builderTableRows
      .map(
        (r) => `
      <div class="builder-table-row">
        <input type="text" class="form-input btr-time" style="padding:0.4rem 0.55rem; font-size:0.82rem;" value="${escapeHtml(r.time)}" placeholder="시간" oninput="window.updateBuilderTableCell(${r.id}, 'time', this.value)" />
        <input type="text" class="form-input btr-content" style="padding:0.4rem 0.55rem; font-size:0.82rem;" value="${escapeHtml(r.content)}" placeholder="세부 내용" oninput="window.updateBuilderTableCell(${r.id}, 'content', this.value)" />
        <input type="text" class="form-input btr-owner" style="padding:0.4rem 0.55rem; font-size:0.82rem;" value="${escapeHtml(r.owner)}" placeholder="담당" oninput="window.updateBuilderTableCell(${r.id}, 'owner', this.value)" />
        <button type="button" class="btn btn-sm btn-secondary btr-del" onclick="window.removeBuilderTableRow(${r.id})" aria-label="행 삭제">✕</button>
      </div>
    `
      )
      .join("");
  }

  window.loadBuilderPreset = function (presetKey) {
    const p = window.EDU_DATA.builderPresets && window.EDU_DATA.builderPresets[presetKey];
    if (!p) return;
    document.getElementById("bDocType").value = p.docType;
    document.getElementById("bRelatedDoc").value = p.related;
    document.getElementById("bTitle").value = p.title;
    document.getElementById("bPurpose").value = p.purpose;
    document.getElementById("bDate").value = p.date;
    document.getElementById("bPlace").value = p.place;
    document.getElementById("bTarget").value = p.target;
    document.getElementById("bDetails").value = p.details;
    document.getElementById("bPlanB").value = p.planB;
    document.getElementById("bBudget").value = p.budget;
    document.getElementById("bAttachments").value = p.attachments;
    document.getElementById("bIncludeTable").checked = Boolean(p.includeTable);
    builderTableRows = clone(p.tableRows || defaultBuilderTableRows);
    captureBuilderDraft();
    renderBuilderTableEditor();
    renderBuilderPreview();
    window.showToast(`'${p.label}' 기안문 프리셋이 로드되었습니다.`);
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

    // 빈 항목을 건너뛰어도 가·나·다·라... 순서를 자동으로 유지 (P0 버그 해결)
    const hangulOrder = ["가", "나", "다", "라", "마", "바", "사", "아", "자", "차"];
    let subIdx = 0;
    const pushSub = (text) => {
      bodyLines.push(`  ${hangulOrder[subIdx++]}. ${text}`);
    };
    if (date) pushSub(`일시: ${date}`);
    if (place) pushSub(`장소: ${place}`);
    if (target) pushSub(`대상: ${target}`);
    if (details.length > 0) {
      pushSub("세부 추진 내용");
      details.forEach((d, i) => bodyLines.push(`    ${i + 1}) ${d}`));
    }
    if (planB) pushSub(`안전 대책 및 악천후 시 대안: ${planB}`);
    if (budget) pushSub(`소요 예산: ${budget}`);
    if (includeTable) pushSub("세부 일정표");

    const tableRowsFormatted = builderTableRows.map((r, rIdx) => {
      const isLast = rIdx === builderTableRows.length - 1;
      const cells = [r.time.trim(), r.content.trim(), r.owner.trim()];
      let markedBlank = false;
      return cells.map((c) => {
        if (!c && isLast && !markedBlank) {
          markedBlank = true;
          return { text: "이하 빈칸", isBlank: true };
        }
        return { text: c || "-", isBlank: false };
      });
    });

    const attachLines = [];
    if (attaches.length === 0) {
      if (includeTable) attachLines.push("  끝.");
      else bodyLines[bodyLines.length - 1] += "  끝.";
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

  window.sendBuilderToLinter = function () {
    const m = buildDocModel();
    const fullBody = m.attachLines.length ? `${m.bodyLines.join("\n")}\n\n${m.attachLines.join("\n")}` : m.bodyLines.join("\n");
    document.getElementById("lintTitleInput").value = m.title;
    document.getElementById("lintBodyInput").value = fullBody;
    const modeSel = document.getElementById("lintDocModeSelect");
    if (modeSel) modeSel.value = m.docType === "내부결재" ? "internal" : "external";
    lintUndoStack = [];
    updateUndoBtn();
    window.switchMainTab("tab-doc", "doc-sub-linter");
    runDocumentLinter();
    window.showToast("기안문 초안을 린터로 불러와 최종 어문규범 점검을 실행했습니다.");
  };

  function renderBuilderPreview() {
    const m = buildDocModel();
    const tableHtml = m.includeTable
      ? `<table class="edufine-table"><thead><tr><th style="width:24%;">시간</th><th>주요 활동 내용</th><th style="width:20%;">담당</th></tr></thead><tbody>${m.tableRowsFormatted
          .map((cells) => `<tr>${cells.map((c) => `<td class="${c.isBlank ? "blank-cell" : ""}">${escapeHtml(c.text)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      : "";

    document.getElementById("edufinePreviewBox").innerHTML = `
      <div class="edufine-header">
        <div class="edufine-org-name">○ ○ 초 등 학 교</div>
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
      txt += "\n[세부 일정표]\n" + m.tableRowsFormatted.map((cells) => `  - ${cells.map((c) => c.text).join(" | ")}`).join("\n");
    }
    if (m.attachLines.length) txt += `\n\n${m.attachLines.join("\n")}`;
    window.copyText(txt, "기안문 텍스트가 복사되었습니다.");
  };

  window.copyBuilderRichHtml = async function () {
    const m = buildDocModel();
    const inlineTable = m.includeTable
      ? `<table style="border-collapse:collapse;width:100%;font-size:10pt;margin:8px 0;"><thead><tr><th style="border:1px solid #000;background:#f1f5f9;padding:4px 6px;">시간</th><th style="border:1px solid #000;background:#f1f5f9;padding:4px 6px;">주요 활동 내용</th><th style="border:1px solid #000;background:#f1f5f9;padding:4px 6px;">담당</th></tr></thead><tbody>${m.tableRowsFormatted
          .map((cells) => `<tr>${cells.map((c) => `<td style="border:1px solid #000;padding:4px 6px;text-align:center;">${escapeHtml(c.text)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      : "";
    const htmlDoc = `<div style="font-family:'맑은 고딕',sans-serif;font-size:10.5pt;line-height:1.7;"><p style="font-weight:bold;">제목: ${escapeHtml(m.title)}</p><pre style="font-family:'맑은 고딕',sans-serif;white-space:pre-wrap;margin:0;">${escapeHtml(m.bodyLines.join("\n"))}</pre>${inlineTable}<pre style="font-family:'맑은 고딕',sans-serif;white-space:pre-wrap;margin-top:8px;">${escapeHtml(m.attachLines.join("\n"))}</pre></div>`;
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
      } catch (e) {}
    }
    window.copyBuilderOutput();
  };

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
      .map((item) => `<tr><td><span class="badge badge-gray">${escapeHtml(item.category)}</span></td><td><span class="lint-wrong">${escapeHtml(item.wrong)}</span></td><td><span class="lint-right">${escapeHtml(item.right)}</span></td><td>${escapeHtml(item.reason)}</td></tr>`)
      .join("");
  }

  // ==========================================
  // 5. MODULE 3: 학교회계 (비목 마법사 + 품의 CSV[IME 해결] + 개산급 정산서[IME/공식인쇄] + 회수 시뮬레이터)
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

    // 성립전 예산 자동 임시저장 복원
    document.getElementById("preProjectName").value = appState.preBudgetDraft.projectName;
    document.getElementById("preTotalGrant").value = appState.preBudgetDraft.totalGrant;
    document.getElementById("preProjectName").addEventListener("input", () => {
      appState.preBudgetDraft.projectName = document.getElementById("preProjectName").value;
      saveState();
    });
    document.getElementById("preTotalGrant").addEventListener("input", () => {
      appState.preBudgetDraft.totalGrant = parseInt(document.getElementById("preTotalGrant").value, 10) || 0;
      saveState();
      renderPreBudgetTable();
    });
    renderPreBudgetTable();
    renderPumuiCsvTable();

    // 개산급 정산서 복원 (담임교사명 저장 포함)
    document.getElementById("settleReceived").value = appState.settlement.received;
    document.getElementById("settleEndDate").value = appState.settlement.endDate;
    document.getElementById("settleTeacher").value = appState.settlement.teacher || appState.profile.teacherName;
    document.getElementById("settleClassName").value = appState.settlement.className;

    ["settleReceived", "settleEndDate", "settleTeacher", "settleClassName"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => {
        appState.settlement.received = parseInt(document.getElementById("settleReceived").value, 10) || 0;
        appState.settlement.endDate = document.getElementById("settleEndDate").value;
        appState.settlement.teacher = document.getElementById("settleTeacher").value;
        appState.settlement.className = document.getElementById("settleClassName").value;
        saveState();
        updateSettlementSummaryOnly();
      });
    });
    renderSettlementTable();
    renderRecallSimulator();
    renderSettleSimulator();

    // v3.0 신규: 공무원 국내 출장 여비 계산기 & 물품·용역·공사 계약 판별기 초기화
    ["travelScopeSelect", "travelPeople", "travelInHours", "travelInCar", "travelDays", "travelNights", "travelRegion", "travelFare", "travelOutCar"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", calculateTravelAllowance);
        el.addEventListener("change", calculateTravelAllowance);
      }
    });
    calculateTravelAllowance();

    ["contractTypeSelect", "contractVatMode", "contractAmountInput", "contractPreferredCheck"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", evaluateContractMethod);
        el.addEventListener("change", evaluateContractMethod);
      }
    });
    evaluateContractMethod();

    ["classOpClasses", "classOpStudents"].forEach((id) => document.getElementById(id).addEventListener("input", calculateClassOperation));
    ["promoPeople", "promoTotal"].forEach((id) => document.getElementById(id).addEventListener("input", calculatePromoLimit));
    calculateClassOperation();
    calculatePromoLimit();
  }

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
            <div style="font-size:1.25rem; font-weight:800; color:var(--brand-primary); margin-bottom:0.4rem;">추천 원가통계비목: 『${escapeHtml(opt.result.item)}』</div>
            <p class="text-sm mb-1"><strong>판단 근거:</strong> ${escapeHtml(opt.result.reason)}</p>
            <div class="callout callout-warn text-xs"><strong>실무 주의사항:</strong> ${escapeHtml(opt.result.caution)}</div>
          </div>
        `;
        return;
      }
      node = opt.next;
    }

    container.innerHTML = `
      <div class="wizard-steps">
        ${breadcrumbs.map((b, i) => `<span class="wizard-step-pill done">${i + 1}. ${escapeHtml(b)}</span>`).join("")}
        <span class="wizard-step-pill active">Step ${costWizardPath.length + 1} 선택</span>
        ${costWizardPath.length > 0 ? `<button type="button" class="btn btn-sm btn-secondary" onclick="window.stepBackCostWizard()">← 이전</button>` : ""}
      </div>
      <div style="font-weight:800; font-size:0.95rem; margin-bottom:0.65rem;">${escapeHtml(node.question)}</div>
      <div class="wizard-choices">
        ${node.options
          .map((opt, idx) => `<button type="button" class="wizard-choice-btn" onclick="window.chooseCostWizardOption(${idx})">${escapeHtml(opt.label)}<span class="wizard-choice-sub">${escapeHtml(opt.sub)}</span></button>`)
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
        <div class="row-between mb-1"><span class="badge badge-gray">대상: ${escapeHtml(c.target)}</span><span class="badge badge-blue">세목: ${escapeHtml(c.code)}</span></div>
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
          <div class="callout callout-info" style="border-left-width:3px;"><div style="font-weight:700; font-size:0.84rem; margin-bottom:0.2rem;">${escapeHtml(v.leftName)}</div><div class="text-xs text-secondary" style="white-space:pre-line;">${escapeHtml(v.leftDesc)}</div></div>
          <div class="surface-box"><div style="font-weight:700; font-size:0.84rem; margin-bottom:0.2rem;">${escapeHtml(v.rightName)}</div><div class="text-xs text-secondary" style="white-space:pre-line;">${escapeHtml(v.rightDesc)}</div></div>
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
      <div style="font-size:1.25rem; font-weight:800; color:var(--brand-primary); margin-bottom:0.35rem;">총 강사수당: ${formatNumber(d.total)}원 <span class="badge badge-blue">운영수당</span></div>
      <div class="font-mono text-xs" style="background:var(--bg-secondary); padding:0.4rem 0.6rem; border-radius:6px; border:1px solid var(--border-color);">에듀파인 산출식: <strong>${escapeHtml(d.formula)}</strong></div>
    `;
  }

  window.copyInstructorFormula = function () {
    const d = getInstructorCalcData();
    window.copyText(d.formula, `산출식(${d.formula})이 복사되었습니다.`);
  };

  window.addInstructorToBudget = function () {
    const d = getInstructorCalcData();
    appState.preBudgetDraft.rows.push({
      id: Date.now(),
      bimok: "운영수당",
      desc: `${d.rateObj.name.split("(")[0].trim()} 강사 수당 (${d.hours}시간)`,
      formula: d.formula,
      amount: d.total
    });
    saveState();
    renderPreBudgetTable();
    window.showToast("성립전 예산 세출표에 강사수당이 추가되었습니다.");
  };

  window.sendInstructorToBuilder = function () {
    const d = getInstructorCalcData();
    const budgetText = `강사수당(운영수당·${d.rateObj.name.split("(")[0].trim()}): 금${formatNumber(d.total)}원(금${numberToKoreanWords(d.total)}원) [${d.formula}]`;
    document.getElementById("bBudget").value = budgetText;
    captureBuilderDraft();
    renderBuilderPreview();
    window.switchMainTab("tab-doc", "doc-sub-builder");
    window.showToast("강사수당 산출식이 기안문 빌더의 소요 예산란에 반영되었습니다.");
  };

  window.sendPreBudgetToBuilder = function () {
    const name = document.getElementById("preProjectName").value.trim() || "교육활동 사업";
    const totalExp = (appState.preBudgetDraft.rows || []).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const budgetText = `${name} 소요 예산(성립전): 금${formatNumber(totalExp)}원(금${numberToKoreanWords(totalExp)}원)`;
    document.getElementById("bBudget").value = budgetText;
    captureBuilderDraft();
    renderBuilderPreview();
    window.switchMainTab("tab-doc", "doc-sub-builder");
    window.showToast("성립전 예산 합계가 기안문 빌더의 소요 예산란에 반영되었습니다.");
  };

  window.loadSamplePreBudget = function () {
    appState.preBudgetDraft = {
      projectName: "2026년 공생의 길(물길, 숲길) 프로젝트 운영",
      totalGrant: 1200000,
      rows: clone(defaultPreBudgetRows)
    };
    document.getElementById("preProjectName").value = appState.preBudgetDraft.projectName;
    document.getElementById("preTotalGrant").value = appState.preBudgetDraft.totalGrant;
    saveState();
    renderPreBudgetTable();
    window.showToast("공생의 길 프로젝트 예시가 로드되었습니다.");
  };

  window.addCustomPreBudgetRow = function () {
    const bimok = document.getElementById("newPreBimok").value;
    const desc = document.getElementById("newPreDesc").value.trim() || "교육활동 운영";
    const formula = document.getElementById("newPreFormula").value.trim() || "100,000원×1식=100,000원";
    const amount = parseInt(document.getElementById("newPreAmount").value, 10) || 0;
    if (amount <= 0) return window.showToast("올바른 요구액(원)을 입력해 주세요.");
    appState.preBudgetDraft.rows.push({ id: Date.now(), bimok, desc, formula, amount });
    document.getElementById("newPreDesc").value = "";
    document.getElementById("newPreFormula").value = "";
    document.getElementById("newPreAmount").value = "";
    saveState();
    renderPreBudgetTable();
  };

  window.removePreBudgetRow = function (id) {
    appState.preBudgetDraft.rows = appState.preBudgetDraft.rows.filter((r) => r.id !== id);
    saveState();
    renderPreBudgetTable();
  };

  function renderPreBudgetTable() {
    const grant = parseInt(document.getElementById("preTotalGrant").value, 10) || 0;
    const rows = appState.preBudgetDraft.rows || [];
    const tbody = document.getElementById("preBudgetTableBody");
    let totalExp = 0;
    let snackExp = 0;

    tbody.innerHTML =
      rows
        .map((r) => {
          totalExp += r.amount;
          if (r.bimok.includes("간식") || r.desc.includes("간식")) snackExp += r.amount;
          return `<tr><td><span class="badge badge-blue">${escapeHtml(r.bimok.replace(/\(.*\)/, ""))}</span></td><td>${escapeHtml(r.desc)}</td><td class="font-mono text-xs">${escapeHtml(r.formula)}</td><td style="font-weight:700; text-align:right;">${formatNumber(r.amount)}</td><td><button type="button" class="btn btn-sm btn-secondary" onclick="window.removePreBudgetRow(${r.id})">✕</button></td></tr>`;
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
    const rowsText = (appState.preBudgetDraft.rows || []).map((r, i) => `    ${i + 1}) [${r.bimok.replace(/\(.*\)/, "")}] ${r.desc}: ${r.formula}`).join("\n");
    const text = `제목: ${proj} 성립전 예산 요구\n\n1. 관련: 교육지원과-6788(2026. 4. 13.)\n2. ${proj} 운영비가 교부되었으나, 추가경정예산에 편성하기에는 시간적 여유가 없어 다음과 같이 성립전 예산편성을 요구합니다.\n  가. 사업명: ${proj}\n  나. 교부금액: 금${formatNumber(grant)}원(금${numberToKoreanWords(grant)}원)\n  다. 예산편성 요구 내용\n    [세입예산] 교육비특별회계전입금(목적사업비전입금): ${formatNumber(grant)}원\n    [세출예산]\n${rowsText}\n    - 합계: ${formatNumber(grant)}원.  끝.`;
    window.copyText(text, "성립전 예산 요구 기안문이 복사되었습니다.");
  };

  // P0-1 해결: 품의 CSV 테이블 — 입력 중 tbody 재렌더링 금지, 소계/총합 셀만 부분 DOM 업데이트!
  window.addPumuiItemRow = function () {
    appState.pumuiItems.push({ id: Date.now(), name: "", spec: "", unit: "개", qty: 1, price: 0 });
    saveState();
    renderPumuiCsvTable();
  };

  window.removePumuiItemRow = function (id) {
    appState.pumuiItems = appState.pumuiItems.filter((i) => i.id !== id);
    saveState();
    renderPumuiCsvTable();
  };

  window.updatePumuiCell = function (id, field, val) {
    const item = appState.pumuiItems.find((i) => i.id === id);
    if (!item) return;
    item[field] = field === "qty" || field === "price" ? Math.max(0, parseInt(val, 10) || 0) : val;
    saveState();
    const subCell = document.getElementById(`pumui-sub-${id}`);
    if (subCell) subCell.textContent = `${formatNumber(item.qty * item.price)}원`;
    updatePumuiGrandTotalOnly();
  };

  function updatePumuiGrandTotalOnly() {
    const total = (appState.pumuiItems || []).reduce((acc, i) => acc + i.qty * i.price, 0);
    const el = document.getElementById("pumuiCsvTotalDisplay");
    if (el) el.textContent = `총 품의 예상액: ${formatNumber(total)}원`;
  }

  function renderPumuiCsvTable() {
    const tbody = document.getElementById("pumuiCsvTableBody");
    if (!tbody) return;
    tbody.innerHTML = (appState.pumuiItems || [])
      .map(
        (item) => `
      <tr>
        <td data-label="품명"><input type="text" class="form-input" style="padding:0.4rem 0.55rem;" value="${escapeHtml(item.name)}" placeholder="품명" oninput="window.updatePumuiCell(${item.id}, 'name', this.value)" /></td>
        <td data-label="규격"><input type="text" class="form-input" style="padding:0.4rem 0.55rem;" value="${escapeHtml(item.spec)}" placeholder="규격" oninput="window.updatePumuiCell(${item.id}, 'spec', this.value)" /></td>
        <td data-label="단위" style="width:85px;"><input type="text" class="form-input" style="padding:0.4rem 0.55rem;" value="${escapeHtml(item.unit)}" oninput="window.updatePumuiCell(${item.id}, 'unit', this.value)" /></td>
        <td data-label="수량" style="width:90px;"><input type="number" class="form-input" style="padding:0.4rem 0.55rem;" value="${item.qty}" min="1" oninput="window.updatePumuiCell(${item.id}, 'qty', this.value)" /></td>
        <td data-label="예상단가(원)" style="width:120px;"><input type="number" class="form-input" style="padding:0.4rem 0.55rem;" value="${item.price}" step="100" oninput="window.updatePumuiCell(${item.id}, 'price', this.value)" /></td>
        <td data-label="예상금액(원)" id="pumui-sub-${item.id}" style="font-weight:700; text-align:right; white-space:nowrap;">${formatNumber(item.qty * item.price)}원</td>
        <td data-label="삭제"><button type="button" class="btn btn-sm btn-secondary" onclick="window.removePumuiItemRow(${item.id})">✕</button></td>
      </tr>
    `
      )
      .join("");
    updatePumuiGrandTotalOnly();
  }

  window.exportPumuiCsv = function () {
    const header = ["품명", "규격", "단위", "수량", "예상단가", "예상금액"];
    const rows = (appState.pumuiItems || []).map((i) => [i.name, i.spec, i.unit, i.qty, i.price, i.qty * i.price]);
    const csvBody = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    downloadFile("K에듀파인_품의품목_업로드양식.csv", "\uFEFF" + csvBody, "text/csv;charset=utf-8;");
    window.showToast("K-에듀파인 품의용 CSV 파일(UTF-8 BOM)이 다운로드되었습니다.");
  };

  // P0-1 & P0-3 해결: 개산급 정산표 (한글 IME 끊김 해결 + 공식 A4 정산서 인쇄 템플릿)
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
    // 입력 중 tbody를 다시 그리지 않고 상단 합계 배너만 갱신!
    updateSettlementSummaryOnly();
  };

  function updateSettlementSummaryOnly() {
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
          <strong>${escapeHtml(appState.settlement.className)} (${escapeHtml(teacher)})</strong><br/>
          <span class="text-sm">수령액(A): <strong>${formatNumber(received)}원</strong> · 집행액(B): <strong>${formatNumber(spent)}원</strong> · 잔액(A-B): <strong style="color:${remain < 0 ? "var(--danger)" : "var(--brand-primary)"};">${formatNumber(remain)}원</strong></span>
        </div>
        <div>${deadlineHtml}</div>
      </div>
    `;
  }

  function renderSettlementTable() {
    updateSettlementSummaryOnly();
    const rows = appState.settlement.rows || [];
    document.getElementById("settlementTableBody").innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td data-label="사용일자" style="width:140px;"><input type="date" class="form-input" style="padding:0.38rem 0.5rem;" value="${escapeHtml(r.date)}" oninput="window.updateSettlementCell(${r.id}, 'date', this.value)" /></td>
        <td data-label="사용업체명"><input type="text" class="form-input" style="padding:0.38rem 0.5rem;" value="${escapeHtml(r.vendor)}" placeholder="사용업체명" oninput="window.updateSettlementCell(${r.id}, 'vendor', this.value)" /></td>
        <td data-label="증빙구분" style="width:125px;">
          <select class="form-select" style="padding:0.38rem 0.5rem;" onchange="window.updateSettlementCell(${r.id}, 'proof', this.value)">
            <option value="전산자료" ${r.proof === "전산자료" ? "selected" : ""}>전산자료(카드)</option>
            <option value="현금영수증" ${r.proof === "현금영수증" ? "selected" : ""}>현금영수증</option>
            <option value="간이영수증" ${r.proof === "간이영수증" ? "selected" : ""}>기타 영수증</option>
          </select>
        </td>
        <td data-label="사용내역"><input type="text" class="form-input" style="padding:0.38rem 0.5rem;" value="${escapeHtml(r.desc)}" placeholder="사용내역" oninput="window.updateSettlementCell(${r.id}, 'desc', this.value)" /></td>
        <td data-label="사용금액(원)" style="width:125px;"><input type="number" class="form-input" style="padding:0.38rem 0.5rem; text-align:right;" value="${r.amount}" step="100" oninput="window.updateSettlementCell(${r.id}, 'amount', this.value)" /></td>
        <td data-label="삭제" class="no-print"><button type="button" class="btn btn-sm btn-secondary" onclick="window.removeSettlementRow(${r.id})">✕</button></td>
      </tr>
    `
      )
      .join("");
  }

  window.printSettlementOfficial = function () {
    const received = appState.settlement.received || 0;
    const rows = appState.settlement.rows || [];
    const spent = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const remain = received - spent;
    const teacher = document.getElementById("settleTeacher")?.value || appState.profile.teacherName;
    const todayStr = new Date().toLocaleDateString("ko-KR");

    document.getElementById("settlementOfficialPrint").innerHTML = `
      <div style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:0.85rem; margin-bottom:1.25rem;">
        <h2 style="font-size:1.55rem; font-weight:800; letter-spacing:0.25em; margin-top:0.2rem;">정 산 서</h2>
      </div>
      <div style="margin-bottom:1rem; font-size:0.95rem; line-height:1.9;">
        <div><strong>□ 건 명:</strong> 학급운영비 개산급 정산 (${escapeHtml(appState.settlement.className)})</div>
        <div><strong>□ 수령액(A):</strong> 금${formatNumber(received)}원 (금${numberToKoreanWords(received)}원)</div>
        <div><strong>□ 집행액(B):</strong> 금${formatNumber(spent)}원 (금${numberToKoreanWords(spent)}원)</div>
        <div><strong>□ 잔 액(A-B):</strong> 금${formatNumber(remain)}원</div>
      </div>
      <table class="edufine-table">
        <thead>
          <tr><th style="width:48px;">순번</th><th style="width:105px;">사용일자</th><th style="width:130px;">사용업체명</th><th style="width:90px;">증빙구분</th><th>사용내역</th><th style="width:105px;">사용금액(원)</th></tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.vendor || "-")}</td><td>${escapeHtml(r.proof)}</td><td style="text-align:left;">${escapeHtml(r.desc || "-")}</td><td style="text-align:right;">${formatNumber(r.amount)}</td></tr>`
            )
            .join("")}
          <tr style="font-weight:800; background:#f1f5f9;"><td colspan="5">합 계</td><td style="text-align:right;">${formatNumber(spent)}</td></tr>
        </tbody>
      </table>
      <div style="margin-top:2rem; text-align:center; font-size:0.95rem;">
        <p style="margin-bottom:1.5rem;">위와 같이 학급운영비 개산급을 정산하고 증빙서류를 첨부하여 제출합니다.</p>
        <p style="margin-bottom:1.5rem;">${escapeHtml(todayStr)}</p>
        <div style="display:flex; justify-content:space-around; font-weight:700;">
          <span>임시출납원(담임): ${escapeHtml(teacher)} &nbsp;&nbsp; (인)</span>
          <span>출납원(행정실장) 확인: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (인)</span>
        </div>
      </div>
    `;
    window.printIsolatedZone("settlement");
  };

  window.exportSettlementCsv = function () {
    const header = ["사용일자", "사용업체명", "증빙구분", "사용내역", "사용금액"];
    const rows = (appState.settlement.rows || []).map((r) => [r.date, r.vendor, r.proof, r.desc, r.amount]);
    const csvBody = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    downloadFile(`학급운영비_개산급정산서_${appState.settlement.className}.csv`, "\uFEFF" + csvBody, "text/csv;charset=utf-8;");
    window.showToast("개산급 정산내역 CSV 파일이 다운로드되었습니다.");
  };

  // v3.0 신규: 공무원 국내 출장 여비 자동 계산기
  function getTravelCalcData() {
    const r = window.EDU_DATA.travelRules;
    const scope = document.getElementById("travelScopeSelect")?.value || "in";
    const people = Math.max(1, parseInt(document.getElementById("travelPeople")?.value, 10) || 1);

    if (scope === "in") {
      const hours = document.getElementById("travelInHours")?.value || "over4";
      const car = document.getElementById("travelInCar")?.value === "yes";
      const base = hours === "under4" ? r.inRegionUnder4h : r.inRegionOver4h;
      const perPerson = Math.max(0, base - (car ? r.inRegionOfficialCarDeduct : 0));
      const total = perPerson * people;
      const label = hours === "under4" ? "관내 4시간 미만" : "관내 4시간 이상";
      const formula = `관내출장 여비(${label}${car ? "·공용차량 감액" : ""}): ${formatNumber(perPerson)}원×${people}명=${formatNumber(total)}원`;
      const breakdown = `1인당 ${formatNumber(base)}원${car ? ` - 공용차량 감액 ${formatNumber(r.inRegionOfficialCarDeduct)}원` : ""} = ${formatNumber(perPerson)}원`;
      return { scope, people, perPerson, total, formula, breakdown, note: "근무지 내 출장은 영수증 정산 없이 정액 지급(공용차량 이용 시 1만 원 감액)." };
    }

    const days = Math.max(1, parseInt(document.getElementById("travelDays")?.value, 10) || 1);
    const nights = Math.max(0, Math.min(days - 1, parseInt(document.getElementById("travelNights")?.value, 10) || 0));
    const regionKey = document.getElementById("travelRegion")?.value || "other";
    const regionInfo = r.lodgingCaps[regionKey] || r.lodgingCaps.other;
    const fare = Math.max(0, parseInt(document.getElementById("travelFare")?.value, 10) || 0);
    const car = document.getElementById("travelOutCar")?.value === "yes";

    const dailyRate = car ? Math.round(r.outDailyAllowance / 2) : r.outDailyAllowance;
    const dailyTotal = dailyRate * days;
    const mealTotal = r.outMealAllowance * days;
    const lodgingMax = regionInfo.cap * nights;
    const perPerson = dailyTotal + mealTotal + lodgingMax + fare;
    const total = perPerson * people;
    const parts = [`일비 ${formatNumber(dailyTotal)}원`, `식비 ${formatNumber(mealTotal)}원`];
    if (nights > 0) parts.push(`숙박비 상한 ${formatNumber(lodgingMax)}원(${regionInfo.label} ${nights}박)`);
    if (fare > 0) parts.push(`운임 ${formatNumber(fare)}원`);
    const formula = `관외출장 여비(${days}일${nights > 0 ? ` ${nights}박` : ""}): ${formatNumber(perPerson)}원×${people}명=${formatNumber(total)}원`;
    return {
      scope,
      people,
      perPerson,
      total,
      formula,
      breakdown: `1인 기준: ${parts.join(" + ")} = ${formatNumber(perPerson)}원`,
      note: "관외출장 운임·숙박비는 영수증 실비 정산(출장 종료 다음 날부터 1주일 이내 K-에듀파인 여비정산서 제출)."
    };
  }

  function calculateTravelAllowance() {
    const scope = document.getElementById("travelScopeSelect")?.value || "in";
    const inBox = document.getElementById("travelInOptions");
    const outBox = document.getElementById("travelOutOptions");
    if (inBox) inBox.style.display = scope === "in" ? "grid" : "none";
    if (outBox) outBox.style.display = scope === "out" ? "block" : "none";

    const box = document.getElementById("travelResultBox");
    if (!box) return;
    const d = getTravelCalcData();
    box.innerHTML = `
      <div class="text-xs text-secondary mb-1">${escapeHtml(d.breakdown)}</div>
      <div style="font-size:1.22rem; font-weight:800; color:var(--brand-primary); margin-bottom:0.35rem;">총 출장 여비: ${formatNumber(d.total)}원 <span class="badge badge-blue">여비 (B10-01)</span></div>
      <div class="font-mono text-xs mb-1" style="background:var(--bg-secondary); padding:0.4rem 0.6rem; border-radius:6px; border:1px solid var(--border-color);">에듀파인 산출식: <strong>${escapeHtml(d.formula)}</strong></div>
      <div class="text-xs text-muted">${escapeHtml(d.note)}</div>
    `;
  }

  window.copyTravelFormula = function () {
    const d = getTravelCalcData();
    window.copyText(d.formula, `출장 여비 산출식(${d.formula})이 복사되었습니다.`);
  };

  window.sendTravelToBuilder = function () {
    const d = getTravelCalcData();
    document.getElementById("bBudget").value = `${d.formula} (여비·금${formatNumber(d.total)}원(금${numberToKoreanWords(d.total)}원))`;
    captureBuilderDraft();
    renderBuilderPreview();
    window.switchMainTab("tab-doc", "doc-sub-builder");
    window.showToast("출장 여비 산출식이 기안문 빌더의 소요 예산란에 반영되었습니다.");
  };

  // v3.0 신규: 물품·용역·공사 계약 방법(수의/S2B/G2B) 판별기
  function evaluateContractMethod() {
    const box = document.getElementById("contractResultBox");
    if (!box) return;
    const type = document.getElementById("contractTypeSelect")?.value || "goods";
    const vatMode = document.getElementById("contractVatMode")?.value || "incl";
    const raw = Math.max(0, parseInt(document.getElementById("contractAmountInput")?.value, 10) || 0);
    const isPref = Boolean(document.getElementById("contractPreferredCheck")?.checked);

    const estPrice = vatMode === "incl" ? Math.round(raw / 1.1) : raw;
    const totalVatIncl = vatMode === "incl" ? raw : Math.round(raw * 1.1);

    const isGoodsOrService = type === "goods" || type === "service";
    const oneQuoteLimit = isGoodsOrService && isPref ? 50000000 : 20000000;
    const twoQuoteLimit =
      type === "constGeneral" ? 400000000 : type === "constSpecial" ? 200000000 : type === "constOther" ? 160000000 : 100000000;

    let methodTitle = "";
    let badgeCls = "badge-green";
    let methodDesc = "";
    let docs = [];

    if (estPrice <= 0) {
      box.innerHTML = `<div class="surface-box text-sm text-muted">예상 계약 금액(원)을 입력하면 적용 계약 방법과 필수 서류가 자동 판별됩니다.</div>`;
      return;
    } else if (estPrice <= oneQuoteLimit) {
      methodTitle = "1인 견적 수의계약 가능";
      badgeCls = "badge-green";
      methodDesc =
        estPrice > 10000000 && isGoodsOrService
          ? `법령상 1인 수의계약(추정가격 ${formatNumber(oneQuoteLimit)}원 이하) 대상이나, 1천만 원 초과 시 학교·교육청 자체 기준에 따라 2인 이상 견적 비교 또는 S2B(학교장터) 이용을 적극 권장합니다.`
          : `추정가격 ${formatNumber(oneQuoteLimit)}원 이하로 1인 견적 수의계약이 가능합니다. (행정실 사전 품의 및 시장조사 권장)`;
      docs = ["지출품의서 (사전 결재)", "견적서 (1인 이상)", "사업자등록증 · 통장사본", "승낙사항 (또는 계약서)", "검사·검수조서", "청렴서약서 (필요 시)"];
    } else if (estPrice <= twoQuoteLimit) {
      methodTitle = "지정정보처리장치(S2B·G2B) 2인 이상 견적 소액수의";
      badgeCls = "badge-amber";
      methodDesc = `추정가격 ${formatNumber(oneQuoteLimit)}원 초과 ~ ${formatNumber(twoQuoteLimit)}원 이하 구간입니다. 나라장터(G2B) 또는 학교장터(S2B)를 통해 2인 이상 견적서 제출 공고를 진행해야 합니다.`;
      docs = ["지출품의서 및 과업지시서/규격서", "산출기초조사서 (시장조사)", "S2B/G2B 2인 이상 견적 공고", "표준계약서 · 계약보증금", "청렴서약서 · 수의계약 각서", "검사·검수조서 및 완료계"];
    } else {
      methodTitle = "일반 · 제한경쟁입찰 (G2B 나라장터)";
      badgeCls = "badge-red";
      methodDesc = `추정가격 ${formatNumber(twoQuoteLimit)}원 초과 구간으로 경쟁입찰 대상입니다. 행정실과 사전 협의하여 입찰 공고 기간(최소 7~10일)과 규격서·예정가격 산정을 충분히 준비하세요.`;
      docs = ["사전 규격 공개 · 입찰 공고안", "산출기초조사서 · 예정가격 조서", "과업지시서 / 시방서 / 설계도서", "나라장터(G2B) 입찰·개찰", "계약서 · 계약이행보증증권", "준공검사조서 · 하자보증서(공사)"];
    }
    if (!isGoodsOrService && !docs.some((d) => d.includes("하자"))) {
      docs.push("하자보수보증금/각서 (공사)");
    }

    box.innerHTML = `
      <div class="callout ${badgeCls === "badge-green" ? "callout-success" : badgeCls === "badge-amber" ? "callout-warn" : "callout-danger"}">
        <div class="row-between mb-1">
          <span class="badge ${badgeCls}">${escapeHtml(methodTitle)}</span>
          <span class="text-xs text-secondary">추정가격(VAT 제외): <strong>${formatNumber(estPrice)}원</strong></span>
        </div>
        <div class="text-xs text-secondary mb-1">부가세 포함 추정금액: <strong>금${formatNumber(totalVatIncl)}원(금${numberToKoreanWords(totalVatIncl)}원)</strong></div>
        <div class="text-sm">${escapeHtml(methodDesc)}</div>
      </div>
      <div class="surface-box">
        <div class="text-xs" style="font-weight:700; margin-bottom:0.35rem;">필수 첨부서류 체크리스트 (행정실 사전 협의 권장)</div>
        <div class="contract-doc-list">
          ${docs.map((doc) => `<div class="contract-doc-item"><span style="color:var(--brand-primary);">✔</span><span>${escapeHtml(doc)}</span></div>`).join("")}
        </div>
      </div>
    `;
  }

  // K-에듀파인 시뮬레이터 2종 전환 (① 품의 회수·연계반송 / ② 개산급 정산등록 9단계)
  window.switchEdufineSim = function (which) {
    activeEdufineSimTab = which;
    const recallEl = document.getElementById("edufineRecallSim");
    const settleEl = document.getElementById("edufineSettleSim");
    const btnRecall = document.getElementById("simTabRecallBtn");
    const btnSettle = document.getElementById("simTabSettleBtn");
    if (recallEl) recallEl.style.display = which === "recall" ? "block" : "none";
    if (settleEl) settleEl.style.display = which === "settle" ? "block" : "none";
    if (btnRecall) btnRecall.className = `btn btn-sm ${which === "recall" ? "btn-primary" : "btn-secondary"}`;
    if (btnSettle) btnSettle.className = `btn btn-sm ${which === "settle" ? "btn-primary" : "btn-secondary"}`;
  };

  window.resetActiveEdufineSim = function () {
    if (activeEdufineSimTab === "settle") window.resetSettleSim();
    else window.resetRecallSim();
  };

  // 시뮬레이터 ②: 개산급 정산등록 9단계 (p.60~62 '전산자료' 선택 체험)
  window.resetSettleSim = function () {
    settleSim = { stage: 0, selectedProof: "", message: "학급운영비 개산급을 정산할 차례입니다. 먼저 [1. 수령일 조회] 버튼을 눌러 미정산 건을 불러오세요.", msgType: "info" };
    renderSettleSimulator();
  };

  window.settleSimAction = function (action, val) {
    if (action === "search") {
      if (settleSim.stage === 0) {
        settleSim.stage = 1;
        settleSim.message = "조회 완료! 아래 목록에서 진행상태가 '미정산'인 학급운영비 건을 클릭해 선택하세요.";
        settleSim.msgType = "success";
      } else {
        settleSim.message = "이미 조회되었습니다. 다음 단계를 진행해 주세요.";
        settleSim.msgType = "info";
      }
    } else if (action === "selectRow") {
      if (settleSim.stage < 1) return;
      if (settleSim.stage === 1) {
        settleSim.stage = 2;
        settleSim.message = "잘 선택했습니다! 이제 카드 영수증 내역을 [행추가]했습니다. 아래에서 카드 영수증의 올바른 '증빙구분'을 선택하세요.";
        settleSim.msgType = "info";
      }
    } else if (action === "selectProof") {
      settleSim.selectedProof = val;
      if (val === "전산자료") {
        settleSim.stage = 3;
        settleSim.message = "정확합니다! 카드(법인·클린카드) 영수증의 증빙구분은 반드시 '전산자료'를 선택합니다. 이제 [3. 저장] 버튼을 누르세요.";
        settleSim.msgType = "success";
      } else if (val) {
        settleSim.message = "⚠️ 실수 주의! 학교 법인·학급운영비 카드 영수증은 '간이/기타 영수증'이 아니라 반드시 '전산자료'를 선택해야 행정실 반려를 막을 수 있습니다!";
        settleSim.msgType = "danger";
      }
    } else if (action === "save") {
      if (settleSim.stage < 3) {
        settleSim.message = "먼저 증빙구분을 '전산자료'로 올바르게 선택해 주세요!";
        settleSim.msgType = "warn";
      } else if (settleSim.stage === 3) {
        settleSim.stage = 4;
        settleSim.message = "저장 완료! 이제 [4. 정산서제출]을 클릭해 출납원(행정실)에게 전자 제출하세요.";
        settleSim.msgType = "success";
      }
    } else if (action === "submit") {
      if (settleSim.stage < 4) {
        settleSim.message = "먼저 [3. 저장]을 완료한 뒤 정산서를 제출해야 합니다!";
        settleSim.msgType = "warn";
      } else if (settleSim.stage === 4) {
        settleSim.stage = 5;
        settleSim.message = "제출 완료! 마지막으로 [5. 출력]을 눌러 정산서 출력본과 실물 영수증을 5일 이내 행정실에 제출하면 끝!";
        settleSim.msgType = "success";
      }
    } else if (action === "print") {
      if (settleSim.stage < 5) {
        settleSim.message = "먼저 [4. 정산서제출]을 완료해야 출력본을 제출할 수 있습니다!";
        settleSim.msgType = "warn";
      } else {
        settleSim.stage = 6;
        settleSim.message = "🎉 개산급 정산등록 9단계 완벽 마스터! (핵심 암기: 미정산 조회 → 카드 증빙은 '전산자료' → 저장 → 정산서제출 → 5일 이내 행정실 제출)";
        settleSim.msgType = "success";
      }
    }
    renderSettleSimulator();
  };

  function renderSettleSimulator() {
    const wrap = document.getElementById("edufineSettleSim");
    if (!wrap) return;
    const statusText = settleSim.stage >= 5 ? "정산제출" : settleSim.stage >= 4 ? "작성저장" : "미정산";
    const statusCls = settleSim.stage >= 5 ? "badge-green" : settleSim.stage >= 4 ? "badge-blue" : "badge-amber";

    wrap.innerHTML = `
      <div class="sim-window">
        <div class="sim-titlebar">
          <span>K-에듀파인 &gt; 학교회계 &gt; 사업관리 &gt; 품의/정산 &gt; 개산급정산등록</span>
          <span class="badge ${statusCls}">단계 ${Math.min(settleSim.stage, 6)} / 6</span>
        </div>
        <div class="sim-toolbar">
          <div class="row-wrap">
            <button type="button" class="btn btn-sm ${settleSim.stage === 0 ? "btn-primary" : "btn-secondary"}" onclick="window.settleSimAction('search')">1. 수령일 조회</button>
            <button type="button" class="btn btn-sm ${settleSim.stage === 3 ? "btn-primary" : "btn-secondary"}" onclick="window.settleSimAction('save')">3. 저장</button>
            <button type="button" class="btn btn-sm ${settleSim.stage === 4 ? "btn-primary" : "btn-secondary"}" onclick="window.settleSimAction('submit')">4. 정산서제출</button>
            <button type="button" class="btn btn-sm ${settleSim.stage === 5 ? "btn-success" : "btn-outline"}" onclick="window.settleSimAction('print')">5. 출력</button>
          </div>
        </div>
        <div class="sim-body stack-sm">
          ${
            settleSim.stage === 0
              ? `<div class="surface-box text-sm text-muted" style="text-align:center;">상단 [1. 수령일 조회]를 클릭하면 개산급 미정산 목록이 표시됩니다.</div>`
              : `<div class="sim-row ${settleSim.stage >= 2 ? "selected" : ""}" onclick="window.settleSimAction('selectRow')">
                  <span style="font-weight:800; color:var(--brand-primary);">${settleSim.stage >= 2 ? "✔" : "▶"}</span>
                  <span class="badge badge-gray">학급운영비</span>
                  <strong>3학년 1반 학급운영비 개산급 (수령액 640,000원)</strong>
                  <span class="badge ${statusCls} sim-status-badge" style="justify-self:end;">${statusText}</span>
                </div>`
          }
          ${
            settleSim.stage >= 2
              ? `<div class="surface-box">
                  <div class="row-between mb-1">
                    <strong class="text-sm">2. 정산 내역 [행추가] 입력 — 법인카드 영수증 (오늘 문구사 · 75,000원)</strong>
                    <span class="badge badge-purple">★ 핵심 함정</span>
                  </div>
                  <div class="row-wrap">
                    <label class="text-xs" style="font-weight:700;" for="simProofSelect">카드 영수증 증빙구분 선택:</label>
                    <select id="simProofSelect" class="form-select" style="width:auto; padding:0.35rem 0.65rem; font-size:0.84rem;" onchange="window.settleSimAction('selectProof', this.value)" ${settleSim.stage >= 4 ? "disabled" : ""}>
                      <option value="">-- 증빙구분 선택 --</option>
                      <option value="간이영수증" ${settleSim.selectedProof === "간이영수증" ? "selected" : ""}>간이영수증</option>
                      <option value="전산자료" ${settleSim.selectedProof === "전산자료" ? "selected" : ""}>전산자료</option>
                      <option value="기타" ${settleSim.selectedProof === "기타" ? "selected" : ""}>기타 영수증</option>
                    </select>
                  </div>
                </div>`
              : ""
          }
          <div class="callout callout-${settleSim.msgType} text-sm">${escapeHtml(settleSim.message)}</div>
        </div>
      </div>
    `;
  }

  // 시뮬레이터 ①: K-에듀파인 지출품의 회수 · 연계반송 클릭형 모의 체험 시뮬레이터
  window.resetRecallSim = function () {
    recallSim = { stage: 0, checked: false, message: "결재가 진행 중인 '교무실 사무용품 구입' 품의를 수정하려고 합니다. 먼저 해당 문서를 체크해 주세요.", msgType: "info" };
    renderRecallSimulator();
  };

  window.simToggleCheck = function () {
    if (recallSim.stage === 3) return;
    recallSim.checked = !recallSim.checked;
    if (recallSim.stage === 0 && recallSim.checked) {
      recallSim.message = "좋습니다! 이제 상단 툴바에서 [회수] 버튼을 클릭해 결재 진행을 멈추세요.";
      recallSim.msgType = "info";
    } else if (recallSim.stage === 1 && recallSim.checked) {
      recallSim.message = "정확합니다! 이제 반드시 [삭제/연계반송] 버튼을 눌러 K-에듀파인(학교회계)으로 반송시키세요.";
      recallSim.msgType = "info";
    }
    renderRecallSimulator();
  };

  window.simClickAction = function (action) {
    if (action === "recall") {
      if (recallSim.stage !== 0) {
        recallSim.message = "이미 회수된 문서입니다! 다음 단계인 [삭제/연계반송]을 진행해 주세요.";
        recallSim.msgType = "warn";
      } else if (!recallSim.checked) {
        recallSim.message = "먼저 목록에서 '교무실 사무용품 구입' 문서의 체크박스를 선택해야 [회수]할 수 있습니다.";
        recallSim.msgType = "warn";
      } else {
        recallSim.stage = 1;
        recallSim.checked = false;
        recallSim.message = "1단계 완료! 진행상태가 '회수'로 바뀌었습니다. 이제 문서를 다시 체크한 뒤 [삭제/연계반송]을 눌러야 합니다.";
        recallSim.msgType = "success";
      }
    } else if (action === "return") {
      if (recallSim.stage === 0) {
        recallSim.message = "아직 결재 '진행' 상태입니다! 먼저 문서를 체크하고 [회수] 버튼을 눌러주세요.";
        recallSim.msgType = "danger";
      } else if (recallSim.stage === 1 && !recallSim.checked) {
        recallSim.message = "'회수' 상태로 바뀐 문서를 다시 한 번 체크한 뒤 [삭제/연계반송]을 눌러주세요!";
        recallSim.msgType = "warn";
      } else if (recallSim.stage === 1 && recallSim.checked) {
        recallSim.stage = 2;
        recallSim.checked = false;
        recallSim.message = "2단계 완료! K-에듀파인 학교회계로 반송되었습니다. 이제 우측 [학교회계 > 품의목록 열기]를 눌러 수정해 보세요.";
        recallSim.msgType = "success";
      }
    } else if (action === "openPumui") {
      if (recallSim.stage < 2) {
        recallSim.message = "⚠️ 수정 불가! 업무관리에서 [회수]만 하고 [삭제/연계반송]을 안 누르면 K-에듀파인 품의목록이 여전히 잠겨 있습니다!";
        recallSim.msgType = "danger";
      } else {
        recallSim.stage = 3;
        recallSim.message = "🎉 시뮬레이션 완벽 성공! 이제 학교회계 > 품의목록에서 '저장' 상태의 품의서를 자유롭게 수정·재결재 요청할 수 있습니다.";
        recallSim.msgType = "success";
      }
    }
    renderRecallSimulator();
  };

  function renderRecallSimulator() {
    const wrap = document.getElementById("edufineRecallSim");
    if (!wrap) return;
    const statusText = recallSim.stage === 0 ? "진행" : recallSim.stage === 1 ? "회수" : "반송완료 (저장)";
    const statusCls = recallSim.stage === 0 ? "badge-amber" : recallSim.stage === 1 ? "badge-red" : "badge-green";

    wrap.innerHTML = `
      <div class="sim-window">
        <div class="sim-titlebar">
          <span>${recallSim.stage >= 2 ? "K-에듀파인 > 학교회계 > 사업관리 > 품의목록" : "K-에듀파인 > 업무관리 > 문서관리 > 결재 > 문서진행"}</span>
          <span class="badge ${statusCls}">현재 상태: ${statusText}</span>
        </div>
        <div class="sim-toolbar">
          <div class="row-wrap">
            <button type="button" class="btn btn-sm ${recallSim.stage === 0 && recallSim.checked ? "btn-primary" : "btn-secondary"}" onclick="window.simClickAction('recall')">1. 회수</button>
            <button type="button" class="btn btn-sm ${recallSim.stage === 1 && recallSim.checked ? "btn-primary" : "btn-secondary"}" onclick="window.simClickAction('return')">2. 삭제 / 연계반송</button>
          </div>
          <button type="button" class="btn btn-sm ${recallSim.stage === 2 ? "btn-success" : "btn-outline"}" onclick="window.simClickAction('openPumui')">3. 학교회계 &gt; 품의목록에서 수정</button>
        </div>
        <div class="sim-body">
          <div class="sim-row ${recallSim.checked ? "selected" : ""}" onclick="window.simToggleCheck()">
            <input type="checkbox" ${recallSim.checked ? "checked" : ""} onclick="event.stopPropagation(); window.simToggleCheck();" aria-label="품의 문서 선택" />
            <span class="badge badge-gray">지출품의</span>
            <strong>교무실 사무용품 구입 (내부/일반)</strong>
            <span class="badge ${statusCls} sim-status-badge" style="justify-self:end;">${statusText}</span>
          </div>
          <div class="callout callout-${recallSim.msgType} mt-1 text-sm">${escapeHtml(recallSim.message)}</div>
        </div>
      </div>
    `;
  }

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
      <div class="row-between mb-1"><span style="font-weight:800;">1인당 평균: ${formatNumber(perPerson)}원</span><span class="badge ${isOk ? "badge-green" : "badge-red"}">${isOk ? "40,000원 한도 준수" : `한도 초과 (최대 ${formatNumber(maxLimit)}원)`}</span></div>
      <div class="text-xs text-secondary">간담회 1인당 40,000원 이내 (50만 원 이상 시 상대방 소속·성명 기재) · 경조사비는 <strong>기관운영업무추진비</strong>에서만 집행(축·조의금 5만 / 화환 10만)</div>
    `;
  }

  // ==========================================
  // 6. MODULE 4: 8대 보직 한해살이 (학년도 동적 .ics + 커스텀 업무 포함) & AI PII 가드
  // ==========================================
  function initRoleModule() {
    document.getElementById("customTaskDept").innerHTML = window.EDU_DATA.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
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
    bar.innerHTML = months.map((m) => `<button type="button" class="month-chip ${selectedMonth === m ? "active" : ""}" onclick="window.selectMonthFilter(${m})">${m}월</button>`).join("");
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
    appState.checkedTasks[taskId] = !appState.checkedTasks[taskId];
    saveState();
    renderDepartments();
  };

  window.addCustomRoleTask = function () {
    const deptId = document.getElementById("customTaskDept").value;
    const month = parseInt(document.getElementById("customTaskMonth").value, 10) || 3;
    const title = document.getElementById("customTaskTitle").value.trim();
    if (!title) return window.showToast("추가할 업무 내용을 입력해 주세요.");
    appState.customTasks.push({ id: "custom-" + Date.now(), deptId, month, title, detail: `${month}월 우리 학교 특색·사용자 추가 업무` });
    if (!appState.selectedDepts.includes(deptId)) appState.selectedDepts.push(deptId);
    document.getElementById("customTaskTitle").value = "";
    saveState();
    renderDepartments();
    window.showToast("나만의 학교 업무가 추가되었습니다.");
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
    dept.periods.forEach((p) => p.tasks.forEach((t) => { total++; if (appState.checkedTasks[t.id]) done++; }));
    (appState.customTasks || []).forEach((ct) => { if (ct.deptId === dept.id) { total++; if (appState.checkedTasks[ct.id]) done++; } });
    return { total, done };
  }

  function renderDepartments() {
    document.getElementById("deptSelectorBar").innerHTML = window.EDU_DATA.departments
      .map((d) => {
        const { total, done } = getDeptTaskStats(d);
        const isSelected = roleViewMode === "month" ? appState.selectedDepts.includes(d.id) : d.id === currentDeptId;
        return `<button type="button" class="btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}" onclick="window.selectOrToggleDepartment('${d.id}')"><span>${roleViewMode === "month" ? (isSelected ? "☑ " : "☐ ") : ""}${escapeHtml(d.name)}</span><span class="badge ${isSelected ? "badge-gray" : "badge-blue"}">${done}/${total}</span></button>`;
      })
      .join("");

    const detail = document.getElementById("deptDetailContainer");
    if (roleViewMode === "month") {
      const myDepts = window.EDU_DATA.departments.filter((d) => appState.selectedDepts.includes(d.id));
      const monthTasks = [];
      myDepts.forEach((d) => {
        d.periods.forEach((p) => p.tasks.forEach((t) => {
          const months = (window.EDU_DATA.taskMonthsMap && window.EDU_DATA.taskMonthsMap[t.id]) || [];
          if (months.includes(selectedMonth)) monthTasks.push({ ...t, deptName: d.name, period: p.period, isCustom: false });
        }));
        (appState.customTasks || []).forEach((ct) => {
          if (ct.deptId === d.id && ct.month === selectedMonth) monthTasks.push({ ...ct, deptName: d.name, period: `${selectedMonth}월 추가 업무`, isCustom: true });
        });
      });

      const doneCnt = monthTasks.filter((t) => appState.checkedTasks[t.id]).length;
      const pct = monthTasks.length > 0 ? Math.round((doneCnt / monthTasks.length) * 100) : 0;
      detail.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div><div class="card-title">${selectedMonth}월 이달의 필수 보직 업무 (${myDepts.map((d) => d.name.split(" ")[0]).join(" · ")})</div><div class="card-subtitle">선택된 ${myDepts.length}개 담당 부서의 ${selectedMonth}월 과업을 한눈에 관리합니다.</div></div>
            <div style="min-width:180px; text-align:right;"><div class="text-xs" style="font-weight:700; margin-bottom:0.25rem;">${selectedMonth}월 달성률: ${pct}% (${doneCnt}/${monthTasks.length})</div><div class="progress-track"><div class="progress-fill success" style="width:${pct}%;"></div></div></div>
          </div>
          ${monthTasks.length === 0 ? `<div class="surface-box text-muted" style="text-align:center; padding:1.5rem;">${selectedMonth}월 예정된 기본 과업이 없습니다.</div>` : `<div class="grid-2">${monthTasks.map((t) => {
            const checked = Boolean(appState.checkedTasks[t.id]);
            return `<label class="check-item ${checked ? "checked" : ""}" id="role-task-${t.id}"><input type="checkbox" ${checked ? "checked" : ""} onchange="window.toggleDeptTask('${t.id}')" /><div style="flex:1;"><div class="row-between"><span class="badge badge-blue">${escapeHtml(t.deptName)}</span>${t.isCustom ? `<button type="button" class="btn btn-sm btn-secondary" onclick="window.deleteCustomRoleTask('${t.id}', event)">삭제</button>` : `<span class="text-xs text-muted">${escapeHtml(t.period)}</span>`}</div><div class="check-title" style="font-weight:700; font-size:0.89rem; margin-top:0.25rem;">${escapeHtml(t.title)}</div><div class="text-xs text-secondary">${escapeHtml(t.detail)}</div></div></label>`;
          }).join("")}</div>`}
        </div>
      `;
      return;
    }

    const dept = window.EDU_DATA.departments.find((d) => d.id === currentDeptId) || window.EDU_DATA.departments[0];
    const { total: deptTotal, done: deptDone } = getDeptTaskStats(dept);
    const deptPct = deptTotal > 0 ? Math.round((deptDone / deptTotal) * 100) : 0;
    const myCustomForDept = (appState.customTasks || []).filter((ct) => ct.deptId === dept.id);

    detail.innerHTML = `
      <div class="card" id="dept-panel-${dept.id}">
        <div class="card-header">
          <div><div class="card-title">${escapeHtml(dept.name)} 연간 한해살이 <span class="badge badge-blue">${escapeHtml(dept.badge)}</span></div><div class="card-subtitle">${escapeHtml(dept.desc)}</div></div>
          <div style="min-width:180px; text-align:right;"><div class="text-xs" style="font-weight:700; margin-bottom:0.25rem;">부서 달성률: ${deptPct}% (${deptDone}/${deptTotal})</div><div class="progress-track"><div class="progress-fill success" style="width:${deptPct}%;"></div></div></div>
        </div>
        <div class="grid-3">
          ${dept.periods.map((p) => `<div class="surface-box"><div style="font-weight:800; font-size:0.94rem; margin-bottom:0.7rem; color:var(--brand-primary);">${escapeHtml(p.period)}</div>${p.tasks.map((t) => {
            const isChecked = Boolean(appState.checkedTasks[t.id]);
            return `<label class="check-item ${isChecked ? "checked" : ""}" id="role-task-${t.id}"><input type="checkbox" ${isChecked ? "checked" : ""} onchange="window.toggleDeptTask('${t.id}')" /><div><div class="check-title" style="font-weight:700; font-size:0.86rem;">${escapeHtml(t.title)}</div><div class="text-xs text-secondary" style="margin-top:0.15rem;">${escapeHtml(t.detail)}</div></div></label>`;
          }).join("")}</div>`).join("")}
        </div>
        ${myCustomForDept.length > 0 ? `<div class="surface-box mt-2"><div style="font-weight:800; font-size:0.9rem; margin-bottom:0.55rem; color:var(--purple);">우리 학교 추가 업무 (${myCustomForDept.length}건)</div><div class="grid-2">${myCustomForDept.map((ct) => {
          const isChecked = Boolean(appState.checkedTasks[ct.id]);
          return `<label class="check-item ${isChecked ? "checked" : ""}"><input type="checkbox" ${isChecked ? "checked" : ""} onchange="window.toggleDeptTask('${ct.id}')" /><div style="flex:1;"><div class="row-between"><span class="badge badge-purple">${ct.month}월</span><button type="button" class="btn btn-sm btn-secondary" onclick="window.deleteCustomRoleTask('${ct.id}', event)">삭제</button></div><div class="check-title" style="font-weight:700; font-size:0.86rem; margin-top:0.2rem;">${escapeHtml(ct.title)}</div></div></label>`;
        }).join("")}</div></div>` : ""}
      </div>
    `;
  }

  // P1-3 해결: 학년도 선택(2026/2027) + 사용자 추가 업무(customTasks) 모두 .ics 포함!
  window.exportRoleIcs = function () {
    const year = parseInt(document.getElementById("icsYearSelect")?.value, 10) || 2027;
    const myDepts = window.EDU_DATA.departments.filter((d) => appState.selectedDepts.includes(d.id));
    const events = [];

    myDepts.forEach((d) => {
      const shortDept = d.name.split(" ")[0];
      d.periods.forEach((p) =>
        p.tasks.forEach((t) => {
          if (appState.checkedTasks[t.id]) return;
          const months = (window.EDU_DATA.taskMonthsMap && window.EDU_DATA.taskMonthsMap[t.id]) || [3];
          const m = months[0];
          const y = m <= 2 ? year + 1 : year;
          const dt = `${y}${String(m).padStart(2, "0")}02`;
          events.push(`BEGIN:VEVENT\r\nUID:${t.id}-${year}@ys2027\r\nDTSTART;VALUE=DATE:${dt}\r\nSUMMARY:[${shortDept}] ${t.title}\r\nDESCRIPTION:${t.detail}\r\nEND:VEVENT`);
        })
      );
      (appState.customTasks || []).forEach((ct) => {
        if (ct.deptId !== d.id || appState.checkedTasks[ct.id]) return;
        const m = ct.month || 3;
        const y = m <= 2 ? year + 1 : year;
        const dt = `${y}${String(m).padStart(2, "0")}05`;
        events.push(`BEGIN:VEVENT\r\nUID:${ct.id}-${year}@ys2027\r\nDTSTART;VALUE=DATE:${dt}\r\nSUMMARY:[${shortDept}·추가] ${ct.title}\r\nDESCRIPTION:${ct.detail}\r\nEND:VEVENT`);
      });
    });

    if (events.length === 0) return window.showToast("내보낼 미완료 업무가 없습니다.");
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//YS2027 EduPortal//KR\r\n${events.join("\r\n")}\r\nEND:VCALENDAR`;
    downloadFile(`${year}학년도_보직교사_연간업무일정.ics`, ics, "text/calendar;charset=utf-8");
    window.showToast(`${year}학년도 미완료 업무 ${events.length}건(추가 업무 포함)이 .ics로 저장되었습니다.`);
  };

  // JneGPT 안전 프롬프트 + PII 가드 v3 (주민번호·전화·이메일·계좌번호·차량번호·학반+학생실명)
  function detectPii(text) {
    const hits = [];
    const phoneRe = /0(?:1[016789]|2|[3-6][1-5])-?\d{3,4}-?\d{4}/g;
    if (/\b\d{6}-?[1-4]\d{6}\b/.test(text)) hits.push("주민등록번호");
    if (phoneRe.test(text)) hits.push("전화·휴대폰 번호");
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) hits.push("이메일 주소");
    const withoutPhones = text.replace(phoneRe, "");
    if (/\b\d{3,4}-\d{2,6}-\d{3,6}(?:-\d{1,3})?\b/.test(withoutPhones)) hits.push("은행 계좌번호");
    if (/\b\d{2,3}[가-힣]\s?\d{4}\b/.test(text)) hits.push("차량번호");
    if (/(?:\d\s*학년\s*\d{1,2}\s*반|\d-\d{1,2})\s+[가-힣]{2,4}(?=\s|,|\.|$|학생|어린이|군|양)/.test(text)) hits.push("학반·학생 실명");
    return hits;
  }

  window.maskAiPiiInput = function () {
    const el = document.getElementById("aiKeywordsInput");
    el.value = el.value
      .replace(/\b\d{6}-?[1-4]\d{6}\b/g, "[주민번호 보호]")
      .replace(/0(?:1[016789]|2|[3-6][1-5])-?\d{3,4}-?\d{4}/g, "[연락처 보호]")
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[이메일 보호]")
      .replace(/\b\d{3,4}-\d{2,6}-\d{3,6}(?:-\d{1,3})?\b/g, "[계좌번호 보호]")
      .replace(/\b\d{2,3}[가-힣]\s?\d{4}\b/g, "[차량번호 보호]")
      .replace(/(\d\s*학년\s*\d{1,2}\s*반|\d-\d{1,2})\s+[가-힣]{2,4}(?=\s|,|\.|$|학생|어린이|군|양)/g, "$1 [학생명 보호]");
    generateAiPrompt();
    window.showToast("민감정보(개인식별·계좌·학생 실명 등)가 안전하게 비식별 처리되었습니다.");
  };

  window.openLinterForAiCheck = function () {
    window.switchMainTab("tab-doc", "doc-sub-linter");
    setTimeout(() => {
      const bodyEl = document.getElementById("lintBodyInput");
      if (bodyEl) {
        bodyEl.focus();
        bodyEl.select();
      }
      window.showToast("AI가 생성한 초안을 붙여넣기(Ctrl+V)해 공문서 규범을 최종 점검하세요!");
    }, 80);
  };

  function generateAiPrompt() {
    const task = document.getElementById("aiTaskSelect").value;
    const kw = document.getElementById("aiKeywordsInput").value.trim() || "초등학교 생태환경 교육활동";
    const piiHits = detectPii(kw);
    const alertBox = document.getElementById("aiPiiAlertBox");

    if (piiHits.length > 0) {
      alertBox.style.display = "block";
      alertBox.innerHTML = `<div class="callout callout-danger row-between text-xs"><span><strong>개인정보 감지 경고!</strong> (${escapeHtml(piiHits.join(", "))}) — JneGPT에 민감정보를 입력하지 마세요.</span><button type="button" class="btn btn-sm btn-danger" onclick="window.maskAiPiiInput()">자동 마스킹</button></div>`;
    } else {
      alertBox.style.display = "none";
    }

    let prompt = "";
    if (task === "plan") {
      prompt = `[역할] 당신은 초등학교 교무행정 및 교육과정 전문가입니다.\n[주제] ${kw}\n[요청사항]\n위 주제로 누구든 바로 실행할 수 있는 '학교 업무 추진계획서' 초안을 작성해 주세요.\n공문서 어문규범(날짜 마침표 뒤 공백, 24시간제, 쉬운 공공언어)과 7대 표준 목차를 준수해 주세요.\n1. 목적 및 필요성 (관련 근거)\n2. 추진 방침\n3. 세부 추진 계획 (일시·장소·대상·시간대별 프로그램 표)\n4. 업무 분장표\n5. 안전 관리 계획 및 유의사항 (※ 우천·악천후 시 대체 계획 Plan B 필수)\n6. 예산 소요 계획 (원가통계비목 및 '단가 × 수량 × 횟수 = 금액' 산출식)\n7. 기대 효과`;
    } else if (task === "letter") {
      prompt = `[역할] 당신은 학부모님과 따뜻하고 명확하게 소통하는 초등학교 담당 교사입니다.\n[주제] ${kw}\n[요청사항]\n국립국어원 '공공언어 바로 쓰기' 원칙에 따라 어려운 한자어·일본어 투를 피하고 쉽고 정중한 가정통신문 초안을 작성해 주세요. (목적, 일시 '2026. 5. 20.(수)' 형식, 장소, 준비물, 안전 유의사항, 신청 회신서 포함)`;
    } else if (task === "press") {
      prompt = `[역할] 당신은 전라남도교육청 학교 홍보·보도자료 전문 담당자입니다.\n[주제] ${kw}\n[요청사항]\n지역 언론사 배포용 보도자료 초안을 작성해 주세요. 헤드라인·부제목 후보 3개와 육하원칙 기반 간결한 문장(한 문장 2~3줄 이내), 학생·학교장 인터뷰 인용문을 포함해 주세요.`;
    } else if (task === "reply") {
      prompt = `[역할] 당신은 경청과 공감을 바탕으로 학부모와 소통하며 교사를 보호하는 보직교사입니다.\n[상황/키워드] ${kw}\n[요청사항]\n① 공감·경청 → ② 학교 규정·사실관계 설명 → ③ 향후 지원 및 협조 요청 순으로 전화 상담용·문자 발송용 답변 초안을 각 1부 작성해 주세요. (개인식별정보는 [학생명]으로 비식별 표기)`;
    } else if (task === "compare") {
      prompt = `[NotebookLM 소스 분석 전용 프롬프트]\n업로드한 구버전 및 신버전 지침 문서만 근거로 분석해 주세요.\n1. 구버전 대비 신설·개정·삭제 항목을 '신·구 대조표(개정 전 / 개정 후 / 학교 현장 조치)'로 정리\n2. '${kw}'와 관련해 올해 우리 학교 규정에 반영할 필수 체크리스트 5가지 도출`;
    }
    document.getElementById("aiPromptOutput").value = prompt;
  }

  window.copyAiPrompt = function () {
    if (detectPii(document.getElementById("aiKeywordsInput").value).length > 0) {
      return window.showToast("개인정보가 감지되었습니다! 먼저 [자동 마스킹]을 눌러 제거해 주세요.");
    }
    window.copyText(document.getElementById("aiPromptOutput").value, "안전 프롬프트가 복사되었습니다.");
  };

  // ==========================================
  // 7. MODULE 5: 연수 실습 3종 + 자동 임시저장(P0-4)
  // ==========================================
  const LAB1_IDS = ["lab1Bimok1", "lab1Formula1", "lab1Amt1", "lab1Bimok2", "lab1Formula2", "lab1Amt2", "lab1Bimok3", "lab1Formula3", "lab1Amt3", "lab1RevBimok"];
  const LAB2_IDS = ["lab2Title", "lab2Body"];
  const LAB3_IDS = ["lab3Title", "lab3Purpose", "lab3Schedule", "lab3Budget", "lab3Safety"];

  function initLabModule() {
    restoreLabDraftsToForm();
    LAB1_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", () => captureLabDraft("lab1", LAB1_IDS));
      if (el) el.addEventListener("change", () => captureLabDraft("lab1", LAB1_IDS));
    });
    LAB2_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", () => captureLabDraft("lab2", LAB2_IDS));
    });
    LAB3_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", () => { captureLabDraft("lab3", LAB3_IDS); renderLab3Preview(); });
    });
    renderLab3Preview();
  }

  function captureLabDraft(key, ids) {
    const obj = {};
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obj[id] = el.value; });
    appState.labDrafts[key] = obj;
    saveState();
  }

  function restoreLabDraftsToForm() {
    [["lab1", LAB1_IDS], ["lab2", LAB2_IDS], ["lab3", LAB3_IDS]].forEach(([key, ids]) => {
      const d = appState.labDrafts && appState.labDrafts[key];
      if (!d) return;
      ids.forEach((id) => { const el = document.getElementById(id); if (el && d[id] !== undefined) el.value = d[id]; });
    });
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
    captureLabDraft("lab1", LAB1_IDS);
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
    document.getElementById("lab2Title").value = "2026학년도 1학기 현장체험학습 사전답사 실시 계획";
    document.getElementById("lab2Body").value = `1. 관련: 2026년 현장체험학습 매뉴얼 및 ○○초등학교-4808(2026. 5. 8.)\n2. 2026학년도 1학기 현장체험학습의 안전한 운영을 위하여 다음과 같이 사전답사를 실시하고자 합니다.\n  가. 일시: 2026. 5. 20.(수) 14:00~17:00\n  나. 장소: 국립광주과학관 및 이동 경로 일원\n  다. 대상: 3학년 부장 및 인솔교사 4명\n  라. 주요 내용: 체험시설 안전 점검, 차량 승하차 구역 및 우천 시 대체 동선 확인\n  마. 예산 계획: 공무원 여비 및 입장료(교육운영비·여비) 80,000원\n\n붙임  1. 사전답사 계획 1부.\n      2. 사전답사 체크리스트 1부.  끝.`;
    captureLabDraft("lab2", LAB2_IDS);
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
      <div class="stack-sm">${checks.map((c) => `<div class="callout ${c.pass ? "callout-success" : "callout-danger"}"><div style="font-weight:700; font-size:0.86rem;">${c.pass ? "✔" : "✕"} ${escapeHtml(c.title)}</div><div class="text-xs text-secondary" style="margin-top:0.15rem;">${escapeHtml(c.detail)}</div></div>`).join("")}</div>
    `;
  }

  window.loadLab3Sample = function () {
    document.getElementById("lab3Title").value = "2026학년도 '초록 빛깔 생태 스케치' 운영 계획";
    document.getElementById("lab3Purpose").value = "• 생태 관찰 및 텃밭 가꾸기 활동을 통한 학생들의 생태 감수성 함양\n• 학생 주도적 프로젝트 활동을 통한 문제 해결 능력 및 협동심 고취";
    document.getElementById("lab3Schedule").value = "• 4월~5월 | 우리 학교 식물 지도 만들기 | 3학년 전원 | 교내 서식 식물 관찰 및 특징 기록\n• 6월~10월 | '초록 생태 수호대' 동아리 | 희망 학생 | 텃밭 작물 재배 및 생태 신문 발행\n• 11월 | 생태 스케치 결과 공유회 | 전교생 | 프로젝트 결과물 전시 및 소감 발표";
    document.getElementById("lab3Budget").value = "• 재배 모종 구입(교육운영비): 2,000원 × 100개 × 1회 = 200,000원 (상추, 방울토마토 등)\n• 관찰 기록 도구(교육운영비): 5,000원 × 25명 × 4학급 = 500,000원 (관찰 수첩 및 색연필)\n• 합계: 700,000원";
    document.getElementById("lab3Safety").value = "• 야외 관찰 시 사전 안전 교육 실시(독충 주의 및 도구 안전 사용법)\n• 우천 시 활동 장소를 교실 내 식물 도감 탐구 및 생태 세밀화 그리기 활동으로 변경(Plan B)";
    captureLabDraft("lab3", LAB3_IDS);
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
      <div class="edufine-header"><div class="edufine-org-slogan">업무 추진계획 초안</div><div style="font-size:1.18rem; font-weight:800; margin-top:0.2rem; color:#0f172a;">${escapeHtml(title)}</div></div>
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
  // 8. MODULE 6: 퀴즈 & FAQ
  // ==========================================
  function initQuizAndFaqModule() {
    document.getElementById("quizCategoryFilter").addEventListener("change", () => { quizFocusIndex = 0; renderQuiz(); });
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

  window.moveQuizFocus = function (delta) { quizFocusIndex += delta; renderQuiz(); };
  window.retrySingleQuiz = function (qId) { delete appState.quizAnswers[qId]; saveState(); renderQuiz(); };

  window.toggleQuizPresenterMode = function () {
    quizPresenterMode = !quizPresenterMode;
    quizRevealedMap = {};
    const btn = document.getElementById("quizPresenterToggleBtn");
    if (btn) {
      btn.textContent = `발표 모드: ${quizPresenterMode ? "ON" : "OFF"}`;
      btn.className = `btn btn-sm ${quizPresenterMode ? "btn-primary" : "btn-secondary"}`;
    }
    renderQuiz();
    window.showToast(quizPresenterMode ? "연수장 발표 모드가 켜졌습니다. [정답·해설 공개] 버튼으로 토론 후 공개하세요." : "일반 학습 모드로 전환되었습니다.");
  };

  window.togglePresenterReveal = function (qId) {
    quizRevealedMap[qId] = !quizRevealedMap[qId];
    renderQuiz();
  };

  function getFilteredQuizList() {
    const questions = window.EDU_DATA.quizQuestions;
    const filter = document.getElementById("quizCategoryFilter")?.value || "ALL";
    let list = questions.filter((q) => filter === "ALL" || mapQuizDomain(q.category) === filter);
    if (quizMode === "wrong") list = list.filter((q) => appState.quizAnswers[q.id] !== undefined && appState.quizAnswers[q.id] !== q.answer);
    return list;
  }

  function handleQuizKeyboardShortcuts(e) {
    const tag = (document.activeElement && document.activeElement.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (document.querySelector(".modal-backdrop.open")) return;
    const quizTab = document.getElementById("tab-quiz");
    const quizSub = document.getElementById("quiz-sub-play");
    if (!quizTab?.classList.contains("active") || !quizSub?.classList.contains("active")) return;
    if (quizMode !== "focus") return;

    const list = getFilteredQuizList();
    if (list.length === 0) return;
    const q = list[Math.max(0, Math.min(quizFocusIndex, list.length - 1))];
    if (!q) return;

    if (e.key === "ArrowRight") {
      if (quizFocusIndex < list.length - 1) {
        e.preventDefault();
        window.moveQuizFocus(1);
      }
    } else if (e.key === "ArrowLeft") {
      if (quizFocusIndex > 0) {
        e.preventDefault();
        window.moveQuizFocus(-1);
      }
    } else if (["1", "2", "3", "4"].includes(e.key) && !quizPresenterMode) {
      const optIdx = parseInt(e.key, 10) - 1;
      if (appState.quizAnswers[q.id] === undefined && q.options[optIdx] !== undefined) {
        e.preventDefault();
        window.answerQuiz(q.id, optIdx);
      }
    } else if (e.key === " " && quizPresenterMode) {
      e.preventDefault();
      window.togglePresenterReveal(q.id);
    }
  }

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
        if (ans === q.answer) { totalCorrect++; domainStats[dom].correct++; }
        else totalWrong++;
      }
    });

    document.getElementById("quizScoreBadge").textContent = quizPresenterMode ? "발표 모드 진행 중" : `점수: ${totalCorrect} / ${questions.length} (${totalCorrect * 5}점)`;
    document.getElementById("quizWrongCount").textContent = String(totalWrong);

    document.getElementById("quizAnalyticsBar").innerHTML = Object.values(domainStats)
      .map((s) => {
        const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
        return `<div class="surface-box"><div class="row-between text-xs mb-1"><strong>${escapeHtml(s.label)}</strong><span>${s.correct}/${s.total} (${pct}%)</span></div><div class="progress-track"><div class="progress-fill ${pct >= 80 ? "success" : ""}" style="width:${pct}%;"></div></div></div>`;
      })
      .join("");

    let list = questions.filter((q) => filter === "ALL" || mapQuizDomain(q.category) === filter);
    if (quizMode === "wrong") list = list.filter((q) => appState.quizAnswers[q.id] !== undefined && appState.quizAnswers[q.id] !== q.answer);

    const container = document.getElementById("quizListContainer");
    if (list.length === 0) {
      container.innerHTML = `<div class="callout callout-success" style="text-align:center; padding:1.75rem;">${quizMode === "wrong" ? "현재 기록된 오답이 없습니다! 훌륭합니다." : "해당 영역에 문항이 없습니다."}</div>`;
      return;
    }

    const presenterBannerHtml = quizPresenterMode
      ? `<div class="presenter-banner"><span><strong>연수장 발표 모드 작동 중</strong> — 선택지 클릭이 잠기며 정답이 가려집니다. 연수생과 토론 후 <strong>[정답·해설 공개]</strong>(또는 <code>Space</code>)를 눌러 확인하세요.</span><button type="button" class="btn btn-sm btn-secondary" onclick="window.toggleQuizPresenterMode()">발표 모드 종료</button></div>`
      : "";

    const renderCard = (q, displayIndex, totalLen) => {
      if (quizPresenterMode) {
        const revealed = Boolean(quizRevealedMap[q.id]);
        return `
          <div class="surface-box">
            <div class="row-between mb-1">
              <span class="badge badge-purple">발표 문항 ${q.id} (${displayIndex + 1}/${totalLen}) · ${escapeHtml(q.category)}</span>
              <button type="button" class="btn btn-sm ${revealed ? "btn-secondary" : "btn-primary"}" onclick="window.togglePresenterReveal(${q.id})">${revealed ? "정답 숨기기" : "정답 · 해설 공개"}</button>
            </div>
            <div style="font-weight:700; font-size:1.02rem; margin-bottom:0.85rem;">${escapeHtml(q.q)}</div>
            <div>${q.options
              .map((opt, oIdx) => {
                const cls = revealed && oIdx === q.answer ? "quiz-option correct" : "quiz-option";
                return `<button type="button" class="${cls}" disabled><span class="badge badge-gray">${oIdx + 1}</span><span>${escapeHtml(opt)}</span></button>`;
              })
              .join("")}</div>
            ${revealed ? `<div class="callout callout-info mt-1 text-sm"><strong>정답 (${q.answer + 1}번) 해설:</strong> ${escapeHtml(q.explanation)}</div>` : ""}
          </div>
        `;
      }

      const userAns = appState.quizAnswers[q.id];
      const answered = userAns !== undefined;
      return `
        <div class="surface-box">
          <div class="row-between mb-1">
            <span class="badge badge-blue">문제 ${q.id} (${displayIndex + 1}/${totalLen}) · ${escapeHtml(q.category)}</span>
            <div class="row-wrap">${answered ? `<span class="badge ${userAns === q.answer ? "badge-green" : "badge-red"}">${userAns === q.answer ? "정답" : "오답"}</span>${userAns !== q.answer ? `<button type="button" class="btn btn-sm btn-secondary" onclick="window.retrySingleQuiz(${q.id})">다시 풀기</button>` : ""}` : `<span class="badge badge-gray">미응시</span>`}</div>
          </div>
          <div style="font-weight:700; font-size:0.97rem; margin-bottom:0.85rem;">${escapeHtml(q.q)}</div>
          <div>${q.options.map((opt, oIdx) => {
            let cls = "quiz-option";
            if (answered) { if (oIdx === q.answer) cls += " correct"; else if (oIdx === userAns) cls += " wrong"; }
            return `<button type="button" class="${cls}" ${answered ? "disabled" : ""} onclick="window.answerQuiz(${q.id}, ${oIdx})"><span class="badge badge-gray">${oIdx + 1}</span><span>${escapeHtml(opt)}</span></button>`;
          }).join("")}</div>
          ${answered ? `<div class="callout callout-info mt-1 text-sm"><strong>해설:</strong> ${escapeHtml(q.explanation)}</div>` : ""}
        </div>
      `;
    };

    if (quizMode === "focus") {
      if (quizFocusIndex < 0) quizFocusIndex = 0;
      if (quizFocusIndex >= list.length) quizFocusIndex = list.length - 1;
      const q = list[quizFocusIndex];
      const progressPct = Math.round(((quizFocusIndex + 1) / list.length) * 100);
      container.innerHTML = `${presenterBannerHtml}<div class="mb-1"><div class="row-between text-xs text-muted mb-1"><span>집중 학습 진행도 (키보드 1~4 선택 · ←/→ 이동)</span><span>${quizFocusIndex + 1} / ${list.length} 문항</span></div><div class="progress-track"><div class="progress-fill" style="width:${progressPct}%;"></div></div></div>${renderCard(q, quizFocusIndex, list.length)}<div class="row-between mt-2"><button type="button" class="btn btn-secondary" ${quizFocusIndex === 0 ? "disabled" : ""} onclick="window.moveQuizFocus(-1)">← 이전 문제</button><button type="button" class="btn btn-primary" ${quizFocusIndex === list.length - 1 ? "disabled" : ""} onclick="window.moveQuizFocus(1)">다음 문제 →</button></div>`;
    } else {
      container.innerHTML = `${presenterBannerHtml}<div class="stack-md">${list.map((q, i) => renderCard(q, i, list.length)).join("")}</div>`;
    }
  }

  window.answerQuiz = function (qId, optionIdx) {
    appState.quizAnswers[qId] = optionIdx;
    let score = 0;
    window.EDU_DATA.quizQuestions.forEach((q) => { if (appState.quizAnswers[q.id] === q.answer) score++; });
    if (appState.quizBestScore === null || score > appState.quizBestScore) appState.quizBestScore = score;
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
    sub.textContent = `${appState.profile.teacherName} (관심 보직: ${myDepts || "교무부장"})`;
    grid.innerHTML = `<div class="surface-box"><div class="text-xs text-muted">연수 실습 워크북</div><div style="font-size:1.3rem; font-weight:800; color:var(--brand-primary);">${labsDone} / 3 완료</div></div><div class="surface-box"><div class="text-xs text-muted">종합 능력평가 최고점</div><div style="font-size:1.3rem; font-weight:800; color:${score >= 80 ? "var(--success)" : "var(--brand-primary)"};">${score}점 / 100점</div></div><div class="surface-box"><div class="text-xs text-muted">공문서 린터 점검 누적</div><div style="font-size:1.3rem; font-weight:800; color:var(--brand-primary);">${appState.lintCount || 0}회</div></div>`;
    ts.textContent = `발급 일시: ${new Date().toLocaleDateString("ko-KR")} · 2027 초등 1급 정교사 자격연수 「슬기로운 교직실무 포털」`;
  }

  function highlightText(rawText, query) {
    const safe = escapeHtml(rawText);
    if (!query) return safe;
    return safe.replace(new RegExp(`(${escapeRegex(escapeHtml(query))})`, "gi"), '<mark class="search-hl">$1</mark>');
  }

  function renderFaqList(forceExpandId = null) {
    const cat = document.getElementById("faqCatFilter").value;
    const q = document.getElementById("faqSearchInput").value.trim();
    const qLow = q.toLowerCase();
    const container = document.getElementById("faqAccordionContainer");
    const filtered = window.EDU_DATA.accountingFaqs.filter((f) => (cat === "ALL" || f.cat === cat) && (!qLow || f.q.toLowerCase().includes(qLow) || f.a.toLowerCase().includes(qLow)));
    if (filtered.length === 0) {
      container.innerHTML = `<div class="surface-box text-muted" style="text-align:center; padding:1.5rem;">일치하는 FAQ 항목이 없습니다.</div>`;
      return;
    }
    container.innerHTML = filtered
      .map((f) => `<div class="faq-item ${Boolean(qLow) || forceExpandId === f.id ? "open" : ""}" id="faq-box-${f.id}"><button type="button" class="faq-question" onclick="this.parentElement.classList.toggle('open')"><span><span class="badge badge-blue" style="margin-right:0.5rem;">${escapeHtml(f.cat)}</span>${highlightText(f.q, q)}</span><svg class="svg-icon faq-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button><div class="faq-answer" style="white-space:pre-line;">${highlightText(f.a, q)}</div></div>`)
      .join("");
  }

  window.toggleAllFaqs = function (expand) {
    document.querySelectorAll("#faqAccordionContainer .faq-item").forEach((el) => el.classList.toggle("open", expand));
  };

  // ==========================================
  // 9. 글로벌 통합 검색 · 커맨드 팔레트 v3.0
  // ==========================================
  const QUICK_COMMANDS = [
    { id: "cmd-travel", keywords: "출장 여비 관내 관외 일비 식비 숙박 계산기", title: "공무원 국내 출장 여비 계산기 열기", desc: "관내·관외 출장 여비 및 공용차량 감액 자동 산출", run: () => window.switchMainTab("tab-budget", "budget-sub-tools") },
    { id: "cmd-contract", keywords: "수의계약 계약 방법 s2b g2b 추정가격 입찰 판별기", title: "물품·용역·공사 계약 방법 판별기 열기", desc: "추정가격 환산 및 1인 수의·S2B·입찰 필수 서류 확인", run: () => window.switchMainTab("tab-budget", "budget-sub-tools") },
    { id: "cmd-settle-sim", keywords: "개산급 정산 등록 시뮬레이터 전산자료 9단계", title: "개산급 정산등록 9단계 시뮬레이터 체험", desc: "카드 영수증 '전산자료' 선택 포함 9단계 모의 실습", run: () => { window.switchMainTab("tab-budget", "budget-sub-guide"); window.switchEdufineSim("settle"); } },
    { id: "cmd-theme", keywords: "다크 모드 라이트 테마 야간 화면", title: "다크 / 라이트 모드 전환", desc: "화면 테마를 즉시 전환합니다", run: () => document.getElementById("themeToggleBtn").click() },
    { id: "cmd-font", keywords: "큰 글씨 확대 빔프로젝터 발표 폰트", title: "큰 글씨 모드 전환 (가+ / 가-)", desc: "빔프로젝터·연수 발표용 글자 크기를 전환합니다", run: () => document.getElementById("fontScaleToggleBtn").click() },
    { id: "cmd-print-settle", keywords: "정산서 인쇄 a4 학급운영비 출력", title: "학급운영비 공식 정산서 A4 인쇄", desc: "작성 중인 개산급 정산서를 공식 서식으로 인쇄합니다", run: () => window.printSettlementOfficial() },
    { id: "cmd-backup", keywords: "백업 json 내보내기 저장 동기화", title: "내 데이터 백업 파일(.json) 다운로드", desc: "체크리스트·기안함·실습·퀴즈 기록 전체 백업", run: () => window.exportBackupJson() },
    { id: "cmd-qr", keywords: "qr 큐알 공유 링크 스캔", title: "현재 화면 QR 코드 공유 열기", desc: "오프라인 QR 코드로 현재 페이지를 즉시 공유합니다", run: () => window.openQrModal() }
  ];

  function openSearchModal() {
    const input = document.getElementById("globalSearchModalInput");
    input.value = "";
    activeSearchIdx = -1;
    renderGlobalSearchResults("");
    openModalAccessible("searchModalBackdrop", input);
  }

  window.closeSearchModal = function () {
    closeModalAccessible("searchModalBackdrop");
  };

  window.applySearchChip = function (keyword) {
    const input = document.getElementById("globalSearchModalInput");
    if (!input) return;
    input.value = keyword;
    input.focus();
    renderGlobalSearchResults(keyword);
  };

  window.clearRecentSearches = function () {
    appState.recentSearches = [];
    saveState();
    renderGlobalSearchResults("");
  };

  window.runQuickCommandById = function (cmdId) {
    const cmd = QUICK_COMMANDS.find((c) => c.id === cmdId);
    if (!cmd) return;
    window.closeSearchModal();
    cmd.run();
  };

  function recordRecentSearch(q) {
    const clean = String(q || "").trim();
    if (!clean || clean.length < 2) return;
    const prev = (appState.recentSearches || []).filter((item) => item !== clean);
    prev.unshift(clean);
    appState.recentSearches = prev.slice(0, 6);
    saveState();
  }

  function handleSearchModalKeydown(e) {
    if (currentSearchResults.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); activeSearchIdx = (activeSearchIdx + 1) % currentSearchResults.length; updateActiveSearchItem(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeSearchIdx = (activeSearchIdx - 1 + currentSearchResults.length) % currentSearchResults.length; updateActiveSearchItem(); }
    else if (e.key === "Enter" && activeSearchIdx >= 0) { e.preventDefault(); window.jumpFromSearch(activeSearchIdx); }
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
    const currentInput = document.getElementById("globalSearchModalInput")?.value || "";
    recordRecentSearch(currentInput);
    window.closeSearchModal();

    if (item.cmdRun) {
      item.cmdRun();
      return;
    }

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
      } else if (item.draftId) {
        window.loadSavedDraft(item.draftId);
      } else if (typeof item.quizIdx === "number") {
        document.getElementById("quizCategoryFilter").value = "ALL";
        quizMode = "focus";
        quizFocusIndex = item.quizIdx;
        window.setQuizMode("focus");
        quizFocusIndex = item.quizIdx;
        renderQuiz();
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
    const rawQ = query.trim();
    const q = rawQ.toLowerCase();
    const box = document.getElementById("globalSearchResults");
    activeSearchIdx = -1;
    if (!q) {
      currentSearchResults = [];
      const recKeywords = ["개산급", "출장 여비", "수의계약", "일반강사", "교육운영비", "익일", "연계반송", "경조사비", "봉사료"];
      const recent = appState.recentSearches || [];
      box.innerHTML = `
        <div class="stack-md">
          ${
            recent.length > 0
              ? `<div>
                  <div class="row-between mb-1"><span class="text-xs text-muted" style="font-weight:700;">최근 검색어</span><button type="button" class="btn btn-sm btn-secondary" style="padding:0.15rem 0.5rem; font-size:0.72rem;" onclick="window.clearRecentSearches()">지우기</button></div>
                  <div class="row-wrap">${recent.map((r) => `<button type="button" class="search-chip" onclick="window.applySearchChip('${escapeHtml(r).replace(/'/g, "\\'")}')">${escapeHtml(r)}</button>`).join("")}</div>
                </div>`
              : ""
          }
          <div>
            <div class="text-xs text-muted mb-1" style="font-weight:700;">추천 검색어 (클릭하여 바로 검색)</div>
            <div class="row-wrap">${recKeywords.map((k) => `<button type="button" class="search-chip" onclick="window.applySearchChip('${k}')">${k}</button>`).join("")}</div>
          </div>
          <div>
            <div class="text-xs text-muted mb-1" style="font-weight:700;">빠른 실행 명령 (커맨드 팔레트)</div>
            <div class="row-wrap">
              ${QUICK_COMMANDS.map((c) => `<button type="button" class="search-chip search-chip-cmd" onclick="window.runQuickCommandById('${c.id}')">⚡ ${escapeHtml(c.title)}</button>`).join("")}
            </div>
          </div>
        </div>
      `;
      return;
    }

    const results = [];
    QUICK_COMMANDS.forEach((c) => {
      if (c.title.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q)) {
        results.push({ badge: "⚡ 빠른 실행", title: c.title, desc: c.desc, cmdRun: c.run });
      }
    });
    (appState.savedDrafts || []).forEach((d) => {
      if (d.name.toLowerCase().includes(q) || (d.payload?.bTitle || "").toLowerCase().includes(q)) {
        results.push({ badge: "내 기안함", title: d.name, desc: `${d.savedAt} 저장된 기안문 불러오기`, tab: "tab-doc", sub: "doc-sub-builder", draftId: d.id });
      }
    });
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
    window.EDU_DATA.costItemComparisons.forEach((v) => {
      if (v.title.toLowerCase().includes(q) || v.leftDesc.toLowerCase().includes(q) || v.rightDesc.toLowerCase().includes(q)) {
        results.push({ badge: "비목 8대 비교", title: v.title, desc: `${v.leftName} vs ${v.rightName}`, tab: "tab-budget", sub: "budget-sub-finder" });
      }
    });
    window.EDU_DATA.accountingFaqs.forEach((f) => {
      if (f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)) {
        results.push({ badge: `학교회계 FAQ · ${f.cat}`, title: f.q, desc: f.a.slice(0, 105) + "...", tab: "tab-quiz", sub: "quiz-sub-faq", faqId: f.id });
      }
    });
    window.EDU_DATA.departments.forEach((d) => {
      d.periods.forEach((p) => p.tasks.forEach((t) => {
        if (t.title.toLowerCase().includes(q) || t.detail.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)) {
          results.push({ badge: `${d.name} (${p.period})`, title: t.title, desc: t.detail, tab: "tab-role", sub: "role-sub-dept", deptId: d.id, taskId: t.id });
        }
      }));
    });
    (appState.customTasks || []).forEach((ct) => {
      if (ct.title.toLowerCase().includes(q) || (ct.detail || "").toLowerCase().includes(q)) {
        results.push({ badge: `내 추가 업무 (${ct.month}월)`, title: ct.title, desc: ct.detail || "사용자 추가 업무", tab: "tab-role", sub: "role-sub-dept", deptId: ct.deptId });
      }
    });
    window.EDU_DATA.shortcuts.forEach((s) => {
      if (s.key.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)) {
        results.push({ badge: "에듀파인 단축키", title: s.key, desc: s.desc, tab: "tab-home" });
      }
    });
    window.EDU_DATA.quizQuestions.forEach((qz, idx) => {
      if (qz.q.toLowerCase().includes(q) || qz.explanation.toLowerCase().includes(q)) {
        results.push({ badge: `능력평가 퀴즈 #${qz.id}`, title: qz.q, desc: qz.explanation.slice(0, 95) + "...", tab: "tab-quiz", sub: "quiz-sub-play", quizIdx: idx });
      }
    });

    currentSearchResults = results.slice(0, 24);
    if (currentSearchResults.length === 0) {
      box.innerHTML = `<div class="text-muted" style="padding:1.5rem; text-align:center;">'${escapeHtml(rawQ)}'에 대한 검색 결과가 없습니다.</div>`;
      return;
    }

    activeSearchIdx = 0;
    box.innerHTML = currentSearchResults
      .map((r, i) => `<div class="search-result-item ${i === 0 ? "active" : ""}" onclick="window.jumpFromSearch(${i})"><div class="row-between" style="margin-bottom:0.2rem;"><span class="badge ${r.cmdRun ? "badge-purple" : "badge-blue"}">${escapeHtml(r.badge)}</span><span class="text-xs" style="color:var(--brand-primary); font-weight:700;">${r.cmdRun ? "즉시 실행 →" : "바로 이동 →"}</span></div><div style="font-weight:700; font-size:0.91rem;">${highlightText(r.title, rawQ)}</div><div class="text-xs text-secondary" style="margin-top:0.15rem;">${highlightText(r.desc, rawQ)}</div></div>`)
      .join("");
  }

  document.addEventListener("DOMContentLoaded", initApp);
})();
