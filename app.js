// ===== ตั้งค่า PDF.js Worker =====
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const PDF_PATH = 'GS12.pdf'; 
const TARGET_WIDTH = 794;
let activeRenderTasks = {};

// ===== โหลดและ Render PDF =====
async function loadPDF() {
  const pdfDoc = await pdfjsLib.getDocument(PDF_PATH).promise;
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    await renderPage(pdfDoc, pageNum);
  }
}

async function renderPage(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const baseScale = TARGET_WIDTH / viewport.width;

  const RENDER_SCALE = 3; 
  const scaledViewport = page.getViewport({ scale: baseScale * RENDER_SCALE });

  const canvas = document.getElementById(`pdf-canvas-${pageNum}`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  canvas.style.width = `${TARGET_WIDTH}px`;
  canvas.style.height = 'auto';

  if (activeRenderTasks[pageNum]) {
    await activeRenderTasks[pageNum].cancel();
  }
  const renderTask = page.render({ canvasContext: ctx, viewport: scaledViewport });
  activeRenderTasks[pageNum] = renderTask;
  await renderTask.promise;
}

// ===== เมื่อเว็บโหลดเสร็จ =====
document.addEventListener('DOMContentLoaded', () => {
  loadPDF();

  // 🌟 ฟังก์ชันจัดการความกว้างของ Input ตามข้อความที่พิมพ์สำหรับ inline-field
  const autoResizeInput = (input) => {
    const span = document.createElement('span');
    const computedStyle = window.getComputedStyle(input);
    span.style.fontFamily = computedStyle.fontFamily || '"TH SarabunPSK", "TH Sarabun New"';
    span.style.fontSize = computedStyle.fontSize || '22px';
    span.style.fontWeight = computedStyle.fontWeight;
    span.style.fontStyle = computedStyle.fontStyle;
    span.style.letterSpacing = computedStyle.letterSpacing;
    span.style.visibility = 'hidden';
    span.style.whiteSpace = 'pre';
    span.style.position = 'absolute';
    span.textContent = input.value || input.getAttribute('placeholder') || ' ';
    document.body.appendChild(span);
    
    const newWidth = span.offsetWidth + 0;
    input.style.width = newWidth + 'px';
    document.body.removeChild(span);
  };

  document.querySelectorAll('.inline-field').forEach(input => {
    input.addEventListener('input', () => {
        autoResizeInput(input);
        if (typeof applyCustomJustify === 'function') applyCustomJustify();
    });
    setTimeout(() => {
        autoResizeInput(input);
        if (typeof applyCustomJustify === 'function') applyCustomJustify();
    }, 100);
  });
  
  // Update justify when contenteditable elements change
  document.querySelectorAll('.inline-flow-input').forEach(input => {
      input.addEventListener('input', () => {
          if (typeof applyCustomJustify === 'function') applyCustomJustify();
      });
  });


  // 🌟 ระบบกล่องล่องหน: คำนวณพิกัดสัมพัทธ์หลังฟอนต์โหลดเสร็จ
  document.fonts.ready.then(() => {
    setTimeout(initGhostAnchors, 300);
  });

  const tabButtons = document.querySelectorAll('.tabs button');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page-wrapper').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`page${btn.dataset.page}`).classList.add('active');
    });
  });

  document.querySelectorAll('input[name="namePrefix"]').forEach(r => r.addEventListener('change', updateDynamicTexts));
  
  document.querySelectorAll('input[name="degreeLevel"]').forEach(r => {
      r.addEventListener('change', () => {
          updateDynamicTexts();
          updateProgramList();
      });
  });
  
  document.querySelectorAll('input[name="programType"]').forEach(r => r.addEventListener('change', updateDynamicTexts));
  document.getElementById('chairCount').addEventListener('change', generateCommittee);
  document.getElementById('committeeCount').addEventListener('change', generateCommittee);


  document.getElementById('p1_program')?.addEventListener('change', handleProgramInput);
  document.getElementById('p2_program')?.addEventListener('change', handleProgramInput);

  updateProgramList();

  setupReqFlow('p1_thesis_value', ['p1_thesis1', 'p1_thesis2', 'p1_thesis3']);
  setupReqFlow('p2_thesis_value', ['p2_thesis1', 'p2_thesis2', 'p2_thesis3']);

  // 5. Export PDF
  document.getElementById('btn-export').addEventListener('click', async () => {
    const p1NameInput = document.getElementById('p1_name');
    const p2NameInput = document.getElementById('p2_name');

    document.body.classList.add('exporting');
    document.querySelectorAll('.page-wrapper').forEach(p => p.style.display = 'block');

    const EXPORT_SCALE = 3; 
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    try {
      const exportSelection = document.getElementById('exportPageSelect').value;
      let pagesToExport = [];
      if (exportSelection === 'both') {
          pagesToExport = [document.getElementById('page1'), document.getElementById('page2')];
      } else if (exportSelection === 'page1') {
          pagesToExport = [document.getElementById('page1')];
      } else if (exportSelection === 'page2') {
          pagesToExport = [document.getElementById('page2')];
      }

      for (let i = 0; i < pagesToExport.length; i++) {
        
        const canvas = await html2canvas(pagesToExport[i], { 
          scale: EXPORT_SCALE, 
          useCORS: true, 
          logging: false,
          onclone: function (clonedDoc) {
            function applyDiacriticFix(el) {
              el.style.setProperty('overflow', 'visible', 'important');
            }
            
            // 1. ฟังก์ชันจัดการความกว้างของ Input ตามข้อความที่พิมพ์
            const autoResizeInput = (input) => {
              // สร้าง span จำลองเพื่อวัดความกว้างของข้อความ
              const span = document.createElement('span');
              const computedStyle = window.getComputedStyle(input);
              span.style.fontFamily = computedStyle.fontFamily;
              span.style.fontSize = computedStyle.fontSize;
              span.style.fontWeight = computedStyle.fontWeight;
              span.style.fontStyle = computedStyle.fontStyle;
              span.style.letterSpacing = computedStyle.letterSpacing;
              
              span.style.visibility = 'hidden';
              span.style.whiteSpace = 'pre';
              span.style.position = 'absolute';
              // ใส่ข้อความ ถ้าว่างให้ใช้ placeholder หรือช่องว่าง
              span.textContent = input.value || input.getAttribute('placeholder') || ' ';
              document.body.appendChild(span);
              
              // ตั้งค่าความกว้างใหม่ โดยเผื่อพื้นที่ไว้เล็กน้อย (เช่น 10px)
              const newWidth = span.offsetWidth + 10;
              input.style.width = newWidth + 'px';
              document.body.removeChild(span);
            };

            // เปลี่ยน input แบบพิมพ์ให้กลายเป็น div ธรรมดาตอนทำ PDF
            const inputs = clonedDoc.querySelectorAll('input');
            inputs.forEach(input => {
              if (input.type === 'radio' || input.type === 'checkbox' || input.type === 'hidden') return;
              
              if (input.classList.contains('inline-field')) {
                // ใช้ span เปล่าไร้สไตล์ เพื่อให้ตัวอักษรกลมกลืนกับข้อความรอบข้าง 100% ไม่มีทางลอย
                const plainSpan = clonedDoc.createElement('span');
                plainSpan.innerText = input.value ? input.value : " ";
                input.parentNode.insertBefore(plainSpan, input);
                input.style.display = 'none';
                return;
              }

              const textSpan = clonedDoc.createElement('span');
              textSpan.innerText = input.value;
              textSpan.className = input.className;
              textSpan.id = input.id;           
              textSpan.style.cssText = input.style.cssText;
              input.removeAttribute('id');     
              
              textSpan.style.setProperty('overflow', 'visible', 'important');
              textSpan.style.setProperty('border', 'none', 'important');
              textSpan.style.setProperty('background', 'transparent', 'important');
              textSpan.style.setProperty('outline', 'none', 'important');
              textSpan.style.setProperty('white-space', 'nowrap', 'important');
              
              if (input.classList.contains('field')) {
                textSpan.style.position = 'absolute';
              } else {
                textSpan.style.display = 'inline-block';
                textSpan.style.verticalAlign = 'baseline';
              }
              
              input.parentNode.insertBefore(textSpan, input);
              input.style.display = 'none';
            });

            // ซ่อน Select ตัวจริงตอนปริ้น
            clonedDoc.querySelectorAll('select').forEach(sel => {
                sel.style.display = 'none';
            });
            
            clonedDoc.querySelectorAll('.fake-input, .fake-display').forEach(applyDiacriticFix);
            clonedDoc.querySelectorAll('.dynamic-text, .dynamic-text-inline').forEach(applyDiacriticFix);
          }
        });
        
        const imgData = canvas.toDataURL('image/png'); 
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      pdf.save('GS12_Form.pdf');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดตอน Export');
    } finally {
      document.body.classList.remove('exporting');
      document.querySelectorAll('.page-wrapper').forEach(p => p.style.display = '');
      document.querySelector(`.tabs button.active`).click();
    }
  });

});

