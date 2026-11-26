// 2027 초등 1급 정교사 자격연수 「슬기로운 교직실무 올인원 포털」 메인 애플리케이션 로직
(function () {
  "use strict";

  const STORAGE_KEY = "EDU_PORTAL_STATE_2027_V1";

  const defaultState = {
    theme: "light",
    lintCount: 0,
    checkedTasks: {},
    labsCompleted: { lab1: false, lab2: false, lab3: false },
    quizAnswers: {},
    quizBestScore: null
  };

  let appState = loadState();
  let currentDeptId = "dept-academic";
  let preBudgetRows = [
    { id: 1, bimok: "교육운영비(자료)", desc: "공생의길 프로젝트 운영(교육자료)", formula: "150,000원×1식×3회=450,000원", amount: 450000 },
    { id: 2, bimok: "교육운영비(간식)", desc: "공생의길 프로젝트 간식 구매", formula: "50,000원×1식×6회=300,000원", amount: 300000 },
    { id: 3, bimok: "운영수당", desc: "공생의길 프로젝트 강사 수당", formula: "150,000원×1명×3회=450,000원", amount: 450000 }
  ];
  let lastLintFixes = [];

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultState));
      return Object.assign(JSON.parse(JSON.stringify(defaultState)), JSON.parse(raw));
    } catch (e) {
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      // ignore storage errors
    }
    updateDashboardStats();
  }

  // Toast Notification
  window.showToast = function (msg) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>✨</span><span>${escapeHtml(msg)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, 2600);
  };

  window.copyText = function (text, toastMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        window.showToast(toastMsg || "클립보드에 복사되었습니다.");
      });
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

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatNumber(num) {
    return Number(num || 0).toLocaleString("ko-KR");
  }

  // ==========================================
  // 1. 초기화 및 탭 내비게이션
  // ==========================================
  function initApp() {
    applyTheme(appState.theme);

    // 메인 탭 전환
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchMainTab(btn.dataset.tab);
      });
    });

    // 서브 탭 전환
    document.querySelectorAll(".sub-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const parentSection = btn.closest(".tab-panel");
        if (!parentSection) return;
        parentSection.querySelectorAll(".sub-tab").forEach((b) => b.classList.remove("active"));
        parentSection.querySelectorAll(".sub-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const target = document.getElementById(btn.dataset.sub);
        if (target) target.classList.add("active");
      });
    });

    // 다크모드 토글
    document.getElementById("themeToggleBtn").addEventListener("click", () => {
      const next = appState.theme === "dark" ? "light" : "dark";
      appState.theme = next;
      applyTheme(next);
      saveState();
    });

    // 진행률 초기화
    document.getElementById("resetProgressBtn").addEventListener("click", () => {
      if (confirm("실습 완료 현황, 보직 체크리스트, 퀴즈 기록을 모두 초기화하시겠습니까?")) {
        appState = JSON.parse(JSON.stringify(defaultState));
        saveState();
        renderDepartments();
        renderQuiz();
        window.showToast("학습 및 실습 기록이 초기화되었습니다.");
      }
    });

    // 글로벌 검색 모달 이벤트
    document.getElementById("globalSearchTrigger").addEventListener("click", openSearchModal);
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearchModal();
      } else if (e.key === "Escape") {
        window.closeSearchModal();
      }
    });
    document.getElementById("searchModalBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "searchModalBackdrop") window.closeSearchModal();
    });
    document.getElementById("globalSearchModalInput").addEventListener("input", (e) => {
      renderGlobalSearchResults(e.target.value);
    });

    // 각 섹션 초기 렌더링
    renderHomeDashboard();
    initLinterModule();
    initBuilderModule();
    initPurifiedDictModule();
    initBudgetModule();
    initRoleModule();
    initLabModule();
    initQuizAndFaqModule();
    updateDashboardStats();
  }

  window.switchMainTab = function (tabId, subId) {
    document.querySelectorAll(".nav-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === tabId);
    });
    if (subId) {
      const panel = document.getElementById(tabId);
      if (panel) {
        panel.querySelectorAll(".sub-tab").forEach((b) => {
          b.classList.toggle("active", b.dataset.sub === subId);
        });
        panel.querySelectorAll(".sub-panel").forEach((p) => {
          p.classList.toggle("active", p.id === subId);
        });
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const icon = document.getElementById("themeIcon");
    const label = document.getElementById("themeLabel");
    if (icon && label) {
      icon.textContent = theme === "dark" ? "☀️" : "🌙";
      label.textContent = theme === "dark" ? "라이트" : "다크";
    }
  }

  // ==========================================
  // 2. 대시보드 & 통계 업데이트
  // ==========================================
  function renderHomeDashboard() {
    const grid = document.getElementById("modulesOverviewGrid");
    grid.innerHTML = window.EDU_DATA.modulesOverview
      .map(
        (m) => `
      <div class="card card-hover" style="cursor:pointer;" onclick="window.switchMainTab('${m.targetTab}')">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <span class="badge badge-blue">MODULE ${m.num}</span>
          <span style="font-size:0.8rem; color:var(--brand-primary); font-weight:700;">바로가기 →</span>
        </div>
        <div style="font-size:1.05rem; font-weight:800; margin-bottom:0.2rem;">${escapeHtml(m.title)}</div>
        <div style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.75rem;">${escapeHtml(m.sub)}</div>
        <ul style="padding-left:1.1rem; font-size:0.84rem; color:var(--text-secondary); display:grid; gap:0.25rem;">
          ${m.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}
        </ul>
      </div>
    `
      )
      .join("");

    const scBody = document.getElementById("shortcutsTableBody");
    scBody.innerHTML = window.EDU_DATA.shortcuts
      .map(
        (s) => `
      <tr>
        <td style="white-space:nowrap;"><kbd>${escapeHtml(s.key)}</kbd></td>
        <td>${escapeHtml(s.desc)}</td>
      </tr>
    `
      )
      .join("");

    const hiBody = document.getElementById("hierarchyTableBody");
    hiBody.innerHTML = window.EDU_DATA.itemHierarchy
      .map(
        (h) => `
      <tr>
        <td><span class="badge badge-gray">${escapeHtml(h.level)}</span></td>
        <td style="font-weight:800; color:var(--brand-primary);">${escapeHtml(h.symbol)}</td>
        <td>${escapeHtml(h.indent)}</td>
        <td style="font-family:var(--font-mono); font-size:0.8rem; white-space:pre;">${escapeHtml(h.example)}</td>
      </tr>
    `
      )
      .join("");
  }

  function updateDashboardStats() {
    // 1. 실습 완료 수
    const labsDone = Object.values(appState.labsCompleted || {}).filter(Boolean).length;
    const elLab = document.getElementById("statLabDone");
    if (elLab) elLab.textContent = `${labsDone} / 3`;

    // 2. 보직교사 체크리스트 달성률
    let totalTasks = 0;
    let checkedCount = 0;
    window.EDU_DATA.departments.forEach((d) => {
      d.periods.forEach((p) => {
        p.tasks.forEach((t) => {
          totalTasks++;
          if (appState.checkedTasks && appState.checkedTasks[t.id]) checkedCount++;
        });
      });
    });
    const pct = totalTasks > 0 ? Math.round((checkedCount / totalTasks) * 100) : 0;
    const elRole = document.getElementById("statRoleProgress");
    if (elRole) elRole.textContent = `${pct}%`;

    // 3. 퀴즈 최고점
    const elQuiz = document.getElementById("statQuizBest");
    if (elQuiz) {
      elQuiz.textContent = appState.quizBestScore !== null ? `${appState.quizBestScore} / 20` : "- 점";
    }

    // 4. 린터 점검 횟수
    const elLint = document.getElementById("statLintCount");
    if (elLint) elLint.textContent = `${appState.lintCount || 0} 회`;
  }

  // ==========================================
  // 3. MODULE 2: 공문서 린터 · 기안 빌더 · 순화 사전
  // ==========================================
  function initLinterModule() {
    window.loadLinterSample(0);
    document.getElementById("runLintBtn").addEventListener("click", () => {
      appState.lintCount = (appState.lintCount || 0) + 1;
      saveState();
      runDocumentLinter();
      window.showToast("공문서 어문규범 및 표기 정밀 점검이 완료되었습니다.");
    });
    document.getElementById("applyAllFixesBtn").addEventListener("click", applyAllLinterFixes);
    document.getElementById("lintTitleInput").addEventListener("input", runDocumentLinter);
    document.getElementById("lintBodyInput").addEventListener("input", runDocumentLinter);
  }

  window.loadLinterSample = function (idx) {
    const sample = window.EDU_DATA.linterSamples[idx];
    if (!sample) return;
    document.getElementById("lintTitleInput").value = sample.title;
    document.getElementById("lintBodyInput").value = sample.body;
    runDocumentLinter();
  };

  function runDocumentLinter() {
    const title = document.getElementById("lintTitleInput").value;
    const body = document.getElementById("lintBodyInput").value;
    const issues = [];
    lastLintFixes = [];

    // 1. 제목 불필요 수식어 점검 (강의안 p.6)
    const titleSuffixRegex = /(에 관한 건|에 대하여|에 대한 건|관련의 건)\s*$/;
    if (titleSuffixRegex.test(title)) {
      const m = title.match(titleSuffixRegex)[0];
      const fixedTitle = title.replace(titleSuffixRegex, " 계획").replace(/\s+/g, " ").trim();
      issues.push({
        type: "error",
        category: "제목 작성 원칙 (p.6)",
        wrong: m,
        right: "구체적 명사형 종결 (예: ~계획, ~안내)",
        reason: "공문서 제목에서 '~에 관한 건', '~에 대하여' 같은 불필요한 수식어는 제거하고 핵심 내용이 드러나게 작성합니다.",
        fixTarget: "title",
        applyFix: (t) => t.replace(titleSuffixRegex, " 계획")
      });
    }

    // 2. 날짜 붙여쓰기 오류 점검: 2026.7.17. 또는 2026. 5.8. (강의안 p.11)
    const compactDateRegex = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})(\.)?/g;
    let match;
    while ((match = compactDateRegex.exec(body)) !== null) {
      const full = match[0];
      const y = match[1];
      const m = match[2];
      const d = match[3];
      const dot = match[4];
      const afterChar = body.slice(match.index + full.length, match.index + full.length + 2);
      // 뒤에 숫자가 이어지는 버전 번호 등이 아니면 날짜로 판단
      const standard = `${y}. ${m}. ${d}.`;
      if (full !== standard && !/^\d/.test(afterChar)) {
        issues.push({
          type: "error",
          category: "날짜 표기법 (p.11)",
          wrong: full,
          right: standard,
          reason: "날짜의 마침표(.)는 연·월·일을 대체하는 부호이므로 마침표 뒤에 한 칸씩 띄어 쓰고, 일(日) 뒤에도 마침표를 찍어야 합니다.",
          fixTarget: "body",
          wrongRaw: full,
          rightRaw: standard
        });
      }
    }

    // 3. 날짜와 요일 사이 불필요한 공백: 2026. 5. 20. (수) -> 2026. 5. 20.(수)
    const daySpaceRegex = /(\d{1,2}\.)\s+\(([월화수목금토일])\)/g;
    while ((match = daySpaceRegex.exec(body)) !== null) {
      issues.push({
        type: "warn",
        category: "날짜·요일 표기 (p.11)",
        wrong: match[0],
        right: `${match[1]}(${match[2]})`,
        reason: "날짜 뒤 요일 괄호는 띄어쓰지 않고 붙여 씁니다. 예: 2026. 5. 20.(수)",
        fixTarget: "body",
        wrongRaw: match[0],
        rightRaw: `${match[1]}(${match[2]})`
      });
    }

    // 4. 기간 물결표(~) 앞뒤 공백: ~ 앞뒤는 붙여 씀 (강의안 p.11)
    const waveSpaceRegex = /(\S)\s+~\s+(\S)/g;
    while ((match = waveSpaceRegex.exec(body)) !== null) {
      issues.push({
        type: "warn",
        category: "기간 물결표 표기 (p.11)",
        wrong: match[0],
        right: `${match[1]}~${match[2]}`,
        reason: "기간을 나타내는 물결표(~)나 붙임표(-) 앞뒤는 띄어쓰지 않고 붙여 씁니다.",
        fixTarget: "body",
        wrongRaw: match[0],
        rightRaw: `${match[1]}~${match[2]}`
      });
    }

    // 5. 물결표(~)와 '까지' 중복 사용: 오전 8시~오후 3시까지 (강의안 p.11)
    const waveUntilRegex = /(~[^\n,.;]+?시(?:\s*\d+분)?|\d{1,2}:\d{2})까지/g;
    while ((match = waveUntilRegex.exec(body)) !== null) {
      issues.push({
        type: "error",
        category: "시간·기간 표기 오류 (p.11)",
        wrong: match[0],
        right: match[1],
        reason: "물결표(~)는 이미 '부터 ~ 까지'의 의미를 담고 있으므로 뒤에 '까지'를 중복해서 쓰지 않습니다.",
        fixTarget: "body",
        wrongRaw: match[0],
        rightRaw: match[1]
      });
    }

    // 6. 자주 틀리는 띄어쓰기 및 투식어 점검 (강의안 p.10, 12)
    const grammarRules = [
      {
        regex: /검토바랍니다/g,
        right: "검토하여 주시기 바랍니다",
        cat: "공문서 문장·띄어쓰기 (p.12)",
        reason: "'검토 바랍니다'보다 '검토하여 주시기 바랍니다'(내부 문서는 '검토하기 바랍니다')로 명확히 표현합니다."
      },
      {
        regex: /실시코자\s*하오니/g,
        right: "실시하고자 하오니",
        cat: "어문규범·투식어",
        reason: "'~코자'는 구투 표현이므로 '~하고자'로 풀어 씁니다."
      },
      {
        regex: /(할|될|볼|갈|올)수\s/g,
        right: "$1 수 ",
        cat: "의존명사 띄어쓰기 (p.10)",
        reason: "의존명사 '수'는 앞말과 반드시 띄어 씁니다 (예: 할 수, 될 수)."
      },
      {
        regex: /파악해주시기\s*드립니다/g,
        right: "파악하여 주시기 바랍니다",
        cat: "문장 호응·과도한 존칭 (p.12)",
        reason: "'~해 주시기 드립니다'는 어법에 맞지 않으며 불필요한 '드립니다' 사용을 지양합니다."
      },
      {
        regex: /강화시키기\s*위한/g,
        right: "강화하기 위한",
        cat: "불필요한 사동 표현 (공문서 바로쓰기 6차시)",
        reason: "'~하다'로 충분한 곳에 무분별하게 '~시키다'를 쓰지 않습니다."
      },
      {
        regex: /계획되었습니다/g,
        right: "계획하였습니다",
        cat: "능동형 문장 권장 (p.8)",
        reason: "공문서는 책임 소재가 분명하도록 불필요한 피동 표현('~되었습니다') 대신 능동형('~하였습니다') 사용을 권장합니다."
      },
      {
        regex: /에\s*있어서/g,
        right: "에서(또는 에 관하여)",
        cat: "일본어 번역 투 (공공언어 바로쓰기 p.13)",
        reason: "'~에 있어서'는 일본어 번역 투 표현이므로 '~에서' 또는 '~에 관하여'로 고쳐 씁니다."
      }
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

    // 7. 첨부물 1개일 때 '붙임 1.' 번호 부여 오류 점검 (강의안 p.18)
    const attachOneRegex = /붙임\s+1\.\s*([^\n]+)\s+끝\./;
    if (attachOneRegex.test(body) && !/2\./.test(body.slice(body.indexOf("붙임")))) {
      const m = body.match(attachOneRegex);
      const fixedAttach = `붙임  ${m[1].trim()}  끝.`;
      issues.push({
        type: "warn",
        category: "붙임 표기 원칙 (p.18)",
        wrong: m[0],
        right: fixedAttach,
        reason: "첨부물이 1개일 경우에는 '1.' 숫자를 매기지 않고 '붙임' 뒤 1타(띄어쓰기 2번)를 띄운 후 바로 기재합니다.",
        fixTarget: "body",
        wrongRaw: m[0],
        rightRaw: fixedAttach
      });
    }

    // 8. 공공언어·행정용어·일본어 투·외래어 사전 매칭
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
  }

  function renderLintIssues(issues) {
    const badge = document.getElementById("lintSummaryBadge");
    const container = document.getElementById("lintIssuesContainer");

    if (issues.length === 0) {
      badge.className = "badge badge-green";
      badge.textContent = "✔ 표기·어문규범 완벽 (오류 0건)";
      container.innerHTML = `
        <div class="card" style="background:var(--success-bg); border-color:var(--success-border); text-align:center; padding:2rem 1rem;">
          <div style="font-size:2rem; margin-bottom:0.5rem;">🎉</div>
          <div style="font-weight:800; color:var(--success); font-size:1.02rem;">검출된 공문서 표기 및 공공언어 오류가 없습니다!</div>
          <div style="font-size:0.86rem; color:var(--text-secondary); margin-top:0.35rem;">행정업무운영편람의 날짜·시간·항목·붙임 표기 원칙과 쉬운 공공언어 기준을 잘 준수하고 있습니다.</div>
        </div>
      `;
      return;
    }

    badge.className = "badge badge-red";
    badge.textContent = `⚠️ 교정 권장 ${issues.length}건 발견`;

    container.innerHTML = issues
      .map(
        (iss, idx) => `
      <div class="lint-issue-card ${iss.type === "warn" ? "warn" : ""}">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
            <span class="badge ${iss.type === "warn" ? "badge-amber" : "badge-red"}">${escapeHtml(iss.category)}</span>
          </div>
          <div style="font-size:0.92rem; margin-bottom:0.25rem;">
            <span class="lint-wrong">${escapeHtml(iss.wrong)}</span>
            <span style="margin:0 0.35rem;">→</span>
            <span class="lint-right">${escapeHtml(iss.right)}</span>
          </div>
          <div style="font-size:0.82rem; color:var(--text-secondary);">${escapeHtml(iss.reason)}</div>
        </div>
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.applySingleLintFix(${idx})">적용</button>
      </div>
    `
      )
      .join("");
  }

  window.applySingleLintFix = function (idx) {
    const iss = lastLintFixes[idx];
    if (!iss) return;
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
    if (lastLintFixes.length === 0) {
      window.showToast("교정할 오류가 없습니다.");
      return;
    }
    let titleVal = document.getElementById("lintTitleInput").value;
    let bodyVal = document.getElementById("lintBodyInput").value;

    lastLintFixes.forEach((iss) => {
      if (iss.fixTarget === "title" && iss.applyFix) {
        titleVal = iss.applyFix(titleVal);
      } else if (iss.fixTarget === "body" && iss.wrongRaw) {
        bodyVal = bodyVal.split(iss.wrongRaw).join(iss.rightRaw);
      }
    });

    document.getElementById("lintTitleInput").value = titleVal;
    document.getElementById("lintBodyInput").value = bodyVal;
    runDocumentLinter();
    window.showToast("검출된 모든 표기·어문규범 오류가 자동 교정되었습니다!");
  }

  window.copyCorrectedDoc = function () {
    const t = document.getElementById("lintTitleInput").value;
    const b = document.getElementById("lintBodyInput").value;
    window.copyText(`제목: ${t}\n\n${b}`, "교정된 기안문이 클립보드에 복사되었습니다.");
  };

  // ==========================================
  // Sub 2-2: 에듀파인 기안문 & 계획서 빌더
  // ==========================================
  function initBuilderModule() {
    const ids = ["bDocType", "bRelatedDoc", "bTitle", "bPurpose", "bDate", "bPlace", "bTarget", "bDetails", "bPlanB", "bBudget", "bAttachments"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", renderBuilderPreview);
    });
    renderBuilderPreview();
  }

  window.loadBuilderPreset = function (preset) {
    if (preset === "fieldtrip") {
      document.getElementById("bDocType").value = "내부결재";
      document.getElementById("bRelatedDoc").value = "장성성산초등학교-4808(2026. 5. 8.)";
      document.getElementById("bTitle").value = "2026학년도 1학기 현장체험학습 사전답사 실시 계획";
      document.getElementById("bPurpose").value = "2026학년도 현장체험학습 매뉴얼에 의거하여 안전하고 교육적인 체험학습 운영을 위해 다음과 같이 사전답사를 실시하고자 합니다.";
      document.getElementById("bDate").value = "2026. 5. 20.(수) 14:00~17:00";
      document.getElementById("bPlace").value = "국립광주과학관 및 이동 경로 일원";
      document.getElementById("bTarget").value = "3학년 부장 및 인솔교사 3명 (총 4명)";
      document.getElementById("bDetails").value = "체험 활동 장소의 교육적 적합성 및 안전 시설 확인\n학생 이동 동선, 식당 위생 상태, 비상 대피로 및 보건실 위치 점검\n차량 승·하차 구역 및 주차장 확보 상태 확인";
      document.getElementById("bPlanB").value = "우천 또는 미세먼지 '나쁨' 시 실내 상설전시관 및 천체투영관 관람 프로그램으로 대체 운영";
      document.getElementById("bBudget").value = "관외출장 여비 및 입장료(교육운영비·여비): 20,000원 × 4명 × 1회 = 80,000원";
      document.getElementById("bAttachments").value = "사전답사 계획 1부.\n사전답사 체크리스트 1부.";
    } else if (preset === "eco") {
      document.getElementById("bDocType").value = "내부결재";
      document.getElementById("bRelatedDoc").value = "창의융합교육과-3120(2026. 4. 2.)";
      document.getElementById("bTitle").value = "2026학년도 학교 생태환경교육 자율동아리 5월 활동 계획";
      document.getElementById("bPurpose").value = "학생 주도적 생태환경 보호 실천과 협동심 함양을 위하여 자율동아리 5월 활동(우리 동네 플로깅)을 다음과 같이 운영하고자 합니다.";
      document.getElementById("bDate").value = "2026. 5. 22.(금) 13:30~15:50";
      document.getElementById("bPlace").value = "학교 주변 생태탐방로 및 성산천 일대";
      document.getElementById("bTarget").value = "생태환경 자율동아리 회원 16명 및 지도교사 2명";
      document.getElementById("bDetails").value = "사전 안전교육(13:30~13:50): 교통안전, 독충 주의 및 집게·장갑 사용법\n생태 플로깅 활동(13:50~15:20): 성산천 산책로 환경 정화 및 식생 관찰\n분리배출 및 소감 나눔(15:20~15:50): 수거 쓰레기 분리배출 및 활동 성찰";
      document.getElementById("bPlanB").value = "우천 및 폭염 특보 시 과학실 내 '업사이클링 친환경 화분 만들기' 활동으로 대체(Plan B)";
      document.getElementById("bBudget").value = "생태 플로깅 물품 및 간식 구입(교육운영비): 10,000원 × 16명 × 1회 = 160,000원";
      document.getElementById("bAttachments").value = "2026학년도 생태환경 자율동아리 5월 운영 계획서 1부.";
    }
    renderBuilderPreview();
    window.showToast("예시 양식이 로드되었습니다.");
  };

  function getFormattedBuilderText() {
    const docType = document.getElementById("bDocType").value;
    const related = document.getElementById("bRelatedDoc").value.trim();
    const title = document.getElementById("bTitle").value.trim();
    const purpose = document.getElementById("bPurpose").value.trim();
    const date = document.getElementById("bDate").value.trim();
    const place = document.getElementById("bPlace").value.trim();
    const target = document.getElementById("bTarget").value.trim();
    const details = document
      .getElementById("bDetails")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const planB = document.getElementById("bPlanB").value.trim();
    const budget = document.getElementById("bBudget").value.trim();
    const attaches = document
      .getElementById("bAttachments")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const lines = [];
    let mainNum = 1;
    if (related) {
      lines.push(`${mainNum}. 관련: ${related}`);
      mainNum++;
    }
    lines.push(`${mainNum}. ${purpose}`);
    lines.push(`  가. 일시: ${date}`);
    lines.push(`  나. 장소: ${place}`);
    lines.push(`  다. 대상: ${target}`);
    if (details.length > 0) {
      lines.push(`  라. 세부 추진 내용`);
      details.forEach((d, i) => {
        lines.push(`    ${i + 1}) ${d}`);
      });
    }
    if (planB) {
      lines.push(`  마. 안전 대책 및 악천후 시 대안: ${planB}`);
    }
    if (budget) {
      lines.push(`  바. 소요 예산: ${budget}`);
    }

    lines.push(""); // 본문과 붙임 사이 1줄 띄움 (가독성 팁 반영)

    if (attaches.length === 0) {
      lines[lines.length - 2] = lines[lines.length - 2] + "  끝.";
      lines.pop();
    } else if (attaches.length === 1) {
      const a0 = attaches[0].endsWith(".") ? attaches[0] : attaches[0] + ".";
      lines.push(`붙임  ${a0}  끝.`);
    } else {
      attaches.forEach((att, idx) => {
        const cleanAtt = att.endsWith(".") ? att : att + ".";
        const isLast = idx === attaches.length - 1;
        if (idx === 0) {
          lines.push(`붙임  1. ${cleanAtt}${isLast ? "  끝." : ""}`);
        } else {
          lines.push(`      ${idx + 1}. ${cleanAtt}${isLast ? "  끝." : ""}`);
        }
      });
    }

    return {
      docType,
      title,
      bodyText: lines.join("\n")
    };
  }

  function renderBuilderPreview() {
    const data = getFormattedBuilderText();
    const box = document.getElementById("edufinePreviewBox");
    box.innerHTML = `
      <div class="edufine-header">
        <div class="edufine-org-slogan">함께 여는 미래, 탄탄한 전남교육</div>
        <div class="edufine-org-name">장 성 성 산 초 등 학 교</div>
      </div>
      <div class="edufine-meta-row">
        <span class="edufine-meta-label">수신</span>
        <span>${escapeHtml(data.docType)}</span>
      </div>
      <div class="edufine-meta-row">
        <span class="edufine-meta-label">(경유)</span>
        <span></span>
      </div>
      <div class="edufine-title-row">
        <span>제목</span>
        <span>${escapeHtml(data.title)}</span>
      </div>
      <div class="edufine-body">${escapeHtml(data.bodyText)}</div>
    `;
  }

  window.copyBuilderOutput = function () {
    const data = getFormattedBuilderText();
    window.copyText(`제목: ${data.title}\n\n${data.bodyText}`, "K-에듀파인 표준 기안문이 복사되었습니다.");
  };

  // Sub 2-3: 공공언어·행정용어 사전
  function initPurifiedDictModule() {
    const catEl = document.getElementById("dictCategoryFilter");
    const searchEl = document.getElementById("dictSearchInput");
    catEl.addEventListener("change", renderPurifiedDict);
    searchEl.addEventListener("input", renderPurifiedDict);
    renderPurifiedDict();
  }

  function renderPurifiedDict() {
    const cat = document.getElementById("dictCategoryFilter").value;
    const q = document.getElementById("dictSearchInput").value.trim().toLowerCase();
    const tbody = document.getElementById("dictTableBody");

    const filtered = window.EDU_DATA.purifiedTerms.filter((item) => {
      const matchCat = cat === "ALL" || item.category.includes(cat);
      const matchQ =
        !q ||
        item.wrong.toLowerCase().includes(q) ||
        item.right.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    tbody.innerHTML = filtered
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
  // 4. MODULE 3: 학교회계 비목 파인더 & 강사료·성립전 예산 계산기
  // ==========================================
  function initBudgetModule() {
    // Sub 3-1: 비목 파인더 & 8대 비교
    document.getElementById("costTargetFilter").addEventListener("change", renderCostFinder);
    document.getElementById("costSearchInput").addEventListener("input", renderCostFinder);
    renderCostFinder();
    renderCostVsCards();

    // Sub 3-2: 강사수당 계산기 초기화
    const instSelect = document.getElementById("instGradeSelect");
    instSelect.innerHTML = window.EDU_DATA.instructorRates
      .map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`)
      .join("");
    instSelect.value = "general2"; // 일반강사 II 기본 선택

    ["instGradeSelect", "instHoursPerDay", "instCount", "instVisits"].forEach((id) => {
      document.getElementById(id).addEventListener("input", calculateInstructorFee);
    });
    calculateInstructorFee();

    // 성립전 예산 시뮬레이터
    document.getElementById("preTotalGrant").addEventListener("input", renderPreBudgetTable);
    renderPreBudgetTable();

    // Sub 3-3: 학급운영비 & 업무추진비 계산기
    ["classOpClasses", "classOpStudents"].forEach((id) => {
      document.getElementById(id).addEventListener("input", calculateClassOperation);
    });
    ["promoPeople", "promoTotal"].forEach((id) => {
      document.getElementById(id).addEventListener("input", calculatePromoLimit);
    });
    calculateClassOperation();
    calculatePromoLimit();
  }

  function renderCostFinder() {
    const target = document.getElementById("costTargetFilter").value;
    const q = document.getElementById("costSearchInput").value.trim().toLowerCase();
    const grid = document.getElementById("costFinderGrid");

    const list = window.EDU_DATA.costFinderCases.filter((c) => {
      const mTarget = target === "ALL" || c.target === target;
      const mQ =
        !q ||
        c.category.toLowerCase().includes(q) ||
        c.item.toLowerCase().includes(q) ||
        c.note.toLowerCase().includes(q);
      return mTarget && mQ;
    });

    grid.innerHTML = list
      .map(
        (c) => `
      <div class="card" style="background:var(--bg-tertiary);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
          <span class="badge badge-gray">대상: ${escapeHtml(c.target)}</span>
          <span class="badge badge-blue">세목: ${escapeHtml(c.code)}</span>
        </div>
        <div style="font-weight:700; font-size:0.95rem; margin-bottom:0.35rem;">${escapeHtml(c.category)}</div>
        <div style="font-size:1.05rem; font-weight:800; color:var(--brand-primary); margin-bottom:0.4rem;">
          👉 권장 원가통계비목: 『${escapeHtml(c.item)}』
        </div>
        <div style="font-size:0.82rem; color:var(--text-secondary);">💡 ${escapeHtml(c.note)}</div>
      </div>
    `
      )
      .join("");
  }

  function renderCostVsCards() {
    const grid = document.getElementById("costVsGrid");
    grid.innerHTML = window.EDU_DATA.costItemComparisons
      .map(
        (v) => `
      <div class="card">
        <div style="font-weight:800; font-size:0.98rem; margin-bottom:0.65rem; color:var(--brand-primary);">
          ⚖️ ${escapeHtml(v.title)}
        </div>
        <div class="grid-2" style="gap:0.65rem;">
          <div style="padding:0.75rem; background:var(--bg-accent); border-radius:8px;">
            <div style="font-weight:700; font-size:0.86rem; margin-bottom:0.25rem;">${escapeHtml(v.leftName)}</div>
            <div style="font-size:0.82rem; color:var(--text-secondary); white-space:pre-line;">${escapeHtml(v.leftDesc)}</div>
          </div>
          <div style="padding:0.75rem; background:var(--bg-tertiary); border-radius:8px;">
            <div style="font-weight:700; font-size:0.86rem; margin-bottom:0.25rem;">${escapeHtml(v.rightName)}</div>
            <div style="font-size:0.82rem; color:var(--text-secondary); white-space:pre-line;">${escapeHtml(v.rightDesc)}</div>
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
    const perVisitPerPerson = rateObj.isHourlyFlat
      ? rateObj.baseRate * hours
      : rateObj.baseRate + rateObj.extraRate * (hours - 1);
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
      <div style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:0.35rem;">${escapeHtml(breakdownText)}</div>
      <div style="font-size:1.3rem; font-weight:800; color:var(--brand-primary); margin-bottom:0.35rem;">
        총 강사수당: ${formatNumber(d.total)}원 <span class="badge badge-blue">원가통계비목: 운영수당</span>
      </div>
      <div style="font-family:var(--font-mono); font-size:0.86rem; background:var(--bg-secondary); padding:0.45rem 0.65rem; border-radius:6px; border:1px solid var(--border-color);">
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
    window.showToast("성립전 예산 세출표에 강사수당 항목이 추가되었습니다.");
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
    window.showToast("공생의 길 프로젝트 성립전 예산 모범 예시가 로드되었습니다.");
  };

  window.addCustomPreBudgetRow = function () {
    const bimok = document.getElementById("newPreBimok").value;
    const desc = document.getElementById("newPreDesc").value.trim() || "교육활동 운영";
    const formula = document.getElementById("newPreFormula").value.trim() || "100,000원×1식=100,000원";
    const amount = parseInt(document.getElementById("newPreAmount").value, 10) || 0;
    if (amount <= 0) {
      window.showToast("올바른 요구액(원)을 입력해 주세요.");
      return;
    }
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

    tbody.innerHTML = preBudgetRows
      .map((r) => {
        totalExp += r.amount;
        if (r.bimok.includes("간식") || r.desc.includes("간식")) {
          snackExp += r.amount;
        }
        const cleanBimok = r.bimok.replace(/\(.*\)/, "");
        return `
        <tr>
          <td><span class="badge badge-blue">${escapeHtml(cleanBimok)}</span></td>
          <td>${escapeHtml(r.desc)}</td>
          <td style="font-family:var(--font-mono); font-size:0.8rem;">${escapeHtml(r.formula)}</td>
          <td style="font-weight:700; text-align:right;">${formatNumber(r.amount)}</td>
          <td><button type="button" class="btn btn-sm btn-secondary" onclick="window.removePreBudgetRow(${r.id})">✕</button></td>
        </tr>
      `;
      })
      .join("");

    tbody.innerHTML += `
      <tr style="background:var(--bg-accent); font-weight:800;">
        <td colspan="3" style="text-align:center;">합 계</td>
        <td style="text-align:right; color:var(--brand-primary);">${formatNumber(totalExp)}원</td>
        <td></td>
      </tr>
    `;

    const snackRatio = grant > 0 ? ((snackExp / grant) * 100).toFixed(1) : "0.0";
    const isSnackOk = parseFloat(snackRatio) < 30.0;
    const diff = grant - totalExp;

    const statusPanel = document.getElementById("preBudgetStatusPanel");
    statusPanel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.5rem;">
        <div>
          <strong>교부금 대비 편성 잔액:</strong>
          <span class="badge ${diff === 0 ? "badge-green" : "badge-red"}">
            ${diff === 0 ? "✔ 세입·세출 100% 일치 (0원)" : `차액 ${formatNumber(diff)}원 발생`}
          </span>
        </div>
        <div>
          <strong>학생 간식비 비율 (30% 미만 의무):</strong>
          <span class="badge ${isSnackOk ? "badge-green" : "badge-red"}">
            ${snackRatio}% (${formatNumber(snackExp)}원) ${isSnackOk ? "✔ 기준 통과" : "⚠️ 30% 미만 위반!"}
          </span>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${isSnackOk ? "success" : "danger"}" style="width:${Math.min(100, parseFloat(snackRatio))}%;"></div>
      </div>
    `;
  }

  window.copyPreBudgetDoc = function () {
    const proj = document.getElementById("preProjectName").value.trim();
    const grant = parseInt(document.getElementById("preTotalGrant").value, 10) || 0;
    const rowsText = preBudgetRows
      .map((r, i) => `    ${i + 1}) [${r.bimok.replace(/\(.*\)/, "")}] ${r.desc}: ${r.formula}`)
      .join("\n");

    const text = `제목: ${proj} 성립전 예산 요구

1. 관련: 교육지원과-6788(2026. 4. 13.)
2. ${proj} 운영비가 교부되었으나, 추가경정예산에 편성하기에는 시간적 여유가 없어 다음과 같이 성립전 예산편성을 요구합니다.
  가. 사업명: ${proj}
  나. 교부금액: ${formatNumber(grant)}원
  다. 예산편성 요구 내용
    [세입예산] 교육비특별회계전입금(목적사업비전입금): ${formatNumber(grant)}원
    [세출예산]
${rowsText}
    - 합계: ${formatNumber(grant)}원.  끝.`;

    window.copyText(text, "성립전 예산 요구 기안문이 복사되었습니다.");
  };

  function calculateClassOperation() {
    const classes = Math.max(1, parseInt(document.getElementById("classOpClasses").value, 10) || 1);
    const students = Math.max(1, parseInt(document.getElementById("classOpStudents").value, 10) || 1);
    const baseAmt = classes * 500000;
    const studentAmt = students * 14000;
    const total = baseAmt + studentAmt;

    document.getElementById("classOpResultBox").innerHTML = `
      <div style="font-size:1.15rem; font-weight:800; color:var(--brand-primary); margin-bottom:0.3rem;">
        최저 편성 기준액: ${formatNumber(total)}원 이상
      </div>
      <div style="font-size:0.84rem; color:var(--text-secondary);">
        • 산출 근거: 학급당(${formatNumber(baseAmt)}원) + 학생당(14,000원 × ${students}명 = ${formatNumber(studentAmt)}원)<br/>
        • 유의사항: 개산급 수령 후 <strong>집행 완료 5일 이내</strong> 정산서 및 증빙서류 제출 (고지방·인스턴트 반복 간식 구입 지양)
      </div>
    `;
  }

  function calculatePromoLimit() {
    const people = Math.max(1, parseInt(document.getElementById("promoPeople").value, 10) || 1);
    const total = Math.max(0, parseInt(document.getElementById("promoTotal").value, 10) || 0);
    const maxLimit = people * 40000;
    const perPerson = Math.round(total / people);
    const isOk = total <= maxLimit;

    document.getElementById("promoResultBox").innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
        <span style="font-weight:800; font-size:1.05rem;">1인당 평균: ${formatNumber(perPerson)}원</span>
        <span class="badge ${isOk ? "badge-green" : "badge-red"}">
          ${isOk ? "✔ 1인당 40,000원 한도 준수" : "⚠️ 한도 초과 (최대 " + formatNumber(maxLimit) + "원)"}
        </span>
      </div>
      <div style="font-size:0.82rem; color:var(--text-secondary);">
        • 간담회·협의회 한도: <strong>1인당 40,000원 이내</strong> (${people}명 최대 ${formatNumber(maxLimit)}원, 건당 50만 원 이상 시 상대방 소속·성명 기재)<br/>
        • 경조사비 한도: <strong>기관운영업무추진비</strong>에서만 집행 가능(사업추진업무추진비 불가), 축·조의금 <strong>50,000원</strong> / 화환·조화 <strong>100,000원</strong>
      </div>
    `;
  }

  // ==========================================
  // 5. MODULE 4: 8대 보직교사 한해살이 & AI 프롬프트 빌더
  // ==========================================
  function initRoleModule() {
    renderDepartments();
    document.getElementById("aiTaskSelect").addEventListener("change", generateAiPrompt);
    document.getElementById("aiKeywordsInput").addEventListener("input", generateAiPrompt);
    generateAiPrompt();
  }

  window.selectDepartment = function (deptId) {
    currentDeptId = deptId;
    renderDepartments();
  };

  window.toggleDeptTask = function (taskId) {
    if (!appState.checkedTasks) appState.checkedTasks = {};
    appState.checkedTasks[taskId] = !appState.checkedTasks[taskId];
    saveState();
    renderDepartments();
  };

  function renderDepartments() {
    const bar = document.getElementById("deptSelectorBar");
    bar.innerHTML = window.EDU_DATA.departments
      .map((d) => {
        let total = 0;
        let done = 0;
        d.periods.forEach((p) =>
          p.tasks.forEach((t) => {
            total++;
            if (appState.checkedTasks && appState.checkedTasks[t.id]) done++;
          })
        );
        const isActive = d.id === currentDeptId;
        return `
        <button type="button" class="btn ${isActive ? "btn-primary" : "btn-secondary"}" onclick="window.selectDepartment('${d.id}')">
          <span>${escapeHtml(d.name)}</span>
          <span class="badge ${isActive ? "badge-gray" : "badge-blue"}">${done}/${total}</span>
        </button>
      `;
      })
      .join("");

    const dept = window.EDU_DATA.departments.find((d) => d.id === currentDeptId) || window.EDU_DATA.departments[0];
    let deptTotal = 0;
    let deptDone = 0;
    dept.periods.forEach((p) =>
      p.tasks.forEach((t) => {
        deptTotal++;
        if (appState.checkedTasks && appState.checkedTasks[t.id]) deptDone++;
      })
    );
    const deptPct = deptTotal > 0 ? Math.round((deptDone / deptTotal) * 100) : 0;

    const detail = document.getElementById("deptDetailContainer");
    detail.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">
              📌 ${escapeHtml(dept.name)} 연간 한해살이 체크리스트
              <span class="badge badge-blue">${escapeHtml(dept.badge)}</span>
            </div>
            <div class="card-subtitle">${escapeHtml(dept.desc)}</div>
          </div>
          <div style="min-width:180px; text-align:right;">
            <div style="font-size:0.82rem; font-weight:700; margin-bottom:0.25rem;">부서 업무 달성률: ${deptPct}% (${deptDone}/${deptTotal})</div>
            <div class="progress-track">
              <div class="progress-fill success" style="width:${deptPct}%;"></div>
            </div>
          </div>
        </div>

        <div class="grid-3">
          ${dept.periods
            .map(
              (p) => `
            <div class="card" style="background:var(--bg-tertiary);">
              <div style="font-weight:800; font-size:0.96rem; margin-bottom:0.75rem; color:var(--brand-primary);">
                🗓️ ${escapeHtml(p.period)}
              </div>
              <div>
                ${p.tasks
                  .map((t) => {
                    const isChecked = Boolean(appState.checkedTasks && appState.checkedTasks[t.id]);
                    return `
                    <label class="check-item ${isChecked ? "checked" : ""}">
                      <input type="checkbox" ${isChecked ? "checked" : ""} onchange="window.toggleDeptTask('${t.id}')" />
                      <div>
                        <div class="check-title" style="font-weight:700; font-size:0.88rem;">${escapeHtml(t.title)}</div>
                        <div style="font-size:0.79rem; color:var(--text-secondary); margin-top:0.15rem;">${escapeHtml(t.detail)}</div>
                      </div>
                    </label>
                  `;
                  })
                  .join("")}
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function generateAiPrompt() {
    const task = document.getElementById("aiTaskSelect").value;
    const kw = document.getElementById("aiKeywordsInput").value.trim() || "초등학교 생태환경 교육활동";
    let prompt = "";

    if (task === "plan") {
      prompt = `[역할] 당신은 전라남도교육청 소속 초등학교 교무행정 및 교육과정 전문가입니다.
[주제] ${kw}
[요청사항]
위 주제로 누구든 바로 실행할 수 있는 구체적인 '학교 업무 추진계획서' 초안을 작성해 주세요.
반드시 다음 7대 표준 목차와 공문서 어문규범(날짜 마침표 뒤 공백, 24시간제, 쉬운 공공언어)을 준수해 주세요.
1. 목적 및 필요성 (관련 근거 포함)
2. 추진 방침
3. 세부 추진 계획 (일시, 장소, 대상, 시간대별 세부 프로그램 표)
4. 업무 분장표
5. 안전 관리 계획 및 유의사항 (※ 우천·악천후 등 돌발 상황 시 대체 계획 Plan B 필수 포함)
6. 예산 소요 계획 (원가통계비목 및 '단가 × 수량 × 횟수 = 금액' 산출식 명시)
7. 기대 효과`;
    } else if (task === "letter") {
      prompt = `[역할] 당신은 초등학교 학부모님과 따뜻하고 명확하게 소통하는 담임/담당 교사입니다.
[주제] ${kw}
[요청사항]
학부모님께 발송할 가정통신문 초안을 작성해 주세요.
- 국립국어원 '공공언어 바로 쓰기' 원칙에 따라 어려운 한자어나 일본어 투 표현을 피하고 쉽고 정중한 우리말로 작성해 주세요.
- 행사의 목적, 일시(2026. 5. 20.(수) 형식), 장소, 학생 준비물, 안전 유의사항, 신청 회신 양식을 포함해 주세요.`;
    } else if (task === "press") {
      prompt = `[역할] 당신은 전라남도교육청 학교 홍보 및 보도자료 작성 전문 주무관입니다.
[주제] ${kw}
[요청사항]
지역 언론사에 배포할 학교 행사 보도자료 초안을 작성해 주세요.
- 눈길을 끄는 메인 제목과 부제목(헤드라인) 2~3개를 먼저 제안해 주세요.
- 본문은 육하원칙에 따라 객관적이고 간결한 문장(한 문장 2~3줄 이내)으로 작성하고, 참여 학생과 학교장의 현장감 있는 인터뷰 인용문 예시를 포함해 주세요.`;
    } else if (task === "reply") {
      prompt = `[역할] 당신은 경청과 공감을 바탕으로 학부모와 소통하며 교사를 보호하는 초등학교 보직교사입니다.
[상황/키워드] ${kw}
[요청사항]
학부모님의 문의·민원에 대해 ① 공감 및 경청 표현 → ② 학교 규정·교육적 취지 및 사실관계 설명 → ③ 향후 지원 방안 및 협조 요청 순서로 정중하고 신뢰감 있는 답변 스크립트(전화 상담용 및 문자 발송용 각 1부)를 작성해 주세요. (개인식별정보는 [학생명]으로 비식별 표기)`;
    } else if (task === "compare") {
      prompt = `[NotebookLM 소스 분석 전용 프롬프트]
업로드한 두 개의 문서(구버전 지침 및 2026학년도 신버전 지침/학교생활규정 표준안)만을 근거로 다음 사항을 분석해 주세요. (외부 추측이나 환각 금지)
1. 구버전 대비 신버전에서 핵심적으로 신설·개정·삭제된 항목을 '신·구 대조표(개정 전 / 개정 후 / 학교 현장 조치사항)' 형태로 정리해 주세요.
2. '${kw}'와 관련하여 올해 우리 학교 계획서 및 규정에 반드시 반영해야 할 필수 체크리스트 5가지를 추출해 주세요.`;
    }

    document.getElementById("aiPromptOutput").value = prompt;
  }

  window.copyAiPrompt = function () {
    const p = document.getElementById("aiPromptOutput").value;
    window.copyText(p, "JneGPT 안전 프롬프트가 클립보드에 복사되었습니다.");
  };

  // ==========================================
  // 6. MODULE 5: 연수 실습 디지털 워크북 (3종)
  // ==========================================
  function initLabModule() {
    ["lab3Title", "lab3Purpose", "lab3Schedule", "lab3Budget", "lab3Safety"].forEach((id) => {
      document.getElementById(id).addEventListener("input", renderLab3Preview);
    });
    renderLab3Preview();
  }

  // Lab 1: 성립전 예산 실습 채점 및 정답 채우기
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
      {
        pass: b1 === "교육운영비" && a1 > 0,
        title: "조건 1) 학생용 교육 자료 구입 원가통계비목",
        detail: b1 === "교육운영비" ? "정답! 교육용 재료 구입은 '교육운영비'에서 집행합니다." : "오답: 학생 교육용 소모성 자료 구입은 '교육운영비'를 선택해야 합니다."
      },
      {
        pass: b2 === "교육운영비" && a2 > 0 && a2 < 360000,
        title: "조건 2) 학생용 간식 구입 비목 및 30% 미만 의무",
        detail:
          b2 === "교육운영비" && a2 > 0 && a2 < 360000
            ? `정답! 학생 간식비는 '교육운영비'이며, ${formatNumber(a2)}원(${((a2 / 1200000) * 100).toFixed(1)}%)으로 30%(36만 원) 미만 기준을 충족했습니다.`
            : "오답: 학생 간식비는 '교육운영비'이며(업무추진비 아님!), 전체 예산 120만 원의 30% 미만(360,000원 미만, 예: 300,000원)으로 편성해야 합니다."
      },
      {
        pass: b3 === "운영수당" && a3 === 450000,
        title: "조건 3) 외부 강사 편성 (일반강사 Ⅱ 1명, 1일 2시간 × 3회)",
        detail:
          b3 === "운영수당" && a3 === 450000
            ? "정답! 비목은 '운영수당'이며, 일반강사 Ⅱ 2시간 단가 150,000원(기본 9만+초과 6만) × 1명 × 3회 = 450,000원입니다."
            : "오답: 외부강사 수당 비목은 '운영수당'이며, 일반강사 Ⅱ(기본 9만+초과 6만=1일 15만 원) × 3회 = 450,000원이 정확히 산출되어야 합니다."
      },
      {
        pass: a1 + a2 + a3 === 1200000 && revB === "목적사업비전입금",
        title: "조건 4) 총 교부금액(1,200,000원) 일치 및 세입 원가통계비목",
        detail:
          a1 + a2 + a3 === 1200000
            ? "정답! 세출 합계가 교부액 1,200,000원과 정확히 일치하며 세입 비목(목적사업비전입금)도 정확합니다."
            : `현재 세출 합계는 ${formatNumber(a1 + a2 + a3)}원입니다. 교부금액 1,200,000원과 일치해야 합니다.`
      }
    ];

    const allPass = checks.every((c) => c.pass);
    if (allPass) {
      appState.labsCompleted.lab1 = true;
      saveState();
      window.showToast("🎉 실습 1(성립전 예산 수립)을 완벽하게 통과하셨습니다!");
    }

    document.getElementById("lab1FeedbackBox").innerHTML = `
      <div style="margin-bottom:0.85rem;">
        <span class="badge ${allPass ? "badge-green" : "badge-amber"}" style="font-size:0.88rem; padding:0.35rem 0.75rem;">
          ${allPass ? "🏆 실습 1 완벽 통과 (4/4 조건 충족)" : "📝 일부 조건 재검토 필요"}
        </span>
      </div>
      <div style="display:grid; gap:0.65rem;">
        ${checks
          .map(
            (c) => `
          <div style="padding:0.75rem; border-radius:8px; background:var(--bg-secondary); border-left:4px solid ${c.pass ? "var(--success)" : "var(--danger)"};">
            <div style="font-weight:700; font-size:0.88rem;">${c.pass ? "✅" : "❌"} ${escapeHtml(c.title)}</div>
            <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.2rem;">${escapeHtml(c.detail)}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  };

  // Lab 2: 체험학습 사전답사 기안문 실습
  window.fillLab2Answer = function () {
    document.getElementById("lab2Title").value = "2026학년도 1학기 현장체험학습 사전답사 실시 계획";
    document.getElementById("lab2Body").value = `1. 관련: 2026년 현장체험학습 매뉴얼 및 장성성산초등학교-4808(2026. 5. 8.)
2. 2026학년도 1학기 현장체험학습의 안전한 운영을 위하여 다음과 같이 사전답사를 실시하고자 합니다.
  가. 일시: 2026. 5. 20.(수) 14:00~17:00
  나. 장소: 국립광주과학관 및 이동 경로 일원
  다. 대상: 3학년 부장 및 인솔교사 4명
  라. 주요 내용: 체험시설 안전 점검, 차량 승하차 구역 및 우천 시 대체 동선 확인
  마. 예산 계획: 공무원 여비 및 입장료(교육운영비·여비) 80,000원

붙임  1. 사전답사 계획 1부.
      2. 사전답사 체크리스트 1부.  끝.`;
    window.gradeLab2();
  };

  window.gradeLab2 = function () {
    const title = document.getElementById("lab2Title").value.trim();
    const body = document.getElementById("lab2Body").value.trim();

    const checks = [
      {
        pass: title.length >= 5 && !/(에 관한 건|에 대하여)$/.test(title),
        title: "1) 제목의 명확성 ('~에 관한 건' 지양)",
        detail: "핵심 내용(현장체험학습 사전답사 계획)이 명확히 드러나며 불필요한 수식어가 없습니다."
      },
      {
        pass: body.includes("매뉴얼") || body.includes("관련"),
        title: "2) 관련 근거 (2026년 현장체험학습 매뉴얼) 명시",
        detail: "본문 도입부에 현장체험학습 매뉴얼 또는 관련 근거가 포함되었습니다."
      },
      {
        pass: (body.includes("예산") || body.includes("원") || body.includes("여비")) && body.includes("일시"),
        title: "3) 사전답사 주요 계획(일시·장소) 및 예산 계획 포함",
        detail: "사전답사 주요 일정과 소요 예산 계획이 본문에 포함되었습니다."
      },
      {
        pass: body.includes("사전답사 계획") && body.includes("체크리스트") && body.includes("끝."),
        title: "4) 복수 붙임 표시(1. 사전답사 계획, 2. 사전답사 체크리스트) 및 '끝.' 표기",
        detail: "첨부물 2종과 문서 종료('끝.') 표기가 행정업무운영편람 기준에 맞게 작성되었습니다."
      }
    ];

    const allPass = checks.every((c) => c.pass);
    if (allPass) {
      appState.labsCompleted.lab2 = true;
      saveState();
      window.showToast("🎉 실습 2(사전답사 계획 기안문 작성)를 완료하셨습니다!");
    }

    document.getElementById("lab2FeedbackBox").innerHTML = `
      <div style="margin-bottom:0.85rem;">
        <span class="badge ${allPass ? "badge-green" : "badge-amber"}" style="font-size:0.88rem; padding:0.35rem 0.75rem;">
          ${allPass ? "🏆 실습 2 통과 (4/4 기준 충족)" : "📝 누락된 필수 항목을 확인해 주세요"}
        </span>
      </div>
      <div style="display:grid; gap:0.65rem;">
        ${checks
          .map(
            (c) => `
          <div style="padding:0.75rem; border-radius:8px; background:var(--bg-secondary); border-left:4px solid ${c.pass ? "var(--success)" : "var(--danger)"};">
            <div style="font-weight:700; font-size:0.88rem;">${c.pass ? "✅" : "❌"} ${escapeHtml(c.title)}</div>
            <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.2rem;">${escapeHtml(c.detail)}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  };

  // Lab 3: 나만의 업무 추진계획서 초안
  window.loadLab3Sample = function () {
    document.getElementById("lab3Title").value = "2026학년도 '초록 빛깔 생태 스케치' 운영 계획";
    document.getElementById("lab3Purpose").value =
      "• 생태 관찰 및 텃밭 가꾸기 활동을 통한 학생들의 생태 감수성 함양\n• 학생 주도적 프로젝트 활동을 통한 문제 해결 능력 및 협동심 고취";
    document.getElementById("lab3Schedule").value =
      "• 4월~5월 | 우리 학교 식물 지도 만들기 | 3학년 전원 | 교내 서식 식물 관찰 및 특징 기록\n• 6월~10월 | '성산 생태 수호대' 동아리 | 희망 학생 | 텃밭 작물 재배 및 생태 신문 발행\n• 11월 | 생태 스케치 결과 공유회 | 전교생 | 프로젝트 결과물 전시 및 소감 발표";
    document.getElementById("lab3Budget").value =
      "• 재배 모종 구입(교육운영비): 2,000원 × 100개 × 1회 = 200,000원 (상추, 방울토마토 등)\n• 관찰 기록 도구(교육운영비): 5,000원 × 25명 × 4학급 = 500,000원 (관찰 수첩 및 색연필)\n• 합계: 700,000원";
    document.getElementById("lab3Safety").value =
      "• 야외 관찰 시 사전 안전 교육 실시(독충 주의 및 모종삽 등 도구 안전 사용법)\n• 우천 시 활동 장소를 교실 내 식물 도감 탐구 및 생태 세밀화 그리기 활동으로 변경(Plan B)";
    renderLab3Preview();
    window.showToast("'초록 빛깔 생태 스케치' 연수자료 예시가 로드되었습니다.");
  };

  function renderLab3Preview() {
    const title = document.getElementById("lab3Title").value.trim();
    const purpose = document.getElementById("lab3Purpose").value.trim();
    const schedule = document.getElementById("lab3Schedule").value.trim();
    const budget = document.getElementById("lab3Budget").value.trim();
    const safety = document.getElementById("lab3Safety").value.trim();

    document.getElementById("lab3PreviewBox").innerHTML = `
      <div style="text-align:center; border-bottom:2px solid #1e293b; padding-bottom:0.75rem; margin-bottom:1rem;">
        <div style="font-size:1.2rem; font-weight:800;">${escapeHtml(title)}</div>
      </div>
      <div class="edufine-body"><strong>1. 목적 및 필요성</strong>
${escapeHtml(purpose)}

<strong>2. 주요 프로그램 및 세부 추진 계획</strong>
${escapeHtml(schedule)}

<strong>3. 예산 소요 계획 (산출 근거)</strong>
${escapeHtml(budget)}

<strong>4. 안전 관리 및 악천후 시 대체 계획 (Plan B)</strong>
${escapeHtml(safety)}</div>
    `;
  }

  window.completeLab3 = function () {
    const c1 = document.getElementById("lab3Chk1").checked;
    const c2 = document.getElementById("lab3Chk2").checked;
    const c3 = document.getElementById("lab3Chk3").checked;
    if (!c1 || !c2 || !c3) {
      window.showToast("자가 점검 체크리스트 3가지 항목(구체성·정확성·대비성)을 모두 확인해 주세요.");
      return;
    }
    appState.labsCompleted.lab3 = true;
    saveState();
    window.showToast("🎉 실습 3(나만의 업무 추진계획서 초안 수립)이 완료 처리되었습니다!");
  };

  window.copyLab3Plan = function () {
    const el = document.getElementById("lab3PreviewBox");
    window.copyText(el.innerText, "업무 추진계획서 초안이 복사되었습니다.");
  };

  // ==========================================
  // 7. MODULE 6: 교직실무 퀴즈 20문항 & 학교회계 FAQ 사전
  // ==========================================
  function initQuizAndFaqModule() {
    renderQuiz();
    renderFaqList();
    document.getElementById("faqCatFilter").addEventListener("change", renderFaqList);
    document.getElementById("faqSearchInput").addEventListener("input", renderFaqList);
  }

  function renderQuiz() {
    const container = document.getElementById("quizListContainer");
    const questions = window.EDU_DATA.quizQuestions;

    let correctCount = 0;
    questions.forEach((q) => {
      if (appState.quizAnswers && appState.quizAnswers[q.id] === q.answer) {
        correctCount++;
      }
    });

    const badge = document.getElementById("quizScoreBadge");
    if (badge) badge.textContent = `점수: ${correctCount} / ${questions.length} (${correctCount * 5}점)`;

    container.innerHTML = questions
      .map((q, idx) => {
        const userAns = appState.quizAnswers ? appState.quizAnswers[q.id] : undefined;
        const answered = userAns !== undefined;

        return `
        <div class="card" style="background:var(--bg-tertiary);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <span class="badge badge-blue">문제 ${idx + 1} · ${escapeHtml(q.category)}</span>
            ${
              answered
                ? `<span class="badge ${userAns === q.answer ? "badge-green" : "badge-red"}">${
                    userAns === q.answer ? "⭕ 정답" : "❌ 오답"
                  }</span>`
                : `<span class="badge badge-gray">미응시</span>`
            }
          </div>
          <div style="font-weight:700; font-size:0.98rem; margin-bottom:0.85rem;">${escapeHtml(q.q)}</div>
          <div>
            ${q.options
              .map((opt, oIdx) => {
                let cls = "quiz-option";
                if (answered) {
                  if (oIdx === q.answer) cls += " correct";
                  else if (oIdx === userAns) cls += " wrong";
                }
                return `
                <button type="button" class="${cls}" ${answered ? "disabled" : ""} onclick="window.answerQuiz(${q.id}, ${oIdx})">
                  <span class="badge badge-gray">${oIdx + 1}</span>
                  <span>${escapeHtml(opt)}</span>
                </button>
              `;
              })
              .join("")}
          </div>
          ${
            answered
              ? `<div style="margin-top:0.65rem; padding:0.75rem; border-radius:8px; background:var(--bg-secondary); font-size:0.85rem; color:var(--text-secondary); border-left:4px solid var(--brand-primary);">
                  <strong>💡 해설:</strong> ${escapeHtml(q.explanation)}
                </div>`
              : ""
          }
        </div>
      `;
      })
      .join("");
  }

  window.answerQuiz = function (qId, optionIdx) {
    if (!appState.quizAnswers) appState.quizAnswers = {};
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
    saveState();
    renderQuiz();
    window.showToast("퀴즈 답안이 초기화되었습니다. 다시 도전해 보세요!");
  };

  function renderFaqList() {
    const cat = document.getElementById("faqCatFilter").value;
    const q = document.getElementById("faqSearchInput").value.trim().toLowerCase();
    const container = document.getElementById("faqAccordionContainer");

    const filtered = window.EDU_DATA.accountingFaqs.filter((f) => {
      const mCat = cat === "ALL" || f.cat === cat;
      const mQ = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
      return mCat && mQ;
    });

    container.innerHTML = filtered
      .map(
        (f) => `
      <div class="faq-item open" id="faq-box-${f.id}">
        <button type="button" class="faq-question" onclick="this.parentElement.classList.toggle('open')">
          <span><span class="badge badge-blue" style="margin-right:0.5rem;">${escapeHtml(f.cat)}</span>${escapeHtml(f.q)}</span>
          <span>▾</span>
        </button>
        <div class="faq-answer" style="white-space:pre-line;">${escapeHtml(f.a)}</div>
      </div>
    `
      )
      .join("");
  }

  // ==========================================
  // 8. 글로벌 통합 검색 모달 (Ctrl+K)
  // ==========================================
  function openSearchModal() {
    const backdrop = document.getElementById("searchModalBackdrop");
    backdrop.classList.add("open");
    const input = document.getElementById("globalSearchModalInput");
    input.value = "";
    renderGlobalSearchResults("");
    setTimeout(() => input.focus(), 50);
  }

  window.closeSearchModal = function () {
    document.getElementById("searchModalBackdrop").classList.remove("open");
  };

  window.jumpFromSearch = function (tabId, subId) {
    window.closeSearchModal();
    window.switchMainTab(tabId, subId);
  };

  function renderGlobalSearchResults(query) {
    const q = query.trim().toLowerCase();
    const box = document.getElementById("globalSearchResults");

    if (!q) {
      box.innerHTML = `
        <div style="font-size:0.86rem; color:var(--text-muted); padding:0.5rem;">
          💡 검색어 예시: <code>개산급</code>, <code>일반강사</code>, <code>교육운영비</code>, <code>익일</code>, <code>회수</code>, <code>연계반송</code>, <code>폐시약</code>, <code>경조사비</code>
        </div>
      `;
      return;
    }

    const results = [];

    // 1. 순화어 사전 검색
    window.EDU_DATA.purifiedTerms.forEach((t) => {
      if (t.wrong.toLowerCase().includes(q) || t.right.toLowerCase().includes(q) || t.reason.toLowerCase().includes(q)) {
        results.push({
          badge: "공공언어·순화어",
          title: `${t.wrong} → ${t.right}`,
          desc: t.reason,
          tab: "tab-doc",
          sub: "doc-sub-dict"
        });
      }
    });

    // 2. 원가통계비목 파인더 검색
    window.EDU_DATA.costFinderCases.forEach((c) => {
      if (c.category.toLowerCase().includes(q) || c.item.toLowerCase().includes(q) || c.note.toLowerCase().includes(q)) {
        results.push({
          badge: `원가통계비목 (${c.code})`,
          title: `${c.category} 👉 ${c.item}`,
          desc: c.note,
          tab: "tab-budget",
          sub: "budget-sub-finder"
        });
      }
    });

    // 3. 학교회계 FAQ 검색
    window.EDU_DATA.accountingFaqs.forEach((f) => {
      if (f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)) {
        results.push({
          badge: `학교회계 FAQ · ${f.cat}`,
          title: f.q,
          desc: f.a.slice(0, 110) + "...",
          tab: "tab-quiz",
          sub: "quiz-sub-faq"
        });
      }
    });

    // 4. 8대 보직교사 업무 검색
    window.EDU_DATA.departments.forEach((d) => {
      d.periods.forEach((p) => {
        p.tasks.forEach((t) => {
          if (t.title.toLowerCase().includes(q) || t.detail.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)) {
            results.push({
              badge: `${d.name} (${p.period})`,
              title: t.title,
              desc: t.detail,
              tab: "tab-role",
              sub: "role-sub-dept"
            });
          }
        });
      });
    });

    if (results.length === 0) {
      box.innerHTML = `<div style="padding:1.5rem; text-align:center; color:var(--text-muted);">'${escapeHtml(query)}'에 대한 검색 결과가 없습니다.</div>`;
      return;
    }

    box.innerHTML = results
      .slice(0, 20)
      .map(
        (r) => `
      <div class="card card-hover" style="margin-bottom:0.6rem; padding:0.85rem 1rem; cursor:pointer;" onclick="window.jumpFromSearch('${r.tab}', '${r.sub}')">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <span class="badge badge-blue">${escapeHtml(r.badge)}</span>
          <span style="font-size:0.78rem; color:var(--brand-primary); font-weight:700;">이동 →</span>
        </div>
        <div style="font-weight:700; font-size:0.93rem;">${escapeHtml(r.title)}</div>
        <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.15rem;">${escapeHtml(r.desc)}</div>
      </div>
    `
      )
      .join("");
  }

  document.addEventListener("DOMContentLoaded", initApp);
})();
