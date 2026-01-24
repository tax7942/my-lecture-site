/**
 * script.js
 * 모든 페이지의 로직을 통합 관리
 */

document.addEventListener('DOMContentLoaded', async function() {
    
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

        // 3) 검색 이벤트
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            
            if (!term) {
                courseGrid.style.display = 'grid';
                searchResults.style.display = 'none';
                return;
            }

            courseGrid.style.display = 'none';
            searchResults.style.display = 'block';

            // 제목 또는 레슨 내용에 검색어가 있는지 확인
            const filtered = allCourses.filter(c => {
                const titleMatch = c.courseTitle.toLowerCase().includes(term);
                // 세부 레슨 제목까지 검색하고 싶다면 아래 주석 해제
                // const lessonMatch = c.lessons && c.lessons.some(l => l.title.toLowerCase().includes(term));
                return titleMatch; 
            });

            if (filtered.length === 0) {
                searchResults.innerHTML = '<p class="no-result">검색 결과가 없습니다.</p>';
            } else {
                searchResults.innerHTML = filtered.map(c => `
                    <div class="search-result-item">
                        <a href="${c.link}">
                            <h3>${c.courseTitle}</h3>
                            <p>${c.lessons ? c.lessons.length + '개의 강의' : '준비중'}</p>
                        </a>
                    </div>
                `).join('');
            }
        });

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
                if(firstLi) firstLi.classList.add('active');
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
            const paths = lesson.contentPaths || [];
            const filePromises = paths.map(path => 
                fetch(path).then(res => {
                    if (!res.ok) throw new Error(`파일 없음: ${path}`);
                    return res.text().then(text => ({ path, text }));
                })
            );

            const files = await Promise.all(filePromises);

            // 파일 내용 변환 (Markdown -> HTML)
            const htmlContent = files.map(f => {
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
    // 5. 공통 UI 유틸리티
    // ==========================================
    
    // 모바일 사이드바 토글
    function setupMobileMenu() {
        const toggleBtn = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('menuOverlay');

        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                if (overlay) overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
            });
        }
        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.style.display = 'none';
            });
        }
    }

    // 모바일/데스크탑 메뉴 호버/클릭 처리
    function setupSubmenuEvents() {
        // 모바일에서 터치 시 서브메뉴 열리게 처리하려면 추가 로직 필요
        // 현재는 CSS hover로 처리됨
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