function updateDynamicTexts() {
  const prefix = document.querySelector('input[name="namePrefix"]:checked').value;
  const program = document.querySelector('input[name="programType"]:checked').value;
  const degreeVal = document.querySelector('input[name="degreeLevel"]:checked').value;
  
  const degree = degreeVal === "master" ? "ปริญญาโท" : "ปริญญาเอก";
  const thesis = degreeVal === "master" ? "วิทยานิพนธ์" : "ดุษฎีนิพนธ์";

  document.querySelectorAll('.display-name-prefix').forEach(el => el.innerText = prefix);
  document.querySelectorAll('.display-program').forEach(el => el.innerText = program);
  document.querySelectorAll('.display-degree').forEach(el => el.innerText = degree);
  document.querySelectorAll('.thesis-word').forEach(el => el.innerText = thesis);
  
  // Re-apply custom justify after dynamic text change
  if (typeof applyCustomJustify === 'function') {
      setTimeout(applyCustomJustify, 10);
  }
}

function generateCommittee() {
  const chairCount = parseInt(document.getElementById('chairCount').value) || 0;
  const commCount = parseInt(document.getElementById('committeeCount').value) || 0;
  const totalCount = chairCount + commCount;
  
  const containerP1 = document.getElementById('committee-area-p1');
  const containerP2 = document.getElementById('committee-area-p2');
  
  containerP1.innerHTML = '';
  containerP2.innerHTML = '';

  if (totalCount === 0) {
      // รีเซ็ตตำแหน่งถ้าไม่มีกรรมการ
      const baseTop = 507 + 24;
      document.querySelectorAll('.post-committee').forEach(el => {
          const offset = parseFloat(el.dataset.postOffset || 0);
          el.dataset.absTop = baseTop + offset;
      });
      initGhostAnchors();
      return;
  }

  // สร้างประธานกรรมการ
  for (let i = 0; i < chairCount; i++) {
    const roleText = "ประธานกรรมการ";
    const rowHTML_P1 = `
      <div class="committee-row">
          <input type="text" class="committee-input" placeholder="ชื่อ-นามสกุล" style="padding-top: 1px; transform: translateY(5px);">
          <div class="committee-role" style="transform: translateY(0px);">${roleText}</div>
      </div>
    `;
    const rowHTML_P2 = `
      <div class="committee-row">
          <input type="text" class="committee-input" placeholder="ชื่อ-นามสกุล" style="padding-top: 1px; transform: translateY(0px);">
          <div class="committee-role" style="transform: translateY(0px);">${roleText}</div>
      </div>
    `;
    containerP1.innerHTML += rowHTML_P1;
    containerP2.innerHTML += rowHTML_P2;
  }

  // สร้างกรรมการ
  for (let i = 0; i < commCount; i++) {
    const roleText = "กรรมการ";
    const rowHTML_P1 = `
      <div class="committee-row">
          <input type="text" class="committee-input" placeholder="ชื่อ-นามสกุล" style="padding-top: 1px; transform: translateY(5px);">
          <div class="committee-role" style="transform: translateY(0px);">${roleText}</div>
      </div>
    `;
    const rowHTML_P2 = `
      <div class="committee-row">
          <input type="text" class="committee-input" placeholder="ชื่อ-นามสกุล" style="padding-top: 1px; transform: translateY(0px);">
          <div class="committee-role" style="transform: translateY(0px);">${roleText}</div>
      </div>
    `;
    containerP1.innerHTML += rowHTML_P1;
    containerP2.innerHTML += rowHTML_P2;
  }

  // ปรับระยะห่างของข้อความด้านล่างกรรมการให้อยู่ชิดติดกัน (เว้น 1 บรรทัดไม่ให้ทับเส้นประ)
  // แต่ละแถวสูง 24px และบวกเพิ่มอีก 24px สำหรับการเว้น 1 บรรทัด
  const baseTop = 507 + (totalCount * 24) + 24;
  const postCommitteeStart = baseTop;

  document.querySelectorAll('.post-committee').forEach(el => {
      const offset = parseFloat(el.dataset.postOffset || 0);
      el.dataset.absTop = postCommitteeStart + offset;
  });

  // รีเซ็ตตำแหน่งใหม่ทั้งหมด
  initGhostAnchors();
}

