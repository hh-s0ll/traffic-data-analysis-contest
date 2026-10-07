// 공모전 분석보고서 Word 제출본 생성
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, AlignmentType,
  WidthType, BorderStyle, ShadingType, HeadingLevel, LevelFormat, Footer, PageNumber, VerticalAlign,
  PageBreak, TableLayoutType,
} = require('docx');

const ROOT = path.join(__dirname, '..');  // 저장소 최상위 (어느 PC에서든 동작)
const FIG = `${ROOT}/analysis/output/figures/`;
const OUT = `${ROOT}/report/팀명_분석보고서.docx`;

const FONT = '맑은 고딕';
const C = { forest: '1F5D3C', mist: 'EAF2EC', line: 'B9CBBE', ink: '14231B', muted: '45554C', clay: 'B4531F', sand: 'F7F1E6' };
const PAGE_W = 11906, MARGIN = 1080, CW = PAGE_W - MARGIN * 2; // A4, 여백 1.9cm, 본문 폭 9746 DXA
const SZ = 18; // 본문 9pt

// ---------- 도우미 ----------
const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? SZ, bold: o.bold, color: o.color, italics: o.italics, highlight: o.hl ? 'yellow' : undefined });

/** "**굵게**", "[[채울 칸]]" 표기를 TextRun 으로 */
function rich(text, o = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(run(text.slice(last, m.index), o));
    const t = m[0];
    if (t.startsWith('**')) out.push(run(t.slice(2, -2), { ...o, bold: true }));
    else out.push(run(t.slice(2, -2), { ...o, hl: true }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(run(text.slice(last), o));
  return out;
}

const p = (text, o = {}) => new Paragraph({
  children: rich(text, o), alignment: o.align ?? AlignmentType.JUSTIFIED,
  spacing: { before: o.before ?? 0, after: o.after ?? 50, line: o.line ?? 262 }, indent: o.indent,
});
const bullet = (text, level = 0) => new Paragraph({
  children: rich(text), numbering: { reference: 'bul', level }, alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 24, line: 256 },
});

function h1(num, text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 90 }, keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.forest, space: 3 } },
    children: [run(`${num}. `, { size: 24, bold: true, color: C.forest }), run(text, { size: 24, bold: true, color: C.forest })],
  });
}
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 110, after: 50 }, keepNext: true,
  children: [run(text, { size: 20, bold: true, color: C.ink })],
});

const border = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function cell(content, w, o = {}) {
  const paras = (Array.isArray(content) ? content : [content]).map((c) =>
    c instanceof Paragraph ? c : new Paragraph({
      children: rich(String(c), { size: o.size ?? 17, bold: o.bold, color: o.color }),
      alignment: o.align ?? AlignmentType.LEFT, spacing: { after: 0, line: 260 }, keepNext: o.keepNext,
    }));
  return new TableCell({
    children: paras, width: { size: w, type: WidthType.DXA }, borders: o.borders ?? borders,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 50, bottom: 50, left: 90, right: 90 }, verticalAlign: o.valign ?? VerticalAlign.CENTER,
    columnSpan: o.span,
  });
}

/** rows[0] 은 머리행. widths 는 비율 */
function table(rows, ratios, o = {}) {
  const sum = ratios.reduce((a, b) => a + b, 0);
  const widths = ratios.map((r) => Math.round((CW * r) / sum));
  widths[widths.length - 1] += CW - widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0, cantSplit: true,
      children: r.map((c, j) => cell(c, widths[j], {
        fill: i === 0 ? C.mist : (o.firstColFill && j === 0 ? 'F6F9F7' : undefined),
        bold: i === 0 || (o.firstColBold && j === 0), size: o.size, align: i === 0 ? AlignmentType.CENTER : (o.align?.[j]),
        keepNext: o.keep !== false && i < rows.length - 1,
      })),
    })),
  });
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
function image(file, widthCm) {
  const [w, h] = pngSize(FIG + file);
  const wpx = Math.round(widthCm * 37.8);
  return new ImageRun({ type: 'png', data: fs.readFileSync(FIG + file), transformation: { width: wpx, height: Math.round((wpx * h) / w) } });
}
const figure = (file, widthCm, caption) => [
  new Paragraph({ children: [image(file, widthCm)], alignment: AlignmentType.CENTER, spacing: { before: 80, after: 30 }, keepNext: true }),
  new Paragraph({ children: [run(caption, { size: 16, color: C.muted })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
];
function figurePair(f1, f2, cap1, cap2, widthCm) {
  const half = Math.floor(CW / 2);
  const mk = (f, cap, w) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: noBorders,
    children: [
      new Paragraph({ children: [image(f, widthCm)], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [run(cap, { size: 16, color: C.muted })], alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
    ],
  });
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [half, CW - half], layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: [mk(f1, cap1, half), mk(f2, cap2, CW - half)] })],
  });
}
/** 계산식 상자: 테두리와 옅은 배경을 가진 문단 */
const boxLine = (text, first, last) => new Paragraph({
  children: rich(text, { size: 18 }), alignment: AlignmentType.LEFT,
  shading: { fill: 'F4F8F5', type: ShadingType.CLEAR, color: 'auto' },
  border: {
    left: { style: BorderStyle.SINGLE, size: 18, color: C.leaf ?? '3F8F5F', space: 6 },
    top: first ? { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } : undefined,
    bottom: last ? { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } : undefined,
    right: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 6 },
  },
  spacing: { after: 0, line: 280 }, indent: { left: 120, right: 120 },
});
const box = (lines) => [...lines.map((l, i) => boxLine(l, i === 0, i === lines.length - 1)), new Paragraph({ children: [], spacing: { after: 60 } })];

// ---------- 내용 (content.js) ----------
/** 표 제목: 표 위에 두고 다음 표와 같은 쪽에 붙인다 */
const caption = (text) => new Paragraph({ children: [run(text, { size: 16, color: C.muted, bold: true })], alignment: AlignmentType.LEFT, keepNext: true, spacing: { before: 100, after: 40 } });
const { cover, body } = require(require('path').join(__dirname,'content.js'))({ p, bullet, h1, h2, table, figure, figurePair, box, caption, AlignmentType, C, run, Paragraph, PageBreak, rich, cell, Table, TableRow, TableCell, WidthType, TableLayoutType, borders, CW });

// ---------- 문서 ----------
const doc = new Document({
  creator: '[팀명]', title: '분석보고서',
  styles: {
    default: { document: { run: { font: FONT, size: SZ } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: C.forest }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 21, bold: true }, paragraph: { outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }] }] },
  sections: [
    { properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1134, bottom: 1134, left: MARGIN, right: MARGIN } } }, children: cover },
    {
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1020, bottom: 1020, left: MARGIN, right: MARGIN }, pageNumbers: { start: 1 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: C.muted })] })] }) },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('written', OUT, Math.round(buf.length / 1024), 'KB');
});
