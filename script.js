/**
 * script.js
 * 모든 페이지의 로직을 통합 관리
 */

document.addEventListener('DOMContentLoaded', async function () {

	// ==========================================
	// 1. 공통 상태 및 초기화
	// ==========================================
	let db = {}; // 모든 코스 데이터를 담을 객체
	const pageType = document.body.dataset.page; // 'home' 또는 'lesson'

	try {
		// DB 로딩 (한 번만 호출)
		const response = await fetch('library/courses-db.json');
		if (!response.ok) throw new Error("DB 로딩 실패");
		db = await response.json();

		// 공통 기능 실행
		renderMainMenu();
		setupMobileMenu();

		// 페이지별 기능 실행
		if (pageType === 'home') {
			initHomePage();
		} else if (pageType === 'lesson') {
			initLessonPage();
		}

	} catch (error) {
		console.error("초기화 오류:", error);
		alert("데이터를 불러오는 중 오류가 발생했습니다.");
	}


	// ==========================================
	// 2. 공통 기능: 메인 메뉴 렌더링
	// ==========================================
	function renderMainMenu() {
		const navUl = document.getElementById('mainMenu');
		if (!navUl) return;

		let html = `<li><a href="index.html">홈</a></li>`;

		// DB 순회 (카테고리 -> 서브카테고리? -> 코스)
		for (const [catId, category] of Object.entries(db)) {
			html += `<li class="has-submenu">
                        <a href="#">${category.categoryTitle} <i class="bi bi-caret-down-fill" style="font-size: 10px;"></i></a>
                        <ul class="submenu">`;

			// 1) 서브카테고리가 있는 경우 (예: 기업세무 -> 법인세)
			if (category.subCategories) {
				for (const [subId, subCat] of Object.entries(category.subCategories)) {
					html += `<li class="has-submenu">
                                <a href="#">${subCat.subCategoryTitle} <i class="bi bi-caret-right-fill" style="font-size: 10px;"></i></a>
                                <ul class="child-submenu">`;
					// 코스 목록
					for (const [courseId, course] of Object.entries(subCat.courses || {})) {
						html += `<li><a href="lesson.html?category=${catId}&sub=${subId}&course=${courseId}">${course.courseTitle}</a></li>`;
					}
					html += `</ul></li>`;
				}
			}

			// 2) 바로 코스가 있는 경우 (예: 세무대리인 -> 개정세법)
			if (category.courses) {
				for (const [courseId, course] of Object.entries(category.courses)) {
					html += `<li><a href="lesson.html?category=${catId}&course=${courseId}">${course.courseTitle}</a></li>`;
				}
			}

			html += `</ul></li>`;
		}

		// 기타 정적 메뉴
		html += `<li><a href="#">로드맵</a></li><li><a href="#">문의하기</a></li>`;
		navUl.innerHTML = html;

		// 모바일 메뉴 토글 이벤트 재설정
		setupSubmenuEvents();
	}

	// ==========================================
	// 3. 페이지별 기능: 홈 (index.html)
	// ==========================================
	function initHomePage() {
		const searchInput = document.getElementById('searchInput');
		const courseGrid = document.getElementById('courseGrid');
		const searchResults = document.getElementById('searchResults');

		// 1) 모든 강의 목록을 평탄화(Flat)하여 배열로 만듦 (검색/표시용)
		let allCourses = [];
		for (const [catId, category] of Object.entries(db)) {
			// 서브카테고리 내의 코스
			if (category.subCategories) {
				for (const [subId, subCat] of Object.entries(category.subCategories)) {
					for (const [cId, course] of Object.entries(subCat.courses)) {
						allCourses.push({ ...course, link: `lesson.html?category=${catId}&sub=${subId}&course=${cId}` });
					}
				}
			}
			// 직속 코스
			if (category.courses) {
				for (const [cId, course] of Object.entries(category.courses)) {
					allCourses.push({ ...course, link: `lesson.html?category=${catId}&course=${cId}` });
				}
			}
		}

		// 2) 초기 카드 그리드 렌더링
		renderCourseCards(allCourses);

		// 3) 레슨 단위 목록 (본문 검색 + 레슨으로 바로 이동)
		const allLessons = [];
		for (const c of allCourses) {
			for (const l of (c.lessons || [])) {
				allLessons.push({
					courseTitle: c.courseTitle,
					title: l.title,
					link: `${c.link}&id=${l.id}`,
					contentPaths: l.contentPaths || []
				});
			}
		}

		// 4) 본문 검색 인덱스 (첫 검색 시 1회만 전체 파일 로딩)
		let contentIndex = null;
		let indexPromise = null;

		function ensureContentIndex() {
			if (!indexPromise) {
				indexPromise = (async () => {
					const paths = [...new Set(allLessons.flatMap(l => l.contentPaths))];
					const results = await Promise.allSettled(
						paths.map(p => fetch(p).then(r => r.ok ? r.text() : ''))
					);
					contentIndex = {};
					paths.forEach((p, i) => {
						contentIndex[p] = results[i].status === 'fulfilled'
							? stripMarkdown(results[i].value)
							: '';
					});
				})();
			}
			return indexPromise;
		}

		// 마크다운 문법을 걷어내고 검색/발췌용 일반 텍스트로 변환
		function stripMarkdown(md) {
			return md
				.replace(/```[\s\S]*?```/g, ' ')          // 코드 블록
				.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')    // 이미지
				.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // 링크는 텍스트만 남김
				.replace(/\[!\w+\][+-]?/g, ' ')           // 콜아웃 마커
				.replace(/^\s*[-:|\s]+$/gm, ' ')          // 표 구분선
				.replace(/[`*_~#>|]/g, ' ')               // 서식 기호
				.replace(/\s+/g, ' ')
				.trim();
		}

		function escapeHtml(s) {
			return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		}

		// 검색어 주변 텍스트 발췌 + 하이라이트
		function makeSnippet(text, idx, len) {
			const start = Math.max(0, idx - 40);
			const end = Math.min(text.length, idx + len + 80);
			return (start > 0 ? '…' : '') +
				escapeHtml(text.slice(start, idx)) +
				`<mark class="highlight">${escapeHtml(text.slice(idx, idx + len))}</mark>` +
				escapeHtml(text.slice(idx + len, end)) +
				(end < text.length ? '…' : '');
		}

		function highlightTitle(title, term) {
			const idx = title.toLowerCase().indexOf(term);
			if (idx === -1) return escapeHtml(title);
			return escapeHtml(title.slice(0, idx)) +
				`<mark class="highlight">${escapeHtml(title.slice(idx, idx + term.length))}</mark>` +
				escapeHtml(title.slice(idx + term.length));
		}

		// 5) 검색 이벤트 (제목 + 본문 내용, 입력 후 200ms 디바운스)
		let debounceTimer = null;
		searchInput.addEventListener('input', () => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(runSearch, 200);
		});

		async function runSearch() {
			const term = searchInput.value.trim().toLowerCase();

			if (!term) {
				courseGrid.style.display = 'grid';
				searchResults.style.display = 'none';
				return;
			}

			courseGrid.style.display = 'none';
			searchResults.style.display = 'block';

			if (!contentIndex) {
				searchResults.innerHTML = '<p class="no-result">검색 인덱스를 준비하는 중...</p>';
			}
			await ensureContentIndex();

			// 인덱스 로딩 중 검색어가 바뀌었으면 이 결과는 버림 (최신 입력이 다시 실행함)
			if (searchInput.value.trim().toLowerCase() !== term) return;

			const matched = [];
			for (const lesson of allLessons) {
				const titleHit = lesson.title.toLowerCase().includes(term) ||
					lesson.courseTitle.toLowerCase().includes(term);

				let snippet = '';
				for (const p of lesson.contentPaths) {
					const text = contentIndex[p] || '';
					const idx = text.toLowerCase().indexOf(term);
					if (idx !== -1) {
						snippet = makeSnippet(text, idx, term.length);
						break;
					}
				}

				if (titleHit || snippet) matched.push({ lesson, snippet });
			}

			if (matched.length === 0) {
				searchResults.innerHTML = '<p class="no-result">검색 결과가 없습니다.</p>';
				return;
			}

			searchResults.innerHTML =
				`<p id="searchResultsInfo">총 ${matched.length}개의 강의가 검색되었습니다.</p>` +
				matched.map(({ lesson, snippet }) => `
					<div class="search-result-item">
						<a href="${lesson.link}">
							<h3>${highlightTitle(lesson.title, term)} <span class="result-course">${escapeHtml(lesson.courseTitle)}</span></h3>
							<p>${snippet || '제목이 검색어와 일치합니다.'}</p>
						</a>
					</div>
				`).join('');
		}

		function renderCourseCards(courses) {
			courseGrid.innerHTML = courses.map(c => `
                <div class="course-card">
                    <a href="${c.link}">
                        <div style="height:150px; background:#eee; display:flex; align-items:center; justify-content:center; color:#aaa;">
                            이미지 없음
                        </div>
                        <h3>${c.courseTitle}</h3>
                        <p>${c.lessons ? c.lessons.length + '개의 강의' : '강의 준비중입니다.'}</p>
                    </a>
                </div>
            `).join('');
		}
	}

	// ==========================================
	// 4. 페이지별 기능: 강의실 (lesson.html)
	// ==========================================
	async function initLessonPage() {
		const urlParams = new URLSearchParams(window.location.search);
		const catId = urlParams.get('category');
		const subId = urlParams.get('sub');
		const courseId = urlParams.get('course');
		const lessonId = parseInt(urlParams.get('id'));

		// DB에서 현재 코스 찾기
		let currentCourse = null;
		if (catId && db[catId]) {
			if (subId && db[catId].subCategories && db[catId].subCategories[subId]) {
				currentCourse = db[catId].subCategories[subId].courses[courseId];
			} else if (db[catId].courses) {
				currentCourse = db[catId].courses[courseId];
			}
		}

		if (!currentCourse) {
			document.getElementById('lessonViewer').innerHTML = "<h2>강의 정보를 찾을 수 없습니다.</h2>";
			return;
		}

		// 1) 사이드바(목차) 렌더링
		const sidebarContent = document.getElementById('sidebarContent');
		const lessonListHtml = (currentCourse.lessons || []).map(l => {
			const isActive = l.id === lessonId ? 'active' : '';
			// URL 유지하면서 id만 변경
			let link = `lesson.html?category=${catId}&course=${courseId}&id=${l.id}`;
			if (subId) link += `&sub=${subId}`;

			return `<li class="${isActive}" data-id="${l.id}"><a href="${link}">${l.title}</a></li>`;
		}).join('');

		sidebarContent.innerHTML = `
            <h3>${currentCourse.courseTitle}</h3>
            <ol class="chapter-list">${lessonListHtml || '<li>등록된 강의가 없습니다.</li>'}</ol>
        `;

		// 2) 본문 콘텐츠 렌더링
		// lessonId가 없으면 첫 번째 강의를 기본으로 보여줌
		const targetLesson = lessonId
			? currentCourse.lessons.find(l => l.id === lessonId)
			: currentCourse.lessons[0];

		if (targetLesson) {
			// 사이드바 활성화 상태 업데이트 (URL에 id가 없을 때를 대비)
			if (!lessonId) {
				const firstLi = sidebarContent.querySelector('li');
				if (firstLi) firstLi.classList.add('active');
			}
			await renderLessonContent(targetLesson);
		} else {
			document.getElementById('lessonViewer').innerHTML = "<h2>강의 내용을 선택해주세요.</h2>";
		}
	}

	// 콘텐츠(Markdown 등)를 가져와서 화면에 뿌리는 함수
	async function renderLessonContent(lesson) {
		const viewer = document.getElementById('lessonViewer');
		viewer.innerHTML = '<div class="spinner">로딩 중...</div>';

		try {
			// contentPaths 배열에 있는 모든 파일을 가져옴
			// allSettled: 일부 파일이 없어도 나머지 콘텐츠는 정상 표시
			const paths = lesson.contentPaths || [];
			const results = await Promise.allSettled(paths.map(path =>
				fetch(path).then(res => {
					if (!res.ok) throw new Error(`파일 없음: ${path}`);
					return res.text().then(text => ({ path, text }));
				})
			));

			// 파일 내용 변환 (Markdown -> HTML), 실패한 파일은 안내 문구로 대체
			const htmlContent = results.map((r, i) => {
				if (r.status === 'rejected') {
					console.error(r.reason);
					return `<div class="content-missing"><i class="bi bi-exclamation-triangle"></i> 콘텐츠 파일을 불러오지 못했습니다: ${paths[i]}</div>`;
				}
				const f = r.value;
				if (f.path.endsWith('.md')) {
					return marked.parse(f.text);
				} else {
					return `<div class="text-content">${f.text.replace(/\n/g, '<br>')}</div>`;
				}
			}).join('<hr class="content-divider">');

			// 최종 렌더링
			viewer.innerHTML = `
				<article>
					<div class="article-header">
						<h2>${lesson.title}</h2>
						<div class="article-meta">
							<span>수정일: ${lesson.lastModifiedDate || lesson.createdDate || '-'}</span>
							<div class="article-actions">
									<button id="shareBtn" title="공유"><i class="bi bi-share"></i></button>
									<button id="printBtn" title="인쇄"><i class="bi bi-printer"></i></button>
							</div>
						</div>
					</div>
						
					${lesson.videoId ? `
					<div class="video-container">
						<iframe src="https://www.youtube.com/embed/${lesson.videoId}" frameborder="0" allowfullscreen></iframe>
					</div>` : ''}

					<div class="a-content">
						${htmlContent}
					</div>
				</article>
			`;

			// 콜아웃 변환 (> [!NOTE] 문법)
			enhanceCallouts(viewer.querySelector('.a-content'));

			// 표를 가로 스크롤 컨테이너로 감싸기 (모바일에서 열이 눌리지 않도록)
			wrapTables(viewer.querySelector('.a-content'));

			// 버튼 이벤트 연결
			document.getElementById('shareBtn')?.addEventListener('click', () => {
				const url = window.location.href;
				navigator.clipboard.writeText(url).then(() => alert('주소가 복사되었습니다.'));
			});
			document.getElementById('printBtn')?.addEventListener('click', () => window.print());

		} catch (e) {
			console.error(e);
			viewer.innerHTML = `<div class="error">콘텐츠를 불러오지 못했습니다.<br>${e.message}</div>`;
		}
	}


	// ==========================================
	// 4-1. 콜아웃(Callout) 변환
	// 마크다운의 "> [!NOTE] 제목" 형태 인용구를 콜아웃 박스로 변환
	// 지원 문법: > [!type], > [!type] 커스텀 제목, > [!type]- (접힘), > [!type]+ (펼침)
	// ==========================================
	const CALLOUT_TYPES = {
		note:      { icon: 'bi-pencil-square',        label: '노트',   theme: 'blue' },
		info:      { icon: 'bi-info-circle',          label: '정보',   theme: 'blue' },
		todo:      { icon: 'bi-check2-square',        label: '할 일',  theme: 'blue' },
		abstract:  { icon: 'bi-clipboard-data',       label: '요약',   theme: 'cyan' },
		summary:   'abstract',
		tldr:      'abstract',
		tip:       { icon: 'bi-lightbulb',            label: '팁',     theme: 'cyan' },
		hint:      'tip',
		important: { icon: 'bi-exclamation-circle',   label: '중요',   theme: 'purple' },
		example:   { icon: 'bi-list-ol',              label: '예시',   theme: 'purple' },
		success:   { icon: 'bi-check-circle',         label: '확인',   theme: 'green' },
		check:     'success',
		done:      'success',
		question:  { icon: 'bi-question-circle',      label: '질문',   theme: 'orange' },
		faq:       'question',
		help:      'question',
		warning:   { icon: 'bi-exclamation-triangle', label: '주의',   theme: 'orange' },
		caution:   'warning',
		attention: 'warning',
		danger:    { icon: 'bi-lightning-charge',     label: '위험',   theme: 'red' },
		error:     'danger',
		bug:       { icon: 'bi-bug',                  label: '버그',   theme: 'red' },
		failure:   { icon: 'bi-x-circle',             label: '실패',   theme: 'red' },
		fail:      'failure',
		missing:   'failure',
		quote:     { icon: 'bi-quote',                label: '인용',   theme: 'gray' },
		cite:      'quote'
	};

	function enhanceCallouts(root) {
		if (!root) return;

		// 중첩 콜아웃도 처리되도록 안쪽(문서 뒤쪽) 요소부터 변환
		const blockquotes = Array.from(root.querySelectorAll('blockquote')).reverse();

		blockquotes.forEach(bq => {
			const firstP = bq.firstElementChild;
			if (!firstP || firstP.tagName !== 'P') return;

			const firstNode = firstP.firstChild;
			if (!firstNode || firstNode.nodeType !== Node.TEXT_NODE) return;

			// [!type], 접힘표시(+/-), 같은 줄의 커스텀 제목 매칭
			const match = firstNode.nodeValue.match(/^\[!([a-zA-Z]+)\]([+-])?[ \t]*([^\n]*)\n?/);
			if (!match) return;

			let meta = CALLOUT_TYPES[match[1].toLowerCase()];
			while (typeof meta === 'string') meta = CALLOUT_TYPES[meta]; // 별칭 해석
			if (!meta) meta = CALLOUT_TYPES.note; // 모르는 타입은 노트로 처리

			const fold = match[2]; // '-' 접힌 상태, '+' 펼친 상태, undefined면 접기 불가
			const customTitle = match[3].trim();

			// 첫 줄의 [!type] 마커 제거
			firstNode.nodeValue = firstNode.nodeValue.slice(match[0].length);
			if (!firstNode.nodeValue) {
				firstNode.remove();
				// marked의 breaks 옵션 사용 시 남는 <br> 정리
				if (firstP.firstChild && firstP.firstChild.nodeName === 'BR') firstP.firstChild.remove();
			}
			if (!firstP.hasChildNodes()) firstP.remove();

			const isFoldable = !!fold;
			const callout = document.createElement(isFoldable ? 'details' : 'div');
			callout.className = `callout callout-${meta.theme}`;
			if (isFoldable && fold === '+') callout.open = true;

			const titleEl = document.createElement(isFoldable ? 'summary' : 'div');
			titleEl.className = 'callout-title';
			titleEl.innerHTML = `<i class="bi ${meta.icon}"></i><span class="callout-title-text"></span>`;
			titleEl.querySelector('.callout-title-text').textContent = customTitle || meta.label;

			const body = document.createElement('div');
			body.className = 'callout-content';
			while (bq.firstChild) body.appendChild(bq.firstChild);

			callout.appendChild(titleEl);
			callout.appendChild(body);
			bq.replaceWith(callout);
		});
	}

	// 표를 .table-wrap으로 감싸고, 열이 3개 이상이면 모바일에서 최소 너비를 확보해 가로 스크롤
	function wrapTables(root) {
		if (!root) return;
		root.querySelectorAll('table').forEach(table => {
			if (table.parentElement.classList.contains('table-wrap')) return;
			const wrap = document.createElement('div');
			wrap.className = 'table-wrap';
			const colCount = table.querySelector('tr')?.children.length || 0;
			if (colCount >= 3) table.classList.add('table-wide');
			table.replaceWith(wrap);
			wrap.appendChild(table);
		});
	}

	// ==========================================
	// 5. 공통 UI 유틸리티
	// ==========================================

	// 모바일 사이드바 토글
	function setupMobileMenu() {
		const toggleBtn = document.getElementById('sidebarToggle');
		const sidebar = document.getElementById('sidebar');
		const overlay = document.getElementById('menuOverlay');

		// CSS가 body.menu-open 기준으로 사이드바 이동/오버레이 표시를 처리함
		if (toggleBtn && sidebar) {
			toggleBtn.addEventListener('click', () => {
				const isOpen = document.body.classList.toggle('menu-open');
				if (isOpen) document.body.classList.remove('nav-open'); // 메인 메뉴와 동시에 열리지 않도록
			});
		}
		if (overlay) {
			overlay.addEventListener('click', () => {
				document.body.classList.remove('menu-open');
			});
		}
	}

	// 모바일/데스크탑 메뉴 호버/클릭 처리
	function setupSubmenuEvents() {
		const mobileQuery = window.matchMedia('(max-width: 768px)');

		// 햄버거 버튼: 모바일에서 메인 메뉴 펼치기/접기
		const navToggle = document.getElementById('navToggle');
		if (navToggle && !navToggle.dataset.bound) {
			navToggle.dataset.bound = 'true';
			navToggle.addEventListener('click', () => {
				const isOpen = document.body.classList.toggle('nav-open');
				navToggle.setAttribute('aria-expanded', String(isOpen));
				navToggle.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
				if (isOpen) document.body.classList.remove('menu-open'); // 목차와 동시에 열리지 않도록
			});
		}

		// 모바일: 서브메뉴가 있는 항목은 탭으로 열고 닫음 (데스크탑은 CSS hover 유지)
		document.querySelectorAll('#mainMenu .has-submenu > a').forEach(anchor => {
			anchor.addEventListener('click', (e) => {
				if (!mobileQuery.matches) return;
				e.preventDefault();
				const li = anchor.parentElement;
				const wasOpen = li.classList.contains('open');
				// 같은 단계의 다른 메뉴는 닫기 (아코디언)
				Array.from(li.parentElement.children).forEach(sibling => sibling.classList.remove('open'));
				if (!wasOpen) li.classList.add('open');
			});
		});

		// 데스크탑 폭으로 돌아가면 모바일 메뉴 상태 초기화
		mobileQuery.addEventListener('change', (e) => {
			if (!e.matches) {
				document.body.classList.remove('nav-open');
				document.querySelectorAll('#mainMenu .open').forEach(li => li.classList.remove('open'));
			}
		});
	}

	// 맨 위로 가기 버튼
	const scrollToTopBtn = document.getElementById('scrollToTopBtn');
	if (scrollToTopBtn) {
		window.addEventListener('scroll', () => {
			scrollToTopBtn.style.display = window.scrollY > 200 ? 'block' : 'none';
		});
		scrollToTopBtn.addEventListener('click', () => {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	}
});