function setupReqFlow(hiddenValId, fieldIds) {
  const hiddenInput = document.getElementById(hiddenValId);
  const fields = fieldIds.map(id => document.getElementById(id)).filter(f => f !== null);
  
  if (!hiddenInput || fields.length === 0) return;

  fields.forEach((field, index) => {
    field.addEventListener('input', () => {
      let fullText = fields.map(f => f.innerText).join('');
      hiddenInput.value = fullText;
      
      if (field.scrollWidth > field.clientWidth && index < fields.length - 1) {
        let text = field.innerText;
        field.innerText = text.slice(0, -1);
        fields[index + 1].innerText = text.slice(-1) + fields[index + 1].innerText;
        
        let range = document.createRange();
        let sel = window.getSelection();
        range.setStart(fields[index + 1].childNodes[0] || fields[index + 1], 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  });
}

// ===== ระบบกล่องล่องหน (Ghost Anchor) - คำนวณพิกัดสัมพัทธ์ =====
// สร้าง div ล่องหนต่อท้ายข้อความหลัก แล้วคำนวณ top/left ให้ element ลูก
// อ้างอิงจากกล่องล่องหนแทนพิกัดกระดาษเดิม
function initGhostAnchors() {
  const ghosts = document.querySelectorAll('.ghost-anchor');
  if (ghosts.length === 0) return;

  // แสดงทุกหน้าชั่วคราวเพื่อวัดพิกัด (หน้าที่ซ่อนจะวัดไม่ได้)
  const pages = document.querySelectorAll('.page-wrapper');
  const savedDisplay = [];
  pages.forEach((p, i) => {
    savedDisplay[i] = { display: p.style.display, visibility: p.style.visibility };
    p.style.display = 'block';
    p.style.visibility = 'hidden';
  });

  // คืนค่าหน้าที่ active ให้มองเห็นได้
  document.querySelectorAll('.page-wrapper.active').forEach(p => {
    p.style.visibility = 'visible';
  });

  ghosts.forEach(ghost => {
    const pageWrapper = ghost.closest('.page-wrapper');
    if (!pageWrapper) return;

    const pageRect = pageWrapper.getBoundingClientRect();
    const ghostRect = ghost.getBoundingClientRect();

    // พิกัดของกล่องล่องหนเทียบกับ page-wrapper
    const ghostTop = ghostRect.top - pageRect.top;
    const ghostLeft = ghostRect.left - pageRect.left;

    // หาพิกัดเพื่อบังคับให้ "โดยมีคณะกรรมการที่ปรึกษา..." อยู่ห่าง 1 Enter (24px) เสมอ
    const word2 = ghost.querySelector('[id$="_thesis_word2"]');
    let shiftY = 0;
    if (word2 && word2.dataset.absTop) {
        const originalRelTop = parseFloat(word2.dataset.absTop) - ghostTop;
        shiftY = 0 - originalRelTop; // บังคับให้ relative top เป็น 0 (ต่อเลยไม่เว้นบรรทัด)
    }

    // ตั้งค่าพิกัด top/left ให้ลูกทุกตัว เป็นระยะสัมพัทธ์จากกล่องล่องหน + การขยับ (shiftY)
    ghost.querySelectorAll('[data-abs-top]').forEach(el => {
      const absTop = parseFloat(el.dataset.absTop);
      const absLeft = parseFloat(el.dataset.absLeft);

      el.style.top = (absTop - ghostTop + shiftY) + 'px';
      el.style.left = (absLeft - ghostLeft) + 'px';
    });
  });

  // คืนสถานะการแสดงผลเดิม
  pages.forEach((p, i) => {
    p.style.display = savedDisplay[i].display;
    p.style.visibility = savedDisplay[i].visibility;
  });
}

const academicData = {
    "master": {
        "การศึกษามหาบัณฑิต": ["การบริหารการศึกษา", "การวิจัยและประเมิน", "การสอนวิทยาศาสตร์และคณิตศาสตร์", "จิตวิทยา", "เทคโนโลยีและสื่อสารการศึกษา", "พลศึกษาและการจัดการกีฬา", "ภาษาไทย", "หลักสูตรและการสอน"],
        "ศิลปศาสตรมหาบัณฑิต": ["สื่อและวัฒนธรรมศึกษา"],
        "ดุริยางคศาสตรมหาบัณฑิต": ["ดนตรีสร้างสรรค์"],
        "นิติศาสตรมหาบัณฑิต": ["นิติศาสตร์"],
        "บริหารธุรกิจมหาบัณฑิต": ["การจัดการธุรกิจ"],
        "รัฐประศาสนศาสตรมหาบัณฑิต": ["รัฐประศาสนศาสตร์"],
        "วิทยาศาสตรมหาบัณฑิต": ["เคมีและนวัตกรรมเคมี", "เทคโนโลยีชีวภาพ", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาชีววิทยา)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาวิทยาศาสตร์สิ่งแวดล้อม)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาฟิสิกส์)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาคณิตศาสตร์)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาวิทยาการคำนวณ)", "อาชีวอนามัยและความปลอดภัย", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาพืชศาสตร์)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาประมง)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาสัตวศาสตร์)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาส่งเสริมเกษตรและพัฒนาชุมชน)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาวิทยาศาสตร์อาหาร)"],
        "สาธารณสุขศาสตรมหาบัณฑิต": ["สาธารณสุขศาสตร์(กลุ่มวิชาวิทยาการระบาดและชีวสถิติ)", "สาธารณสุขศาสตร์(กลุ่มวิชาการส่งเสริมสุขภาพ)", "สาธารณสุขศาสตร์(กลุ่มวิชาเศรษฐศาสตร์สุขภาพ)", "สาธารณสุขศาสตร์(กลุ่มวิชาบริหารสาธารณสุข)"],
        "วิศวกรรมศาสตรมหาบัณฑิต": ["วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมพลังงาน)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมเครื่องกล)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมไฟฟ้า)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมยาง)"]
    },
    "doctor": {
        "การศึกษาดุษฎีบัณฑิต": ["การบริหารการศึกษา", "หลักสูตรและการสอน(กลุ่มวิชาการศึกษาปฐมวัย)", "หลักสูตรและการสอน(กลุ่มวิชาการศึกษาประถมศึกษา)", "หลักสูตรและการสอน(กลุ่มวิชาการศึกษามัธยมศึกษา)", "หลักสูตรและการสอน(กลุ่มวิชาการอุดมศึกษาและอาชีวศึกษา)", "พลศึกษาและการจัดการกีฬา(กลุ่มวิชาพลศึกษา)", "พลศึกษาและการจัดการกีฬา(กลุ่มวิชาจัดการกีฬา)", "พลศึกษาและการจัดการกีฬา(กลุ่มวิชาบูรณาการด้านพลศึกษาและการจัดการกีฬา)"],
        "ปรัชญาดุษฎีบัณฑิต": ["เทคโนโลยีและสื่อสารการศึกษา", "สื่อและวัฒนธรรมศึกษา", "การจัดการธุรกิจ", "รัฐประศาสนศาสตร์", "การพัฒนาที่ยั่งยืน", "เทคโนโลยีชีวภาพ", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาชีววิทยา)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาวิทยาศาสตร์สิ่งแวดล้อม)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาฟิสิกส์)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาคณิตศาสตร์)", "วิทยาศาสตร์และนวัตกรรม(กลุ่มวิชาวิทยาการคำนวณ)", "เคมีและนวัตกรรมเคมี", "วิทยาศาสตร์สุขภาพ", "อาชีวอนามัยและความปลอดภัย", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมพลังงาน)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมเครื่องกล)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมไฟฟ้า)", "วิศวกรรมศาสตร์(กลุ่มวิชาวิศวกรรมยาง)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาพืชศาสตร์)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาประมง)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาสัตวศาสตร์)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาส่งเสริมเกษตรและพัฒนาชุมชน)", "เกษตรศาสตร์สมัยใหม่(กลุ่มวิชาวิทยาศาสตร์อาหาร)"],
        "นิติศาสตรดุษฎีบัณฑิต": ["นิติศาสตร์"],
        "สาธารณสุขศาสตรดุษฎีบัณฑิต": ["สาธารณสุขศาสตร์(กลุ่มวิชาวิทยาการระบาดและชีวสถิติ)", "สาธารณสุขศาสตร์(กลุ่มวิชาการส่งเสริมสุขภาพ)", "สาธารณสุขศาสตร์(กลุ่มวิชาเศรษฐศาสตร์สุขภาพ)", "สาธารณสุขศาสตร์(กลุ่มวิชาบริหารสาธารณสุข)"]
    }
};

function updateProgramList() {
    const degreeRadio = document.querySelector('input[name="degreeLevel"]:checked');
    if (!degreeRadio) return;
    const degreeVal = degreeRadio.value;
    
    const p1Program = document.getElementById('p1_program');
    const p2Program = document.getElementById('p2_program');
    const p1Major = document.getElementById('p1_major');
    const p2Major = document.getElementById('p2_major');

    if (!p1Program) return;

    p1Program.innerHTML = '<option value="">-- เลือกหลักสูตร --</option>';
    p2Program.innerHTML = '<option value="">-- เลือกหลักสูตร --</option>';
    p1Major.innerHTML = '<option value="">-- เลือกสาขาวิชา --</option>';
    p2Major.innerHTML = '<option value="">-- เลือกสาขาวิชา --</option>';

    // 🌟 เคลียร์ตัวอักษรกล่องโชว์จำลอง
    ['p1_program', 'p2_program', 'p1_major', 'p2_major'].forEach(id => {
        const disp = document.getElementById(id + '_display');
        if(disp) disp.innerText = '-- เลือก --';
    });

    if (academicData[degreeVal]) {
        const programs = Object.keys(academicData[degreeVal]);
        programs.forEach(p => {
            p1Program.add(new Option(p, p));
            p2Program.add(new Option(p, p));
        });
    }
}

function handleProgramInput(event) {
    const degreeVal = document.querySelector('input[name="degreeLevel"]:checked').value;
    const selectedProg = event.target.value;
    
    // 🌟 ส่งค่าหลักสูตรไปให้กล่องจำลองโชว์ผลบนจอ
    const disp = document.getElementById(event.target.id + '_display');
    if(disp) disp.innerText = selectedProg || '-- เลือก --';
    
    const isP1 = event.target.id === 'p1_program';
    const majorSelectId = isP1 ? 'p1_major' : 'p2_major';
    const majorSelect = document.getElementById(majorSelectId);
    
    if (!majorSelect) return;
    
    majorSelect.innerHTML = '<option value="">-- เลือกสาขาวิชา --</option>';
    
    // เคลียร์ค่าสาขาในกล่องจำลอง
    const majorDisp = document.getElementById(majorSelectId + '_display');
    if(majorDisp) majorDisp.innerText = '-- เลือก --';
    
    if (degreeVal && selectedProg && academicData[degreeVal][selectedProg]) {
        const majors = academicData[degreeVal][selectedProg];
        majors.forEach(m => {
            majorSelect.add(new Option(m, m));
        });
    }

    // 🌟 ส่งค่าสาขาวิชาไปให้กล่องจำลองโชว์ผลบนจอเวลามีการเลือกใหม่
    majorSelect.onchange = function() {
        if(majorDisp) majorDisp.innerText = this.value || '-- เลือก --';
    };
}

// 🌟 Custom UI for Major Selection (Single Click = Dropdown, Double Click = Edit)
function setupSmartMajor(id) {
    const display = document.getElementById(id + '_display');
    const select = document.getElementById(id);
    if (!display || !select) return;

    let clickTimeout;
    
    display.addEventListener('click', function(e) {
        if (display.isContentEditable) return; 
        
        if (clickTimeout) clearTimeout(clickTimeout);
        clickTimeout = setTimeout(() => {
            // Remove any existing dropdowns
            document.querySelectorAll('.custom-dropdown').forEach(el => el.remove());
            
            const rect = display.getBoundingClientRect();
            const dropdown = document.createElement('div');
            dropdown.className = 'custom-dropdown';
            dropdown.style.position = 'absolute';
            dropdown.style.top = (rect.bottom + window.scrollY - 1) + 'px'; // ขยับขึ้นนิดนึงให้ชิดกรอบ
            dropdown.style.left = (rect.left + window.scrollX) + 'px';
            dropdown.style.backgroundColor = '#fff';
            dropdown.style.border = '1px solid #767676';
            dropdown.style.boxShadow = '2px 2px 4px rgba(0,0,0,0.1)';
            dropdown.style.zIndex = '1000';
            dropdown.style.maxHeight = '250px';
            dropdown.style.overflowY = 'auto';
            dropdown.style.minWidth = Math.max(180, rect.width) + 'px';
            dropdown.style.fontFamily = "'TH SarabunPSK', 'TH Sarabun New', sans-serif";
            dropdown.style.textAlign = 'left';
            dropdown.style.padding = '1px 0'; // ขอบบนล่างนิดเดียวแบบ native
            
            if (select.options.length <= 1) {
                const noItem = document.createElement('div');
                noItem.innerText = '-- กรุณาเลือกหลักสูตรก่อน --';
                noItem.style.padding = '2px 8px';
                noItem.style.fontSize = '22px';
                noItem.style.color = '#999';
                noItem.style.cursor = 'default';
                dropdown.appendChild(noItem);
            } else {
                Array.from(select.options).forEach(opt => {
                    const item = document.createElement('div');
                    item.innerText = opt.text;
                    item.style.padding = '1px 6px'; // แพดดิ้งแคบๆ แบบ native
                    item.style.cursor = 'default'; // ใช้ลูกศรปกติ ไม่ใช่รูปมือ
                    item.style.fontSize = '22px';
                    item.style.color = '#000';
                    item.style.lineHeight = '24px';
                    
                    item.onmouseenter = () => {
                        item.style.backgroundColor = '#1a73e8'; // สีน้ำเงินแบบ Chrome Native
                        item.style.color = '#fff';
                    };
                    item.onmouseleave = () => {
                        item.style.backgroundColor = 'transparent';
                        item.style.color = '#000';
                    };
                    item.onclick = (ev) => {
                        ev.stopPropagation();
                        select.value = opt.value;
                        display.innerText = opt.value ? opt.text : '-- เลือก --';
                        dropdown.remove();
                    };
                    dropdown.appendChild(item);
                });
            }
            
            document.body.appendChild(dropdown);
            
            setTimeout(() => {
                document.addEventListener('click', function closeDropdown(ev) {
                    if (!dropdown.contains(ev.target)) {
                        dropdown.remove();
                        document.removeEventListener('click', closeDropdown);
                    }
                });
            }, 10);
        }, 200); 
    });

    display.addEventListener('dblclick', function(e) {
        if (clickTimeout) clearTimeout(clickTimeout);
        document.querySelectorAll('.custom-dropdown').forEach(el => el.remove());
        
        display.contentEditable = "true";
        display.focus();
        
        // Move cursor to the end
        if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
            const range = document.createRange();
            range.selectNodeContents(display);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    });
    
    display.addEventListener('blur', function() {
        display.contentEditable = "false";
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupSmartMajor('p1_major');
    setupSmartMajor('p2_major');
    initCustomJustify();
    applyCustomJustify();
});

// ===== Custom Justify Algorithm (Word-like) =====
function segmentThai(text) {
    if (window.Intl && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
        return Array.from(segmenter.segment(text)).map(s => s.segment);
    }
    const words = [];
    text.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (part.trim().length === 0) {
            words.push(part);
        } else {
            let currentWord = "";
            for (let i = 0; i < part.length; i++) {
                currentWord += part[i];
                if (currentWord.length >= 4 && !part[i].match(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/)) {
                    words.push(currentWord);
                    currentWord = "";
                }
            }
            if (currentWord.length > 0) words.push(currentWord);
        }
    });
    return words;
}

function initCustomJustify() {
    const containers = [
        document.getElementById('p1_main_para'),
        document.getElementById('p1_post_para'),
        document.getElementById('p2_main_para'),
        document.getElementById('p2_post_para')
    ];

    containers.forEach(container => {
        if (!container) return;
        
        // Remove old chunks if any (for re-init)
        const chunks = container.querySelectorAll('.thai-chunk');
        chunks.forEach(c => {
            const txt = document.createTextNode(c.textContent);
            container.replaceChild(txt, c);
        });
        
        const nodes = Array.from(container.childNodes);
        nodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                if (text.length > 0) {
                    const words = segmentThai(text);
                    const fragment = document.createDocumentFragment();
                    words.forEach(word => {
                        const span = document.createElement('span');
                        span.className = 'thai-word';
                        span.textContent = word;
                        fragment.appendChild(span);
                    });
                    container.replaceChild(fragment, node);
                }
            }
        });
    });
}

function applyCustomJustify() {
    const containers = [
        document.getElementById('p1_main_para'),
        document.getElementById('p1_post_para'),
        document.getElementById('p2_main_para'),
        document.getElementById('p2_post_para')
    ];

    containers.forEach(container => {
        if (!container) return;
        
        // 1. Reset styles
        container.style.textAlign = 'left';
        
        // reset margins on ALL children
        Array.from(container.children).forEach(el => {
            if (el.style) el.style.marginRight = '0px';
        });

        // Force reflow
        void container.offsetHeight;

        // 2. Group elements by line
        const lines = [];
        let currentLine = [];
        let currentTop = null;
        const containerRect = container.getBoundingClientRect();

        Array.from(container.children).forEach(el => {
            if (el.style.display === 'none' || el.classList.contains('ghost-anchor') || el.style.opacity === '0') return;
            
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;

            const midY = rect.top + rect.height / 2;

            if (currentTop === null) {
                currentTop = midY;
                currentLine.push({ el, rect });
            } else {
                if (Math.abs(midY - currentTop) < 15) {
                    currentLine.push({ el, rect });
                } else {
                    lines.push(currentLine);
                    currentLine = [{ el, rect }];
                    currentTop = midY;
                }
            }
        });
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }

        // 3. Distribute remaining space per line (except last line)
        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];
            if (line.length === 0) continue;

            const firstEl = line[0].el.getBoundingClientRect();
            const lastEl = line[line.length - 1].el.getBoundingClientRect();
            const lineWidth = lastEl.right - firstEl.left;
            
            const gap = containerRect.width - lineWidth - 1.5; // safety margin

            if (gap > 0 && gap < containerRect.width * 0.4) {
                // filter out indent spans (typically the very first element if it has inline width and no class)
                let stretchable = line.filter((item, index) => {
                    if (index === 0 && item.el.tagName === 'SPAN' && item.el.style.width && !item.el.className) {
                        return false;
                    }
                    return true;
                });

                if (stretchable.length > 1) {
                    // Do not apply margin to the last element of the line
                    const applyTo = stretchable.slice(0, stretchable.length - 1);
                    const spacePerItem = gap / applyTo.length;
                    
                    applyTo.forEach(item => {
                        item.el.style.marginRight = spacePerItem + 'px';
                    });
                }
            }
        }
    });
}